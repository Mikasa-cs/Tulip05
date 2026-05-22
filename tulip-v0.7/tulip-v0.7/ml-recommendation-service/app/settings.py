from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


SERVICE_ROOT = Path(__file__).resolve().parents[1]
ENV_FILE_PATH = SERVICE_ROOT / '.env'


class Settings(BaseSettings):
    supabase_url: str = Field(..., alias='SUPABASE_URL')
    supabase_service_role_key: str = Field(..., alias='SUPABASE_SERVICE_ROLE_KEY')
    recommender_api_key: str = Field(..., alias='RECOMMENDER_API_KEY')
    catalog_ttl_seconds: int = Field(600, alias='CATALOG_TTL_SECONDS')
    max_limit: int = Field(24, alias='RECOMMENDER_MAX_LIMIT')
    user_signals_ttl_seconds: int = Field(45, alias='USER_SIGNALS_TTL_SECONDS')
    user_signals_cache_size: int = Field(2000, alias='USER_SIGNALS_CACHE_SIZE')

    collaborative_enabled: bool = Field(True, alias='COLLABORATIVE_ENABLED')
    collaborative_max_events: int = Field(12000, alias='COLLABORATIVE_MAX_EVENTS')
    collaborative_max_orders: int = Field(2500, alias='COLLABORATIVE_MAX_ORDERS')
    collaborative_max_order_items: int = Field(12000, alias='COLLABORATIVE_MAX_ORDER_ITEMS')
    collaborative_max_items_per_user: int = Field(40, alias='COLLABORATIVE_MAX_ITEMS_PER_USER')
    collaborative_neighbors_per_item: int = Field(80, alias='COLLABORATIVE_NEIGHBORS_PER_ITEM')

    visual_max_candidates: int = Field(800, alias='VISUAL_MAX_CANDIDATES')
    visual_image_timeout_seconds: int = Field(4, alias='VISUAL_IMAGE_TIMEOUT_SECONDS')
    visual_feature_cache_size: int = Field(3000, alias='VISUAL_FEATURE_CACHE_SIZE')
    model_version: str = Field('hybrid-multi-agent-v2', alias='MODEL_VERSION')

    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE_PATH),
        env_file_encoding='utf-8',
        extra='ignore',
        case_sensitive=False,
        populate_by_name=True,
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
