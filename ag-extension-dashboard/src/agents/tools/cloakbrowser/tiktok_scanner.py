import httpx
import re
import json
from .models import ContentCandidate
import random
from datetime import datetime
import logging


class TikTokScanner:
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.user_agents = [
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
            "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        ]

    async def scan_trends(self, niche: str, published_after: datetime | None = None, region: str | None = None, **kwargs) -> list[ContentCandidate]:
        """
        Scans TikTok for trending videos in a niche by scraping the public search page.
        This is a cost-free alternative to paid APIs.
        """
        self.logger.info(f"[TikTokScanner] Real scan for niche: {niche}...")

        url = f"https://www.tiktok.com/search/video?q={niche.replace(' ', '%20')}"
        headers = {
            "User-Agent": random.choice(self.user_agents),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
        }

        try:
            html = await self._fetch_html(url, headers)
            if not html:
                return []

            raw_data = self._extract_rehydration_data(html)
            if not raw_data:
                return []

            video_list = self._parse_video_list(raw_data)
            candidates = []

            for item in video_list:
                candidate = self._map_item_to_candidate(item, niche, region, published_after)
                if candidate:
                    candidates.append(candidate)

                if len(candidates) >= 5:
                    break

            return candidates

        except Exception as e:
            self.logger.error(f"TikTok Scanner Error: {e}")
            return []

    async def _fetch_html(self, url: str, headers: dict) -> str | None:
        try:
            async with httpx.AsyncClient(headers=headers, follow_redirects=True, timeout=10.0) as client:
                response = await client.get(url)
                if response.status_code != 200:
                    self.logger.error(f"[TikTokScanner] Scrape Failed: Status {response.status_code}")
                    return None
                return response.text
        except Exception as e:
            self.logger.error(f"Network error in TikTok scan: {e}")
            return None

    def _extract_rehydration_data(self, html: str) -> dict | None:
        match = re.search(r'id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>(.*?)<\/script>', html)
        if not match:
            self.logger.warning("[TikTokScanner] No rehydration data found in TikTok response")
            return None
        try:
            return json.loads(match.group(1))
        except (json.JSONDecodeError, IndexError) as e:
            self.logger.error(f"JSON decode failed: {e}")
            return None

    def _parse_video_list(self, raw_data: dict) -> list:
        try:
            default_scope = raw_data.get("__DEFAULT_SCOPE__", {})
            return (
                default_scope.get("webapp.search-video", {})
                .get("data", {})
                .get("item_list", [])
            )
        except Exception as e:
            self.logger.error(f"Parsing TikTok JSON failed: {e}")
            return []

    def _map_item_to_candidate(self, item: dict, niche: str, region: str | None, published_after: datetime | None) -> ContentCandidate | None:
        video_id = item.get("id")
        if not video_id:
            return None

        create_time = item.get("createTime")
        if create_time and published_after:
            pub_dt = datetime.fromtimestamp(int(create_time))
            if pub_dt < published_after:
                return None

        author_data = item.get("author", {})
        stats = item.get("stats", {})
        views = stats.get("playCount", 0)
        engagement_score = self._calc_engagement(stats)
        duration_seconds = float(item.get("video", {}).get("duration", 0))

        # Calculate viral score (Scrape-based fallback logic)
        viral_score = min(max(int((views / 5000) * (1 + engagement_score * 10)), 1), 95)

        return ContentCandidate(
            id=f"tt_{video_id}",
            platform="TikTok",
            source_uri=f"https://www.tiktok.com/@{author_data.get('uniqueId', 'user')}/video/{video_id}",
            creator_name=author_data.get("nickname", "Unknown Creator"),
            title=item.get("desc", f"Viral {niche} Insight"),
            description=item.get("desc", ""),
            view_count=views,
            like_count=stats.get("diggCount", 0),
            comment_count=stats.get("commentCount", 0),
            share_count=stats.get("shareCount", 0),
            engagement_score=engagement_score,
            viral_score=viral_score,
            region=region,
            duration_seconds=duration_seconds,
            discovery_date=datetime.now(),
            tags=item.get("challenges", []),
            thumbnail_uri=item.get("video", {}).get("cover"),
            metadata={
                "cover": item.get("video", {}).get("cover"),
                "duration": duration_seconds,
                "published_at": datetime.fromtimestamp(int(create_time)).isoformat() if create_time else None,
            },
        )

    def _calc_engagement(self, stats: dict) -> float:
        plays = stats.get("playCount", 1)
        likes = stats.get("diggCount", 0)
        comments = stats.get("commentCount", 0)
        shares = stats.get("shareCount", 0)
        if plays == 0:
            return 0.0
        return (likes + comments + shares) / plays
