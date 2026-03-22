from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


MessageRole = Literal["user", "assistant", "system"]
MessageSender = Literal["system", "model", "user"]
MessageType = Literal[
    "error",
    "info",
    "debug",
    "warning",
    "turn_start",
    "turn_complete",
    "interrupted",
    "function_call",
    "function_response",
    "function_progress",
    "log",
    "audio",
    "text",
    "image",
]
MessageStatus = Literal["running", "completed", "failed"]


class MessageAttachment(BaseModel):
    type: Literal["audio", "video", "screen", "image"]
    name: str
    status: Literal["pending", "ready"] = "pending"


class MessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=8000)
    role: MessageRole = "user"
    attachments: list[MessageAttachment] = Field(default_factory=list)


class MessageResponse(BaseModel):
    id: str
    chat_id: str
    content: str = ""
    role: MessageRole = "user"
    sender: MessageSender | None = None
    type: MessageType = "text"
    data: Any | None = None
    status: MessageStatus | None = None
    attachments: list[MessageAttachment] = Field(default_factory=list)
    created_at: datetime


class MessageListResponse(BaseModel):
    items: list[MessageResponse]
