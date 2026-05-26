import httpx
import logging
import json
import re
import random
from datetime import datetime
from .models import ContentCandidate

logger = logging.getLogger(__name__)


class InstagramScanner:
    """
    Scans Instagram for trending Reels using web scraping.
    Instagram is the primary hub for high-aesthetic vertical content.
    
    Uses the public explore page and search to find trending content
    without requiring the official Graph API.
    """
    
    def __init__(self):
        self.platform = "Instagram"
        self.base_url = "https://www.instagram.com"
        self.explore_url = "https://www.instagram.com/explore/"
        self.user_agents = [
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
            "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        ]
    
    async def scan_trends(self, niche: str, published_after: datetime | None = None, **kwargs) -> list[ContentCandidate]:
        """
        Scans Instagram for trending Reels in a niche.
        Uses the explore page and hashtag search to find trending content.
        """
        logger.info(f"[InstagramScanner] Scanning for trending Reels in niche: {niche}")
        
        candidates = []
        
        # Try multiple search strategies
        search_queries = [
            f"{niche} reels",
            f"#{niche.replace(' ', '')}reels",
            f"trending {niche}"
        ]
        
        for query in search_queries[:2]:
            try:
                results = await self._search_hashtag(query, niche)
                candidates.extend(results)
            except Exception as e:
                logger.warning(f"[InstagramScanner] Search failed for '{query}': {e}")
        
        # If scraping fails, fall back to explore page
        if not candidates:
            try:
                candidates = await self._scrape_explore(niche)
            except Exception as e:
                logger.warning(f"[InstagramScanner] Explore page scrape failed: {e}")
        
        # Remove duplicates by URL
        seen = set()
        unique_candidates = []
        for c in candidates:
            if c.source_uri not in seen:
                seen.add(c.source_uri)
                unique_candidates.append(c)
        
        logger.info(f"[InstagramScanner] Found {len(unique_candidates)} unique Reels")
        return unique_candidates[:15]
    
    async def _search_hashtag(self, query: str, niche: str) -> list[ContentCandidate]:
        """Search Instagram for a hashtag and extract Reels."""
        headers = {
            "User-Agent": random.choice(self.user_agents),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
        }
        
        # Instagram hashtag URL format
        hashtag = query.replace(' ', '').replace('#', '')
        url = f"{self.base_url}/explore/tags/{hashtag}/"
        
        candidates = []
        
        try:
            async with httpx.AsyncClient(headers=headers, follow_redirects=True, timeout=15.0) as client:
                response = await client.get(url)
                
                if response.status_code != 200:
                    logger.warning(f"[InstagramScanner] Hashtag search failed: {response.status_code}")
                    return []
                
                # Look for JSON data in script tags (Instagram's SSR data)
                # Try to find __NEXT_DATA__ or similar hydrated data
                json_matches = re.findall(
                    r'<script[^>]*type="application/json"[^>]*data-chunk="[^"]*"[^>]*>(.*?)</script>',
                    response.text,
                    re.DOTALL
                )
                
                for json_str in json_matches:
                    try:
                        data = json.loads(json_str)
                        posts = self._extract_posts_from_json(data)
                        candidates.extend(posts)
                    except json.JSONDecodeError:
                        continue
                
                # Alternative: Look for sharedData in window
                if not candidates:
                    shared_data_match = re.search(
                        r'window\.__sharedData\s*=\s*(.*?);</script>',
                        response.text,
                        re.DOTALL
                    )
                    if shared_data_match:
                        try:
                            data = json.loads(shared_data_match.group(1))
                            posts = self._extract_posts_from_json(data)
                            candidates.extend(posts)
                        except json.JSONDecodeError:
                            pass
                
        except Exception as e:
            logger.warning(f"[InstagramScanner] Hashtag search error: {e}")
        
        return candidates
    
    def _extract_posts_from_json(self, data: dict) -> list[ContentCandidate]:
        """Extract post data from Instagram's JSON structure."""
        candidates = []
        
        # Navigate through the complex Instagram JSON structure
        try:
            # Try different possible paths
            edges = []
            
            # Path 1: hashtag -> edge_hashtag_to_media
            if "props" in data:
                page = data.get("props", {}).get("page", {})
                if "hashtag" in page:
                    edge = page["hashtag"].get("edge_hashtag_to_media", {})
                    edges = edge.get("edges", [])
            
            # Path 2: data -> hashtag -> edge_hashtag_to_media  
            if not edges and "data" in data:
                hashtag = data.get("data", {}).get("hashtag", {})
                edge = hashtag.get("edge_hashtag_to_media", {})
                edges = edge.get("edges", [])
            
            # Path 3: legacy sharedData format
            if not edges:
                entry_data = data.get("entry_data", {}).get("TagPage", [{}])[0].get("graphql", {})
                hashtag = entry_data.get("hashtag", {})
                edge = hashtag.get("edge_hashtag_to_media", {})
                edges = edge.get("edges", [])
            
            for edge in edges:
                node = edge.get("node", {})
                if not node:
                    continue
                
                shortcode = node.get("shortcode", "")
                if not shortcode:
                    continue
                
                # Get dimensions for aspect ratio (important for Reels)
                dimensions = node.get("dimensions", {})
                width = dimensions.get("width", 0)
                height = dimensions.get("height", 0)
                is_portrait = height > width if width and height else False
                
                # Skip if not likely a Reel (too landscape)
                if width and height and width > height * 1.5:
                    continue
                
                # Extract engagement metrics
                edge_liked_by = node.get("edge_liked_by", {})
                likes = edge_liked_by.get("count", 0)
                
                edge_media_preview_like = node.get("edge_media_preview_like", {})
                preview_likes = edge_media_preview_like.get("count", 0)
                
                total_likes = max(likes, preview_likes)
                
                # Get comments if available
                edge_media_to_comment = node.get("edge_media_to_comment", {})
                comments = edge_media_to_comment.get("count", 0)
                
                # Calculate engagement score estimate
                views_estimate = total_likes * 20  # Rough estimate
                engagement_score = (total_likes + comments) / max(views_estimate, 1) if views_estimate else 0
                
                # Get thumbnail
                display_url = node.get("display_url", "")
                thumbnail_uri = node.get("thumbnail_src", display_url)
                
                # Get owner info
                owner = node.get("owner", {})
                username = owner.get("username", "unknown")
                
                # Get caption
                edge_media_to_caption = node.get("edge_media_to_caption", {})
                caption_edges = edge_media_to_caption.get("edges", [])
                title = ""
                if caption_edges:
                    title = caption_edges[0].get("node", {}).get("text", "")[:100]
                
                if not title:
                    title = f"Instagram Reel by @{username}"
                
                candidate = ContentCandidate(
                    id=f"ig_{shortcode}",
                    platform="Instagram Reels",
                    source_uri=f"https://www.instagram.com/reel/{shortcode}/",
                    creator_name=username,
                    title=title,
                    view_count=views_estimate,
                    like_count=total_likes,
                    comment_count=comments,
                    share_count=0,
                    engagement_score=engagement_score,
                    thumbnail_uri=thumbnail_uri,
                    metadata={
                        "is_portrait": is_portrait,
                        "dimensions": f"{width}x{height}"
                    }
                )
                candidates.append(candidate)
                
        except Exception as e:
            logger.warning(f"[InstagramScanner] JSON parsing error: {e}")
        
        return candidates
    
    async def _scrape_explore(self, niche: str) -> list[ContentCandidate]:
        """
        Fallback: Scrape Instagram Explore page.
        This is less reliable as the explore page is personalized.
        """
        headers = {
            "User-Agent": random.choice(self.user_agents),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        }
        
        try:
            async with httpx.AsyncClient(headers=headers, follow_redirects=True, timeout=15.0) as client:
                response = await client.get(self.explore_url)
                
                if response.status_code != 200:
                    return []
                
                # Try to extract trending posts from explore page
                # This is highly variable as Instagram personalizes heavily
                # For now, return empty - hashtag search is more reliable
                pass
                
        except Exception as e:
            logger.warning(f"[InstagramScanner] Explore scrape error: {e}")
        
        return []


# Base instance for the service
base_instagram_service = InstagramScanner()
