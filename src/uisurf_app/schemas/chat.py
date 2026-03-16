from datetime import datetime

from pydantic import BaseModel, Field


class ChatSessionBase(BaseModel):
    title: str = Field(min_length=1, max_length=120)


class ChatSessionCreate(ChatSessionBase):
    pass


class ChatSessionResponse(ChatSessionBase):
    id: str
    owner_id: str
    vnc_url: str | None = None
    vnc_pending: bool = False
    created_at: datetime
    updated_at: datetime
    selected: bool = False


class ChatSessionListResponse(BaseModel):
    items: list[ChatSessionResponse]
