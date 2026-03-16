import logging
from abc import abstractmethod, ABCMeta

from fastapi import WebSocket

logger = logging.getLogger(__name__)

class ApplicationSession(metaclass=ABCMeta):
    def __init__(self, *args, **kwargs):
        """
        Initialize the application.
        This method can be overridden in subclasses to perform custom initialization.
        """
        pass


    @abstractmethod
    async def start(self, ws: WebSocket, *args, **kwargs):
        """
        Process incoming WebSocket requests.
        This method should be implemented to handle the logic of the application.
        """
        raise NotImplementedError("This method should be overridden in subclasses")

    async def cleanup(self):
        """
        Cleanup resources when the application is shutting down.
        This method should be implemented to handle any necessary cleanup logic.
        """
        pass
