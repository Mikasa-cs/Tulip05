from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


class RecommendationItem(BaseModel):
    product_id: str
    score: float
    reason: str


class RecommendationResponse(BaseModel):
    model_version: str
    generated_at: datetime
    items: list[RecommendationItem]


class UserRecommendationRequest(BaseModel):
    user_id: str = Field(..., min_length=10)
    limit: int = Field(8, ge=1, le=50)


class SimilarRecommendationRequest(BaseModel):
    product_id: str = Field(..., min_length=1)
    user_id: str | None = None
    limit: int = Field(8, ge=1, le=50)


class VisualSimilarRecommendationRequest(BaseModel):
    image_base64: str | None = None
    image_url: str | None = None
    user_id: str | None = None
    limit: int = Field(8, ge=1, le=50)

    @model_validator(mode='after')
    def validate_image_source(self) -> 'VisualSimilarRecommendationRequest':
        has_base64 = bool((self.image_base64 or '').strip())
        has_url = bool((self.image_url or '').strip())

        if not has_base64 and not has_url:
            raise ValueError('Either image_base64 or image_url is required.')

        return self


class TrendingRecommendationRequest(BaseModel):
    user_id: str | None = None
    limit: int = Field(8, ge=1, le=50)


class RecommendationPersistRequest(BaseModel):
    user_id: str = Field(..., min_length=10)
    recommendation_type: Literal['for_you', 'wishlist_inspired', 'similar_products', 'trending']
    source_product_id: str | None = None
    items: list[RecommendationItem]

    @field_validator('items')
    @classmethod
    def validate_items(cls, value: list[RecommendationItem]) -> list[RecommendationItem]:
        if not value:
            raise ValueError('items must contain at least one recommendation row')
        return value
