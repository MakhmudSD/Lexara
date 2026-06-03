"""FAISS-backed vector store with local persistence and chunk-id mapping."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from app.core.config import Settings
from app.core.exceptions import AppError

try:
    import faiss  # type: ignore
except ImportError:  # pragma: no cover
    faiss = None

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
    ) -> None:
        if len(chunk_ids) != len(embeddings):
            raise AppError(
                400,
                "embedding_chunk_mismatch",
                "chunk_ids and embeddings must have the same length.",
            )
        if not chunk_ids:
            return

        workspace_index = self._load_workspace(workspace_id)
        matrix = _to_matrix(embeddings)
        workspace_index.index.add(matrix)
        workspace_index.chunk_ids.extend(chunk_ids)
        self._persist(workspace_index)

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
        if not kept_positions:
            workspace_index.chunk_ids = []
            workspace_index.index = faiss.IndexFlatIP(self.dimension)
        else:
            vecs = np.zeros((len(kept_positions), self.dimension), dtype="float32")
            for new_pos, old_pos in enumerate(kept_positions):
                workspace_index.index.reconstruct(old_pos, vecs[new_pos])
            new_index = faiss.IndexFlatIP(self.dimension)
            new_index.add(vecs)
            workspace_index.index = new_index
            workspace_index.chunk_ids = kept_ids
        self._persist(workspace_index)

    def rebuild_workspace_index(
        self,
        workspace_id: str,
        chunk_ids: list[str],
        embeddings: list[list[float]],
    ) -> None:
        """Replace the workspace index with a full rebuild from database state."""
        if len(chunk_ids) != len(embeddings):
            raise AppError(
                400,
                "embedding_chunk_mismatch",
                "chunk_ids and embeddings must have the same length.",
            )

        if not chunk_ids:
            self._indexes.pop(workspace_id, None)
            self._delete_persisted(workspace_id)
            return

        index = faiss.IndexFlatIP(self.dimension)
        matrix = _to_matrix(embeddings)
        index.add(matrix)
        workspace_index = _WorkspaceIndex(
            workspace_id=workspace_id,
            chunk_ids=list(chunk_ids),
            index=index,
        )
        self._indexes[workspace_id] = workspace_index
        self._persist(workspace_index)

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
            workspace_index = _WorkspaceIndex(
                workspace_id=workspace_id,
                chunk_ids=chunk_ids,
                index=index,
            )
            self._indexes[workspace_id] = workspace_index
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
            json.dumps({"chunk_ids": workspace_index.chunk_ids}, indent=2),
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
        if index_path.exists():
            index_path.unlink()
        if mapping_path.exists():
            mapping_path.unlink()

    def _index_path(self, workspace_id: str) -> Path:
        return self.base_dir / f"{workspace_id}.index"

    def _mapping_path(self, workspace_id: str) -> Path:
        return self.base_dir / f"{workspace_id}.mapping.json"


def _to_matrix(embeddings: list[list[float]]) -> np.ndarray:
    matrix = np.asarray(embeddings, dtype="float32")
    if matrix.ndim != 2:
        raise AppError(500, "invalid_embedding_shape", "Embeddings must be a 2D matrix.")
    faiss.normalize_L2(matrix)
    return matrix
