from fastapi import APIRouter

from uisurf_app.api.routes import chat, health, messages, prompt, remote_session, websocket

api_router = APIRouter()
api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(chat.router, prefix="/chats", tags=["chats"])
api_router.include_router(messages.router, prefix="/messages", tags=["messages"])
api_router.include_router(prompt.router, prefix="/prompts", tags=["prompts"])
api_router.include_router(
    remote_session.router,
    prefix="/remote-sessions",
    tags=["remote-sessions"],
)
api_router.include_router(websocket.router, prefix="/ws", tags=["websocket"])
