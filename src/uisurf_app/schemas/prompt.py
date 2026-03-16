from pydantic import BaseModel, Field


class PromptRefineRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=8000)


class PromptRefineResponse(BaseModel):
    refined_prompt: str
