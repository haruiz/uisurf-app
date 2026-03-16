from fastapi import APIRouter, Depends, HTTPException, status

from uisurf_app.core.security import get_current_principal
from uisurf_app.schemas.auth import Principal
from uisurf_app.schemas.messages import MessageCreate, MessageListResponse, MessageResponse
from uisurf_app.services.chat_service import ChatService, get_chat_service

router = APIRouter()


@router.get("/chat/{chat_id}", response_model=MessageListResponse)
async def list_messages(
    chat_id: str,
    principal: Principal = Depends(get_current_principal),
    service: ChatService = Depends(get_chat_service),
) -> MessageListResponse:
    messages = await service.list_messages(chat_id=chat_id, owner_id=principal.user_id)
    if messages is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat session not found")
    return MessageListResponse(items=messages)


@router.post("/chat/{chat_id}", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def create_message(
    chat_id: str,
    payload: MessageCreate,
    principal: Principal = Depends(get_current_principal),
    service: ChatService = Depends(get_chat_service),
) -> MessageResponse:
    message = await service.create_message(chat_id=chat_id, owner_id=principal.user_id, payload=payload)
    if message is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat session not found")
    return message


@router.delete("/chat/{chat_id}", status_code=status.HTTP_204_NO_CONTENT)
async def clear_messages(
    chat_id: str,
    principal: Principal = Depends(get_current_principal),
    service: ChatService = Depends(get_chat_service),
) -> None:
    cleared = await service.clear_messages(chat_id=chat_id, owner_id=principal.user_id)
    if not cleared:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat session not found")
