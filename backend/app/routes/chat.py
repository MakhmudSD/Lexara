from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, get_runtime
from app.core.runtime import AppRuntime
from app.schemas.chat import ChatQueryRequest, ChatQueryResponse
from app.services.query_service import query_workspace

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/query", response_model=ChatQueryResponse)
def chat_query(
    payload: ChatQueryRequest,
    db: Session = Depends(get_db),
    runtime: AppRuntime = Depends(get_runtime),
) -> ChatQueryResponse:
    return query_workspace(
        db,
        runtime.vector_store,
        runtime.settings,
        workspace_id=payload.workspace_id,
        question=payload.question,
        top_k=payload.top_k,
    )
