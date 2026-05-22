from datetime import datetime, timezone
from functools import lru_cache
import logging
import os
from pathlib import Path
import socket
import sys


SERVICE_ROOT = Path(__file__).resolve().parents[1]
APP_ROOT = SERVICE_ROOT / 'app'


def bootstrap_python_path() -> None:
    paths_to_add: list[Path] = [SERVICE_ROOT, APP_ROOT]

    windows_site_packages = SERVICE_ROOT / '.venv' / 'Lib' / 'site-packages'
    if windows_site_packages.exists():
        paths_to_add.append(windows_site_packages)

    unix_lib_root = SERVICE_ROOT / '.venv' / 'lib'
    if unix_lib_root.exists():
        for candidate in unix_lib_root.glob('python*/site-packages'):
            if candidate.exists():
                paths_to_add.append(candidate)

    for candidate in paths_to_add:
        candidate_str = str(candidate)
        if candidate_str not in sys.path:
            sys.path.insert(0, candidate_str)


bootstrap_python_path()

from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

if __package__:
    from .recommender import HybridRecommender
    from .schemas import (
        RecommendationResponse,
        SimilarRecommendationRequest,
        TrendingRecommendationRequest,
        UserRecommendationRequest,
        VisualSimilarRecommendationRequest,
    )
    from .settings import get_settings
else:
    from recommender import HybridRecommender
    from schemas import (
        RecommendationResponse,
        SimilarRecommendationRequest,
        TrendingRecommendationRequest,
        UserRecommendationRequest,
        VisualSimilarRecommendationRequest,
    )
    from settings import get_settings

logger = logging.getLogger('tulip-recommender')


DEFAULT_ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
    'http://127.0.0.1:4173',
]


def get_allowed_origins() -> list[str]:
    raw_origins = os.getenv('ALLOWED_ORIGINS', '').strip()
    if raw_origins:
        origins = [origin.strip() for origin in raw_origins.split(',') if origin.strip()]
        if '*' in origins:
            return ['*']
        if origins:
            return origins

    return DEFAULT_ALLOWED_ORIGINS


def get_allowed_origin_regex() -> str | None:
    raw_regex = os.getenv('ALLOWED_ORIGIN_REGEX', '').strip()
    if raw_regex:
        return raw_regex

    if '*' in get_allowed_origins():
        return None

    return r'^https?://(localhost|127\.0\.0\.1)(:\d+)?$'

app = FastAPI(
    title='Tulip Recommendation Service',
    version='1.0.0',
    description='Multi-agent ML recommendations (content + collaborative behavior + popularity/freshness).',
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_origin_regex=get_allowed_origin_regex(),
    allow_credentials=False,
    allow_methods=['POST', 'GET', 'OPTIONS'],
    allow_headers=['*'],
)


def is_port_available(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        return sock.connect_ex((host, port)) != 0


def get_preferred_port() -> int:
    raw_port = os.getenv('RECOMMENDER_PORT', '8010').strip()

    try:
        parsed_port = int(raw_port)
    except ValueError:
        return 8010

    if 1 <= parsed_port <= 65535:
        return parsed_port

    return 8010


def resolve_runtime_port(host: str, preferred_port: int) -> int:
    if is_port_available(host, preferred_port):
        return preferred_port

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind((host, 0))
        return int(sock.getsockname()[1])


def verify_api_key(x_recommender_api_key: str | None = Header(default=None)) -> None:
    settings = get_runtime_settings()

    if x_recommender_api_key != settings.recommender_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Invalid recommender API key.',
        )


@lru_cache(maxsize=1)
def get_runtime_settings():
    return get_settings()


@lru_cache(maxsize=1)
def get_runtime_recommender() -> HybridRecommender:
    settings = get_runtime_settings()
    return HybridRecommender(settings)


def build_response(items) -> RecommendationResponse:
    settings = get_runtime_settings()

    return RecommendationResponse(
        model_version=settings.model_version,
        generated_at=datetime.now(timezone.utc),
        items=items,
    )


@app.get('/health')
def health() -> dict[str, str]:
    return {'status': 'ok', 'service': 'tulip-recommender'}


@app.get('/')
def root() -> dict[str, str]:
    return {
        'status': 'ok',
        'service': 'tulip-recommender',
        'health': '/health',
        'docs': '/docs',
    }


@app.get('/favicon.ico', include_in_schema=False)
def favicon() -> Response:
    return Response(status_code=204)


@app.post('/recommendations/for-you', response_model=RecommendationResponse, dependencies=[Depends(verify_api_key)])
def recommendations_for_you(payload: UserRecommendationRequest) -> RecommendationResponse:
    try:
        recommender = get_runtime_recommender()
        items = recommender.recommend_for_user(user_id=payload.user_id, limit=payload.limit)
        recommender.persist_recommendations(payload.user_id, 'for_you', items)
        return build_response(items)
    except Exception as error:
        logger.exception('Failed to build for-you recommendations', exc_info=error)
        raise HTTPException(status_code=500, detail='Unable to generate for-you recommendations.')


@app.post('/recommendations/wishlist-inspired', response_model=RecommendationResponse, dependencies=[Depends(verify_api_key)])
def recommendations_wishlist_inspired(payload: UserRecommendationRequest) -> RecommendationResponse:
    try:
        recommender = get_runtime_recommender()
        items = recommender.recommend_wishlist_inspired(user_id=payload.user_id, limit=payload.limit)
        recommender.persist_recommendations(payload.user_id, 'wishlist_inspired', items)
        return build_response(items)
    except Exception as error:
        logger.exception('Failed to build wishlist-inspired recommendations', exc_info=error)
        raise HTTPException(status_code=500, detail='Unable to generate wishlist-inspired recommendations.')


@app.post('/recommendations/similar', response_model=RecommendationResponse, dependencies=[Depends(verify_api_key)])
def recommendations_similar(payload: SimilarRecommendationRequest) -> RecommendationResponse:
    try:
        recommender = get_runtime_recommender()
        items = recommender.recommend_similar(
            product_id=payload.product_id,
            limit=payload.limit,
            user_id=payload.user_id,
        )

        if payload.user_id:
            recommender.persist_recommendations(
                user_id=payload.user_id,
                recommendation_type='similar_products',
                items=items,
                source_product_id=payload.product_id,
            )

        return build_response(items)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))
    except Exception as error:
        logger.exception('Failed to build similar recommendations', exc_info=error)
        raise HTTPException(status_code=500, detail='Unable to generate similar recommendations.')


@app.post('/recommendations/visual-similar', response_model=RecommendationResponse, dependencies=[Depends(verify_api_key)])
def recommendations_visual_similar(payload: VisualSimilarRecommendationRequest) -> RecommendationResponse:
    try:
        recommender = get_runtime_recommender()
        items = recommender.recommend_visual_similar(
            image_base64=payload.image_base64,
            image_url=payload.image_url,
            limit=payload.limit,
            user_id=payload.user_id,
        )
        return build_response(items)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
    except Exception as error:
        logger.exception('Failed to build visual similar recommendations', exc_info=error)
        raise HTTPException(status_code=500, detail='Unable to generate visual similar recommendations.')


@app.post('/recommendations/trending', response_model=RecommendationResponse, dependencies=[Depends(verify_api_key)])
def recommendations_trending(payload: TrendingRecommendationRequest) -> RecommendationResponse:
    try:
        recommender = get_runtime_recommender()
        items = recommender.recommend_trending(limit=payload.limit, user_id=payload.user_id)

        if payload.user_id:
            recommender.persist_recommendations(payload.user_id, 'trending', items)

        return build_response(items)
    except Exception as error:
        logger.exception('Failed to build trending recommendations', exc_info=error)
        raise HTTPException(status_code=500, detail='Unable to generate trending recommendations.')


@app.post('/recommendations/cache/refresh', dependencies=[Depends(verify_api_key)])
def refresh_catalog_cache() -> dict[str, str]:
    try:
        recommender = get_runtime_recommender()
        recommender._get_catalog(force_refresh=True)
        return {'status': 'ok', 'message': 'Catalog cache refreshed.'}
    except Exception as error:
        logger.exception('Catalog refresh failed', exc_info=error)
        raise HTTPException(status_code=500, detail='Unable to refresh catalog cache.')


if __name__ == '__main__':
    import uvicorn

    host = os.getenv('RECOMMENDER_HOST', '127.0.0.1').strip() or '127.0.0.1'
    preferred_port = get_preferred_port()
    runtime_port = resolve_runtime_port(host, preferred_port)

    if runtime_port != preferred_port:
        print(f"Port {preferred_port} is already in use. Starting recommender on port {runtime_port} instead.")

    uvicorn.run(app, host=host, port=runtime_port)
