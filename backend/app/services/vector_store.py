"""FAISS-backed vector store with local persistence and chunk-id mapping."""

from __future__ import annotations

import json
import logging
import pickle
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np

from app.core.config import Settings
from app.core.exceptions import AppError

try:
    import faiss  # type: ignore
except ImportError:  # pragma: no cover
    faiss = None

try:
    from rank_bm25 import BM25Okapi  # type: ignore
except ImportError:  # pragma: no cover
    BM25Okapi = None

logger = logging.getLogger(__name__)


@dataclass
class VectorSearchHit:
    chunk_id: str
    score: float
    faiss_id: int


@dataclass
class _WorkspaceIndex:
    workspace_id: str
    chunk_ids: list[str]
    index: "faiss.IndexFlatIP"
    # Raw tokenised corpus kept in sync with chunk_ids so BM25 can be rebuilt.
    corpus: list[list[str]] = field(default_factory=list)


class FaissVectorStore:
    """
    Per-workspace FAISS indexes persisted on disk.

    Mapping: FAISS internal id (0..n-1) <-> PostgreSQL document_chunks.id (UUID string).
    """

    def __init__(self, settings: Settings):
        if faiss is None:
            raise AppError(
                500,
                "faiss_not_available",
                "FAISS is not installed on the server.",
            )
        self.settings = settings
        self.dimension = settings.embedding_dimension
        self.base_dir = Path(settings.faiss_data_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)
        self._indexes: dict[str, _WorkspaceIndex] = {}
        self._bm25_indexes: dict[str, "BM25Okapi | None"] = {}

    def validate_dimensions(self) -> None:
        for index_path in self.base_dir.glob("*.index"):
            index = faiss.read_index(str(index_path))
            if index.d != self.dimension:
                workspace_id = index_path.stem
                logger.warning(
                    "FAISS index '%s' has dimension %d but embedding_dimension is %d — "
                    "purging stale index so workspace can be re-indexed.",
                    index_path.name,
                    index.d,
                    self.dimension,
                )
                self._delete_persisted(workspace_id)

    def add_embeddings(
        self,
        workspace_id: str,
        chunk_ids: list[str],
        embeddings: list[list[float]],
        chunk_texts: list[str] | None = None,
    ) -> None:
        if len(chunk_ids) != len(embeddings):
            raise AppError(
                400,
                "embedding_chunk_mismatch",
                "chunk_ids and embeddings must have the same length.",
            )
        if chunk_texts is not None and len(chunk_texts) != len(chunk_ids):
            raise AppError(
                400,
                "embedding_chunk_mismatch",
                "chunk_texts and chunk_ids must have the same length.",
            )
        if not chunk_ids:
            return

        workspace_index = self._load_workspace(workspace_id)
        matrix = _to_matrix(embeddings)
        workspace_index.index.add(matrix)
        workspace_index.chunk_ids.extend(chunk_ids)

        if chunk_texts is not None:
            workspace_index.corpus.extend(
                [tok for tok in [text.lower().split() for text in chunk_texts]]
            )

        self._persist(workspace_index)
        self._rebuild_bm25(workspace_id, workspace_index)

    def search(
        self,
        workspace_id: str,
        query_embedding: list[float],
        top_k: int,
    ) -> list[VectorSearchHit]:
        workspace_index = self._load_workspace(workspace_id)
        if not workspace_index.chunk_ids:
            return []

        query = _to_matrix([query_embedding])
        limit = min(top_k, len(workspace_index.chunk_ids))
        scores, positions = workspace_index.index.search(query, limit)

        hits: list[VectorSearchHit] = []
        for score, position in zip(scores[0], positions[0]):
            if position < 0:
                continue
            faiss_id = int(position)
            hits.append(
                VectorSearchHit(
                    chunk_id=workspace_index.chunk_ids[faiss_id],
                    score=float(score),
                    faiss_id=faiss_id,
                )
            )
        return hits

    def hybrid_search(
        self,
        workspace_id: str,
        query: str,
        top_k: int = 5,
        query_embedding: "list[float] | None" = None,
        db: "Session | None" = None,
    ) -> list[str]:
        """Hybrid BM25 + vector search using Reciprocal Rank Fusion (RRF).

        Parameters
        ----------
        workspace_id:
            Target workspace.
        query:
            Raw query string (used for BM25 tokenisation).
        top_k:
            Number of results to return.
        query_embedding:
            Pre-computed query embedding for FAISS vector search.  When *None*
            the method falls back to pure BM25 (if available) or returns [].
        db:
            SQLAlchemy session used to fetch chunk texts by ID.  Required when
            the workspace corpus is empty (texts are loaded from the DB).
            Optional when all chunk texts are already stored in the corpus.
        """
        from uuid import UUID

        workspace_index = self._load_workspace(workspace_id)

        # --- Guard: empty index -------------------------------------------
        if not workspace_index.chunk_ids:
            return []

        chunk_ids = workspace_index.chunk_ids  # positional list

        # ------------------------------------------------------------------
        # 1. Vector search – top-50 chunk_ids ranked by cosine similarity
        # ------------------------------------------------------------------
        vector_ranking: list[str] = []  # ordered chunk_ids, best first
        if query_embedding is not None:
            hits = self.search(
                workspace_id=workspace_id,
                query_embedding=query_embedding,
                top_k=50,
            )
            vector_ranking = [hit.chunk_id for hit in hits]

        # ------------------------------------------------------------------
        # 2. BM25 search – top-50 chunk_ids ranked by BM25Okapi score
        # ------------------------------------------------------------------
        bm25_ranking: list[str] = []
        bm25 = self._bm25_indexes.get(workspace_id)
        if bm25 is not None:
            tokens = query.lower().split()
            scores = bm25.get_scores(tokens)
            top_indices = np.argsort(scores)[::-1][:50]
            bm25_ranking = [chunk_ids[i] for i in top_indices if scores[i] > 0]

        # ------------------------------------------------------------------
        # Fallback: no BM25 index → pure vector search
        # ------------------------------------------------------------------
        if not bm25_ranking:
            if not vector_ranking:
                return []
            # Return texts for whatever vector search found (up to top_k).
            selected_ids = vector_ranking[:top_k]
            return self._fetch_texts(selected_ids, workspace_index, db)

        # Fallback: no vector embedding supplied → pure BM25
        if not vector_ranking:
            selected_ids = bm25_ranking[:top_k]
            return self._fetch_texts(selected_ids, workspace_index, db)

        # ------------------------------------------------------------------
        # 3. Reciprocal Rank Fusion (RRF) with k=60
        # ------------------------------------------------------------------
        RRF_K = 60
        combined: dict[str, float] = {}

        for rank, chunk_id in enumerate(vector_ranking):
            combined[chunk_id] = combined.get(chunk_id, 0.0) + 1.0 / (rank + RRF_K)

        for rank, chunk_id in enumerate(bm25_ranking):
            combined[chunk_id] = combined.get(chunk_id, 0.0) + 1.0 / (rank + RRF_K)

        # ------------------------------------------------------------------
        # 4. Sort by RRF score descending, take top_k
        # ------------------------------------------------------------------
        ranked_ids = sorted(combined, key=lambda cid: combined[cid], reverse=True)[:top_k]

        # ------------------------------------------------------------------
        # 5. Fetch chunk texts and return
        # ------------------------------------------------------------------
        return self._fetch_texts(ranked_ids, workspace_index, db)

    def _fetch_texts(
        self,
        chunk_ids: list[str],
        workspace_index: "_WorkspaceIndex",
        db: "Session | None",
    ) -> list[str]:
        """Return text strings for the given chunk IDs.

        Tries the in-memory corpus first (fast path); falls back to DB lookup
        when corpus entries are missing or the corpus is empty.
        """
        # Build a position map: chunk_id → corpus index
        pos_map = {cid: i for i, cid in enumerate(workspace_index.chunk_ids)}
        corpus_len = len(workspace_index.corpus)

        texts: list[str] = []
        missing_ids: list[str] = []

        for cid in chunk_ids:
            idx = pos_map.get(cid)
            if idx is not None and idx < corpus_len:
                # Corpus stores tokenised lists; re-join to plain text.
                texts.append(" ".join(workspace_index.corpus[idx]))
            else:
                texts.append(None)  # placeholder
                missing_ids.append(cid)

        # DB lookup for any that were not in the corpus ----------------------
        if missing_ids and db is not None:
            from uuid import UUID
            from app.crud import document as document_crud

            try:
                uuid_ids = [UUID(cid) for cid in missing_ids]
                db_chunks = document_crud.get_chunks_by_ids(db, uuid_ids)
                db_text_map = {str(chunk.id): chunk.text for chunk in db_chunks}
            except Exception:
                logger.warning("hybrid_search: DB lookup for chunk texts failed")
                db_text_map = {}

            # Fill placeholders
            missing_iter = iter(missing_ids)
            texts = [
                db_text_map.get(next(missing_iter), "") if t is None else t
                for t in texts
            ]
        else:
            # No DB available – drop placeholders
            texts = [t for t in texts if t is not None]

        return texts

    def remove_embeddings(
        self,
        workspace_id: str,
        chunk_ids_to_remove: list[str],
    ) -> None:
        """Remove specific chunk IDs from the FAISS index by rebuilding without them."""
        if not chunk_ids_to_remove:
            return
        workspace_index = self._load_workspace(workspace_id)
        remove_set = set(chunk_ids_to_remove)
        kept_positions = [
            i for i, cid in enumerate(workspace_index.chunk_ids) if cid not in remove_set
        ]
        kept_ids = [workspace_index.chunk_ids[i] for i in kept_positions]
        # Keep corpus aligned with chunk_ids (corpus may be shorter if texts were not
        # provided during earlier add_embeddings calls, so guard with len check).
        corpus_len = len(workspace_index.corpus)
        kept_corpus = [
            workspace_index.corpus[i]
            for i in kept_positions
            if i < corpus_len
        ]
        if not kept_positions:
            workspace_index.chunk_ids = []
            workspace_index.corpus = []
            workspace_index.index = faiss.IndexFlatIP(self.dimension)
        else:
            vecs = np.zeros((len(kept_positions), self.dimension), dtype="float32")
            for new_pos, old_pos in enumerate(kept_positions):
                workspace_index.index.reconstruct(old_pos, vecs[new_pos])
            new_index = faiss.IndexFlatIP(self.dimension)
            new_index.add(vecs)
            workspace_index.index = new_index
            workspace_index.chunk_ids = kept_ids
            workspace_index.corpus = kept_corpus
        self._persist(workspace_index)
        self._rebuild_bm25(workspace_id, workspace_index)

    def rebuild_workspace_index(
        self,
        workspace_id: str,
        chunk_ids: list[str],
        embeddings: list[list[float]],
        chunk_texts: list[str] | None = None,
    ) -> None:
        """Replace the workspace index with a full rebuild from database state."""
        if len(chunk_ids) != len(embeddings):
            raise AppError(
                400,
                "embedding_chunk_mismatch",
                "chunk_ids and embeddings must have the same length.",
            )
        if chunk_texts is not None and len(chunk_texts) != len(chunk_ids):
            raise AppError(
                400,
                "embedding_chunk_mismatch",
                "chunk_texts and chunk_ids must have the same length.",
            )

        if not chunk_ids:
            self._indexes.pop(workspace_id, None)
            self._bm25_indexes[workspace_id] = None
            self._delete_persisted(workspace_id)
            return

        corpus = (
            [text.lower().split() for text in chunk_texts]
            if chunk_texts is not None
            else []
        )
        index = faiss.IndexFlatIP(self.dimension)
        matrix = _to_matrix(embeddings)
        index.add(matrix)
        workspace_index = _WorkspaceIndex(
            workspace_id=workspace_id,
            chunk_ids=list(chunk_ids),
            index=index,
            corpus=corpus,
        )
        self._indexes[workspace_id] = workspace_index
        self._persist(workspace_index)
        self._rebuild_bm25(workspace_id, workspace_index)

    def _load_workspace(self, workspace_id: str) -> _WorkspaceIndex:
        if workspace_id in self._indexes:
            return self._indexes[workspace_id]

        index_path = self._index_path(workspace_id)
        mapping_path = self._mapping_path(workspace_id)
        if index_path.exists() and mapping_path.exists():
            index = faiss.read_index(str(index_path))
            if index.d != self.dimension:
                raise AppError(
                    500,
                    "faiss_dimension_mismatch",
                    (
                        f"FAISS index for workspace {workspace_id} has dimension {index.d}, "
                        f"but Settings.embedding_dimension is {self.dimension}."
                    ),
                )
            mapping = json.loads(mapping_path.read_text(encoding="utf-8"))
            chunk_ids = mapping.get("chunk_ids", [])
            corpus = mapping.get("corpus", [])
            workspace_index = _WorkspaceIndex(
                workspace_id=workspace_id,
                chunk_ids=chunk_ids,
                index=index,
                corpus=corpus,
            )
            self._indexes[workspace_id] = workspace_index

            # Load BM25 pickle if it exists.
            bm25_path = self._bm25_path(workspace_id)
            if bm25_path.exists() and BM25Okapi is not None:
                try:
                    with bm25_path.open("rb") as fh:
                        self._bm25_indexes[workspace_id] = pickle.load(fh)
                except Exception:
                    logger.warning(
                        "Failed to load BM25 index for workspace %s; will be rebuilt on next write.",
                        workspace_id,
                    )
                    self._bm25_indexes[workspace_id] = None
            else:
                self._bm25_indexes[workspace_id] = None

            return workspace_index

        workspace_index = _WorkspaceIndex(
            workspace_id=workspace_id,
            chunk_ids=[],
            index=faiss.IndexFlatIP(self.dimension),
        )
        self._indexes[workspace_id] = workspace_index
        return workspace_index

    def _persist(self, workspace_index: _WorkspaceIndex) -> None:
        index_path = self._index_path(workspace_index.workspace_id)
        mapping_path = self._mapping_path(workspace_index.workspace_id)
        faiss.write_index(workspace_index.index, str(index_path))
        mapping_path.write_text(
            json.dumps(
                {
                    "chunk_ids": workspace_index.chunk_ids,
                    "corpus": workspace_index.corpus,
                },
                indent=2,
            ),
            encoding="utf-8",
        )
        logger.info(
            "Persisted FAISS index for workspace %s (%d vectors)",
            workspace_index.workspace_id,
            len(workspace_index.chunk_ids),
        )

    def _delete_persisted(self, workspace_id: str) -> None:
        index_path = self._index_path(workspace_id)
        mapping_path = self._mapping_path(workspace_id)
        bm25_path = self._bm25_path(workspace_id)
        if index_path.exists():
            index_path.unlink()
        if mapping_path.exists():
            mapping_path.unlink()
        if bm25_path.exists():
            bm25_path.unlink()

    def _rebuild_bm25(self, workspace_id: str, workspace_index: _WorkspaceIndex) -> None:
        """Build (or clear) the BM25 index for a workspace and persist it to disk."""
        if BM25Okapi is None:
            return
        if not workspace_index.corpus:
            self._bm25_indexes[workspace_id] = None
            bm25_path = self._bm25_path(workspace_id)
            if bm25_path.exists():
                bm25_path.unlink()
            return

        bm25 = BM25Okapi(workspace_index.corpus)
        self._bm25_indexes[workspace_id] = bm25
        bm25_path = self._bm25_path(workspace_id)
        with bm25_path.open("wb") as fh:
            pickle.dump(bm25, fh)
        logger.info(
            "Persisted BM25 index for workspace %s (%d docs)",
            workspace_id,
            len(workspace_index.corpus),
        )

    def _index_path(self, workspace_id: str) -> Path:
        return self.base_dir / f"{workspace_id}.index"

    def _mapping_path(self, workspace_id: str) -> Path:
        return self.base_dir / f"{workspace_id}.mapping.json"

    def _bm25_path(self, workspace_id: str) -> Path:
        return self.base_dir / f"bm25_{workspace_id}.pkl"


def _to_matrix(embeddings: list[list[float]]) -> np.ndarray:
    matrix = np.asarray(embeddings, dtype="float32")
    if matrix.ndim != 2:
        raise AppError(500, "invalid_embedding_shape", "Embeddings must be a 2D matrix.")
    faiss.normalize_L2(matrix)
    return matrix
