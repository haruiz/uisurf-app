from fastapi import APIRouter, Depends, HTTPException, status

from uisurf_app.core.security import get_current_principal
from uisurf_app.schemas.auth import Principal
from uisurf_app.schemas.remote_session import (
    RemoteSessionActionListResponse,
    RemoteSessionConnectRequest,
    RemoteSessionDisconnectRequest,
    RemoteSessionResponse,
)
from uisurf_app.services.remote_session_service import (
    RemoteSessionService,
    get_remote_session_service,
)

router = APIRouter()


@router.post("/connect", response_model=RemoteSessionResponse, status_code=status.HTTP_202_ACCEPTED)
async def connect_remote_session(
    payload: RemoteSessionConnectRequest,
    principal: Principal = Depends(get_current_principal),
    service: RemoteSessionService = Depends(get_remote_session_service),
) -> RemoteSessionResponse:
    return service.connect(owner_id=principal.user_id, payload=payload)


@router.post("/disconnect", response_model=RemoteSessionResponse)
async def disconnect_remote_session(
    payload: RemoteSessionDisconnectRequest,
    principal: Principal = Depends(get_current_principal),
    service: RemoteSessionService = Depends(get_remote_session_service),
) -> RemoteSessionResponse:
    session = service.disconnect(owner_id=principal.user_id, payload=payload)
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Remote session not found")
    return session


@router.get("/{session_id}", response_model=RemoteSessionResponse)
async def get_remote_session(
    session_id: str,
    principal: Principal = Depends(get_current_principal),
    service: RemoteSessionService = Depends(get_remote_session_service),
) -> RemoteSessionResponse:
    session = service.get_session(owner_id=principal.user_id, session_id=session_id)
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Remote session not found")
    return session


@router.get("/{session_id}/actions", response_model=RemoteSessionActionListResponse)
async def list_remote_session_actions(
    session_id: str,
    principal: Principal = Depends(get_current_principal),
    service: RemoteSessionService = Depends(get_remote_session_service),
) -> RemoteSessionActionListResponse:
    actions = service.list_actions(owner_id=principal.user_id, session_id=session_id)
    if actions is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Remote session not found")
    return RemoteSessionActionListResponse(items=actions)
