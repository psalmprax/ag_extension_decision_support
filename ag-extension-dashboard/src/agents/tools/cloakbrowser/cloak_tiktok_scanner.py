"""
Cloak-Backed TikTok Scanner

Uses CloakBrowser stealth engine as primary scraper with the existing
httpx-based TikTokScanner as fallback when the scraper service is unavailable.
"""

import datetime
import logging
from typing import Optional

from .scanner_base import DiscoveryScannerBase
from .models import ContentCandidate
from .cloak_scanner import CloakBrowserScanner
from .tiktok_scanner import TikTokScanner

logger = logging.getLogger(__name__)


class CloakTikTokScanner(DiscoveryScannerBase):
    """TikTok scanner backed by CloakBrowser stealth engine with httpx fallback."""

    def __init__(self, scraper_url: str = "http://discovery-scraper:8010"):
        self.cloak_engine = CloakBrowserScanner(
            scraper_url=scraper_url, platform="tiktok"
        )
        self.fallback_scanner = TikTokScanner()

    async def scan_trends(
        self,
        niche: str,
        published_after: Optional[datetime.datetime] = None,
        region: Optional[str] = None,
        **kwargs,
    ) -> list[ContentCandidate]:
        # 1. Try CloakBrowser first (stealth Playwright)
        try:
            results = await self.cloak_engine.scan_platform(
                "tiktok", niche, published_after=published_after, region=region
            )
            if results:
                logger.info(
                    f"[CloakTikTok] Stealth scan returned {len(results)} candidates for '{niche}'"
                )
                return results
        except Exception as e:
            logger.warning(f"[CloakTikTok] Stealth scan failed: {e}")

        # 2. Fall back to existing HTTP scraper
        logger.info(f"[CloakTikTok] Falling back to httpx scraper for '{niche}'")
        return await self.fallback_scanner.scan_trends(
            niche, published_after=published_after, region=region
        )

    async def close(self):
        await self.cloak_engine.close()
