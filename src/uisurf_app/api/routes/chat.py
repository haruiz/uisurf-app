from fastapi import APIRouter, Depends, HTTPException, status

from uisurf_app.core.security import get_current_principal
from uisurf_app.schemas.auth import Principal
from uisurf_app.schemas.chat import ChatSessionCreate, ChatSessionListResponse, ChatSessionResponse
from uisurf_app.services.chat_service import ChatService, get_chat_service

router = APIRouter()


@router.get("", response_model=ChatSessionListResponse)
async def list_chat_sessions(
    principal: Principal = Depends(get_current_principal),
    service: ChatService = Depends(get_chat_service),
) -> ChatSessionListResponse:
    return ChatSessionListResponse(items=await service.list_sessions(principal.user_id))


@router.post("", response_model=ChatSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_chat_session(
    payload: ChatSessionCreate,
    principal: Principal = Depends(get_current_principal),
    service: ChatService = Depends(get_chat_service),
) -> ChatSessionResponse:
    return await service.create_session(
        owner_id=principal.user_id,
        payload=payload,
        auth_token=principal.token,
    )


@router.get("/{chat_id}", response_model=ChatSessionResponse)
async def get_chat_session(
    chat_id: str,
    principal: Principal = Depends(get_current_principal),
    service: ChatService = Depends(get_chat_service),
) -> ChatSessionResponse:
    session = await service.get_session(chat_id=chat_id, owner_id=principal.user_id)
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat session not found")
    return session


@router.delete("/{chat_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chat_session(
    chat_id: str,
    principal: Principal = Depends(get_current_principal),
    service: ChatService = Depends(get_chat_service),
) -> None:
    deleted = await service.delete_session(
        chat_id=chat_id,
        owner_id=principal.user_id,
        auth_token=principal.token,
    )
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat session not found")
