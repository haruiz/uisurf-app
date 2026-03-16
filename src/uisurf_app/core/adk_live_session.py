import asyncio
import base64
import logging
from typing import Optional
from urllib.parse import urlparse

from fastapi import WebSocket, WebSocketDisconnect
from google.adk import Runner
from google.adk.agents import RunConfig
from google.adk.events import Event
from google.genai import errors as genai_errors
from google.genai import types as genai_types

from uisurf_app.schemas import Message, MessageSender, MessageType, AudioData, SpeechMode, \
    FunctionCallData, FunctionResponseData
from .live_session import ApplicationSession
from ..utils.ws_utils import send_message

logger = logging.getLogger(__name__)

# --- Constants for better maintainability ---
AUDIO_MIMETYPE = "audio/pcm;rate=16000"
SHUTDOWN_TIMEOUT = 2.0  # Seconds to wait for tasks to close gracefully


class ADKLiveSession(ApplicationSession):
    """
    Manages a live conversational session between a WebSocket client and a Gemini agent
    using the Google ADK framework, supporting both text and audio modalities.
    """

    def __init__(
        self,
        on_message_callback=None,
    ):
        """
        Initializes the ADKSession instance.

        Args:
            app_name (str): The application name used for session registration.
            user_id (str): Unique user identifier for tracking session state.
            root_agent (Agent): The root agent to handle routing and generation.
            response_modality (Modality): The desired output modality (TEXT or AUDIO).
            voice_name (str): The name of the prebuilt voice to use for speech synthesis (if AUDIO modality).
        """
        super().__init__()
        self._ws: Optional[WebSocket] = None
        self._tasks: list[asyncio.Task] = []
        self._on_message_callback = on_message_callback
        self._runner: Optional[Runner] = None
        self._run_config: Optional[RunConfig] = None
        self._user_id: Optional[str] = None
        self._session_id: Optional[str] = None
        self._vnc_url: Optional[str] = None
        self._vnc_host_base: Optional[str] = None

    async def start(self, ws: WebSocket, *args, **kwargs):
        """
        Entry point for starting the session. Accepts WebSocket connection and begins handling I/O.
        """

        runner: Runner = kwargs["runner"]
        run_config: RunConfig = kwargs["run_config"]
        user_id: str = kwargs["user_id"]
        session_id: str = kwargs["session_id"]
        vnc_url: str | None = kwargs.get("vnc_url")

        self._ws = ws
        self._runner = runner
        self._run_config = run_config
        self._user_id = user_id
        self._session_id = session_id
        self._vnc_url = vnc_url
        self._vnc_host_base = self._extract_host_base(vnc_url)
        await send_message(
            self._ws, Message(
                type=MessageType.DEBUG,
                sender=MessageSender.SYSTEM,
                data="ADK live session started successfully. You can now send messages."
            )
        )
        await self.client_to_agent_messaging()

    async def client_to_agent_messaging(self):
        """
        Listens for user input from the WebSocket and forwards it to the agent.
        """
        logger.info("Listening to WebSocket user input")
        while True:
            raw_data = await self._ws.receive_json()
            user_message = Message.model_validate(raw_data)

            if self._on_message_callback is not None:
                user_message = await self._on_message_callback(user_message)

            if user_message.type == MessageType.TEXT:
                logger.info("Received text message for agent: %s", user_message.data)
                await self._run_text_turn(str(user_message.data))
            elif user_message.type == MessageType.AUDIO:
                logger.warning("Audio input is not supported for text websocket sessions")
                await self._send_error_message("Audio input is not supported for this session.")

    def _extract_host_base(self, value: str | None) -> str | None:
        if not value:
            return None
        parsed = urlparse(value)
        if not parsed.scheme or not parsed.netloc:
            return None
        return f"{parsed.scheme}://{parsed.netloc}"

    async def _run_text_turn(self, text: str):
        if not self._runner or not self._user_id or not self._session_id:
            raise RuntimeError("ADK session is not initialized")

        try:
            await send_message(self._ws, Message(
                type=MessageType.TURN_START,
                sender=MessageSender.SYSTEM
            ))
            async for event in self._runner.run_async(
                user_id=self._user_id,
                session_id=self._session_id,
                new_message=genai_types.Content(
                    role="user",
                    parts=[genai_types.Part(text=text)],
                ),
                run_config=self._run_config,
            ):
                await self._handle_runner_event(event)
            await self._handle_turn_end()
        except genai_errors.APIError as exc:
            logger.error("ADK API error while processing websocket turn: %s", exc)
            await self._send_error_message(str(exc))

    async def _handle_runner_event(self, event: Event):
        if event.turn_complete or event.interrupted:
            await self._handle_turn_end()
            return

        part: genai_types.Part = event.content.parts[0] if event.content and event.content.parts else None
        if not part:
            return

        if part.function_call:
            await self._handle_function_call(part.function_call)
        elif part.inline_data:
            await self._handle_inline_data(part.inline_data)
        elif part.function_response:
            await self._handle_function_response(part.function_response)
        elif part.executable_code:
            logger.info("Received executable code part for user: %s", part.executable_code)
        elif part.code_execution_result:
            logger.info("Received code execution result for user: %s", part.code_execution_result)
        elif part.text:
            await self._handle_text(part.text, is_partial=event.partial)

    async def shutdown(self):
        """
        Cancels all running tasks associated with the session with a timeout.
        """
        logger.info("Shutting down adk session")
        for task in self._tasks:
            if not task.done():
                task.cancel()

        try:
            await asyncio.wait_for(
                asyncio.gather(*self._tasks, return_exceptions=True),
                timeout=SHUTDOWN_TIMEOUT
            )
            logger.info("All session tasks shut down gracefully.")
        except asyncio.TimeoutError:
            logger.warning(
                "Timeout while waiting for tasks to shut down. Some tasks may still be running."
            )

    def cleanup(self):
        """Public method to allow external shutdown triggers."""
        return self.shutdown()

    # --- Helper Methods for Clarity ---

    async def _handle_turn_end(self):
        """
        Handles the end of a turn, either completed or interrupted, and sends a completion message to the client.
        :return:
        """
        await send_message(self._ws, Message(
            type=MessageType.TURN_COMPLETE,
            sender=MessageSender.SYSTEM
        ))

    async def _handle_function_call(self, func_call: genai_types.FunctionCall):
        """
        Handles function call messages from the agent and sends them to the WebSocket client.
        :param func_call:
        :return:
        """
        await send_message(self._ws, Message(
            type=MessageType.FUNCTION_CALL,
            sender=MessageSender.MODEL,
            data=FunctionCallData(name=func_call.name, arguments=func_call.args or {})
        ))

    async def _handle_inline_data(self, inline_data: genai_types.Blob):
        """
        Handles inline data messages from the agent and sends them to the WebSocket client.
        :param inline_data:
        :return:
        """
        if inline_data.mime_type.startswith("audio/pcm"):
            audio_base64 = base64.b64encode(inline_data.data).decode('utf-8')
            await send_message(self._ws, Message(
                type=MessageType.AUDIO,
                sender=MessageSender.MODEL,
                data=AudioData(content=audio_base64, mime_type="application/json", speech_mode=SpeechMode.CONVERSATION)
            ))
        else:
            logger.warning("Received unsupported inline data type: %s", inline_data.mime_type)

    async def _handle_text(self, text: str, is_partial: bool):
        """
        Handles text messages from the agent and sends them to the WebSocket client.
        :param text:
        :param is_partial:
        :return:
        """
        await send_message(self._ws, Message(
            type=MessageType.TEXT,
            sender=MessageSender.MODEL,
            data=text
        ))

    async def _send_error_message(self, error_data: str):
        """
        Sends an error message to the WebSocket client.
        :param error_data:
        :return:
        """
        await send_message(self._ws, Message(
            type=MessageType.ERROR,
            sender=MessageSender.SYSTEM,
            data=error_data
        ))

    async def _handle_function_response(self, function_response: genai_types.FunctionResponse):
        """
        Handles function response messages from the agent and sends them to the WebSocket client.
        :param function_response:
        :return:
        """
        logger.info("Sending function response '%s'", function_response.name)
        logger.info(f"Function response data: {function_response.response}")
        await send_message(self._ws, Message(
            type=MessageType.FUNCTION_RESPONSE,
            sender=MessageSender.MODEL,
            data=FunctionResponseData(
                name=function_response.name,
                response=function_response.response or ""
            )
        ))


def get_live_adk_session(
        on_message_callback = None
):
    """
    Get an adk live session instance.
    """
    return ADKLiveSession(
        on_message_callback=on_message_callback
    )
