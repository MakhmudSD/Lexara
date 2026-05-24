from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from app.storage.base import DocumentStore
from app.storage.models import DocumentChunk, DocumentMetadata, DocumentRecord


class SQLiteDocumentStore(DocumentStore):
    def __init__(self, database_path: str):
        self.database_path = database_path
        Path(database_path).parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.database_path, check_same_thread=False)
        connection.row_factory = sqlite3.Row
        return connection

    def _initialize(self) -> None:
        with self._connect() as connection:
            connection.executescript(
                """
                PRAGMA journal_mode=WAL;
                PRAGMA foreign_keys=ON;

                CREATE TABLE IF NOT EXISTS documents (
                    document_id TEXT PRIMARY KEY,
                    filename TEXT NOT NULL,
                    content_type TEXT NOT NULL,
                    raw_text TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    file_size INTEGER NOT NULL,
                    user_id TEXT NULL,
                    workspace_id TEXT NULL
                );

                CREATE TABLE IF NOT EXISTS chunks (
                    chunk_id TEXT PRIMARY KEY,
                    document_id TEXT NOT NULL,
                    workspace_id TEXT NOT NULL,
                    text TEXT NOT NULL,
                    embedding TEXT NOT NULL,
                    index_position INTEGER NOT NULL,
                    FOREIGN KEY(document_id) REFERENCES documents(document_id) ON DELETE CASCADE
                );
                """
            )
            self._ensure_column(connection, "documents", "workspace_id", "TEXT NULL")
            self._ensure_column(connection, "chunks", "workspace_id", "TEXT NOT NULL DEFAULT ''")
            connection.execute(
                """
                UPDATE chunks
                SET workspace_id = COALESCE(
                    (SELECT d.workspace_id FROM documents d WHERE d.document_id = chunks.document_id),
                    workspace_id
                )
                WHERE workspace_id = ''
                """
            )
            connection.executescript(
                """
                CREATE INDEX IF NOT EXISTS idx_documents_user_id
                ON documents(user_id);

                CREATE INDEX IF NOT EXISTS idx_documents_workspace_id
                ON documents(workspace_id);

                CREATE INDEX IF NOT EXISTS idx_chunks_document_id
                ON chunks(document_id, index_position);

                CREATE INDEX IF NOT EXISTS idx_chunks_workspace_id
                ON chunks(workspace_id, index_position);
                """
            )

    def save_document(self, document: DocumentRecord) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                INSERT OR REPLACE INTO documents (
                    document_id,
                    filename,
                    content_type,
                    raw_text,
                    created_at,
                    file_size,
                    user_id,
                    workspace_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    document.document_id,
                    document.filename,
                    document.content_type,
                    document.raw_text,
                    document.metadata.upload_time,
                    document.metadata.size_bytes,
                    document.user_id,
                    document.workspace_id,
                ),
            )
            connection.execute("DELETE FROM chunks WHERE document_id = ?", (document.document_id,))
            connection.executemany(
                """
                INSERT INTO chunks (
                    chunk_id,
                    document_id,
                    workspace_id,
                    text,
                    embedding,
                    index_position
                ) VALUES (?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        chunk.chunk_id,
                        chunk.document_id,
                        chunk.workspace_id,
                        chunk.content,
                        json.dumps(document.embeddings[index]),
                        chunk.index,
                    )
                    for index, chunk in enumerate(document.chunks)
                ],
            )

    def get_document(
        self,
        document_id: str,
        user_id: str | None = None,
        workspace_id: str | None = None,
    ) -> DocumentRecord | None:
        with self._connect() as connection:
            row = connection.execute(
                f"""
                SELECT document_id, filename, content_type, raw_text, created_at, file_size, user_id, workspace_id
                FROM documents
                WHERE document_id = ?
                {self._and_clause(user_id=user_id, workspace_id=workspace_id)}
                """,
                self._document_params(document_id=document_id, user_id=user_id, workspace_id=workspace_id),
            ).fetchone()
        if row is None:
            return None
        return self._build_document(
            row=row,
            chunks=self.get_document_chunks(document_id, user_id=user_id, workspace_id=workspace_id),
            embeddings=self.get_document_embeddings(document_id, user_id=user_id, workspace_id=workspace_id),
        )

    def list_documents(
        self,
        user_id: str | None = None,
        workspace_id: str | None = None,
    ) -> list[DocumentRecord]:
        with self._connect() as connection:
            rows = connection.execute(
                f"""
                SELECT document_id, filename, content_type, raw_text, created_at, file_size, user_id, workspace_id
                FROM documents
                {self._where_clause(user_id=user_id, workspace_id=workspace_id)}
                ORDER BY created_at DESC
                """,
                self._filter_params(user_id=user_id, workspace_id=workspace_id),
            ).fetchall()
        return [
            self._build_document(
                row=row,
                chunks=self.get_document_chunks(str(row["document_id"]), user_id=user_id, workspace_id=workspace_id),
                embeddings=self.get_document_embeddings(str(row["document_id"]), user_id=user_id, workspace_id=workspace_id),
            )
            for row in rows
        ]

    def get_workspace_documents(
        self,
        workspace_id: str,
        user_id: str | None = None,
    ) -> list[DocumentRecord]:
        return self.list_documents(user_id=user_id, workspace_id=workspace_id)

    def get_document_chunks(
        self,
        document_id: str,
        user_id: str | None = None,
        workspace_id: str | None = None,
    ) -> list[DocumentChunk]:
        self._ensure_document_access(document_id=document_id, user_id=user_id, workspace_id=workspace_id)
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT chunk_id, document_id, workspace_id, text, index_position
                FROM chunks
                WHERE document_id = ?
                ORDER BY index_position ASC
                """,
                (document_id,),
            ).fetchall()
        return [self._build_chunk(row) for row in rows]

    def get_document_embeddings(
        self,
        document_id: str,
        user_id: str | None = None,
        workspace_id: str | None = None,
    ) -> list[list[float]]:
        self._ensure_document_access(document_id=document_id, user_id=user_id, workspace_id=workspace_id)
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT embedding
                FROM chunks
                WHERE document_id = ?
                ORDER BY index_position ASC
                """,
                (document_id,),
            ).fetchall()
        return [json.loads(str(row["embedding"])) for row in rows]

    def get_workspace_chunks(
        self,
        workspace_id: str,
        user_id: str | None = None,
    ) -> list[DocumentChunk]:
        with self._connect() as connection:
            rows = connection.execute(
                f"""
                SELECT c.chunk_id, c.document_id, c.workspace_id, c.text, c.index_position
                FROM chunks c
                INNER JOIN documents d ON d.document_id = c.document_id
                WHERE c.workspace_id = ?
                {"AND d.user_id = ?" if user_id is not None else ""}
                ORDER BY c.document_id ASC, c.index_position ASC
                """,
                (workspace_id, user_id) if user_id is not None else (workspace_id,),
            ).fetchall()
        return [self._build_chunk(row) for row in rows]

    def get_workspace_embeddings(
        self,
        workspace_id: str,
        user_id: str | None = None,
    ) -> list[list[float]]:
        with self._connect() as connection:
            rows = connection.execute(
                f"""
                SELECT c.embedding
                FROM chunks c
                INNER JOIN documents d ON d.document_id = c.document_id
                WHERE c.workspace_id = ?
                {"AND d.user_id = ?" if user_id is not None else ""}
                ORDER BY c.document_id ASC, c.index_position ASC
                """,
                (workspace_id, user_id) if user_id is not None else (workspace_id,),
            ).fetchall()
        return [json.loads(str(row["embedding"])) for row in rows]

    def get_chunks_by_ids(
        self,
        workspace_id: str,
        chunk_ids: list[str],
        user_id: str | None = None,
    ) -> list[DocumentChunk]:
        if not chunk_ids:
            return []
        placeholders = ", ".join("?" for _ in chunk_ids)
        query = f"""
            SELECT c.chunk_id, c.document_id, c.workspace_id, c.text, c.index_position
            FROM chunks c
            INNER JOIN documents d ON d.document_id = c.document_id
            WHERE c.workspace_id = ? AND c.chunk_id IN ({placeholders})
            {"AND d.user_id = ?" if user_id is not None else ""}
        """
        params: tuple = (workspace_id, *chunk_ids, user_id) if user_id is not None else (workspace_id, *chunk_ids)
        with self._connect() as connection:
            rows = connection.execute(query, params).fetchall()
        chunk_by_id = {str(row["chunk_id"]): self._build_chunk(row) for row in rows}
        return [chunk_by_id[chunk_id] for chunk_id in chunk_ids if chunk_id in chunk_by_id]

    def has_documents(
        self,
        user_id: str | None = None,
        workspace_id: str | None = None,
    ) -> bool:
        with self._connect() as connection:
            row = connection.execute(
                f"SELECT 1 FROM documents {self._where_clause(user_id=user_id, workspace_id=workspace_id)} LIMIT 1",
                self._filter_params(user_id=user_id, workspace_id=workspace_id),
            ).fetchone()
        return row is not None

    def total_chunks(
        self,
        user_id: str | None = None,
        workspace_id: str | None = None,
    ) -> int:
        with self._connect() as connection:
            if user_id is None and workspace_id is None:
                row = connection.execute("SELECT COUNT(*) AS total FROM chunks").fetchone()
            else:
                row = connection.execute(
                    """
                    SELECT COUNT(*) AS total
                    FROM chunks c
                    INNER JOIN documents d ON d.document_id = c.document_id
                    WHERE (? IS NULL OR d.user_id = ?)
                    AND (? IS NULL OR d.workspace_id = ?)
                    """,
                    (user_id, user_id, workspace_id, workspace_id),
                ).fetchone()
        return int(row["total"]) if row is not None else 0

    def _ensure_document_access(
        self,
        document_id: str,
        user_id: str | None,
        workspace_id: str | None,
    ) -> None:
        with self._connect() as connection:
            row = connection.execute(
                f"""
                SELECT 1
                FROM documents
                WHERE document_id = ?
                {self._and_clause(user_id=user_id, workspace_id=workspace_id)}
                LIMIT 1
                """,
                self._document_params(document_id=document_id, user_id=user_id, workspace_id=workspace_id),
            ).fetchone()
        if row is None:
            raise ValueError("Document access not allowed or document does not exist.")

    def _build_document(
        self,
        row: sqlite3.Row,
        chunks: list[DocumentChunk],
        embeddings: list[list[float]],
    ) -> DocumentRecord:
        return DocumentRecord(
            document_id=str(row["document_id"]),
            workspace_id=str(row["workspace_id"]) if row["workspace_id"] is not None else "",
            filename=str(row["filename"]),
            raw_text=str(row["raw_text"]),
            chunks=chunks,
            embeddings=embeddings,
            content_type=str(row["content_type"]),
            metadata=DocumentMetadata(
                upload_time=str(row["created_at"]),
                size_bytes=int(row["file_size"]),
            ),
            user_id=str(row["user_id"]) if row["user_id"] is not None else None,
        )

    def _build_chunk(self, row: sqlite3.Row) -> DocumentChunk:
        return DocumentChunk(
            chunk_id=str(row["chunk_id"]),
            document_id=str(row["document_id"]),
            workspace_id=str(row["workspace_id"]) if row["workspace_id"] is not None else "",
            index=int(row["index_position"]),
            content=str(row["text"]),
        )

    def _ensure_column(
        self,
        connection: sqlite3.Connection,
        table_name: str,
        column_name: str,
        definition: str,
    ) -> None:
        rows = connection.execute(f"PRAGMA table_info({table_name})").fetchall()
        existing_columns = {str(row["name"]) for row in rows}
        if column_name not in existing_columns:
            connection.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {definition}")

    def _where_clause(self, user_id: str | None, workspace_id: str | None) -> str:
        clauses: list[str] = []
        if user_id is not None:
            clauses.append("user_id = ?")
        if workspace_id is not None:
            clauses.append("workspace_id = ?")
        return f"WHERE {' AND '.join(clauses)}" if clauses else ""

    def _and_clause(self, user_id: str | None, workspace_id: str | None) -> str:
        clauses: list[str] = []
        if user_id is not None:
            clauses.append("user_id = ?")
        if workspace_id is not None:
            clauses.append("workspace_id = ?")
        return f" AND {' AND '.join(clauses)}" if clauses else ""

    def _filter_params(self, user_id: str | None, workspace_id: str | None) -> tuple:
        values: list[str] = []
        if user_id is not None:
            values.append(user_id)
        if workspace_id is not None:
            values.append(workspace_id)
        return tuple(values)

    def _document_params(
        self,
        document_id: str,
        user_id: str | None,
        workspace_id: str | None,
    ) -> tuple:
        return (document_id, *self._filter_params(user_id=user_id, workspace_id=workspace_id))
