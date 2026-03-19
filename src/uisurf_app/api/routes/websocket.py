from __future__ import annotations

import asyncio
import logging
import traceback
from urllib.parse import urlparse, urlunparse

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketException, status, WebSocketDisconnect
from google.adk import Runner
from google.adk.agents import RunConfig
from google.adk.agents.llm_agent import Agent
from google.adk.agents.remote_a2a_agent import (
    AGENT_CARD_WELL_KNOWN_PATH,
    RemoteA2aAgent,
)
from google.adk.agents.run_config import StreamingMode
from google.adk.artifacts import InMemoryArtifactService
from google.adk.sessions import BaseSessionService
from google.genai import types as genai_types
from starlette.websockets import WebSocketState

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
from uisurf_app.utils.ws_utils import format_client, send_message, suppress_exception

logger = logging.getLogger(__name__)


router = APIRouter()


def _resolve_live_agent_model() -> str:
    settings = get_settings()
    configured_model = settings.live_agent_model
    if "native-audio" in configured_model:
        text_model = settings.live_agent_text_model
        logger.info(
            "Using text live model %s instead of audio-native model %s for websocket text chat",
            text_model,
            configured_model,
        )
        return text_model
    return configured_model


def _build_a2a_url(vnc_url: str | None, path: str) -> str | None:
    if not vnc_url:
        return None
    parsed = urlparse(vnc_url)
    if not parsed.scheme or not parsed.netloc:
        return None
    base_path = parsed.path or "/"
    if base_path.endswith("/vnc.html"):
        base_path = base_path[: -len("/vnc.html")]
    elif base_path.endswith("vnc.html"):
        base_path = base_path[: -len("vnc.html")]
    agent_path = f"{base_path.rstrip('/')}/{path.strip('/')}/"
    return urlunparse(
        (
            parsed.scheme,
            parsed.netloc,
            agent_path,
            "",
            "",
            "",
        )
    )


def get_uisurf_agent(vnc_url: str | None) -> Agent:
    sub_agents: list[RemoteA2aAgent] = []

    browser_a2a_url = _build_a2a_url(vnc_url, "browser")
    if browser_a2a_url:
        sub_agents.append(
            RemoteA2aAgent(
                name="web_browser_agent",
                description=(
                    "Specialized browser automation agent for interacting with websites and web applications. "
                    "Use this agent for tasks such as opening pages, searching the web, clicking elements, "
                    "filling forms, navigating multi-step workflows, and extracting information from browser-based interfaces."
                ),
                agent_card=f"{browser_a2a_url.rstrip('/')}{AGENT_CARD_WELL_KNOWN_PATH}",
            )
        )

    desktop_a2a_url = _build_a2a_url(vnc_url, "desktop")
    if desktop_a2a_url:
        sub_agents.append(
            RemoteA2aAgent(
                name="desktop_agent",
                description=(
                    "Specialized desktop automation agent for interacting with native desktop environments. "
                    "Use this agent for tasks such as opening desktop applications, clicking UI elements, "
                    "typing text, navigating system dialogs, and completing multi-step workflows outside the browser."
                ),
                agent_card=f"{desktop_a2a_url.rstrip('/')}{AGENT_CARD_WELL_KNOWN_PATH}",
            )
        )

    return Agent(
        model=_resolve_live_agent_model(),
        name="root_agent",
        description=(
            "Universal UI orchestration agent that answers general user questions and coordinates UI automation "
            "through specialized browser and desktop agents."
        ),
        sub_agents=sub_agents,
        instruction=(
            "You are a Universal UI Assistant that helps users answer questions and complete tasks that may require "
            "interacting with browser or desktop interfaces.\n\n"
            "Core responsibilities:\n"
            "- Respond directly to general questions, simple requests, and casual conversation.\n"
            "- Orchestrate UI automation tasks by delegating them to the appropriate specialized agent.\n"
            "- Keep the user informed with concise, clear, and transparent updates.\n\n"
            "Agent selection policy:\n"
            "- Use web_browser_agent for tasks involving websites or browser-based applications.\n"
            "- Use desktop_agent for tasks involving native desktop applications or operating system interfaces.\n"
            "- If no specialized agent is available for the requested task, explain the limitation clearly.\n"
            "- Do not pretend to have completed an action that was not actually performed.\n\n"
            "Execution policy for UI tasks:\n"
            "1. Determine whether the request is a direct question or a UI automation task.\n"
            "2. If it is a UI automation task, create a short actionable plan.\n"
            "3. Delegate the task to the most appropriate specialized agent.\n"
            "4. Briefly explain what is being delegated and why that agent is the correct choice.\n"
            "5. Review the result returned by the specialized agent.\n"
            "6. Interpret the outcome and communicate it clearly to the user.\n"
            "7. Continue the workflow until the user's objective is completed or blocked.\n\n"
            "Communication rules:\n"
            "- Be polite, natural, and helpful.\n"
            "- Keep status updates brief and useful.\n"
            "- Ask a clarifying question when required details are missing.\n"
            "- Provide concise explanations instead of unnecessary internal reasoning.\n"
            "- All user-facing replies must be readable Markdown.\n"
            "- Prefer short paragraphs, bullet lists, and headings only when they improve readability.\n"
            "- Convert raw tool or agent output into polished Markdown before sending it to the user.\n"
            "- If a tool or sub-agent returns JSON, event payloads, traces, or logs, extract the meaning and present "
            "only the useful result in Markdown.\n"
            "- Never emit lines that look like protocol messages, such as JSON objects with keys like eventType, "
            "payload, isFinal, role, or parts.\n"
            "- Never present internal chain-of-thought, hidden reasoning, or meta commentary about your reasoning "
            "process. Summarize the conclusion instead.\n"
            "- Never expose raw agent protocol messages, JSON payloads, event envelopes, internal traces, or "
            "phrases like 'For context: [agent] said ...' in the final user-facing response.\n"
            "- Rewrite every sub-agent result into clean natural language before presenting it to the user.\n"
            "- Present outcomes as a concise summary of what was done and what happened, not as a transcript.\n"
            "- If a delegated step fails or an agent lacks the capability, explain that plainly without quoting "
            "or pasting the sub-agent's raw output.\n"
            "- When handing off from browser work to desktop work, state the handoff clearly in one short sentence.\n\n"
            "Completion rules:\n"
            "- After every delegated task, summarize the steps taken.\n"
            "- State the final result, status, or blocking issue.\n"
            "- Include the next step when the task could not be fully completed.\n\n"
            "Markdown formatting examples:\n"
            "- For a direct answer, respond with one short paragraph.\n"
            "- For multiple results, use a short bullet list with the key facts.\n"
            "- For structured details like hours, phone number, or address, use bullets instead of raw JSON.\n"
            "- Only use fenced code blocks when the user explicitly asks for code or raw data.\n\n"
            "Safety and reliability rules:\n"
            "- Prioritize safe, reliable, and transparent behavior.\n"
            "- Avoid risky, destructive, or unauthorized actions.\n"
            "- Confirm critical intent when an action may have meaningful consequences.\n"
            "- Be honest about what was completed, what failed, and what remains pending."
        ),
    )


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
    adk_session_service : BaseSessionService = Depends(get_adk_session_service)
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
        root_agent = get_uisurf_agent(vnc_url)

        runner = Runner(
            agent=root_agent,
            app_name=app_name,
            session_service=adk_session_service,
            artifact_service=InMemoryArtifactService()
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
