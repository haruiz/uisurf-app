import typing
from enum import Enum
from typing import Dict, Any, Optional

from pydantic import BaseModel, model_validator


class SpeechMode(Enum):
    """
    Enum-like class to define speech modes for Gemini Live Session.
    """
    NARRATION = "narration"
    CONVERSATION = "conversation"

class MessageType(Enum):
    """Enum for message types in WebSocket communication"""
    ERROR = "error"
    INFO = "info"
    DEBUG = "debug"
    WARNING = "warning"
    TURN_START = "turn_start"
    TURN_COMPLETE = "turn_complete"
    TUN_INTERRUPTED = "interrupted"
    FUNCTION_CALL = "function_call"
    FUNCTION_RESPONSE = "function_response"
    FUNCTION_PROGRESS = "function_progress"  # Add this
    LOG = "log"
    AUDIO = "audio"
    TEXT = "text"
    IMAGE = "image"

class FunctionProgressData(BaseModel):
    name: str
    message: str
    progress: float
    total: float
    percentage: float


class MessageSender(Enum):
    """Enum for message senders in WebSocket communication"""
    SYSTEM = "system"
    MODEL = "model"
    USER = "user"


class FunctionCallData(BaseModel):
    """Schema for function call data in WebSocket communication"""
    name: str
    arguments: Dict[str, Any]  # Arguments for the function call, can be any JSON-serializable type
    tool_result: Optional[typing.Union[Dict[str, Any], str]] = None  # Result of the function call, can be a dict or a string

class FunctionResponseData(BaseModel):
    """Schema for function response data in WebSocket communication"""
    name: str  # Name of the function that was called
    response: Optional[typing.Union[Dict[str, Any], str]] = None  # Response from the function call, can be a dict or a string

class SpeechData(BaseModel):
    """Schema for audio data in WebSocket communication"""
    audio: str  # Base64 encoded audio data
    words: dict # Dictionary containing word-level information, e.g., {'start': 0.0, 'end': 1.0, 'confidence': 0.95, 'word': 'hello'}


class MessageData(BaseModel):
    """Schema for audio data in WebSocket communication"""
    content: str  # Text content of the message
    mime_type: str = "text/plain"  # Default content type for text data

class AudioData(MessageData):
    """Schema for audio data in WebSocket communication"""
    speech_mode: SpeechMode = SpeechMode.CONVERSATION  # Speech mode for the audio data
    speech_data: Optional[SpeechData] = None  # Optional speech data if available


# --- Type Mapping and Union ---
MessageDataModel = typing.Union[AudioData,FunctionResponseData,FunctionProgressData, FunctionCallData, MessageData, Dict[str, Any], str, None]

message_type_to_model: Dict[MessageType, typing.Type[BaseModel]] = {
    MessageType.FUNCTION_CALL: FunctionCallData,
    MessageType.AUDIO: AudioData,
    MessageType.IMAGE: MessageData,
    MessageType.TEXT: MessageData,
    MessageType.FUNCTION_RESPONSE: FunctionResponseData,
    MessageType.FUNCTION_PROGRESS: FunctionProgressData,
}


# --- Unified Message Schema ---
class Message(BaseModel):
    type: MessageType = MessageType.INFO
    data: MessageDataModel = None
    sender: MessageSender = MessageSender.SYSTEM
    timestamp: Optional[int] = None

    @model_validator(mode="before")
    @classmethod
    def coerce_data(cls, values: Dict[str, Any]) -> Dict[str, Any]:
        model_cls = message_type_to_model.get(values.get("type"))
        raw_data = values.get("data")
        if model_cls and isinstance(raw_data, dict):
            values["data"] = model_cls(**raw_data)

        return values