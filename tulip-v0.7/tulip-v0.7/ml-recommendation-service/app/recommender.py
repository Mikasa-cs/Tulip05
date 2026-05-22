from __future__ import annotations

import base64
from collections import Counter, OrderedDict, defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from io import BytesIO
import json
import math
from pathlib import Path
from typing import Any
import urllib.error
import urllib.request

import numpy as np
from scipy.sparse import csr_matrix
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

try:
    from PIL import Image
    _PIL_IMPORT_ERROR: ImportError | None = None
except ImportError as error:
    Image = Any  # type: ignore
    _PIL_IMPORT_ERROR = error

try:
    from supabase import Client, create_client
    _SUPABASE_IMPORT_ERROR: ImportError | None = None
except ImportError as error:
    Client = Any  # type: ignore
    create_client = None  # type: ignore
    _SUPABASE_IMPORT_ERROR = error

try:
    from .schemas import RecommendationItem
    from .settings import Settings
except ImportError:
    from schemas import RecommendationItem
    from settings import Settings


@dataclass
class CatalogCache:
    fetched_at: datetime
    products: list[dict[str, Any]]
    product_ids: list[str]
    image_urls: list[str]
    categories: list[str]
    index_by_id: dict[str, int]
    matrix: csr_matrix
    popularity: np.ndarray
    collaborative_neighbors: dict[str, list[tuple[str, float]]]


@dataclass
class UserSignalCacheEntry:
    fetched_at: datetime
    signals: dict[str, Any]


class HybridRecommender:
    def __init__(self, settings: Settings) -> None:
        if _SUPABASE_IMPORT_ERROR is not None or create_client is None:
            raise RuntimeError(
                "Missing dependency 'supabase'. Install service dependencies with: "
                "python -m venv .venv && .venv\\Scripts\\python.exe -m pip install -r requirements.txt"
            ) from _SUPABASE_IMPORT_ERROR

        if _PIL_IMPORT_ERROR is not None:
            raise RuntimeError(
                "Missing dependency 'Pillow'. Install service dependencies with: "
                "python -m venv .venv && .venv\\Scripts\\python.exe -m pip install -r requirements.txt"
            ) from _PIL_IMPORT_ERROR

        self._settings = settings
        self._supabase = create_client(
            settings.supabase_url,
            settings.supabase_service_role_key,
        )
        self._cache: CatalogCache | None = None
        self._visual_feature_cache: OrderedDict[str, np.ndarray] = OrderedDict()
        self._user_signals_cache: OrderedDict[str, UserSignalCacheEntry] = OrderedDict()

    @staticmethod
    def _clean_token(value: Any) -> str:
        if value is None:
            return ''
        text = str(value).strip().lower()
        if not text:
            return ''
        return text.replace('/', ' ').replace('-', ' ')

    def _build_feature_text(self, product: dict[str, Any]) -> str:
        tokens: list[str] = []

        category = self._clean_token(product.get('category'))
        master_category = self._clean_token(product.get('master_category'))
        sub_category = self._clean_token(product.get('sub_category'))
        article_type = self._clean_token(product.get('article_type'))
        base_colour = self._clean_token(product.get('base_colour'))
        season = self._clean_token(product.get('season'))
        usage = self._clean_token(product.get('usage'))
        gender = self._clean_token(product.get('gender'))
        brand = self._clean_token(product.get('brand'))
        skin_type = self._clean_token(product.get('skin_type'))

        if category:
            tokens.append(f'cat_{category}')
        if master_category:
            tokens.append(f'master_{master_category}')
        if sub_category:
            tokens.append(f'sub_{sub_category}')
        if article_type:
            tokens.append(f'article_{article_type}')
        if base_colour:
            tokens.append(f'colour_{base_colour}')
        if season:
            tokens.append(f'season_{season}')
        if usage:
            tokens.append(f'usage_{usage}')
        if gender:
            tokens.append(f'gender_{gender}')
        if brand:
            tokens.append(f'brand_{brand}')
        if skin_type:
            tokens.append(f'skin_{skin_type}')

        if category and article_type:
            tokens.append(f'cat_article_{category}_{article_type}')
        if category and brand:
            tokens.append(f'cat_brand_{category}_{brand}')
        if usage and article_type:
            tokens.append(f'usage_article_{usage}_{article_type}')

        notable_effects = product.get('notable_effects')
        if isinstance(notable_effects, list):
            for effect in notable_effects:
                token = self._clean_token(effect)
                if token:
                    tokens.append(f'effect_{token}')
        elif isinstance(notable_effects, str):
            token = self._clean_token(notable_effects)
            if token:
                tokens.append(f'effect_{token}')

        return ' '.join(tokens)

    @staticmethod
    def _normalize(values: np.ndarray) -> np.ndarray:
        if values.size == 0:
            return values

        minimum = float(np.min(values))
        maximum = float(np.max(values))
        spread = maximum - minimum
        if spread <= 1e-9:
            return np.zeros_like(values)
        return (values - minimum) / spread

    @staticmethod
    def _parse_utc_datetime(value: Any) -> datetime | None:
        if not isinstance(value, str):
            return None

        normalized = value.strip()
        if not normalized:
            return None

        if normalized.endswith('Z'):
            normalized = normalized[:-1] + '+00:00'

        try:
            parsed = datetime.fromisoformat(normalized)
        except ValueError:
            return None

        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)

        return parsed.astimezone(timezone.utc)

    @staticmethod
    def _safe_bool(value: Any) -> bool:
        return bool(value) if value is not None else False

    @staticmethod
    def _event_base_weight(event_type: str) -> float:
        if event_type == 'add_to_wishlist':
            return 1.05
        if event_type == 'add_to_cart':
            return 0.95
        if event_type == 'view_product':
            return 0.45
        return 0.25

    @staticmethod
    def _time_decay(hours_elapsed: float, half_life_hours: float) -> float:
        safe_half_life = max(1.0, half_life_hours)
        return float(math.exp(-hours_elapsed / safe_half_life))

    def _build_popularity_scores(self, products: list[dict[str, Any]]) -> np.ndarray:
        ratings = np.array([float(item.get('rating') or 0.0) for item in products], dtype=np.float32) / 5.0
        reviews = np.log1p(np.array([float(item.get('reviews') or 0.0) for item in products], dtype=np.float32))
        normalized_reviews = self._normalize(reviews)

        now = datetime.now(timezone.utc)
        freshness_values: list[float] = []

        for item in products:
            updated_at = self._parse_utc_datetime(item.get('updated_at'))
            created_at = self._parse_utc_datetime(item.get('created_at'))
            reference_time = updated_at or created_at

            if reference_time is None:
                freshness_values.append(0.5)
                continue

            age_days = max(0.0, (now - reference_time).total_seconds() / 86400.0)
            freshness_values.append(float(math.exp(-age_days / 180.0)))

        freshness = self._normalize(np.array(freshness_values, dtype=np.float32))

        trending_boost = np.array([
            1.0 if self._safe_bool(item.get('is_trending')) else 0.0 for item in products
        ], dtype=np.float32)
        new_boost = np.array([
            1.0 if self._safe_bool(item.get('is_new')) else 0.0 for item in products
        ], dtype=np.float32)

        return (
            (0.42 * ratings)
            + (0.26 * normalized_reviews)
            + (0.14 * trending_boost)
            + (0.08 * new_boost)
            + (0.10 * freshness)
        )

    def _fetch_catalog_products(self) -> list[dict[str, Any]]:
        remote_products: list[dict[str, Any]] = []

        try:
            response = (
                self._supabase
                .table('products')
                .select(
                    'id,brand,category,master_category,sub_category,article_type,base_colour,season,'
                    'usage,gender,skin_type,notable_effects,rating,reviews,is_trending,is_new,stock,image_url,'
                    'created_at,updated_at'
                )
                .gt('stock', 0)
                .limit(25000)
                .execute()
            )

            products = response.data or []
            remote_products = [item for item in products if item.get('id')]
        except Exception:
            remote_products = []

        fallback_products = self._load_products_from_local_dataset()

        if remote_products:
            if not fallback_products:
                return remote_products

            remote_ids = {str(item.get('id')).strip() for item in remote_products if str(item.get('id') or '').strip()}
            supplemental_local_products = [
                item
                for item in fallback_products
                if str(item.get('id') or '').strip() and str(item.get('id')).strip() not in remote_ids
            ]

            return remote_products + supplemental_local_products

        if fallback_products:
            return fallback_products

        raise RuntimeError('No product catalog available from Supabase or local dataset.')

    @staticmethod
    def _parse_notable_effects(value: Any) -> list[str]:
        if isinstance(value, list):
            return [str(item) for item in value if str(item).strip()]

        if isinstance(value, str):
            cleaned = value.strip()
            if not cleaned:
                return []
            return [part.strip() for part in cleaned.split(',') if part.strip()]

        return []

    def _load_products_from_local_dataset(self) -> list[dict[str, Any]]:
        repo_root = Path(__file__).resolve().parents[2]
        dataset_path = repo_root / 'src' / 'data' / 'tulipProducts.json'

        if not dataset_path.exists():
            return []

        try:
            raw = json.loads(dataset_path.read_text(encoding='utf-8'))
        except Exception:
            return []

        if not isinstance(raw, list):
            return []

        normalized: list[dict[str, Any]] = []

        for item in raw:
            if not isinstance(item, dict):
                continue

            product_id = str(item.get('id') or '').strip()
            if not product_id:
                continue

            stock_value = item.get('stock')
            stock = int(stock_value) if isinstance(stock_value, (int, float)) else 1
            if stock <= 0:
                continue

            normalized.append(
                {
                    'id': product_id,
                    'brand': item.get('brand'),
                    'category': item.get('category'),
                    'master_category': item.get('masterCategory'),
                    'sub_category': item.get('subCategory'),
                    'article_type': item.get('articleType'),
                    'base_colour': item.get('baseColour'),
                    'season': item.get('season'),
                    'usage': item.get('usage'),
                    'gender': item.get('gender'),
                    'skin_type': item.get('skinType'),
                    'notable_effects': self._parse_notable_effects(item.get('notableEffects')),
                    'rating': item.get('rating') or 0,
                    'reviews': item.get('reviews') or 0,
                    'is_trending': bool(item.get('isTrending')),
                    'is_new': bool(item.get('isNew')),
                    'stock': stock,
                    'image_url': item.get('image'),
                    'created_at': f"{int(item.get('year')):04d}-01-01T00:00:00+00:00" if isinstance(item.get('year'), int) else None,
                    'updated_at': None,
                }
            )

        return normalized

    def _build_catalog_cache(self, products: list[dict[str, Any]]) -> CatalogCache:
        product_ids = [str(item['id']) for item in products]
        image_urls = [str(item.get('image_url') or '').strip() for item in products]
        categories = [self._clean_token(item.get('category')) for item in products]
        index_by_id = {product_id: idx for idx, product_id in enumerate(product_ids)}

        corpus = [self._build_feature_text(item) for item in products]
        vectorizer = TfidfVectorizer(
            ngram_range=(1, 2),
            min_df=1,
            norm='l2',
            sublinear_tf=True,
        )
        matrix = vectorizer.fit_transform(corpus)

        popularity = self._build_popularity_scores(products)
        collaborative_neighbors = self._build_collaborative_neighbors(index_by_id)

        return CatalogCache(
            fetched_at=datetime.now(timezone.utc),
            products=products,
            product_ids=product_ids,
            image_urls=image_urls,
            categories=categories,
            index_by_id=index_by_id,
            matrix=matrix,
            popularity=popularity,
            collaborative_neighbors=collaborative_neighbors,
        )

    def _fetch_global_interaction_weights(self, valid_product_ids: set[str]) -> dict[str, dict[str, float]]:
        user_product_weights: dict[str, dict[str, float]] = defaultdict(dict)
        now = datetime.now(timezone.utc)

        max_event_rows = max(2000, int(self._settings.collaborative_max_events))
        max_order_rows = max(800, int(self._settings.collaborative_max_orders))
        max_order_item_rows = max(3000, int(self._settings.collaborative_max_order_items))

        try:
            event_rows = (
                self._supabase
                .table('recommendation_events')
                .select('user_id,product_id,event_type,occurred_at')
                .order('occurred_at', desc=True)
                .limit(max_event_rows)
                .execute()
                .data
                or []
            )
        except Exception:
            event_rows = []

        for row in event_rows:
            user_id = str(row.get('user_id') or '').strip()
            product_id = str(row.get('product_id') or '').strip()

            if not user_id or not product_id or product_id not in valid_product_ids:
                continue

            event_type = str(row.get('event_type') or '').strip()
            base_weight = self._event_base_weight(event_type)

            occurred_at = self._parse_utc_datetime(row.get('occurred_at'))
            if occurred_at is not None:
                hours_elapsed = max(0.0, (now - occurred_at).total_seconds() / 3600.0)
                base_weight *= self._time_decay(hours_elapsed, half_life_hours=336.0)

            current_value = user_product_weights[user_id].get(product_id, 0.0)
            user_product_weights[user_id][product_id] = current_value + base_weight

        try:
            order_rows = (
                self._supabase
                .table('orders')
                .select('id,user_id,created_at')
                .order('created_at', desc=True)
                .limit(max_order_rows)
                .execute()
                .data
                or []
            )
        except Exception:
            order_rows = []

        order_user_map: dict[str, str] = {}
        order_created_map: dict[str, datetime | None] = {}
        order_ids: list[str] = []

        for row in order_rows:
            order_id = str(row.get('id') or '').strip()
            user_id = str(row.get('user_id') or '').strip()
            if not order_id or not user_id:
                continue

            order_ids.append(order_id)
            order_user_map[order_id] = user_id
            order_created_map[order_id] = self._parse_utc_datetime(row.get('created_at'))

        order_item_rows: list[dict[str, Any]] = []
        if order_ids:
            try:
                order_item_rows = (
                    self._supabase
                    .table('order_items')
                    .select('order_id,product_id,quantity')
                    .in_('order_id', order_ids)
                    .limit(max_order_item_rows)
                    .execute()
                    .data
                    or []
                )
            except Exception:
                order_item_rows = []

        for row in order_item_rows:
            order_id = str(row.get('order_id') or '').strip()
            product_id = str(row.get('product_id') or '').strip()
            user_id = order_user_map.get(order_id)

            if not order_id or not product_id or not user_id or product_id not in valid_product_ids:
                continue

            quantity = float(row.get('quantity') or 1.0)
            quantity_weight = min(max(quantity, 1.0), 5.0)
            base_weight = 1.45 * quantity_weight

            created_at = order_created_map.get(order_id)
            if created_at is not None:
                hours_elapsed = max(0.0, (now - created_at).total_seconds() / 3600.0)
                base_weight *= self._time_decay(hours_elapsed, half_life_hours=24.0 * 240.0)

            current_value = user_product_weights[user_id].get(product_id, 0.0)
            user_product_weights[user_id][product_id] = current_value + base_weight

        return user_product_weights

    def _build_collaborative_neighbors(self, index_by_id: dict[str, int]) -> dict[str, list[tuple[str, float]]]:
        if not self._settings.collaborative_enabled:
            return {}

        interaction_weights = self._fetch_global_interaction_weights(set(index_by_id.keys()))
        if not interaction_weights:
            return {}

        pair_scores: dict[str, dict[str, float]] = defaultdict(dict)
        max_items_per_user = max(6, int(self._settings.collaborative_max_items_per_user))

        for product_weights in interaction_weights.values():
            filtered = [
                (product_id, float(weight))
                for product_id, weight in product_weights.items()
                if product_id in index_by_id and float(weight) > 0.0
            ]

            if len(filtered) < 2:
                continue

            filtered.sort(key=lambda item: item[1], reverse=True)
            filtered = filtered[:max_items_per_user]

            total_weight = sum(weight for _, weight in filtered)
            if total_weight <= 0:
                continue

            normalized = [(product_id, weight / total_weight) for product_id, weight in filtered]

            for left_index in range(len(normalized)):
                source_id, source_weight = normalized[left_index]

                for right_index in range(left_index + 1, len(normalized)):
                    target_id, target_weight = normalized[right_index]
                    contribution = (source_weight + target_weight) * 0.5

                    source_map = pair_scores[source_id]
                    target_map = pair_scores[target_id]
                    source_map[target_id] = source_map.get(target_id, 0.0) + contribution
                    target_map[source_id] = target_map.get(source_id, 0.0) + contribution

        neighbors_per_item = max(10, int(self._settings.collaborative_neighbors_per_item))
        collaborative_neighbors: dict[str, list[tuple[str, float]]] = {}

        for source_id, score_map in pair_scores.items():
            if not score_map:
                continue

            sorted_neighbors = sorted(score_map.items(), key=lambda item: item[1], reverse=True)[:neighbors_per_item]
            top_score = float(sorted_neighbors[0][1])
            if top_score <= 1e-9:
                continue

            collaborative_neighbors[source_id] = [
                (target_id, float(score / top_score))
                for target_id, score in sorted_neighbors
                if target_id in index_by_id and score > 0
            ]

        return collaborative_neighbors

    def _get_catalog(self, force_refresh: bool = False) -> CatalogCache:
        now = datetime.now(timezone.utc)
        is_expired = (
            self._cache is None
            or (now - self._cache.fetched_at) > timedelta(seconds=self._settings.catalog_ttl_seconds)
        )

        if force_refresh or is_expired:
            products = self._fetch_catalog_products()
            self._cache = self._build_catalog_cache(products)

        if self._cache is None:
            raise RuntimeError('Catalog cache is not initialized.')

        return self._cache

    def _collect_user_signals(self, user_id: str) -> dict[str, Any]:
        wishlist_rows = []
        cart_rows = []
        order_rows = []
        order_item_rows = []
        event_rows = []

        try:
            wishlist_rows = (
                self._supabase
                .table('wishlist_items')
                .select('product_id')
                .eq('user_id', user_id)
                .limit(300)
                .execute()
                .data
                or []
            )
        except Exception:
            wishlist_rows = []

        try:
            cart_rows = (
                self._supabase
                .table('cart_items')
                .select('product_id,quantity')
                .eq('user_id', user_id)
                .limit(200)
                .execute()
                .data
                or []
            )
        except Exception:
            cart_rows = []

        try:
            order_rows = (
                self._supabase
                .table('orders')
                .select('id')
                .eq('user_id', user_id)
                .order('created_at', desc=True)
                .limit(120)
                .execute()
                .data
                or []
            )
        except Exception:
            order_rows = []

        order_ids = [str(row['id']) for row in order_rows if row.get('id')]
        if order_ids:
            try:
                order_item_rows = (
                    self._supabase
                    .table('order_items')
                    .select('order_id,product_id,quantity')
                    .in_('order_id', order_ids)
                    .limit(3000)
                    .execute()
                    .data
                    or []
                )
            except Exception:
                order_item_rows = []

        try:
            event_rows = (
                self._supabase
                .table('recommendation_events')
                .select('product_id,event_type,occurred_at')
                .eq('user_id', user_id)
                .in_('event_type', ['view_product', 'add_to_cart', 'add_to_wishlist'])
                .order('occurred_at', desc=True)
                .limit(450)
                .execute()
                .data
                or []
            )
        except Exception:
            event_rows = []

        wishlist_ids = [str(row['product_id']) for row in wishlist_rows if row.get('product_id')]
        cart_pairs = [
            (str(row['product_id']), float(row.get('quantity') or 1.0))
            for row in cart_rows
            if row.get('product_id')
        ]
        ordered_pairs = [
            (str(row['product_id']), float(row.get('quantity') or 1.0))
            for row in order_item_rows
            if row.get('product_id')
        ]
        interaction_events = [
            (
                str(row['product_id']),
                str(row.get('event_type') or '').strip(),
                row.get('occurred_at'),
            )
            for row in event_rows
            if row.get('product_id')
        ]
        viewed_ids = [product_id for product_id, event_type, _ in interaction_events if event_type == 'view_product']

        wishlist_set = set(wishlist_ids)
        cart_product_ids = {product_id for product_id, _ in cart_pairs}
        ordered_product_ids = {product_id for product_id, _ in ordered_pairs}
        event_product_ids = {product_id for product_id, _, _ in interaction_events}

        strict_exclude_ids = set(wishlist_set)
        strict_exclude_ids.update(cart_product_ids)
        strict_exclude_ids.update(ordered_product_ids)

        transaction_exclude_ids = set(cart_product_ids)
        transaction_exclude_ids.update(ordered_product_ids)

        seen_ids = set(wishlist_ids)
        seen_ids.update(product_id for product_id, _ in cart_pairs)
        seen_ids.update(product_id for product_id, _ in ordered_pairs)
        seen_ids.update(product_id for product_id, _, _ in interaction_events)

        return {
            'wishlist_ids': wishlist_ids,
            'cart_pairs': cart_pairs,
            'ordered_pairs': ordered_pairs,
            'interaction_events': interaction_events,
            'viewed_ids': viewed_ids,
            'strict_exclude_ids': strict_exclude_ids,
            'transaction_exclude_ids': transaction_exclude_ids,
            'event_product_ids': event_product_ids,
            'seen_ids': seen_ids,
        }

    def _get_user_signals(self, user_id: str) -> dict[str, Any]:
        normalized_user_id = user_id.strip()
        if not normalized_user_id:
            return {
                'wishlist_ids': [],
                'cart_pairs': [],
                'ordered_pairs': [],
                'interaction_events': [],
                'viewed_ids': [],
                'strict_exclude_ids': set(),
                'transaction_exclude_ids': set(),
                'event_product_ids': set(),
                'seen_ids': set(),
            }

        now = datetime.now(timezone.utc)
        cache_entry = self._user_signals_cache.get(normalized_user_id)
        ttl_seconds = max(5, int(self._settings.user_signals_ttl_seconds))

        if cache_entry is not None:
            if (now - cache_entry.fetched_at) <= timedelta(seconds=ttl_seconds):
                self._user_signals_cache.move_to_end(normalized_user_id)
                return cache_entry.signals

        signals = self._collect_user_signals(normalized_user_id)
        self._user_signals_cache[normalized_user_id] = UserSignalCacheEntry(
            fetched_at=now,
            signals=signals,
        )
        self._user_signals_cache.move_to_end(normalized_user_id)

        max_cache_size = max(50, int(self._settings.user_signals_cache_size))
        while len(self._user_signals_cache) > max_cache_size:
            self._user_signals_cache.popitem(last=False)

        return signals

    def _build_user_product_weights(self, signals: dict[str, Any]) -> dict[str, float]:
        weights_by_product: dict[str, float] = {}

        for product_id, quantity in signals.get('ordered_pairs', []):
            weights_by_product[product_id] = weights_by_product.get(product_id, 0.0) + min(quantity, 4.0) * 1.25

        for product_id in signals.get('wishlist_ids', []):
            weights_by_product[product_id] = weights_by_product.get(product_id, 0.0) + 1.1

        for product_id, quantity in signals.get('cart_pairs', []):
            weights_by_product[product_id] = weights_by_product.get(product_id, 0.0) + min(quantity, 4.0) * 0.95

        now = datetime.now(timezone.utc)
        for product_id, event_type, occurred_at in signals.get('interaction_events', []):
            base_weight = self._event_base_weight(event_type)

            parsed_occurred_at = self._parse_utc_datetime(occurred_at)
            if parsed_occurred_at is not None:
                hours_elapsed = max(0.0, (now - parsed_occurred_at).total_seconds() / 3600.0)
                base_weight *= self._time_decay(hours_elapsed, half_life_hours=96.0)

            weights_by_product[product_id] = weights_by_product.get(product_id, 0.0) + base_weight

        return weights_by_product

    def _build_user_profile_vector(
        self,
        cache: CatalogCache,
        signals: dict[str, Any],
    ) -> tuple[csr_matrix | None, set[str], dict[str, float]]:
        weights_by_product = self._build_user_product_weights(signals)

        profile_vector: csr_matrix | None = None
        usable_product_ids: set[str] = set()
        usable_weight_map: dict[str, float] = {}

        for product_id, weight in weights_by_product.items():
            product_index = cache.index_by_id.get(product_id)
            if product_index is None or weight <= 0:
                continue

            weighted_row = cache.matrix[product_index] * weight
            profile_vector = weighted_row if profile_vector is None else profile_vector + weighted_row
            usable_product_ids.add(product_id)
            usable_weight_map[product_id] = float(weight)

        if usable_weight_map:
            max_weight = max(usable_weight_map.values())
            if max_weight > 1e-9:
                usable_weight_map = {
                    product_id: float(weight / max_weight)
                    for product_id, weight in usable_weight_map.items()
                }

        return profile_vector, usable_product_ids, usable_weight_map

    def _build_collaborative_scores(self, cache: CatalogCache, seed_weights: dict[str, float]) -> np.ndarray:
        scores = np.zeros(len(cache.product_ids), dtype=np.float32)

        if not seed_weights or not cache.collaborative_neighbors:
            return scores

        for source_product_id, source_weight in seed_weights.items():
            if source_weight <= 0:
                continue

            for target_product_id, similarity_score in cache.collaborative_neighbors.get(source_product_id, []):
                target_index = cache.index_by_id.get(target_product_id)
                if target_index is None:
                    continue

                scores[target_index] += float(source_weight * similarity_score)

        return self._normalize(scores)

    def _build_category_preference_scores(self, cache: CatalogCache, seed_weights: dict[str, float]) -> np.ndarray:
        if not seed_weights:
            return np.zeros(len(cache.product_ids), dtype=np.float32)

        category_weights: Counter[str] = Counter()

        for product_id, weight in seed_weights.items():
            if weight <= 0:
                continue

            product_index = cache.index_by_id.get(product_id)
            if product_index is None:
                continue

            category = cache.categories[product_index]
            if category:
                category_weights[category] += float(weight)

        if not category_weights:
            return np.zeros(len(cache.product_ids), dtype=np.float32)

        top_categories = category_weights.most_common(4)
        total_weight = sum(weight for _, weight in top_categories)
        if total_weight <= 1e-9:
            return np.zeros(len(cache.product_ids), dtype=np.float32)

        normalized_category_weight = {
            category: float(weight / total_weight)
            for category, weight in top_categories
        }

        return np.array(
            [normalized_category_weight.get(category, 0.0) for category in cache.categories],
            dtype=np.float32,
        )

    def _combine_agent_scores(
        self,
        catalog_size: int,
        agents: list[tuple[np.ndarray, float]],
    ) -> np.ndarray:
        if catalog_size <= 0:
            return np.array([], dtype=np.float32)

        normalized_agents: list[tuple[np.ndarray, float]] = []

        for raw_scores, weight in agents:
            if weight <= 0:
                continue
            if raw_scores.size != catalog_size:
                continue

            safe_scores = np.where(np.isfinite(raw_scores), raw_scores, 0.0).astype(np.float32)
            normalized_scores = self._normalize(safe_scores)

            if normalized_scores.size == 0:
                continue
            if float(np.max(normalized_scores)) <= 1e-9:
                continue

            normalized_agents.append((normalized_scores, float(weight)))

        if not normalized_agents:
            return np.zeros(catalog_size, dtype=np.float32)

        total_weight = sum(weight for _, weight in normalized_agents)
        if total_weight <= 1e-9:
            return np.zeros(catalog_size, dtype=np.float32)

        combined_scores = np.zeros(catalog_size, dtype=np.float32)
        for normalized_scores, weight in normalized_agents:
            combined_scores += normalized_scores * (weight / total_weight)

        return combined_scores

    @staticmethod
    def _sanitize_limit(requested_limit: int, max_limit: int) -> int:
        return max(1, min(int(requested_limit), int(max_limit)))

    @staticmethod
    def _is_http_url(value: str) -> bool:
        normalized_value = value.strip().lower()
        return normalized_value.startswith('http://') or normalized_value.startswith('https://')

    @staticmethod
    def _decode_base64_image(image_base64: str) -> bytes | None:
        if not image_base64:
            return None

        cleaned_value = image_base64.strip()
        if not cleaned_value:
            return None

        if cleaned_value.lower().startswith('data:') and ',' in cleaned_value:
            cleaned_value = cleaned_value.split(',', 1)[1]

        cleaned_value = ''.join(cleaned_value.split())
        if not cleaned_value:
            return None

        try:
            return base64.b64decode(cleaned_value, validate=True)
        except Exception:
            return None

    @staticmethod
    def _extract_visual_feature_vector(image_bytes: bytes) -> np.ndarray | None:
        if not image_bytes:
            return None

        try:
            with Image.open(BytesIO(image_bytes)) as image:
                rgb_image = image.convert('RGB').resize((112, 112))
                hsv_image = rgb_image.convert('HSV')
                gray_image = rgb_image.convert('L')
        except Exception:
            return None

        rgb_pixels = np.asarray(rgb_image, dtype=np.float32) / 255.0
        hsv_pixels = np.asarray(hsv_image, dtype=np.float32)
        gray_pixels = np.asarray(gray_image, dtype=np.float32) / 255.0

        mean_rgb = rgb_pixels.mean(axis=(0, 1))
        std_rgb = rgb_pixels.std(axis=(0, 1))

        hue_hist, _ = np.histogram(hsv_pixels[..., 0], bins=12, range=(0, 255), density=True)
        sat_hist, _ = np.histogram(hsv_pixels[..., 1], bins=4, range=(0, 255), density=True)
        val_hist, _ = np.histogram(hsv_pixels[..., 2], bins=4, range=(0, 255), density=True)

        gradient_x = np.abs(np.diff(gray_pixels, axis=1)).mean(dtype=np.float32)
        gradient_y = np.abs(np.diff(gray_pixels, axis=0)).mean(dtype=np.float32)

        feature_vector = np.concatenate(
            [
                mean_rgb,
                std_rgb,
                hue_hist.astype(np.float32),
                sat_hist.astype(np.float32),
                val_hist.astype(np.float32),
                np.array([gradient_x, gradient_y], dtype=np.float32),
            ]
        ).astype(np.float32)

        if feature_vector.size == 0 or not np.isfinite(feature_vector).all():
            return None

        magnitude = float(np.linalg.norm(feature_vector))
        if magnitude <= 1e-8:
            return None

        return feature_vector / magnitude

    def _download_image_bytes(self, image_url: str) -> bytes | None:
        normalized_url = image_url.strip()
        if not self._is_http_url(normalized_url):
            return None

        request = urllib.request.Request(
            normalized_url,
            headers={
                'User-Agent': 'TulipRecommender/1.0',
            },
        )

        timeout_seconds = max(1, int(self._settings.visual_image_timeout_seconds))
        max_payload_bytes = 4 * 1024 * 1024

        try:
            with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
                payload = response.read(max_payload_bytes + 1)
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, ValueError):
            return None
        except Exception:
            return None

        if not payload or len(payload) > max_payload_bytes:
            return None

        return payload

    def _get_cached_visual_feature(self, image_url: str) -> np.ndarray | None:
        normalized_url = image_url.strip()
        if not normalized_url:
            return None

        cached_feature = self._visual_feature_cache.get(normalized_url)
        if cached_feature is not None:
            self._visual_feature_cache.move_to_end(normalized_url)
            return cached_feature

        image_bytes = self._download_image_bytes(normalized_url)
        if image_bytes is None:
            return None

        feature_vector = self._extract_visual_feature_vector(image_bytes)
        if feature_vector is None:
            return None

        self._visual_feature_cache[normalized_url] = feature_vector
        self._visual_feature_cache.move_to_end(normalized_url)

        cache_size_limit = max(100, int(self._settings.visual_feature_cache_size))
        while len(self._visual_feature_cache) > cache_size_limit:
            self._visual_feature_cache.popitem(last=False)

        return feature_vector

    def _build_visual_query_feature(self, image_base64: str | None, image_url: str | None) -> np.ndarray | None:
        if image_base64 and image_base64.strip():
            decoded_bytes = self._decode_base64_image(image_base64)
            if decoded_bytes is not None:
                feature_vector = self._extract_visual_feature_vector(decoded_bytes)
                if feature_vector is not None:
                    return feature_vector

        if image_url and image_url.strip():
            return self._get_cached_visual_feature(image_url)

        return None

    def _select_visual_candidate_indices(self, cache: CatalogCache, limit: int = 8) -> np.ndarray:
        catalog_size = len(cache.product_ids)
        if catalog_size == 0:
            return np.array([], dtype=np.int32)

        max_candidates = max(50, int(self._settings.visual_max_candidates))
        dynamic_limit = max(120, int(limit) * 40)
        candidate_limit = min(max_candidates, dynamic_limit, catalog_size)
        return np.argsort(cache.popularity)[::-1][:candidate_limit]

    def _to_recommendation_items(
        self,
        cache: CatalogCache,
        scores: np.ndarray,
        limit: int,
        reason: str,
        exclude_product_ids: set[str] | None = None,
    ) -> list[RecommendationItem]:
        exclude_product_ids = exclude_product_ids or set()

        if scores.size != len(cache.product_ids):
            raise ValueError('Score vector length does not match catalog size.')

        finite_indices = np.flatnonzero(np.isfinite(scores))
        if finite_indices.size == 0:
            return []

        short_list_size = min(finite_indices.size, max(limit * 25, 350))
        if short_list_size < finite_indices.size:
            shortlist_positions = np.argpartition(scores[finite_indices], -short_list_size)[-short_list_size:]
            shortlist_indices = finite_indices[shortlist_positions]
        else:
            shortlist_indices = finite_indices

        ranked_indices = shortlist_indices[np.argsort(scores[shortlist_indices])[::-1]]
        recommendations: list[RecommendationItem] = []
        emitted_product_ids: set[str] = set()

        for index in ranked_indices:
            product_id = cache.product_ids[int(index)]
            if product_id in exclude_product_ids:
                continue
            if product_id in emitted_product_ids:
                continue

            score = float(scores[int(index)])
            if not np.isfinite(score):
                continue

            recommendations.append(
                RecommendationItem(
                    product_id=product_id,
                    score=round(score, 6),
                    reason=reason,
                ),
            )
            emitted_product_ids.add(product_id)

            if len(recommendations) >= limit:
                break

        if len(recommendations) >= limit or short_list_size >= finite_indices.size:
            return recommendations

        full_ranked_indices = finite_indices[np.argsort(scores[finite_indices])[::-1]]
        for index in full_ranked_indices:
            product_id = cache.product_ids[int(index)]
            if product_id in exclude_product_ids or product_id in emitted_product_ids:
                continue

            score = float(scores[int(index)])
            if not np.isfinite(score):
                continue

            recommendations.append(
                RecommendationItem(
                    product_id=product_id,
                    score=round(score, 6),
                    reason=reason,
                ),
            )
            emitted_product_ids.add(product_id)

            if len(recommendations) >= limit:
                break

        return recommendations

    def _build_category_boost(self, cache: CatalogCache, seen_product_ids: set[str]) -> np.ndarray:
        if not seen_product_ids:
            return np.zeros(len(cache.product_ids), dtype=np.float32)

        category_counter: Counter[str] = Counter()
        for product_id in seen_product_ids:
            index = cache.index_by_id.get(product_id)
            if index is None:
                continue
            category = cache.categories[index]
            if category:
                category_counter[category] += 1

        if not category_counter:
            return np.zeros(len(cache.product_ids), dtype=np.float32)

        top_categories = {category for category, _ in category_counter.most_common(3)}
        return np.array(
            [0.12 if category in top_categories else 0.0 for category in cache.categories],
            dtype=np.float32,
        )

    def recommend_for_user(self, user_id: str, limit: int = 8) -> list[RecommendationItem]:
        cache = self._get_catalog()
        safe_limit = self._sanitize_limit(limit, self._settings.max_limit)
        signals = self._get_user_signals(user_id)

        profile_vector, _, seed_weights = self._build_user_profile_vector(cache, signals)
        if profile_vector is None and not seed_weights:
            return self.recommend_trending(limit=safe_limit, user_id=user_id)

        if profile_vector is None:
            affinity_scores = np.zeros(len(cache.product_ids), dtype=np.float32)
        else:
            affinity_scores = cosine_similarity(profile_vector, cache.matrix).ravel().astype(np.float32)

        collaborative_scores = self._build_collaborative_scores(cache, seed_weights)
        category_scores = self._build_category_preference_scores(cache, seed_weights)

        combined_scores = self._combine_agent_scores(
            catalog_size=len(cache.product_ids),
            agents=[
                (affinity_scores, 0.48),
                (collaborative_scores, 0.27),
                (category_scores, 0.10),
                (cache.popularity, 0.15),
            ],
        )

        if combined_scores.size == 0 or float(np.max(combined_scores)) <= 1e-9:
            return self.recommend_trending(limit=safe_limit, user_id=user_id)

        recommendations = self._to_recommendation_items(
            cache=cache,
            scores=combined_scores,
            limit=safe_limit,
            reason='Matched by multi-agent profile, shopper behavior, and trends',
            exclude_product_ids=set(signals.get('strict_exclude_ids', set())),
        )

        if recommendations:
            return recommendations

        return self.recommend_trending(limit=safe_limit, user_id=user_id)

    def recommend_wishlist_inspired(self, user_id: str, limit: int = 8) -> list[RecommendationItem]:
        cache = self._get_catalog()
        safe_limit = self._sanitize_limit(limit, self._settings.max_limit)
        signals = self._get_user_signals(user_id)

        wishlist_ids = [product_id for product_id in signals.get('wishlist_ids', []) if product_id in cache.index_by_id]
        if not wishlist_ids:
            return self.recommend_for_user(user_id=user_id, limit=safe_limit)

        seed_indices = [cache.index_by_id[product_id] for product_id in wishlist_ids[:20]]
        similarity_matrix = cosine_similarity(cache.matrix[seed_indices], cache.matrix)
        wishlist_max = np.asarray(similarity_matrix.max(axis=0)).ravel().astype(np.float32)
        wishlist_mean = np.asarray(similarity_matrix.mean(axis=0)).ravel().astype(np.float32)
        wishlist_affinity = (0.72 * wishlist_max) + (0.28 * wishlist_mean)

        user_weight_map = self._build_user_product_weights(signals)
        seed_weights: dict[str, float] = {product_id: 1.0 for product_id in wishlist_ids[:40]}
        for product_id, weight in user_weight_map.items():
            seed_weights[product_id] = max(seed_weights.get(product_id, 0.0), float(weight) * 0.65)

        if seed_weights:
            max_weight = max(seed_weights.values())
            if max_weight > 1e-9:
                seed_weights = {
                    product_id: float(weight / max_weight)
                    for product_id, weight in seed_weights.items()
                }

        collaborative_scores = self._build_collaborative_scores(cache, seed_weights)
        category_scores = self._build_category_preference_scores(cache, seed_weights)

        combined_scores = self._combine_agent_scores(
            catalog_size=len(cache.product_ids),
            agents=[
                (wishlist_affinity, 0.57),
                (collaborative_scores, 0.24),
                (category_scores, 0.09),
                (cache.popularity, 0.10),
            ],
        )

        exclude_product_ids = set(signals.get('strict_exclude_ids', set()))
        recommendations = self._to_recommendation_items(
            cache=cache,
            scores=combined_scores,
            limit=safe_limit,
            reason='Inspired by your wishlist and similar shopper patterns',
            exclude_product_ids=exclude_product_ids,
        )

        if recommendations:
            return recommendations

        return self.recommend_for_user(user_id=user_id, limit=safe_limit)

    def recommend_similar(
        self,
        product_id: str,
        limit: int = 8,
        user_id: str | None = None,
    ) -> list[RecommendationItem]:
        cache = self._get_catalog()
        safe_limit = self._sanitize_limit(limit, self._settings.max_limit)

        source_index = cache.index_by_id.get(product_id)
        if source_index is None:
            if user_id:
                return self.recommend_for_user(user_id=user_id, limit=safe_limit)
            return self.recommend_trending(limit=safe_limit, user_id=None)

        content_scores = cosine_similarity(cache.matrix[source_index], cache.matrix).ravel().astype(np.float32)

        collaborative_seed_weights: dict[str, float] = {product_id: 1.0}
        exclude_product_ids: set[str] = {product_id}

        if user_id:
            signals = self._get_user_signals(user_id)
            exclude_product_ids.update(signals.get('strict_exclude_ids', set()))

            user_weights = self._build_user_product_weights(signals)
            if user_weights:
                max_user_weight = max(user_weights.values())
                if max_user_weight > 1e-9:
                    for candidate_product_id, weight in user_weights.items():
                        collaborative_seed_weights[candidate_product_id] = max(
                            collaborative_seed_weights.get(candidate_product_id, 0.0),
                            float(weight / max_user_weight) * 0.35,
                        )

        collaborative_scores = self._build_collaborative_scores(cache, collaborative_seed_weights)

        source_category = cache.categories[source_index]
        category_scores = np.array(
            [1.0 if source_category and category == source_category else 0.0 for category in cache.categories],
            dtype=np.float32,
        )

        combined_scores = self._combine_agent_scores(
            catalog_size=len(cache.product_ids),
            agents=[
                (content_scores, 0.62),
                (collaborative_scores, 0.23),
                (cache.popularity, 0.08),
                (category_scores, 0.07),
            ],
        )

        if combined_scores.size > source_index:
            combined_scores[source_index] = -np.inf

        recommendations = self._to_recommendation_items(
            cache=cache,
            scores=combined_scores,
            limit=safe_limit,
            reason='Similar style blended with multi-agent shopper behavior',
            exclude_product_ids=exclude_product_ids,
        )

        if recommendations:
            return recommendations

        return self.recommend_trending(limit=safe_limit, user_id=user_id)

    def recommend_visual_similar(
        self,
        image_base64: str | None = None,
        image_url: str | None = None,
        limit: int = 8,
        user_id: str | None = None,
    ) -> list[RecommendationItem]:
        cache = self._get_catalog()
        safe_limit = self._sanitize_limit(limit, self._settings.max_limit)

        query_feature = self._build_visual_query_feature(image_base64=image_base64, image_url=image_url)
        if query_feature is None:
            raise ValueError('Unable to process input image. Provide a valid image_base64 or image_url.')

        candidate_indices = self._select_visual_candidate_indices(cache, limit=safe_limit)
        if candidate_indices.size == 0:
            return self.recommend_trending(limit=safe_limit, user_id=user_id)

        scores = np.full(len(cache.product_ids), -np.inf, dtype=np.float32)

        for raw_index in candidate_indices:
            index = int(raw_index)
            candidate_image_url = cache.image_urls[index]
            if not candidate_image_url:
                continue

            candidate_feature = self._get_cached_visual_feature(candidate_image_url)
            if candidate_feature is None:
                continue

            visual_similarity = float(np.dot(query_feature, candidate_feature))
            if not np.isfinite(visual_similarity):
                continue

            scores[index] = (0.85 * visual_similarity) + (0.15 * float(cache.popularity[index]))

        exclude_product_ids: set[str] = set()

        if image_url:
            normalized_source_url = image_url.strip()
            if normalized_source_url:
                exclude_product_ids.update(
                    cache.product_ids[index]
                    for index, candidate_url in enumerate(cache.image_urls)
                    if candidate_url == normalized_source_url
                )

        if user_id:
            signals = self._get_user_signals(user_id)
            exclude_product_ids.update(signals.get('seen_ids', set()))

        recommendations = self._to_recommendation_items(
            cache=cache,
            scores=scores,
            limit=safe_limit,
            reason='Visually similar picks based on your uploaded photo',
            exclude_product_ids=exclude_product_ids,
        )

        if recommendations:
            return recommendations

        return self.recommend_trending(limit=safe_limit, user_id=user_id)

    def recommend_trending(self, limit: int = 8, user_id: str | None = None) -> list[RecommendationItem]:
        cache = self._get_catalog()
        safe_limit = self._sanitize_limit(limit, self._settings.max_limit)

        exclude_product_ids: set[str] = set()
        category_boost = np.zeros(len(cache.product_ids), dtype=np.float32)

        if user_id:
            signals = self._get_user_signals(user_id)
            seen_product_ids = set(signals.get('strict_exclude_ids', set()))
            exclude_product_ids.update(seen_product_ids)
            category_boost = self._build_category_boost(cache, seen_product_ids)

        combined_scores = (0.90 * cache.popularity) + (0.10 * category_boost)

        return self._to_recommendation_items(
            cache=cache,
            scores=combined_scores,
            limit=safe_limit,
            reason='Trending with strong ratings and reviews',
            exclude_product_ids=exclude_product_ids,
        )

    def persist_recommendations(
        self,
        user_id: str,
        recommendation_type: str,
        items: list[RecommendationItem],
        source_product_id: str | None = None,
    ) -> None:
        if not items:
            return

        delete_query = (
            self._supabase
            .table('user_recommendations')
            .delete()
            .eq('user_id', user_id)
            .eq('recommendation_type', recommendation_type)
        )

        if source_product_id:
            delete_query = delete_query.eq('source_product_id', source_product_id)
        else:
            delete_query = delete_query.is_('source_product_id', 'null')

        try:
            delete_query.execute()

            payload = [
                {
                    'user_id': user_id,
                    'recommendation_type': recommendation_type,
                    'source_product_id': source_product_id,
                    'product_id': item.product_id,
                    'score': item.score,
                    'rank_position': rank,
                    'reason': item.reason,
                    'model_version': self._settings.model_version,
                    'computed_at': datetime.now(timezone.utc).isoformat(),
                }
                for rank, item in enumerate(items, start=1)
            ]

            self._supabase.table('user_recommendations').insert(payload).execute()
        except Exception:
            return
