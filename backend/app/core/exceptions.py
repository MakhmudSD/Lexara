from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

logger = logging.getLogger("rag_saas")


class AppError(Exception):
    def __init__(self, status_code: int, code: str, message: str):
        self.status_code = status_code
        self.code = code
        self.message = message
        super().__init__(message)


def register_exception_handlers(app: FastAPI) -> None:
    def _request_id(request: Request) -> str | None:
        return getattr(request.state, "request_id", None)

    @app.exception_handler(AppError)
    async def handle_app_error(request: Request, exc: AppError) -> JSONResponse:
        runtime = getattr(request.app.state, "runtime", None)
        if runtime is not None:
            runtime.observability.add_event(
                request_id=_request_id(request) or "unknown",
                event_type="error",
                stage="api",
                message=exc.message,
                metadata={"code": exc.code, "status_code": exc.status_code},
                level="ERROR",
            )
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": exc.code,
                    "message": exc.message,
                    "request_id": _request_id(request),
                }
            },
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        runtime = getattr(request.app.state, "runtime", None)
        if runtime is not None:
            runtime.observability.add_event(
                request_id=_request_id(request) or "unknown",
                event_type="validation_error",
                stage="api",
                message="Request validation failed.",
                metadata={"errors": exc.errors()},
                level="ERROR",
            )
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "validation_error",
                    "message": "Request validation failed.",
                    "request_id": _request_id(request),
                    "details": exc.errors(),
                }
            },
        )

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled exception", exc_info=exc)
        runtime = getattr(request.app.state, "runtime", None)
        if runtime is not None:
            runtime.observability.add_event(
                request_id=_request_id(request) or "unknown",
                event_type="unexpected_error",
                stage="api",
                message="Unexpected server error.",
                metadata={"error_type": exc.__class__.__name__},
                level="ERROR",
            )
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "internal_server_error",
                    "message": "An unexpected server error occurred.",
                    "request_id": _request_id(request),
                }
            },
        )
