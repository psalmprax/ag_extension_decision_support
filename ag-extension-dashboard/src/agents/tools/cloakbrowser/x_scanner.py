import httpx
import logging
import json
import re
import random
from datetime import datetime
from .models import ContentCandidate

logger = logging.getLogger(__name__)


class XScanner:
    """
    Scans X (Twitter) for trending media tweets using web scraping.
    Twitter API v2 requires paid access for bulk queries, so this uses
    public HTML scraping as a free alternative.
    """
    
    def __init__(self):
        self.platform = "X (Twitter)"
        self.base_url = "https://x.com"
        self.user_agents = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
        ]
    
    async def scan_trends(self, niche: str, published_after: datetime | None = None, region: str | None = None, **kwargs) -> list[ContentCandidate]:
        """
        Scans X (Twitter) for trending tweets with media in a niche.
        Uses the search page to find relevant tweets.
        """
        logger.info(f"[XScanner] Scanning X for trending tweets about: {niche}")
        
        candidates = []
        
        # Try search query
        try:
            results = await self._search_tweets(niche)
            candidates.extend(results)
        except Exception as e:
            logger.warning(f"[XScanner] Search failed: {e}")
        
        # Try trending hashtags as fallback
        if not candidates:
            try:
                results = await self._get_trending()
                candidates.extend(results)
            except Exception as e:
                logger.warning(f"[XScanner] Trending fetch failed: {e}")
        
        # Remove duplicates by URL
        seen = set()
        unique_candidates = []
        for c in candidates:
            if c.source_uri not in seen:
                seen.add(c.source_uri)
                unique_candidates.append(c)
        
        logger.info(f"[XScanner] Found {len(unique_candidates)} unique tweets")
        return unique_candidates[:15]
    
    async def _search_tweets(self, query: str) -> list[ContentCandidate]:
        """Search X for tweets matching the query."""
        headers = {
            "User-Agent": random.choice(self.user_agents),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
        }
        
        # X search URL format
        url = f"{self.base_url}/search?q={query.replace(' ', '%20')}&f=live"
        
        candidates = []
        
        try:
            async with httpx.AsyncClient(headers=headers, follow_redirects=True, timeout=15.0) as client:
                response = await client.get(url)
                
                if response.status_code != 200:
                    logger.warning(f"[XScanner] Search failed: {response.status_code}")
                    return []
                
                # X uses React SSR with JSON embedded in script tags
                # Look for __NEXT_DATA__ or similar
                json_matches = re.findall(
                    r'<script[^>]*id="__NEXT_DATA__"[^>]*>(.*?)</script>',
                    response.text,
                    re.DOTALL
                )
                
                for json_str in json_matches:
                    try:
                        data = json.loads(json_str)
                        tweets = self._extract_tweets_from_json(data, query)
                        candidates.extend(tweets)
                    except json.JSONDecodeError:
                        continue
                
                # Alternative: Look for other data patterns
                if not candidates:
                    re.findall(
                        r'<script[^>]*data-testid="tweet"[^>]*>(.*?)</script>',
                        response.text,
                        re.DOTALL
                    )
                    # This is less reliable, but as a fallback
                    pass
                
        except Exception as e:
            logger.warning(f"[XScanner] Search error: {e}")
        
        return candidates
    
    def _extract_tweets_from_json(self, data: dict, query: str) -> list[ContentCandidate]:
        """Extract tweet data from X's JSON structure."""
        candidates = []
        
        try:
            # Navigate through X's complex JSON structure
            # The structure changes frequently, so we try multiple paths
            
            # Path 1: props -> pageProps -> searchTimeline
            props = data.get("props", {})
            page_props = props.get("pageProps", {})
            
            # Try search timeline
            timeline = page_props.get("searchTimeline", {})
            timeline_instructions = timeline.get("timeline", {}).get("instructions", [])
            
            for instruction in timeline_instructions:
                entries = instruction.get("entries", [])
                for entry in entries:
                    tweet = self._parse_tweet_entry(entry)
                    if tweet:
                        candidates.append(tweet)
            
            # Path 2: Alternative structure
            if not candidates:
                legacy_timeline = page_props.get("timeline", {})
                instructions = legacy_timeline.get("instructions", [])
                for instruction in instructions:
                    entries = instruction.get("entries", [])
                    for entry in entries:
                        tweet = self._parse_tweet_entry(entry)
                        if tweet:
                            candidates.append(tweet)
                            
        except Exception as e:
            logger.warning(f"[XScanner] JSON parsing error: {e}")
        
        return candidates
    
    def _parse_tweet_entry(self, entry: dict) -> ContentCandidate | None:
        """Parse a single tweet from a timeline entry."""
        try:
            # Get content from entry
            content = entry.get("content", {})
            
            # Handle different entry types
            entry_type = content.get("entryType", "")
            
            if entry_type == "TimelineTweet":
                tweet_object = content.get("itemContent", {}).get("tweet_results", {})
                if not tweet_object:
                    return None
                    
                # Get the core tweet
                result = tweet_object.get("result", {})
                
                # Try different possible structures
                core = result.get("core", {})
                if not core:
                    # Legacy structure
                    core = result.get("legacy", {})
                
                # Get user info
                if isinstance(core, dict):
                    user_results = core.get("user_results", {})
                    if not user_results:
                        user_results = core.get("core", {}).get("user_results", {})
                    
                    user = user_results.get("result", {})
                    if isinstance(user, dict):
                        legacy_user = user.get("legacy", {})
                        username = legacy_user.get("screen_name", "unknown")
                    else:
                        username = "unknown"
                else:
                    username = "unknown"
                
                # Get tweet text and metrics
                if isinstance(core, dict):
                    legacy = core.get("legacy", {})
                    if not legacy:
                        legacy = core
                else:
                    legacy = {}
                
                tweet_id = legacy.get("id_str", entry.get("sortIndex", ""))
                full_text = legacy.get("full_text", "")
                if not full_text:
                    full_text = legacy.get("text", "")
                
                if not full_text:
                    return None
                
                # Get metrics
                retweets = legacy.get("retweet_count", 0)
                likes = legacy.get("favorite_count", 0)
                replies = legacy.get("reply_count", 0)
                
                # Estimate views (X doesn't expose this in public API)
                # Use engagement as proxy
                engagement = retweets + likes + replies
                estimated_views = engagement * 15  # Rough estimate
                
                # Calculate engagement score
                engagement_score = engagement / max(estimated_views, 1)
                
                # Get media if present
                media = legacy.get("entities", {}).get("media", [])
                media_url = media[0].get("media_url_https", "") if media else ""
                
                # Get the tweet URL
                user_id = legacy.get("user_id_str", "")
                if not user_id and isinstance(core, dict):
                    user_results = core.get("user_results", {})
                    user = user_results.get("result", {})
                    legacy_user = user.get("legacy", {})
                    user_id = legacy_user.get("id_str", "")
                
                url = f"https://x.com/{username}/status/{tweet_id}"
                
                return ContentCandidate(
                    id=f"x_{tweet_id}",
                    platform="X (Twitter)",
                    source_uri=url,
                    creator_name=username,
                    title=full_text[:100] + "..." if len(full_text) > 100 else full_text,
                    view_count=estimated_views,
                    like_count=likes,
                    comment_count=replies,
                    share_count=retweets,
                    engagement_score=engagement_score,
                    thumbnail_uri=media_url,
                    metadata={
                        "full_text": full_text
                    }
                )
                
        except Exception as e:
            logger.debug(f"[XScanner] Tweet parse error: {e}")
        
        return None
    
    async def _get_trending(self) -> list[ContentCandidate]:
        """Get trending topics from X (fallback)."""
        headers = {
            "User-Agent": random.choice(self.user_agents),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        }
        
        # Try to get trending page
        url = f"{self.base_url}/i/trends"
        
        try:
            async with httpx.AsyncClient(headers=headers, follow_redirects=True, timeout=15.0) as client:
                response = await client.get(url)
                
                if response.status_code != 200:
                    return []
                
                # Parse trends from the response
                # This is less reliable as X heavily personalizes
                pass
                
        except Exception as e:
            logger.warning(f"[XScanner] Trending fetch error: {e}")
        
        return []


base_x_scanner_service = XScanner()
