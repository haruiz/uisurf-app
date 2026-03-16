from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from functools import lru_cache
from secrets import token_urlsafe

from uisurf_app.schemas.auth import Principal


@dataclass(slots=True)
class WebSocketTicket:
    ticket: str
    user_id: str
    session_id: str
    principal: Principal
    expires_at: datetime


class WebSocketTicketService:
    def __init__(self, ttl_seconds: int = 120) -> None:
        self._ttl_seconds = ttl_seconds
        self._tickets: dict[str, WebSocketTicket] = {}

    def issue_ticket(self, principal: Principal, session_id: str) -> WebSocketTicket:
        self._prune_expired()
        ticket = WebSocketTicket(
            ticket=token_urlsafe(32),
            user_id=principal.user_id,
            session_id=session_id,
            principal=principal,
            expires_at=datetime.now(UTC) + timedelta(seconds=self._ttl_seconds),
        )
        self._tickets[ticket.ticket] = ticket
        return ticket

    def resolve_ticket(self, ticket: str | None) -> WebSocketTicket | None:
        self._prune_expired()
        if not ticket:
            return None
        candidate = self._tickets.get(ticket)
        if candidate is None:
            return None
        if candidate.expires_at <= datetime.now(UTC):
            self._tickets.pop(ticket, None)
            return None
        return candidate

    def _prune_expired(self) -> None:
        now = datetime.now(UTC)
        expired = [ticket for ticket, value in self._tickets.items() if value.expires_at <= now]
        for ticket in expired:
            self._tickets.pop(ticket, None)


@lru_cache
def get_websocket_ticket_service() -> WebSocketTicketService:
    return WebSocketTicketService()
