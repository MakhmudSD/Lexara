from fastapi import APIRouter, Depends, File, Form, Request, UploadFile

from app.api.schemas.chat import ChatRequest, ChatResponse
from app.api.schemas.upload import UploadFormData, UploadResponse
from app.core.dependencies import get_request_id, get_runtime
from app.core.runtime import AppRuntime
from app.services.chat_service import handle_chat
from app.services.document_service import handle_upload

router = APIRouter(tags=["public"])


def parse_upload_form(
    user_id: str | None = Form(default=None, min_length=1, max_length=128),
    workspace_id: str | None = Form(default=None, min_length=1, max_length=128),
) -> UploadFormData:
    return UploadFormData(user_id=user_id, workspace_id=workspace_id)


@router.post("/upload", response_model=UploadResponse)
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    form_data: UploadFormData = Depends(parse_upload_form),
    runtime: AppRuntime = Depends(get_runtime),
    request_id: str = Depends(get_request_id),
) -> UploadResponse:
    response = await handle_upload(
        runtime=runtime,
        upload=file,
        user_id=form_data.user_id,
        workspace_id=form_data.workspace_id,
        request_id=request_id,
    )
    request.state.workspace_id = response.workspace_id
    request.state.document_id = response.document_id
    return response


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
