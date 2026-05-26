from fastapi import APIRouter, Depends, Request

from app.api.schemas.chat import ChatRequest, ChatResponse
from app.core.dependencies import get_request_id, get_runtime
from app.core.runtime import AppRuntime
from app.services.chat_service import handle_chat

router = APIRouter(tags=["public"])


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: Request,
    payload: ChatRequest,
    runtime: AppRuntime = Depends(get_runtime),
    request_id: str = Depends(get_request_id),
) -> ChatResponse:
    response = await handle_chat(
        runtime=runtime,
        payload=payload,
        request_id=request_id,
    )
    request.state.workspace_id = payload.workspace_id
    return response
