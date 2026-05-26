from __future__ import annotations

import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id

        started_at = time.perf_counter()
        runtime = request.app.state.runtime
        status_code = 500

        runtime.observability.add_event(
            request_id=request_id,
            event_type="request_started",
            stage="api",
            message="Request started.",
            metadata={"method": request.method, "path": request.url.path},
            workspace_id=getattr(request.state, "workspace_id", None),
            document_id=getattr(request.state, "document_id", None),
        )

        try:
            response = await call_next(request)
            status_code = response.status_code
        except Exception:
            duration_ms = round((time.perf_counter() - started_at) * 1000, 3)
            runtime.observability.add_request(
                request_id=request_id,
                method=request.method,
                path=request.url.path,
                status_code=status_code,
                duration_ms=duration_ms,
                workspace_id=getattr(request.state, "workspace_id", None),
                document_id=getattr(request.state, "document_id", None),
            )
            runtime.observability.add_event(
                request_id=request_id,
                event_type="request_failed",
                stage="api",
                message="Request failed.",
                metadata={
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": status_code,
                    "duration_ms": duration_ms,
                },
                workspace_id=getattr(request.state, "workspace_id", None),
                document_id=getattr(request.state, "document_id", None),
                level="ERROR",
            )
            raise

        duration_ms = round((time.perf_counter() - started_at) * 1000, 3)
        runtime.observability.add_request(
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            status_code=status_code,
            duration_ms=duration_ms,
            workspace_id=getattr(request.state, "workspace_id", None),
            document_id=getattr(request.state, "document_id", None),
        )
        runtime.observability.add_event(
            request_id=request_id,
            event_type="request_completed",
            stage="api",
            message="Request completed.",
            metadata={
                "method": request.method,
                "path": request.url.path,
                "status_code": status_code,
                "duration_ms": duration_ms,
            },
            workspace_id=getattr(request.state, "workspace_id", None),
            document_id=getattr(request.state, "document_id", None),
        )
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response
