"""
Cloak-Backed Facebook Scanner

Uses CloakBrowser stealth engine as primary scraper with the existing
httpx-based FacebookScanner as fallback when the scraper service is unavailable.
"""

import datetime
import logging
from typing import Optional

from .scanner_base import DiscoveryScannerBase
from .models import ContentCandidate
from .cloak_scanner import CloakBrowserScanner
from .facebook_scanner import FacebookScanner

logger = logging.getLogger(__name__)


class CloakFacebookScanner(DiscoveryScannerBase):
    """Facebook scanner backed by CloakBrowser stealth engine with httpx fallback."""

    def __init__(self, scraper_url: str = "http://discovery-scraper:8010"):
        self.cloak_engine = CloakBrowserScanner(
            scraper_url=scraper_url, platform="facebook"
        )
        self.fallback_scanner = FacebookScanner()

    async def scan_trends(
        self,
        niche: str,
        published_after: Optional[datetime.datetime] = None,
        region: Optional[str] = None,
        **kwargs,
    ) -> list[ContentCandidate]:
        try:
            results = await self.cloak_engine.scan_platform(
                "facebook", niche, published_after=published_after, region=region
            )
            if results:
                logger.info(
                    f"[CloakFacebook] Stealth scan returned {len(results)} candidates for '{niche}'"
                )
                return results
        except Exception as e:
            logger.warning(f"[CloakFacebook] Stealth scan failed: {e}")

        logger.info(f"[CloakFacebook] Falling back to httpx scraper for '{niche}'")
        return await self.fallback_scanner.scan_trends(
            niche, published_after=published_after
        )

    async def close(self):
        await self.cloak_engine.close()
