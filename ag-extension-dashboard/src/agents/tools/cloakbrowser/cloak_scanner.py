"""
CloakBrowser Scanner — Multi-Platform Stealth Scraping Engine

A DiscoveryScannerBase subclass that uses the containerized CloakBrowser
service for undetected web scraping of YouTube and other platforms.
Bypasses API quota limits and anti-bot protections entirely.
"""

import asyncio
import datetime
import logging
import re
from typing import Optional

import httpx

from .scanner_base import DiscoveryScannerBase
from .models import ContentCandidate
from .cloak_platform_config import (
    CloakPlatformConfig,
    get_platform_config,
    get_all_platform_keys,
    CLOAK_PLATFORMS,
)

logger = logging.getLogger(__name__)

# Semaphore to limit concurrent CloakBrowser scans (Playwright is heavy)
_CLOAK_SEMAPHORE = asyncio.Semaphore(3)


class CloakBrowserScanner(DiscoveryScannerBase):
    """
    Scanner that delegates to the containerized discovery-scraper service
    powered by CloakBrowser + Playwright for stealth browsing.
    Supports multiple platforms via the platform config registry.
    """

    def __init__(
        self,
        scraper_url: str = "http://discovery-scraper:8010",
        timeout: float = 45.0,
        platform: str = "youtube",
    ):
        self.scraper_url = scraper_url
        self.timeout = timeout
        self.default_platform = platform
        self._client: Optional[httpx.AsyncClient] = None

    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=self.timeout)
        return self._client

    def __init_subclass__(cls, **kwargs):
        pass

    # ── Public API ──────────────────────────────────────────────

    async def scan_trends(
        self,
        niche: str,
        published_after: Optional[datetime.datetime] = None,
        region: Optional[str] = "US",
        **kwargs,
    ) -> list[ContentCandidate]:
        """Backward-compatible: scrape using the default platform (YouTube)."""
        return await self.scan_platform(
            self.default_platform, niche, published_after=published_after, region=region
        )

    async def scan_platform(
        self,
        platform_key: str,
        niche: str,
        published_after: Optional[datetime.datetime] = None,
        region: Optional[str] = "US",
    ) -> list[ContentCandidate]:
        """
        Generic multi-platform scrape via the CloakBrowser service.
        Uses the platform config registry for URL templates and parsing.
        """
        config = get_platform_config(platform_key)
        if not config:
            logger.warning(f"CloakBrowser: unknown platform '{platform_key}'")
            return []

        async with _CLOAK_SEMAPHORE:
            return await self._scrape_with_retry(config, niche, region)

    async def scan_all_platforms(
        self,
        niche: str,
        region: Optional[str] = "US",
        platforms: Optional[list[str]] = None,
    ) -> list[ContentCandidate]:
        """Scan multiple platforms concurrently."""
        keys = platforms or get_all_platform_keys()
        tasks = [self.scan_platform(k, niche, region=region) for k in keys]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        candidates = []
        for res in results:
            if isinstance(res, list):
                candidates.extend(res)
            elif isinstance(res, Exception):
                logger.error(f"CloakBrowser multi-scan error: {res}")
        return candidates

    # ── Internal: retry + dispatch ──────────────────────────────

    async def _scrape_with_retry(
        self,
        config: CloakPlatformConfig,
        niche: str,
        region: Optional[str],
    ) -> list[ContentCandidate]:
        last_err = None
        for attempt in range(1, config.max_retries + 1):
            try:
                return await self._do_scrape(config, niche, region)
            except httpx.TimeoutException:
                last_err = "timeout"
                wait = config.retry_backoff * attempt
                logger.warning(
                    f"CloakBrowser [{config.name}] timeout (attempt {attempt}/{config.max_retries}), "
                    f"retrying in {wait}s…"
                )
                await asyncio.sleep(wait)
            except httpx.ConnectError:
                logger.warning(
                    f"Cannot connect to CloakBrowser scraper at {self.scraper_url}"
                )
                return []
            except Exception as e:
                logger.exception(
                    f"CloakBrowser [{config.name}] scan failed for '{niche}': {e}"
                )
                return []

        logger.error(
            f"CloakBrowser [{config.name}] exhausted retries for '{niche}' (last: {last_err})"
        )
        return []

    async def _do_scrape(
        self,
        config: CloakPlatformConfig,
        niche: str,
        region: Optional[str],
    ) -> list[ContentCandidate]:
        """Execute a single scrape attempt against the discovery-scraper service."""
        params = {
            "niche": niche,
            "region": region or "US",
            "max_results": config.max_results,
            **config.extra_params,
        }

        if config.use_generic_endpoint:
            query = niche.replace(" ", "+")
            query_no_spaces = niche.replace(" ", "")
            url = config.search_url_template.format(
                query=query, query_no_spaces=query_no_spaces
            )
            params["url"] = url
            params["platform"] = config.name.lower()
            if config.wait_selector:
                params["wait_selector"] = config.wait_selector
            if config.requires_scroll:
                params["scroll"] = "true"

        endpoint = f"{self.scraper_url}{config.scrape_endpoint}"
        response = await self.client.get(endpoint, params=params)
        response.raise_for_status()
        data = response.json()

        if not data.get("success"):
            logger.error(
                f"CloakBrowser [{config.name}] scraper failed: {data.get('error', 'unknown')}"
            )
            return []

        # Dispatch to platform-specific parser
        parser = self._get_parser(config.name.lower())
        raw_items = data.get("candidates", data.get("results", data.get("items", [])))
        candidates = parser(raw_items, config, niche, region)

        logger.info(
            f"CloakBrowser [{config.name}] returned {len(candidates)} candidates for '{niche}'"
        )
        return candidates

    # ── Platform parsers ────────────────────────────────────────

    def _get_parser(self, platform_name: str):
        parsers = {
            "youtube": self._parse_youtube,
            "tiktok": self._parse_tiktok,
            "instagram": self._parse_instagram,
            "facebook": self._parse_facebook,
            "x (twitter)": self._parse_x_twitter,
            "linkedin": self._parse_linkedin,
        }
        return parsers.get(platform_name, self._parse_generic)

    def _parse_youtube(self, items, config, niche, region):
        candidates = []
        for item in items:
            video_id = item.get("id", "")
            if not video_id:
                continue
            candidates.append(
                ContentCandidate(
                    id=f"{config.id_prefix}_{video_id}",
                    platform=config.platform_label,
                    source_uri=item.get("url", ""),
                    creator_name=item.get("channel", "Unknown"),
                    title=item.get("title", "No Title"),
                    thumbnail_uri=item.get("thumbnail", ""),
                    view_count=self._parse_views(item.get("views", "0")),
                    like_count=0,
                    comment_count=0,
                    share_count=0,
                    engagement_score=0.0,
                    viral_score=0,
                    region=region or "US",
                    category=config.category,
                    tags=[niche] + config.tags_extra,
                    metadata={"scraper": "cloakbrowser", "source": "youtube_web"},
                )
            )
        return candidates

    def _parse_tiktok(self, items, config, niche, region):
        candidates = []
        for item in items:
            vid = item.get("id") or item.get("video_id", "")
            if not vid:
                continue
            author = item.get("author") or item.get("channel") or "Unknown"
            views = self._parse_views(str(item.get("views", item.get("playCount", 0))))
            likes = self._safe_int(item.get("likes", item.get("diggCount", 0)))
            comments = self._safe_int(item.get("comments", item.get("commentCount", 0)))
            shares = self._safe_int(item.get("shares", item.get("shareCount", 0)))
            engagement = (likes + comments + shares) / max(views, 1)
            viral = min(max(int((views / 5000) * (1 + engagement * 10)), 1), 95)
            candidates.append(
                ContentCandidate(
                    id=f"{config.id_prefix}_{vid}",
                    platform=config.platform_label,
                    source_uri=item.get("url", f"https://www.tiktok.com/video/{vid}"),
                    creator_name=author,
                    title=item.get("title", item.get("desc", f"TikTok {niche}")),
                    thumbnail_uri=item.get("thumbnail", item.get("cover", "")),
                    view_count=views,
                    like_count=likes,
                    comment_count=comments,
                    share_count=shares,
                    engagement_score=engagement,
                    viral_score=viral,
                    region=region or "US",
                    category=config.category,
                    tags=[niche] + config.tags_extra,
                    metadata={"scraper": "cloakbrowser", "source": "tiktok_web"},
                )
            )
        return candidates

    def _parse_instagram(self, items, config, niche, region):
        candidates = []
        for item in items:
            shortcode = item.get("shortcode") or item.get("id", "")
            if not shortcode:
                continue
            likes = self._safe_int(item.get("likes", 0))
            comments = self._safe_int(item.get("comments", 0))
            views_est = max(likes * 20, 1)
            engagement = (likes + comments) / max(views_est, 1)
            candidates.append(
                ContentCandidate(
                    id=f"{config.id_prefix}_{shortcode}",
                    platform=config.platform_label,
                    source_uri=item.get("url", f"https://www.instagram.com/reel/{shortcode}/"),
                    creator_name=item.get("author") or item.get("username", "Unknown"),
                    title=item.get("title") or item.get("caption", f"IG Reel: {niche}")[:100],
                    thumbnail_uri=item.get("thumbnail", ""),
                    view_count=views_est,
                    like_count=likes,
                    comment_count=comments,
                    engagement_score=engagement,
                    region=region or "US",
                    category=config.category,
                    tags=[niche] + config.tags_extra,
                    metadata={"scraper": "cloakbrowser", "source": "instagram_web"},
                )
            )
        return candidates

    def _parse_facebook(self, items, config, niche, region):
        candidates = []
        for item in items:
            vid = item.get("id") or item.get("video_id", "")
            if not vid:
                continue
            views = self._safe_int(item.get("views", item.get("view_count", 0)))
            likes = self._safe_int(item.get("likes", 0))
            comments = self._safe_int(item.get("comments", 0))
            shares = self._safe_int(item.get("shares", 0))
            engagement = (likes + comments + shares) / max(views, 1) if views else 0.05
            candidates.append(
                ContentCandidate(
                    id=f"{config.id_prefix}_{vid}",
                    platform=config.platform_label,
                    source_uri=item.get("url", ""),
                    creator_name=item.get("author") or item.get("page_name", "Unknown"),
                    title=item.get("title", f"Facebook Video: {niche}")[:100],
                    thumbnail_uri=item.get("thumbnail", ""),
                    view_count=views,
                    like_count=likes,
                    comment_count=comments,
                    share_count=shares,
                    engagement_score=engagement,
                    region=region or "US",
                    category=config.category,
                    tags=[niche] + config.tags_extra,
                    metadata={"scraper": "cloakbrowser", "source": "facebook_web"},
                )
            )
        return candidates

    def _parse_x_twitter(self, items, config, niche, region):
        candidates = []
        for item in items:
            tid = item.get("id") or item.get("tweet_id", "")
            if not tid:
                continue
            likes = self._safe_int(item.get("likes", item.get("favorite_count", 0)))
            retweets = self._safe_int(item.get("retweets", item.get("retweet_count", 0)))
            replies = self._safe_int(item.get("replies", item.get("reply_count", 0)))
            engagement_total = likes + retweets + replies
            views_est = max(engagement_total * 15, 1)
            engagement = engagement_total / max(views_est, 1)
            candidates.append(
                ContentCandidate(
                    id=f"{config.id_prefix}_{tid}",
                    platform=config.platform_label,
                    source_uri=item.get("url", f"https://x.com/i/status/{tid}"),
                    creator_name=item.get("author") or item.get("username", "Unknown"),
                    title=(item.get("text", "") or item.get("title", f"X: {niche}"))[:100],
                    thumbnail_uri=item.get("media_url", item.get("thumbnail", "")),
                    view_count=views_est,
                    like_count=likes,
                    comment_count=replies,
                    share_count=retweets,
                    engagement_score=engagement,
                    region=region or "US",
                    category=config.category,
                    tags=[niche] + config.tags_extra,
                    metadata={"scraper": "cloakbrowser", "source": "x_twitter_web"},
                )
            )
        return candidates

    def _parse_linkedin(self, items, config, niche, region):
        candidates = []
        for item in items:
            pid = item.get("id") or item.get("post_id", "")
            if not pid:
                continue
            likes = self._safe_int(item.get("likes", 0))
            comments = self._safe_int(item.get("comments", 0))
            shares = self._safe_int(item.get("shares", 0))
            engagement_total = likes + comments + shares
            views_est = max(engagement_total * 30, 1)
            engagement = engagement_total / max(views_est, 1)
            candidates.append(
                ContentCandidate(
                    id=f"{config.id_prefix}_{pid}",
                    platform=config.platform_label,
                    source_uri=item.get("url", f"https://www.linkedin.com/feed/update/{pid}"),
                    creator_name=item.get("author", "Unknown"),
                    title=(item.get("title", "") or item.get("text", f"LinkedIn: {niche}"))[:100],
                    thumbnail_uri=item.get("thumbnail", ""),
                    view_count=views_est,
                    like_count=likes,
                    comment_count=comments,
                    share_count=shares,
                    engagement_score=engagement,
                    region=region or "US",
                    category=config.category,
                    tags=[niche] + config.tags_extra,
                    metadata={"scraper": "cloakbrowser", "source": "linkedin_web"},
                )
            )
        return candidates

    def _parse_generic(self, items, config, niche, region):
        candidates = []
        for item in items:
            cid = item.get("id", "")
            if not cid:
                continue
            candidates.append(
                ContentCandidate(
                    id=f"{config.id_prefix}_{cid}",
                    platform=config.platform_label,
                    source_uri=item.get("url", ""),
                    creator_name=item.get("author", "Unknown"),
                    title=item.get("title", "No Title")[:100],
                    thumbnail_uri=item.get("thumbnail", ""),
                    view_count=self._safe_int(item.get("views", 0)),
                    region=region or "US",
                    category=config.category,
                    tags=[niche] + config.tags_extra,
                    metadata={"scraper": "cloakbrowser", "source": f"{config.name.lower()}_web"},
                )
            )
        return candidates

    # ── Utilities ───────────────────────────────────────────────

    def _parse_views(self, views_str: str) -> int:
        """Parse view count strings like '1.2M views', '500K views', '1,234 views'."""
        if not views_str:
            return 0
        views_str = str(views_str).replace("views", "").replace("view", "").strip()
        views_str = views_str.replace(",", "")
        match = re.match(r"([\d.]+)\s*([MK]?)", views_str, re.IGNORECASE)
        if not match:
            return 0
        num = float(match.group(1))
        suffix = match.group(2).upper()
        if suffix == "M":
            return int(num * 1_000_000)
        elif suffix == "K":
            return int(num * 1_000)
        return int(num)

    def _safe_int(self, val) -> int:
        try:
            return int(val)
        except (ValueError, TypeError):
            return 0

    async def close(self):
        """Clean up the HTTP client."""
        if self._client:
            await self._client.aclose()
            self._client = None
