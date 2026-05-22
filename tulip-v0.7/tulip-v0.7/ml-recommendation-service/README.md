# Tulip Recommendation Service (FastAPI)

Hybrid recommendation backend for Tulip:
- Multi-agent content scorer: TF-IDF on product attributes and feature crosses
- Collaborative behavior scorer: user interaction + order co-occurrence neighbors
- Popularity/freshness scorer: rating + reviews + trend/new + recency decay
- Personalization: wishlist + cart + order history + telemetry, blended by ensemble weights


