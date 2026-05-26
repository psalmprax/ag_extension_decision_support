"""
Cloak-Backed X (Twitter) Scanner

Uses CloakBrowser stealth engine as primary scraper with the existing
httpx-based XScanner as fallback when the scraper service is unavailable.
"""

import datetime
import logging
from typing import Optional

from .scanner_base import DiscoveryScannerBase
from .models import ContentCandidate
from .cloak_scanner import CloakBrowserScanner
from .x_scanner import XScanner

logger = logging.getLogger(__name__)


class CloakXScanner(DiscoveryScannerBase):
    """X/Twitter scanner backed by CloakBrowser stealth engine with httpx fallback."""

    def __init__(self, scraper_url: str = "http://discovery-scraper:8010"):
        self.cloak_engine = CloakBrowserScanner(
            scraper_url=scraper_url, platform="x_twitter"
        )
        self.fallback_scanner = XScanner()

    async def scan_trends(
        self,
        niche: str,
        published_after: Optional[datetime.datetime] = None,
        region: Optional[str] = None,
        **kwargs,
    ) -> list[ContentCandidate]:
        try:
            results = await self.cloak_engine.scan_platform(
                "x_twitter", niche, published_after=published_after, region=region
            )
            if results:
                logger.info(
                    f"[CloakX] Stealth scan returned {len(results)} candidates for '{niche}'"
                )
                return results
        except Exception as e:
            logger.warning(f"[CloakX] Stealth scan failed: {e}")

        logger.info(f"[CloakX] Falling back to httpx scraper for '{niche}'")
        return await self.fallback_scanner.scan_trends(
            niche, published_after=published_after, region=region
        )

    async def close(self):
        await self.cloak_engine.close()
