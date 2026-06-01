from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.auth import get_current_user, require_admin
from app.core.dependencies import get_db
from app.core.exceptions import AppError
from app.db.models import SupportTicket, User

router = APIRouter(prefix="/support", tags=["support"])
admin_router = APIRouter(prefix="/admin/support", tags=["support"])


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
    current_user: User = Depends(get_current_user),
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
    current_user: User = Depends(get_current_user),
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
    current_user: User = Depends(get_current_user),
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
    current_admin: User = Depends(require_admin),
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
    current_admin: User = Depends(require_admin),
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
    current_admin: User = Depends(require_admin),
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
