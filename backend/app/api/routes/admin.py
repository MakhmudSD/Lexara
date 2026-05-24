from fastapi import APIRouter, Depends

from app.api.schemas.admin import (
    AdminDocumentResponse,
    HealthResponse,
    LogEntryResponse,
    RequestHistoryResponse,
    RetrievalHistoryResponse,
)
from app.core.dependencies import get_runtime
from app.core.runtime import AppRuntime
from app.services.admin_service import (
    get_documents,
    get_health_status,
    get_logs,
    get_request_history,
    get_retrieval_history,
)

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/logs", response_model=list[LogEntryResponse])
async def admin_logs(runtime: AppRuntime = Depends(get_runtime)) -> list[LogEntryResponse]:
    return get_logs(runtime)


@router.get("/requests", response_model=list[RequestHistoryResponse])
async def admin_requests(
    runtime: AppRuntime = Depends(get_runtime),
) -> list[RequestHistoryResponse]:
    return get_request_history(runtime)


@router.get("/documents", response_model=list[AdminDocumentResponse])
async def admin_documents(
    runtime: AppRuntime = Depends(get_runtime),
) -> list[AdminDocumentResponse]:
    return get_documents(runtime)


@router.get("/retrievals", response_model=list[RetrievalHistoryResponse])
async def admin_retrievals(
    runtime: AppRuntime = Depends(get_runtime),
) -> list[RetrievalHistoryResponse]:
    return get_retrieval_history(runtime)


@router.get("/health", response_model=HealthResponse)
async def admin_health(runtime: AppRuntime = Depends(get_runtime)) -> HealthResponse:
    return get_health_status(runtime)
