from __future__ import annotations

import asyncio
from functools import lru_cache

from google import genai
from google.genai import types

from uisurf_app.core.config import get_settings


PROMPT_REFINER_INSTRUCTIONS = """
You improve prompts for a browser automation agent.

Rewrite the user's prompt to be:
- clear
- concise
- grammatically correct
- free of obvious typos
- better structured for an autonomous web agent

Keep the user's original intent.
Do not invent requirements.
Do not add markdown, labels, bullet points, or explanations.
Return only the improved prompt text.
""".strip()


class PromptRefineService:
    def __init__(self, *, api_key: str, model: str) -> None:
        self._client = genai.Client(api_key=api_key)
        self._model = model

    async def refine_prompt(self, prompt: str) -> str:
        response = await asyncio.to_thread(
            self._client.models.generate_content,
            model=self._model,
            contents=[
                types.Part.from_text(text=PROMPT_REFINER_INSTRUCTIONS),
                types.Part.from_text(text=prompt),
            ],
            config=types.GenerateContentConfig(temperature=0.2),
        )
        refined = (response.text or "").strip()
        return refined or prompt.strip()


@lru_cache
def get_prompt_refine_service() -> PromptRefineService:
    settings = get_settings()
    if not settings.google_api_key:
        raise RuntimeError("GOOGLE_API_KEY is not configured")
    return PromptRefineService(
        api_key=settings.google_api_key,
        model=settings.prompt_refine_model,
    )
