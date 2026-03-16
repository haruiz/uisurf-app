from functools import lru_cache

import firebase_admin
from firebase_admin import credentials

from uisurf_app.core.config import get_settings


@lru_cache
def get_firebase_app() -> firebase_admin.App:
    settings = get_settings()

    existing = firebase_admin._apps.get("adkwebsurf")
    if existing is not None:
        return existing

    if settings.firebase_client_email and settings.firebase_private_key and settings.firebase_project_id:
        credential = credentials.Certificate(
            {
                "type": "service_account",
                "project_id": settings.firebase_project_id,
                "client_email": settings.firebase_client_email,
                "private_key": settings.firebase_private_key.replace("\\n", "\n"),
            }
        )
        return firebase_admin.initialize_app(credential=credential, name="adkwebsurf")

    if settings.firebase_project_id:
        return firebase_admin.initialize_app(
            options={"projectId": settings.firebase_project_id},
            name="adkwebsurf",
        )

    raise RuntimeError("Firebase admin credentials are not configured.")

