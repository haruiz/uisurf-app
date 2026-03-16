from datetime import UTC, datetime
from functools import lru_cache
from uuid import uuid4

from uisurf_app.schemas.remote_session import (
    RemoteSessionActionResponse,
    RemoteSessionConnectRequest,
    RemoteSessionDisconnectRequest,
    RemoteSessionResponse,
)


class RemoteSessionService:
    def __init__(self) -> None:
        self._sessions: dict[str, dict[str, RemoteSessionResponse]] = {}
        self._actions: dict[str, list[RemoteSessionActionResponse]] = {}

    def connect(self, owner_id: str, payload: RemoteSessionConnectRequest) -> RemoteSessionResponse:
        session_id = f"vnc_{uuid4().hex[:8]}"
        connected_at = datetime.now(UTC)
        session = RemoteSessionResponse(
            id=session_id,
            owner_id=owner_id,
            label=payload.label,
            host=payload.host,
            port=payload.port,
            status="connecting",
            viewer_url=None,
            connected_at=connected_at,
        )
        self._sessions.setdefault(owner_id, {})[session_id] = session
        self._actions[session_id] = [
            RemoteSessionActionResponse(
                id=f"act_{uuid4().hex[:8]}",
                session_id=session_id,
                action="Queued browser-control agent session for viewer bootstrap.",
                timestamp=connected_at,
            )
        ]
        return session

    def disconnect(
        self,
        owner_id: str,
        payload: RemoteSessionDisconnectRequest,
    ) -> RemoteSessionResponse | None:
        session = self.get_session(owner_id=owner_id, session_id=payload.session_id)
        if session is None:
            return None
        session.status = "disconnected"
        self._actions.setdefault(session.id, []).append(
            RemoteSessionActionResponse(
                id=f"act_{uuid4().hex[:8]}",
                session_id=session.id,
                action="Disconnected remote viewer session.",
                timestamp=datetime.now(UTC),
            )
        )
        return session

    def get_session(self, owner_id: str, session_id: str) -> RemoteSessionResponse | None:
        return self._sessions.get(owner_id, {}).get(session_id)

    def list_actions(
        self,
        owner_id: str,
        session_id: str,
    ) -> list[RemoteSessionActionResponse] | None:
        if self.get_session(owner_id=owner_id, session_id=session_id) is None:
            return None
        return self._actions.get(session_id, [])


@lru_cache
def get_remote_session_service() -> RemoteSessionService:
    return RemoteSessionService()
