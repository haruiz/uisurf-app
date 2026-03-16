from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


MessageRole = Literal["user", "assistant", "system"]


class MessageAttachment(BaseModel):
    type: Literal["audio", "video", "screen", "image"]
    name: str
    status: Literal["pending", "ready"] = "pending"


class MessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=8000)
    role: MessageRole = "user"
    attachments: list[MessageAttachment] = Field(default_factory=list)


class MessageResponse(MessageCreate):
    id: str
    chat_id: str
    created_at: datetime


class MessageListResponse(BaseModel):
    items: list[MessageResponse]
