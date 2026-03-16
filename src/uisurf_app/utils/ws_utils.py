from contextlib import contextmanager

from fastapi import WebSocket
from uisurf_app.schemas  import Message

def format_client(ws: WebSocket) -> str:
    """
    Return a compact identifier for the connected client.
    """
    # ws.client is Optional[tuple[str, int]] in Starlette
    try:
        host, port = (ws.client or ("unknown", 0))
        subprotocols = getattr(ws, "subprotocols", None)
        return f"{host}:{port} (subprotocols={subprotocols})"
    except Exception:  # noqa: BLE001
        return "unknown"


async def send_message(ws: WebSocket, message: Message):
    """
    Send a message to the WebSocket client.

    Args:
        ws: The WebSocket connection.
        message: The message to send
    """
    await ws.send_json(message.model_dump(exclude_none=True, mode="json"))



@contextmanager
def suppress_exception():
    try:
        yield
    except Exception:  # noqa: BLE001
        pass
