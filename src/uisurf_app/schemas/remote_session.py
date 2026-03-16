from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


RemoteStatus = Literal["disconnected", "connecting", "connected", "error"]


class RemoteSessionConnectRequest(BaseModel):
    host: str = Field(min_length=1)
    port: int = Field(default=5900, ge=1, le=65535)
    password: str | None = None
    label: str = Field(default="Browser Agent")


class RemoteSessionDisconnectRequest(BaseModel):
    session_id: str


class RemoteSessionResponse(BaseModel):
    id: str
    owner_id: str
    label: str
    host: str
    port: int
    status: RemoteStatus
    viewer_url: str | None = None
    connected_at: datetime
    last_error: str | None = None


class RemoteSessionActionResponse(BaseModel):
    id: str
    session_id: str
    action: str
    timestamp: datetime


class RemoteSessionActionListResponse(BaseModel):
    items: list[RemoteSessionActionResponse]
