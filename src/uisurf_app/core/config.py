from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )
    app_name: str = "UISurf"
    app_version: str = "0.1.0"
    api_prefix: str = "/api/v1"
    debug: bool = False
    host: str = "0.0.0.0"
    port: int = 8000
    reload: bool = True
    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:3000"],
        alias="CORS_ORIGINS",
    )
    firebase_project_id: str | None = None
    firebase_client_email: str | None = None
    firebase_private_key: str | None = None
    firestore_database_id: str | None = None
    google_api_key: str | None = None
    chat_session_app_name: str = "adkwebsurf"
    prompt_refine_model: str = "gemini-2.5-flash"

    ui_agent_api_base_url: str | None = None
    ui_agent_control_mode: str = "agent"
    ui_agent_timeout_seconds: float = 15.0

    google_genai_use_vertexai: bool = True
    google_cloud_project: str | None = None
    google_cloud_location: str = "us-central1"
    vertex_ai_agent_engine_id: str | None = None
    live_agent_model: str = "gemini-2.5-flash-native-audio-preview-12-2025"
    live_agent_text_model: str = "gemini-2.0-flash"
    log_level: str = "INFO"


    @property
    def use_vertex_ai_session_service(self) -> bool:
        return bool(self.google_cloud_project and self.vertex_ai_agent_engine_id)


@lru_cache
def get_settings() -> Settings:
    return Settings()
