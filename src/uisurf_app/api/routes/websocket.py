from __future__ import annotations

import asyncio
import logging
import traceback

from fastapi import (
    APIRouter,
    Depends,
    Query,
    WebSocket,
    WebSocketDisconnect,
    WebSocketException,
    status,
)
from google.adk import Runner
from google.adk.agents import RunConfig
from google.adk.agents.run_config import StreamingMode
from google.adk.artifacts import InMemoryArtifactService
from google.adk.sessions import BaseSessionService
from google.genai import types as genai_types
from starlette.websockets import WebSocketState

from uisurf_app.agents.uisurf_orchestrator_agent.agent import get_uisurf_orchestrator_agent
from uisurf_app.core.adk_live_session import get_live_adk_session
from uisurf_app.core.adk_session_service import get_adk_session_service
from uisurf_app.core.config import get_settings
from uisurf_app.core.security import get_current_principal, get_ws_principal
from uisurf_app.schemas import Message, MessageType, MessageSender
from uisurf_app.schemas.auth import Principal, WebSocketTicketCreate, WebSocketTicketResponse
from uisurf_app.services.chat_service import ChatService, get_chat_service
from uisurf_app.services.websocket_ticket_service import (
    WebSocketTicketService,
    get_websocket_ticket_service,
)
from uisurf_app.utils.misc_utils import (
    get_remote_browser_agent_url_from_vnc,
    get_remote_desktop_agent_url_from_vnc,
)
from uisurf_app.utils.ws_utils import format_client, send_message, suppress_exception

logger = logging.getLogger(__name__)


router = APIRouter()


@router.post("/tickets", response_model=WebSocketTicketResponse)
async def create_websocket_ticket(
    payload: WebSocketTicketCreate,
    principal: Principal = Depends(get_current_principal),
    ticket_service: WebSocketTicketService = Depends(get_websocket_ticket_service),
) -> WebSocketTicketResponse:
    ticket = ticket_service.issue_ticket(principal=principal, session_id=payload.session_id)
    return WebSocketTicketResponse(
        ticket=ticket.ticket,
        user_id=ticket.user_id,
        session_id=ticket.session_id,
        expires_at=ticket.expires_at.isoformat(),
    )

@router.websocket("/receive/{user_id}/{session_id}")
async def websocket_receiver(
    websocket: WebSocket,
    user_id: str,
    session_id: str,
    vnc_url: str | None = Query(default=None, alias="vnc_url"),
    principal: Principal = Depends(get_ws_principal),
    chat_service: ChatService = Depends(get_chat_service),
    adk_session_service: BaseSessionService = Depends(get_adk_session_service),
) -> None:
    if principal.user_id != user_id:
        raise WebSocketException(
            code=status.WS_1008_POLICY_VIOLATION,
            reason="WebSocket user does not match the authenticated user.",
        )
    app_settings = get_settings()
    app_name = app_settings.chat_session_app_name
    await websocket.accept()

    client_info = format_client(websocket)
    logger.info("WebSocket connection accepted from %s", client_info)
    logger.info("User: %s", principal.email)
    logger.info("Session ID: %s", session_id)
    logger.info("VNC URL: %s", vnc_url)
    live_session = None

    try:
        live_session = get_live_adk_session()
        browser_agent_url = get_remote_browser_agent_url_from_vnc(vnc_url=vnc_url)
        desktop_agent_url = get_remote_desktop_agent_url_from_vnc(vnc_url=vnc_url)
        root_agent = get_uisurf_orchestrator_agent(
            browser_agent_url=browser_agent_url,
            desktop_agent_url=desktop_agent_url,
        )

        runner = Runner(
            agent=root_agent,
            app_name=app_name,
            session_service=adk_session_service,
            artifact_service=InMemoryArtifactService(),
        )
        run_config = RunConfig(
            response_modalities=[genai_types.Modality.TEXT],
            streaming_mode=StreamingMode.BIDI,
        )

        await live_session.start(
            websocket,
            runner=runner,
            run_config=run_config,
            user_id=user_id,
            session_id=session_id,
            vnc_url=vnc_url,
        )

    except WebSocketDisconnect:
        logger.info(f"Client disconnected: {client_info}")
    except asyncio.CancelledError:
        logger.info(f"WebSocket connection cancelled for {client_info}")
    except Exception as exc:
        logger.exception(f"Unexpected error for {client_info}: {exc}")
        if websocket.client_state == WebSocketState.CONNECTED:
            try:
                await send_message(
                    websocket,
                    Message(
                        type=MessageType.ERROR,
                        sender=MessageSender.SYSTEM,
                        data=(
                            f"An unexpected error occurred: {exc}\n"
                            f"{traceback.format_exc()}"
                        ),
                    ),
                )
                # Close with 1011 (internal error)
                await websocket.close(code=1011)
            except Exception:  # noqa: BLE001
                # If we can't notify the client, just make sure it's closed
                with suppress_exception():
                    if websocket.client_state == WebSocketState.CONNECTED:
                        await websocket.close(code=1011)
    finally:
        logger.info(f"WebSocket connection closed for {client_info}")
        if live_session:
            await live_session.cleanup()  # Ensure resources are cleaned up
