from pydantic import BaseModel, EmailStr


class Principal(BaseModel):
    user_id: str
    email: EmailStr
    name: str | None = None
    picture: str | None = None
    claims: dict[str, object] | None = None
    token: str | None = None


class WebSocketTicketCreate(BaseModel):
    session_id: str


class WebSocketTicketResponse(BaseModel):
    ticket: str
    user_id: str
    session_id: str
    expires_at: str
