from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class MultimodalInputCapability(BaseModel):
    kind: Literal["text", "audio", "video", "screen"]
    enabled: bool = True


class MultimodalSessionCreate(BaseModel):
    chat_id: str
    capabilities: list[MultimodalInputCapability] = Field(default_factory=list)


class MultimodalSessionResponse(BaseModel):
    id: str
    chat_id: str
    owner_id: str
    status: Literal["pending", "ready"] = "pending"
    transport: Literal["websocket", "webrtc", "unknown"] = "unknown"
    created_at: datetime
