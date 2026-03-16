from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import UTC, datetime
from functools import lru_cache

from firebase_admin import firestore

from uisurf_app.core.config import get_settings
from uisurf_app.core.firebase import get_firebase_app


@dataclass(slots=True)
class ChatVncSessionRecord:
    owner_id: str
    session_id: str
    vnc_url: str | None
    status: str
    updated_at: datetime


class ChatVncSessionService:
    def __init__(
        self,
        collection_name: str = "chat_vnc_sessions",
        database_id: str | None = None,
    ) -> None:
        self._collection_name = collection_name
        self._database_id = database_id

    async def get(self, owner_id: str, session_id: str) -> ChatVncSessionRecord | None:
        return await asyncio.to_thread(self._get_sync, owner_id, session_id)

    async def get_many(self, owner_id: str, session_ids: list[str]) -> dict[str, ChatVncSessionRecord]:
        if not session_ids:
            return {}
        return await asyncio.to_thread(self._get_many_sync, owner_id, session_ids)

    async def set_pending(self, owner_id: str, session_id: str) -> None:
        await asyncio.to_thread(
            self._upsert_sync,
            owner_id,
            session_id,
            {
                "owner_id": owner_id,
                "session_id": session_id,
                "vnc_url": None,
                "status": "pending",
                "updated_at": firestore.SERVER_TIMESTAMP,
            },
        )

    async def set_ready(self, owner_id: str, session_id: str, vnc_url: str) -> None:
        await asyncio.to_thread(
            self._upsert_sync,
            owner_id,
            session_id,
            {
                "owner_id": owner_id,
                "session_id": session_id,
                "vnc_url": vnc_url,
                "status": "ready",
                "updated_at": firestore.SERVER_TIMESTAMP,
            },
        )

    async def set_error(self, owner_id: str, session_id: str) -> None:
        await asyncio.to_thread(
            self._upsert_sync,
            owner_id,
            session_id,
            {
                "owner_id": owner_id,
                "session_id": session_id,
                "status": "error",
                "updated_at": firestore.SERVER_TIMESTAMP,
            },
        )

    async def delete(self, owner_id: str, session_id: str) -> None:
        await asyncio.to_thread(self._delete_sync, owner_id, session_id)

    def _collection(self):
        client = firestore.client(app=get_firebase_app(), database_id=self._database_id)
        return client.collection(self._collection_name)

    def _doc_id(self, owner_id: str, session_id: str) -> str:
        return f"{owner_id}:{session_id}"

    def _get_sync(self, owner_id: str, session_id: str) -> ChatVncSessionRecord | None:
        snapshot = self._collection().document(self._doc_id(owner_id, session_id)).get()
        if not snapshot.exists:
            return None
        return self._deserialize(snapshot.to_dict() or {}, owner_id, session_id)

    def _get_many_sync(self, owner_id: str, session_ids: list[str]) -> dict[str, ChatVncSessionRecord]:
        records: dict[str, ChatVncSessionRecord] = {}
        for session_id in session_ids:
            record = self._get_sync(owner_id, session_id)
            if record is not None:
                records[session_id] = record
        return records

    def _upsert_sync(self, owner_id: str, session_id: str, payload: dict[str, object]) -> None:
        self._collection().document(self._doc_id(owner_id, session_id)).set(payload, merge=True)

    def _delete_sync(self, owner_id: str, session_id: str) -> None:
        self._collection().document(self._doc_id(owner_id, session_id)).delete()

    def _deserialize(
        self,
        payload: dict[str, object],
        owner_id: str,
        session_id: str,
    ) -> ChatVncSessionRecord:
        raw_updated_at = payload.get("updated_at")
        if isinstance(raw_updated_at, datetime):
            updated_at = raw_updated_at.astimezone(UTC)
        else:
            updated_at = datetime.now(UTC)

        return ChatVncSessionRecord(
            owner_id=str(payload.get("owner_id") or owner_id),
            session_id=str(payload.get("session_id") or session_id),
            vnc_url=str(payload["vnc_url"]) if payload.get("vnc_url") else None,
            status=str(payload.get("status") or "unknown"),
            updated_at=updated_at,
        )


@lru_cache
def get_chat_vnc_session_service() -> ChatVncSessionService:
    settings = get_settings()
    return ChatVncSessionService(database_id=settings.firestore_database_id)
