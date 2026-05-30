from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, Header
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, get_runtime
from app.core.exceptions import AppError
from app.core.runtime import AppRuntime
from app.db.models import SupportTicket, User
from app.services.auth_service import decode_access_token

router = APIRouter(prefix="/support", tags=["support"])
admin_router = APIRouter(prefix="/admin/support", tags=["support"])


def _get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
    runtime: AppRuntime = Depends(get_runtime),
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise AppError(401, "missing_token", "Authorization token is required.")
    token = authorization.split(" ", 1)[1].strip()
    claims = decode_access_token(token, runtime.settings)
    user = db.query(User).filter(User.id == claims.get("sub")).first()
    if user is None:
        raise AppError(401, "invalid_token", "Invalid or expired token.")
    return user


def _require_admin(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
    runtime: AppRuntime = Depends(get_runtime),
) -> User:
    user = _get_current_user.__wrapped__(authorization, db, runtime) if hasattr(_get_current_user, '__wrapped__') else None
    if not authorization or not authorization.startswith("Bearer "):
        raise AppError(401, "missing_token", "Authorization token is required.")
    token = authorization.split(" ", 1)[1].strip()
    claims = decode_access_token(token, runtime.settings)
    if claims.get("role") != "admin":
        raise AppError(403, "forbidden", "Admin access required.")
    user = db.query(User).filter(User.id == claims.get("sub")).first()
    if user is None:
        raise AppError(401, "invalid_token", "Invalid or expired token.")
    return user


class SubmitTicketRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=1000)


class AnswerTicketRequest(BaseModel):
    answer: str = Field(..., min_length=1, max_length=5000)
    is_public: bool = False


class TicketResponse(BaseModel):
    id: str
    user_id: str
    user_email: str | None = None
    question: str
    answer: str | None
    is_public: bool
    status: str
    created_at: str
    answered_at: str | None


def _ticket_to_response(ticket: SupportTicket, include_email: bool = False) -> TicketResponse:
    return TicketResponse(
        id=str(ticket.id),
        user_id=str(ticket.user_id),
        user_email=ticket.user.email if include_email and ticket.user else None,
        question=ticket.question,
        answer=ticket.answer,
        is_public=ticket.is_public,
        status="answered" if ticket.answer else "pending",
        created_at=ticket.created_at.isoformat(),
        answered_at=ticket.answered_at.isoformat() if ticket.answered_at else None,
    )


@router.post("/tickets", response_model=TicketResponse, status_code=201)
def submit_ticket(
    payload: SubmitTicketRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(_get_current_user),
) -> TicketResponse:
    ticket = SupportTicket(
        id=uuid4(),
        user_id=current_user.id,
        question=payload.question.strip(),
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return _ticket_to_response(ticket)


@router.get("/tickets", response_model=list[TicketResponse])
def get_my_tickets(
    db: Session = Depends(get_db),
    current_user: User = Depends(_get_current_user),
) -> list[TicketResponse]:
    tickets = (
        db.query(SupportTicket)
        .filter(SupportTicket.user_id == current_user.id)
        .order_by(SupportTicket.created_at.desc())
        .all()
    )
    return [_ticket_to_response(t) for t in tickets]


@router.get("/faq", response_model=list[TicketResponse])
def get_faq(
    db: Session = Depends(get_db),
    current_user: User = Depends(_get_current_user),
) -> list[TicketResponse]:
    tickets = (
        db.query(SupportTicket)
        .filter(SupportTicket.is_public.is_(True), SupportTicket.answer.isnot(None))
        .order_by(SupportTicket.answered_at.desc())
        .limit(50)
        .all()
    )
    return [_ticket_to_response(t) for t in tickets]


@admin_router.get("/tickets", response_model=list[TicketResponse])
def admin_get_tickets(
    db: Session = Depends(get_db),
    current_admin: User = Depends(_require_admin),
) -> list[TicketResponse]:
    tickets = (
        db.query(SupportTicket)
        .order_by(SupportTicket.answer.is_(None).desc(), SupportTicket.created_at.desc())
        .all()
    )
    return [_ticket_to_response(t, include_email=True) for t in tickets]


@admin_router.patch("/tickets/{ticket_id}/answer", response_model=TicketResponse)
def admin_answer_ticket(
    ticket_id: str,
    payload: AnswerTicketRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(_require_admin),
) -> TicketResponse:
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if ticket is None:
        raise AppError(404, "ticket_not_found", "Support ticket not found.")
    ticket.answer = payload.answer.strip()
    ticket.answered_by = current_admin.id
    ticket.answered_at = datetime.utcnow()
    ticket.is_public = payload.is_public
    db.commit()
    db.refresh(ticket)
    return _ticket_to_response(ticket, include_email=True)


@admin_router.patch("/tickets/{ticket_id}/publish", response_model=TicketResponse)
def admin_toggle_publish(
    ticket_id: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(_require_admin),
) -> TicketResponse:
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if ticket is None:
        raise AppError(404, "ticket_not_found", "Support ticket not found.")
    if ticket.answer is None:
        raise AppError(400, "unanswered_ticket", "Cannot publish an unanswered ticket.")
    ticket.is_public = not ticket.is_public
    db.commit()
    db.refresh(ticket)
    return _ticket_to_response(ticket, include_email=True)
