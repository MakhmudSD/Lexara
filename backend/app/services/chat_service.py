from __future__ import annotations

import time

from app.schemas.chat import ChatDebugResponse, ChatRequest, ChatResponse, ChatSource
from app.core.exceptions import AppError
from app.core.runtime import AppRuntime
from app.observability.models import PipelineStepEntry, RetrievalHistoryEntry, RetrievalResultEntry
from app.services.embedding_service import embed_query
from app.services.llm_service import generate_answer
from app.services.retrieval_service import retrieve_top_chunks


async def handle_chat(
    runtime: AppRuntime,
    payload: ChatRequest,
    request_id: str,
) -> ChatResponse:
    if not runtime.documents.has_documents(user_id=payload.user_id, workspace_id=payload.workspace_id):
        raise AppError(
            404,
            "workspace_not_found",
            "No accessible documents were found for this workspace.",
        )

    runtime.observability.add_event(
        request_id=request_id,
        event_type="chat_requested",
        stage="chat",
        message="Starting workspace chat request.",
        metadata={
            "top_k": payload.top_k,
            "workspace_id": payload.workspace_id,
            "user_id": payload.user_id,
        },
        workspace_id=payload.workspace_id,
    )

    workspace_documents = runtime.documents.get_workspace_documents(
        workspace_id=payload.workspace_id,
        user_id=payload.user_id,
    )
    filename_by_document_id = {
        document.document_id: document.filename for document in workspace_documents
    }

    pipeline_steps: list[PipelineStepEntry] = []
    latency: dict[str, float] = {}

    embedding_started = time.perf_counter()
    question_embedding = embed_query(payload.question, runtime.settings)
    embedding_latency = round((time.perf_counter() - embedding_started) * 1000, 3)
    latency["embedding"] = embedding_latency
    pipeline_steps.append(
        PipelineStepEntry(
            stage="embedding",
            status="completed",
            latency_ms=embedding_latency,
            metadata={"input_type": "question"},
        )
    )
    runtime.observability.add_event(
        request_id=request_id,
        event_type="query_embedding_generated",
        stage="embedding",
        message="Generated embedding for chat question.",
        metadata={"latency_ms": embedding_latency},
        workspace_id=payload.workspace_id,
    )

    retrieval_started = time.perf_counter()
    search_results = runtime.vector_store.search(
        query_embedding=question_embedding,
        workspace_id=payload.workspace_id,
        top_k=payload.top_k,
        user_id=payload.user_id,
    )
    workspace_chunks = runtime.documents.get_workspace_chunks(
        workspace_id=payload.workspace_id,
        user_id=payload.user_id,
    )
    workspace_embeddings = runtime.documents.get_workspace_embeddings(
        workspace_id=payload.workspace_id,
        user_id=payload.user_id,
    )
    retrieved_chunks = runtime.documents.get_chunks_by_ids(
        workspace_id=payload.workspace_id,
        chunk_ids=[item.chunk_id for item in search_results],
        user_id=payload.user_id,
    )
    chunk_lookup = {chunk.chunk_id: chunk for chunk in retrieved_chunks}
    embedding_lookup = {
        chunk.chunk_id: embedding
        for chunk, embedding in zip(workspace_chunks, workspace_embeddings)
    }

    aligned_chunks = []
    aligned_embeddings = []
    for item in search_results:
        chunk = chunk_lookup.get(item.chunk_id)
        embedding = embedding_lookup.get(item.chunk_id)
        if chunk is None or embedding is None:
            continue
        aligned_chunks.append(chunk)
        aligned_embeddings.append(embedding)

    matches = retrieve_top_chunks(
        question_embedding=question_embedding,
        document_chunks=aligned_chunks,
        document_embeddings=aligned_embeddings,
        top_k=payload.top_k,
    )
    retrieval_latency = round((time.perf_counter() - retrieval_started) * 1000, 3)
    latency["retrieval"] = retrieval_latency
    pipeline_steps.append(
        PipelineStepEntry(
            stage="retrieval",
            status="completed",
            latency_ms=retrieval_latency,
            metadata={"matches": len(matches), "workspace_id": payload.workspace_id},
        )
    )

    runtime.observability.add_retrieval(
        RetrievalHistoryEntry(
            request_id=request_id,
            workspace_id=payload.workspace_id,
            question=payload.question,
            top_k=payload.top_k,
            latency_ms=retrieval_latency,
            results=[
                RetrievalResultEntry(
                    document_id=match.document_id,
                    chunk_id=match.chunk_id,
                    score=match.score,
                    chunk_text=match.text,
                )
                for match in matches
            ],
        )
    )
    runtime.observability.add_event(
        request_id=request_id,
        event_type="retrieval_completed",
        stage="retrieval",
        message="Retrieved relevant chunks from workspace.",
        metadata={
            "scores": [round(match.score, 4) for match in matches],
            "workspace_id": payload.workspace_id,
            "user_id": payload.user_id,
            "latency_ms": retrieval_latency,
        },
        workspace_id=payload.workspace_id,
    )

    generation_started = time.perf_counter()
    answer, _usage = await generate_answer(
        question=payload.question,
        context_chunks=[match.text for match in matches],
        settings=runtime.settings,
    )
    generation_latency = round((time.perf_counter() - generation_started) * 1000, 3)
    latency["llm_generation"] = generation_latency
    pipeline_steps.append(
        PipelineStepEntry(
            stage="llm_generation",
            status="completed",
            latency_ms=generation_latency,
            metadata={"context_chunks": len(matches)},
        )
    )
    runtime.observability.add_event(
        request_id=request_id,
        event_type="llm_answer_generated",
        stage="llm_generation",
        message="Generated answer from retrieved workspace context.",
        metadata={"latency_ms": generation_latency},
        workspace_id=payload.workspace_id,
    )

    sources = [
        ChatSource(
            document_id=match.document_id,
            chunk_id=match.chunk_id,
            filename=filename_by_document_id.get(match.document_id, "unknown"),
            score=match.score,
            text=match.text,
        )
        for match in matches
    ]

    debug = None
    if payload.debug:
        debug = ChatDebugResponse(
            chunks_used=[match.text for match in matches],
            scores=[match.score for match in matches],
            latency=latency,
            pipeline_steps=[
                step.model_dump() if hasattr(step, "model_dump") else step.dict()
                for step in pipeline_steps
            ],
        )

    return ChatResponse(
        request_id=request_id,
        answer=answer,
        sources=sources,
        latency=latency,
        retrieval_scores=[match.score for match in matches],
        metadata={
            "workspace_id": payload.workspace_id,
            "user_id": payload.user_id,
            "top_k": payload.top_k,
            "documents_considered": len(workspace_documents),
        },
        debug=debug,
    )
