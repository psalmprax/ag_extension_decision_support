"""
Cloak-Backed Instagram Scanner

Uses CloakBrowser stealth engine as primary scraper with the existing
httpx-based InstagramScanner as fallback when the scraper service is unavailable.
"""

import datetime
import logging
from typing import Optional

from .scanner_base import DiscoveryScannerBase
from .models import ContentCandidate
from .cloak_scanner import CloakBrowserScanner
from .instagram_scanner import InstagramScanner

logger = logging.getLogger(__name__)


class CloakInstagramScanner(DiscoveryScannerBase):
    """Instagram scanner backed by CloakBrowser stealth engine with httpx fallback."""

    def __init__(self, scraper_url: str = "http://discovery-scraper:8010"):
        self.cloak_engine = CloakBrowserScanner(
            scraper_url=scraper_url, platform="instagram"
        )
        self.fallback_scanner = InstagramScanner()

    async def scan_trends(
        self,
        niche: str,
        published_after: Optional[datetime.datetime] = None,
        region: Optional[str] = None,
        **kwargs,
    ) -> list[ContentCandidate]:
        try:
            results = await self.cloak_engine.scan_platform(
                "instagram", niche, published_after=published_after, region=region
            )
            if results:
                logger.info(
                    f"[CloakInstagram] Stealth scan returned {len(results)} candidates for '{niche}'"
                )
                return results
        except Exception as e:
            logger.warning(f"[CloakInstagram] Stealth scan failed: {e}")

        logger.info(f"[CloakInstagram] Falling back to httpx scraper for '{niche}'")
        return await self.fallback_scanner.scan_trends(
            niche, published_after=published_after
        )

    async def close(self):
        await self.cloak_engine.close()
