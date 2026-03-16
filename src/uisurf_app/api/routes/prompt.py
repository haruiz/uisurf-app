from fastapi import APIRouter, Depends, HTTPException, status

from uisurf_app.core.security import get_current_principal
from uisurf_app.schemas.auth import Principal
from uisurf_app.schemas.prompt import PromptRefineRequest, PromptRefineResponse
from uisurf_app.services.prompt_refine_service import (
    PromptRefineService,
    get_prompt_refine_service,
)

router = APIRouter()


@router.post("/refine", response_model=PromptRefineResponse, status_code=status.HTTP_200_OK)
async def refine_prompt(
    payload: PromptRefineRequest,
    principal: Principal = Depends(get_current_principal),
    service: PromptRefineService = Depends(get_prompt_refine_service),
) -> PromptRefineResponse:
    del principal
    try:
        refined_prompt = await service.refine_prompt(payload.prompt)
    except RuntimeError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Prompt refinement failed") from error

    return PromptRefineResponse(refined_prompt=refined_prompt)
