from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime
from functools import lru_cache
from typing import Any
from uuid import uuid4

from google.adk.events.event import Event
from google.adk.events.event_actions import EventActions
from google.adk.sessions import BaseSessionService, Session

from uisurf_app.core.config import get_settings
from uisurf_app.core.adk_session_service import get_adk_session_service
from uisurf_app.schemas.chat import ChatSessionCreate, ChatSessionResponse
from uisurf_app.schemas.messages import MessageCreate, MessageResponse
from uisurf_app.services.ui_agent_session_service import (
    UiAgentSessionService,
    get_ui_agent_session_service,
)
from uisurf_app.services.chat_vnc_session_service import (
    ChatVncSessionService,
    get_chat_vnc_session_service,
)

logger = logging.getLogger(__name__)


class ChatService:
    def __init__(
        self,
        session_service: BaseSessionService,
        app_name: str,
        ui_agent_session_service: UiAgentSessionService,
        chat_vnc_session_service: ChatVncSessionService,
    ) -> None:
        self._session_service = session_service
        self._app_name = app_name
        self._ui_agent_session_service = ui_agent_session_service
        self._chat_vnc_session_service = chat_vnc_session_service
        self._messages: dict[str, list[MessageResponse]] = {}

    async def list_sessions(self, owner_id: str) -> list[ChatSessionResponse]:
        response = await self._session_service.list_sessions(app_name=self._app_name, user_id=owner_id)
        sessions = getattr(response, "sessions", [])
        vnc_records = await self._chat_vnc_session_service.get_many(
            owner_id,
            [session.id for session in sessions],
        )
        return [
            self._map_session(session, owner_id=owner_id, vnc_record=vnc_records.get(session.id))
            for session in sessions
        ]

    async def create_session(
        self,
        owner_id: str,
        payload: ChatSessionCreate,
        auth_token: str | None = None,
    ) -> ChatSessionResponse:
        now = datetime.now(UTC)
        control_mode = (
            payload.control_mode
            if payload.control_mode in {"agent", "manual"}
            else self._ui_agent_session_service.control_mode
        )
        create_kwargs = {
            "app_name": self._app_name,
            "user_id": owner_id,
            "state": {
                "title": payload.title,
                "created_at": now.isoformat(),
                "control_mode": control_mode,
            },
        }
        if not get_settings().use_vertex_ai_session_service:
            create_kwargs["session_id"] = f"chat_{uuid4().hex[:8]}"

        session = await self._session_service.create_session(**create_kwargs)
        self._messages.setdefault(session.id, [])
        if self._ui_agent_session_service.enabled and auth_token:
            await self._chat_vnc_session_service.set_pending(owner_id, session.id)
            asyncio.create_task(
                self._provision_vnc_session(
                    owner_id=owner_id,
                    session_id=session.id,
                    auth_token=auth_token,
                    control_mode=control_mode,
                )
            )
        vnc_record = await self._chat_vnc_session_service.get(owner_id, session.id)
        return self._map_session(session, owner_id=owner_id, vnc_record=vnc_record)

    async def get_session(self, chat_id: str, owner_id: str) -> ChatSessionResponse | None:
        session = await self._session_service.get_session(
            app_name=self._app_name,
            user_id=owner_id,
            session_id=chat_id,
        )
        if session is None:
            return None
        vnc_record = await self._chat_vnc_session_service.get(owner_id, chat_id)
        return self._map_session(session, owner_id=owner_id, vnc_record=vnc_record)

    async def delete_session(
        self,
        chat_id: str,
        owner_id: str,
        auth_token: str | None = None,
    ) -> bool:
        session = await self._session_service.get_session(
            app_name=self._app_name,
            user_id=owner_id,
            session_id=chat_id,
        )
        if session is None:
            self._messages.pop(chat_id, None)
            await self._chat_vnc_session_service.delete(owner_id, chat_id)
            return True

        await self._session_service.delete_session(
            app_name=self._app_name,
            user_id=owner_id,
            session_id=chat_id,
        )
        self._messages.pop(chat_id, None)
        await self._chat_vnc_session_service.delete(owner_id, chat_id)
        try:
            await self._ui_agent_session_service.delete_session(
                session_id=chat_id,
                auth_token=auth_token,
            )
        except Exception:  # noqa: BLE001
            pass
        return True

    async def list_messages(self, chat_id: str, owner_id: str) -> list[MessageResponse] | None:
        session = await self._session_service.get_session(
            app_name=self._app_name,
            user_id=owner_id,
            session_id=chat_id,
        )
        if session is None:
            return None
        return self._map_persisted_messages(session)

    async def create_message(
        self,
        chat_id: str,
        owner_id: str,
        payload: MessageCreate,
    ) -> MessageResponse | None:
        session = await self._session_service.get_session(
            app_name=self._app_name,
            user_id=owner_id,
            session_id=chat_id,
        )
        if session is None:
            return None

        created = MessageResponse(
            id=f"msg_{uuid4().hex[:10]}",
            chat_id=chat_id,
            role=payload.role,
            sender=self._sender_from_role(payload.role),
            type="text",
            data={
                "content": payload.content,
                "mime_type": "text/plain",
            },
            content=payload.content,
            attachments=payload.attachments,
            created_at=datetime.now(UTC),
        )
        self._messages.setdefault(chat_id, []).append(created)
        return created

    async def clear_messages(self, chat_id: str, owner_id: str) -> bool:
        session = await self._session_service.get_session(
            app_name=self._app_name,
            user_id=owner_id,
            session_id=chat_id,
        )
        if session is None:
            return False

        self._messages[chat_id] = []
        clear_event = Event(
            author="system",
            actions=EventActions(
                state_delta={
                    "messages_cleared_at": datetime.now(UTC).isoformat(),
                }
            ),
        )
        await self._session_service.append_event(session, clear_event)
        return True

    def _map_persisted_messages(self, session: Session) -> list[MessageResponse]:
        messages: list[MessageResponse] = []
        cleared_at = self._parse_cleared_at(session)

        for event in session.events:
            if event.partial or not event.content or not event.content.parts:
                continue
            if cleared_at is not None and event.timestamp <= cleared_at.timestamp():
                continue

            role = self._role_from_author(event.author)
            sender = self._sender_from_author(event.author)
            created_at = datetime.fromtimestamp(event.timestamp, tz=UTC)
            event_id = self._build_event_message_id(event)

            for part_index, part in enumerate(event.content.parts):
                message = self._map_persisted_part(
                    chat_id=session.id,
                    event_id=event_id,
                    part_index=part_index,
                    part=part,
                    role=role,
                    sender=sender,
                    created_at=created_at,
                )
                if message is not None:
                    messages.append(message)

        return messages

    def _map_persisted_part(
        self,
        *,
        chat_id: str,
        event_id: str,
        part_index: int,
        part: Any,
        role: str,
        sender: str,
        created_at: datetime,
    ) -> MessageResponse | None:
        message_id = f"{event_id}:{part_index}"
        text = getattr(part, "text", None)
        if isinstance(text, str):
            content = text.strip()
            if content:
                return MessageResponse(
                    id=message_id,
                    chat_id=chat_id,
                    role=role,
                    sender=sender,
                    type="text",
                    data={
                        "content": content,
                        "mime_type": "text/plain",
                    },
                    content=content,
                    attachments=[],
                    created_at=created_at,
                )

        function_call = getattr(part, "function_call", None)
        if function_call is not None:
            function_name = getattr(function_call, "name", "").strip() or "function_call"
            arguments = getattr(function_call, "args", None) or {}
            return MessageResponse(
                id=message_id,
                chat_id=chat_id,
                role=role,
                sender=sender,
                type="function_call",
                data={
                    "name": function_name,
                    "arguments": arguments,
                },
                status="running",
                content=f"Calling {function_name}.",
                attachments=[],
                created_at=created_at,
            )

        function_response = getattr(part, "function_response", None)
        if function_response is not None:
            function_name = getattr(function_response, "name", "").strip() or "function_response"
            response = getattr(function_response, "response", None)
            return MessageResponse(
                id=message_id,
                chat_id=chat_id,
                role=role,
                sender=sender,
                type="function_response",
                data={
                    "name": function_name,
                    "response": response,
                },
                status=self._infer_response_status(response),
                content=self._summarize_function_response(function_name, response),
                attachments=[],
                created_at=created_at,
            )

        return None

    def _build_event_message_id(self, event: Event) -> str:
        if event.id:
            return event.id

        timestamp_ms = int((event.timestamp or 0) * 1000)
        author = "".join(
            character if character.isalnum() or character in {"_", "-"} else "_"
            for character in str(event.author or "unknown")
        )
        return f"evt_{timestamp_ms}_{author}"

    def _summarize_function_response(self, function_name: str, response: Any) -> str:
        if isinstance(response, str):
            content = response.strip()
            if content:
                return content

        if isinstance(response, dict):
            for key in ("message", "result", "response", "detail", "error", "error_message"):
                value = response.get(key)
                if isinstance(value, str) and value.strip():
                    return value.strip()

        return f"{function_name} returned a response."

    def _infer_response_status(self, response: Any) -> str | None:
        summary = self._summarize_function_response("function", response).lower()
        if any(token in summary for token in ("fail", "error", "cancel", "denied")):
            return "failed"
        if any(token in summary for token in ("complete", "done", "success", "finished", "final")):
            return "completed"
        return None

    def _role_from_author(self, author: str | None) -> str:
        if author == "user":
            return "user"
        if author == "system":
            return "system"
        return "assistant"

    def _sender_from_author(self, author: str | None) -> str:
        if author == "user":
            return "user"
        if author == "system":
            return "system"
        return "model"

    def _sender_from_role(self, role: str) -> str:
        if role == "user":
            return "user"
        if role == "system":
            return "system"
        return "model"

    def _map_session(self, session: Session, owner_id: str, vnc_record=None) -> ChatSessionResponse:
        created_at = self._parse_created_at(session)
        updated_at = datetime.fromtimestamp(session.last_update_time or created_at.timestamp(), tz=UTC)
        title = str(session.state.get("title") or "Untitled session")
        raw_control_mode = session.state.get("control_mode")
        control_mode = (
            raw_control_mode
            if raw_control_mode in {"agent", "manual"}
            else self._ui_agent_session_service.control_mode
        )
        return ChatSessionResponse(
            id=session.id,
            owner_id=session.user_id,
            title=title,
            control_mode=control_mode,
            vnc_url=vnc_record.vnc_url if vnc_record else None,
            vnc_pending=bool(vnc_record and vnc_record.status == "pending"),
            created_at=created_at,
            updated_at=updated_at,
            selected=False,
        )

    def _parse_created_at(self, session: Session) -> datetime:
        raw_created_at = session.state.get("created_at")
        if isinstance(raw_created_at, str):
            try:
                return datetime.fromisoformat(raw_created_at.replace("Z", "+00:00")).astimezone(UTC)
            except ValueError:
                pass

        if session.last_update_time:
            return datetime.fromtimestamp(session.last_update_time, tz=UTC)

        return datetime.now(UTC)

    def _parse_cleared_at(self, session: Session) -> datetime | None:
        raw_cleared_at = session.state.get("messages_cleared_at")
        if not isinstance(raw_cleared_at, str):
            return None

        try:
            return datetime.fromisoformat(raw_cleared_at.replace("Z", "+00:00")).astimezone(UTC)
        except ValueError:
            return None

    async def _provision_vnc_session(
        self,
        owner_id: str,
        session_id: str,
        auth_token: str,
        control_mode: str,
    ) -> None:
        try:
            vnc_url = await self._ui_agent_session_service.create_session(
                session_id=session_id,
                auth_token=auth_token,
                control_mode=control_mode,
            )
            if vnc_url:
                await self._chat_vnc_session_service.set_ready(owner_id, session_id, vnc_url)
            else:
                await self._chat_vnc_session_service.set_error(owner_id, session_id)
        except Exception:  # noqa: BLE001
            logger.exception("Failed to provision VNC session for chat %s", session_id)
            await self._chat_vnc_session_service.set_error(owner_id, session_id)


@lru_cache
def get_chat_service() -> ChatService:
    settings = get_settings()
    return ChatService(
        session_service=get_adk_session_service(),
        app_name=settings.chat_session_app_name,
        ui_agent_session_service=get_ui_agent_session_service(),
        chat_vnc_session_service=get_chat_vnc_session_service(),
    )
