from __future__ import annotations

import asyncio
import json
from functools import lru_cache
from typing import Any
from urllib import error, parse, request

from uisurf_app.core.config import Settings, get_settings


class UiAgentSessionService:
    def __init__(self, base_url: str | None, control_mode: str, timeout_seconds: float) -> None:
        self._base_url = base_url.rstrip("/") if base_url else None
        self._control_mode = control_mode
        self._timeout_seconds = timeout_seconds

    @property
    def enabled(self) -> bool:
        return bool(self._base_url)

    async def create_session(self, session_id: str, auth_token: str | None) -> str | None:
        if not self.enabled or not auth_token:
            return None
        payload = await self._request(
            method="POST",
            path="/sessions/",
            auth_token=auth_token,
            body={
                "session_id": session_id,
                "control_mode": self._control_mode,
            },
        )
        raw_vnc_url = payload.get("vncUrl")
        if isinstance(raw_vnc_url, str) and raw_vnc_url:
            return raw_vnc_url
        fallback_vnc_url = payload.get("vnc_url")
        if isinstance(fallback_vnc_url, str) and fallback_vnc_url:
            return fallback_vnc_url
        return None

    async def delete_session(self, session_id: str, auth_token: str | None) -> None:
        if not self.enabled or not auth_token:
            return
        try:
            await self._request(
                method="DELETE",
                path=f"/sessions/{parse.quote(session_id, safe='')}",
                auth_token=auth_token,
            )
        except error.HTTPError as exc:
            if exc.code != 404:
                raise

    async def _request(
        self,
        method: str,
        path: str,
        auth_token: str,
        body: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        if not self._base_url:
            return {}

        url = f"{self._base_url}{path}"
        data = json.dumps(body).encode("utf-8") if body is not None else None
        req = request.Request(
            url=url,
            data=data,
            method=method,
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json",
            },
        )

        def send() -> dict[str, Any]:
            with request.urlopen(req, timeout=self._timeout_seconds) as response:
                raw = response.read()
            if not raw:
                return {}
            payload = json.loads(raw.decode("utf-8"))
            return payload if isinstance(payload, dict) else {}

        return await asyncio.to_thread(send)


@lru_cache
def get_ui_agent_session_service() -> UiAgentSessionService:
    settings: Settings = get_settings()
    return UiAgentSessionService(
        base_url=settings.ui_agent_api_base_url,
        control_mode=settings.ui_agent_control_mode,
        timeout_seconds=settings.ui_agent_timeout_seconds,
    )
