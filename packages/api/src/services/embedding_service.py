"""
Embedding Service - Provides a unified interface for different embedding providers
Follows the same pattern as LLM service in the llamastack implementation
"""

import logging
import os
from abc import ABC, abstractmethod
from typing import List

import httpx
from openai import OpenAI

from ..core.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class EmbeddingProvider(ABC):
    """Abstract base class for embedding providers"""
    
    @abstractmethod
    async def get_embedding(self, text: str) -> List[float]:
        """Generate embedding for the given text"""
        pass
    
    @abstractmethod
    def get_dimensions(self) -> int:
        """Return the dimensionality of embeddings from this provider"""
        pass


class OpenAIEmbeddingProvider(EmbeddingProvider):
    """OpenAI embedding provider"""
    
    def __init__(self):
        self.client = OpenAI(
            api_key=settings.API_KEY,
            base_url=settings.BASE_URL
        )
        self.model = settings.EMBEDDING_MODEL
        self.dimensions = settings.EMBEDDING_DIMENSIONS
    
    async def get_embedding(self, text: str) -> List[float]:
        try:
            response = self.client.embeddings.create(
                input=text.lower(),
                model=self.model
            )
            embedding = response.data[0].embedding
            logger.info(f"Generated {len(embedding)}-dim embedding via OpenAI")
            return embedding
        except Exception as e:
            logger.error(f"Error generating OpenAI embedding: {e}")
            raise
    
    def get_dimensions(self) -> int:
        return self.dimensions


class OllamaEmbeddingProvider(EmbeddingProvider):
    """Ollama embedding provider - local, fast, no API costs"""
    
    def __init__(self):
        self.base_url = settings.OLLAMA_BASE_URL
        self.model = settings.EMBEDDING_MODEL
        self.dimensions = settings.EMBEDDING_DIMENSIONS
        
    async def get_embedding(self, text: str) -> List[float]:
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self.base_url}/api/embeddings",
                    json={
                        "model": self.model,
                        "prompt": text.lower()
                    }
                )
                response.raise_for_status()
                result = response.json()
                
                embedding = result.get("embedding", [])
                if len(embedding) != self.dimensions:
                    raise ValueError(f"Expected {self.dimensions} dimensions, got {len(embedding)}")
                
                logger.info(f"Generated {len(embedding)}-dim embedding via Ollama")
                return embedding
                
        except Exception as e:
            logger.error(f"Error generating Ollama embedding: {e}")
            raise
    
    def get_dimensions(self) -> int:
        return self.dimensions


class LlamaStackEmbeddingProvider(EmbeddingProvider):
    """LlamaStack embedding provider - for future implementation"""
    
    def __init__(self):
        self.base_url = settings.LLAMASTACK_BASE_URL
        self.model = settings.EMBEDDING_MODEL
        self.dimensions = settings.EMBEDDING_DIMENSIONS
        
    async def get_embedding(self, text: str) -> List[float]:
        """
        TODO: Implement LlamaStack embedding API calls
        This will be implemented when the LlamaStack PR merges
        """
        try:
            # Future LlamaStack API implementation
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self.base_url}/embeddings",  # TBD: actual endpoint
                    json={
                        "model": self.model,
                        "input": text.lower()
                    }
                )
                response.raise_for_status()
                result = response.json()
                
                embedding = result.get("embedding", [])
                logger.info(f"Generated {len(embedding)}-dim embedding via LlamaStack")
                return embedding
                
        except Exception as e:
            logger.error(f"Error generating LlamaStack embedding: {e}")
            raise
    
    def get_dimensions(self) -> int:
        return self.dimensions


def get_embedding_client() -> EmbeddingProvider:
    """
    Factory function to get the appropriate embedding provider
    Follows the same pattern as get_llm_client() in the llamastack implementation
    """
    provider = os.getenv('EMBEDDING_PROVIDER', settings.EMBEDDING_PROVIDER)
    
    if provider == 'ollama':
        return OllamaEmbeddingProvider()
    elif provider == 'llamastack':
        return LlamaStackEmbeddingProvider()
    elif provider == 'openai':
        return OpenAIEmbeddingProvider()
    else:
        logger.warning(f"Unknown embedding provider: {provider}, defaulting to ollama")
        return OllamaEmbeddingProvider()


class EmbeddingService:
    """
    Main embedding service that uses the configured provider
    This provides a consistent interface regardless of underlying provider
    """
    
    def __init__(self):
        self.provider = get_embedding_client()
        logger.info(f"Initialized embedding service with provider: {type(self.provider).__name__}")
    
    async def get_embedding(self, text: str) -> List[float]:
        """Generate embedding for text using configured provider"""
        return await self.provider.get_embedding(text)
    
    def get_dimensions(self) -> int:
        """Get embedding dimensions from current provider"""
        return self.provider.get_dimensions()


# Global embedding service instance
embedding_service = EmbeddingService()
