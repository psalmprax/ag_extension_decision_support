import httpx
import logging
import json
import re
import random
from datetime import datetime
from .models import ContentCandidate

logger = logging.getLogger(__name__)


class FacebookScanner:
    """
    Scans Facebook Watch for trending video content using web scraping.
    Note: Facebook/Meta has strict anti-scraping measures. This uses public
    page scraping as a free alternative to the paid Meta Graph API.
    """
    
    def __init__(self):
        self.platform = "Facebook Watch"
        self.base_url = "https://www.facebook.com"
        self.user_agents = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
        ]
    
    async def scan_trends(self, niche: str, published_after: datetime | None = None, **kwargs) -> list[ContentCandidate]:
        """
        Scans Facebook Watch for trending video content in a niche.
        Uses the watch page and search to find trending videos.
        """
        logger.info(f"[FacebookScanner] Scanning Facebook Watch for: {niche}")
        
        candidates = []
        
        # Try watch page trending
        try:
            results = await self._get_watch_trending(niche)
            candidates.extend(results)
        except Exception as e:
            logger.warning(f"[FacebookScanner] Watch trending failed: {e}")
        
        # Try search as fallback
        if not candidates:
            try:
                results = await self._search_videos(niche)
                candidates.extend(results)
            except Exception as e:
                logger.warning(f"[FacebookScanner] Search failed: {e}")
        
        # Remove duplicates
        seen = set()
        unique_candidates = []
        for c in candidates:
            if c.source_uri not in seen:
                seen.add(c.source_uri)
                unique_candidates.append(c)
        
        logger.info(f"[FacebookScanner] Found {len(unique_candidates)} videos")
        return unique_candidates[:15]
    
    async def _get_watch_trending(self, niche: str) -> list[ContentCandidate]:
        """Get trending videos from Facebook Watch page."""
        headers = {
            "User-Agent": random.choice(self.user_agents),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
        }
        
        # Facebook Watch trending URL
        url = f"{self.base_url}/watch/"
        
        candidates = []
        
        try:
            async with httpx.AsyncClient(headers=headers, follow_redirects=True, timeout=15.0) as client:
                response = await client.get(url)
                
                if response.status_code != 200:
                    logger.warning(f"[FacebookScanner] Watch page failed: {response.status_code}")
                    return []
                
                # Facebook uses heavily encrypted HTML/JS
                # Look for any video data in script tags
                script_data = re.findall(
                    r'<script[^>]*>(.*?)</script>',
                    response.text,
                    re.DOTALL
                )
                
                # Try to find JSON data that might contain video info
                for script in script_data:
                    if 'video' in script.lower() or 'watch' in script.lower():
                        try:
                            # Look for JSON-like structures
                            json_matches = re.findall(r'\{[^{}]*"video"[^{}]*\}', script)
                            for json_str in json_matches:
                                try:
                                    data = json.loads(json_str)
                                    videos = self._extract_videos_from_json(data)
                                    candidates.extend(videos)
                                except Exception:
                                    pass
                        except Exception:
                            pass
                
                # Alternative: Look for structured data
                sd_matches = re.findall(
                    r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>',
                    response.text,
                    re.DOTALL
                )
                
                for sd_str in sd_matches:
                    try:
                        data = json.loads(sd_str)
                        videos = self._extract_videos_from_schema(data)
                        candidates.extend(videos)
                    except Exception:
                        pass
                
        except Exception as e:
            logger.warning(f"[FacebookScanner] Watch page error: {e}")
        
        return candidates
    
    async def _search_videos(self, niche: str) -> list[ContentCandidate]:
        """Search Facebook for videos in a niche."""
        headers = {
            "User-Agent": random.choice(self.user_agents),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
        }
        
        # Facebook video search URL
        url = f"{self.base_url}/search/videos/?q={niche.replace(' ', '%20')}"
        
        candidates = []
        
        try:
            async with httpx.AsyncClient(headers=headers, follow_redirects=True, timeout=15.0) as client:
                response = await client.get(url)
                
                if response.status_code != 200:
                    logger.warning(f"[FacebookScanner] Search failed: {response.status_code}")
                    return []
                
                # Similar JSON extraction as watch page
                # Facebook's structure is complex and changes frequently
                # This is a best-effort extraction
                script_data = re.findall(
                    r'<script[^>]*>(.*?)</script>',
                    response.text,
                    re.DOTALL
                )
                
                for script in script_data:
                    if 'video' in script.lower():
                        try:
                            json_matches = re.findall(r'\{[^{}]*"video"[^{}]*\}', script)
                            for json_str in json_matches:
                                try:
                                    data = json.loads(json_str)
                                    videos = self._extract_videos_from_json(data)
                                    candidates.extend(videos)
                                except Exception:
                                    pass
                        except Exception:
                            pass
                
        except Exception as e:
            logger.warning(f"[FacebookScanner] Search error: {e}")
        
        return candidates
    
    def _extract_videos_from_json(self, data: dict) -> list[ContentCandidate]:
        """Extract video info from JSON data."""
        candidates = []
        
        try:
            # Recursively search for video-like objects
            if isinstance(data, dict):
                # Check if this looks like a video object
                if "video" in str(data).lower():
                    video_data = data.get("video", {})
                    if not video_data:
                        video_data = data
                    
                    # Try to extract video info
                    url = video_data.get("url") or video_data.get("share_url")
                    if url and "facebook.com" in url:
                        title = video_data.get("title", "Facebook Video")
                        author = video_data.get("user", {}).get("name", "Unknown")
                        views = video_data.get("views", 0) or video_data.get("view_count", 0)
                        
                        candidates.append(ContentCandidate(
                            id=f"fb_{hash(url) % 1000000}",
                            platform="Facebook Watch",
                            source_uri=url,
                            creator_name=author,
                            title=title[:100],
                            view_count=views,
                            like_count=0,
                            comment_count=0,
                            share_count=0,
                            engagement_score=0.05,  # Default estimate
                            metadata={}
                        ))
                
                # Recurse into nested objects
                for value in data.values():
                    if isinstance(value, (dict, list)):
                        candidates.extend(self._extract_videos_from_json(value))
                        
            elif isinstance(data, list):
                for item in data:
                    if isinstance(item, (dict, list)):
                        candidates.extend(self._extract_videos_from_json(item))
                        
        except Exception as e:
            logger.debug(f"[FacebookScanner] JSON extract error: {e}")
        
        return candidates
    
    def _extract_videos_from_schema(self, data: dict) -> list[ContentCandidate]:
        """Extract video info from schema.org JSON-LD."""
        candidates = []
        
        try:
            # Handle @graph format
            items = data.get("@graph", [data])
            
            for item in items:
                if item.get("@type") in ["VideoObject", "Video"]:
                    url = item.get("url") or item.get("contentUrl")
                    if url and "facebook.com" in url:
                        title = item.get("name", "Facebook Video")
                        description = item.get("description", "")[:100]
                        
                        # Try to get engagement stats
                        interaction = item.get("interactionStatistic", {})
                        views = interaction.get("userInteractionCount", 0)
                        
                        candidates.append(ContentCandidate(
                            id=f"fb_{hash(url) % 1000000}",
                            platform="Facebook Watch",
                            source_uri=url,
                            creator_name=item.get("author", {}).get("name", "Unknown") if isinstance(item.get("author"), dict) else "Unknown",
                            title=title[:100] if title else description,
                            view_count=views,
                            like_count=0,
                            comment_count=0,
                            share_count=0,
                            engagement_score=0.05,
                            thumbnail_uri=item.get("thumbnailUrl"),
                            metadata={}
                        ))
                        
        except Exception as e:
            logger.debug(f"[FacebookScanner] Schema extract error: {e}")
        
        return candidates


base_facebook_scanner_service = FacebookScanner()
