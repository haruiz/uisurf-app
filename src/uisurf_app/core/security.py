from typing import Annotated, Any

from fastapi import Depends, Header, HTTPException, Query, WebSocket, WebSocketException, status
from firebase_admin import auth

from uisurf_app.core.firebase import get_firebase_app
from uisurf_app.core.config import Settings, get_settings
from uisurf_app.schemas.auth import Principal
from uisurf_app.services.websocket_ticket_service import WebSocketTicketService, get_websocket_ticket_service


def resolve_principal_from_token(token: str | None) -> Principal:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Firebase bearer token.",
        )

    try:
        app = get_firebase_app()
        decoded: dict[str, Any] = auth.verify_id_token(token, app=app)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unable to verify Firebase token.",
        ) from exc

    email = decoded.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Firebase token does not include an email.",
        )

    return Principal(
        user_id=decoded["uid"],
        email=email,
        name=decoded.get("name"),
        picture=decoded.get("picture"),
        claims=decoded,
        token=token,
    )


def resolve_principal(authorization: str | None = None) -> Principal:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Firebase bearer token.",
        )

    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Firebase bearer token.",
        )

    return resolve_principal_from_token(token)


def _ws_policy_violation(detail: str) -> WebSocketException:
    return WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason=detail)


async def get_current_principal(
    authorization: Annotated[str | None, Header()] = None,
    settings: Settings = Depends(get_settings),
) -> Principal:
    _ = settings
    return resolve_principal(authorization=authorization)


async def get_ws_principal(
    websocket: WebSocket,
    user_id: str,
    session_id: str,
    ticket: Annotated[str | None, Query(alias="ticket")] = None,
    websocket_ticket_service: WebSocketTicketService = Depends(get_websocket_ticket_service),
    settings: Settings = Depends(get_settings),
) -> Principal:
    _ = websocket
    _ = settings

    resolved_ticket = websocket_ticket_service.resolve_ticket(ticket)
    if resolved_ticket is None:
        raise _ws_policy_violation("Missing or invalid websocket ticket.")
    if resolved_ticket.user_id != user_id or resolved_ticket.session_id != session_id:
        raise _ws_policy_violation("Websocket ticket does not match the requested session.")
    return resolved_ticket.principal
