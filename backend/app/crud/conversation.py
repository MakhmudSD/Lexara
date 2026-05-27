from __future__ import annotations
from uuid import UUID, uuid4
from datetime import datetime
from sqlalchemy.orm import Session
from app.db.models import Conversation, ConversationTurn


def get_or_create_conversation(
    db: Session,
    workspace_id: str,
    conversation_id: str | None,
    first_question: str,
) -> Conversation:
    if conversation_id:
        existing = (
            db.query(Conversation)
            .filter(
                Conversation.id == conversation_id,
                Conversation.is_active.is_(True),
            )
            .first()
        )
        if existing:
            return existing
    title = first_question[:80].strip()
    conversation = Conversation(
        id=uuid4(),
        workspace_id=workspace_id,
        title=title,
        is_active=True,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(conversation)
    db.flush()
    return conversation


def append_turn(
    db: Session,
    conversation: Conversation,
    question: str,
    answer: str,
    sources: list[dict],
    latency_ms: float | None = None,
) -> ConversationTurn:
    turn_index = db.query(ConversationTurn).filter(
        ConversationTurn.conversation_id == conversation.id
    ).count()
    turn = ConversationTurn(
        id=uuid4(),
        conversation_id=conversation.id,
        turn_index=turn_index,
        question=question,
        answer=answer,
        sources=sources,
        latency_ms=latency_ms,
        created_at=datetime.utcnow(),
    )
    db.add(turn)
    conversation.updated_at = datetime.utcnow()
    db.flush()
    return turn


def get_conversation_history(
    db: Session,
    conversation_id: UUID,
    max_turns: int = 10,
) -> list[ConversationTurn]:
    return (
        db.query(ConversationTurn)
        .filter(ConversationTurn.conversation_id == conversation_id)
        .order_by(ConversationTurn.turn_index.desc())
        .limit(max_turns)
        .all()[::-1]
    )


def list_workspace_conversations(
    db: Session,
    workspace_id: str,
    skip: int = 0,
    limit: int = 50,
) -> list[Conversation]:
    return (
        db.query(Conversation)
        .filter(
            Conversation.workspace_id == workspace_id,
            Conversation.is_active.is_(True),
        )
        .order_by(Conversation.updated_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
