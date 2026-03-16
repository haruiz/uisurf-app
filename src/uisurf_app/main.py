from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from uisurf_app.api.router import api_router
from uisurf_app.core.config import get_settings

from dotenv import load_dotenv

load_dotenv()


def create_app() -> FastAPI:
    settings = get_settings()
    application = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        debug=settings.debug,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    application.include_router(api_router, prefix=settings.api_prefix)

    @application.get("/", tags=["meta"])
    async def root() -> dict[str, str]:
        return {
            "name": settings.app_name,
            "version": settings.app_version,
            "docs_url": "/docs",
        }

    return application


app = create_app()


def main() -> None:
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "uisurf_app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.reload,
    )
