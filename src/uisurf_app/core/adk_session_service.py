from functools import lru_cache

from google.adk.sessions import BaseSessionService, InMemorySessionService, VertexAiSessionService
from google.adk.sessions.sqlite_session_service import SqliteSessionService

from uisurf_app.core.config import get_settings


@lru_cache
def get_adk_session_service() -> BaseSessionService:
    settings = get_settings()
    if settings.use_vertex_ai_session_service:
        return VertexAiSessionService(
            project=settings.google_cloud_project,
            location=settings.google_cloud_location,
            agent_engine_id=settings.vertex_ai_agent_engine_id,
        )
    return SqliteSessionService(db_path="sessions.db")
