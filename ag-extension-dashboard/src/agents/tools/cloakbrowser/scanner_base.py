from abc import ABC, abstractmethod
import datetime
from .models import ContentCandidate


class DiscoveryScannerBase(ABC):
    @abstractmethod
    async def scan_trends(
        self, niche: str, published_after: datetime.datetime | None = None, region: str | None = None
    ) -> list[ContentCandidate]:
        pass

    def identify_viral_velocity(self, candidate: ContentCandidate) -> float:
        """
        Calculates how fast the content is gaining views/engagement.
        Default implementation: views per hour based on published_at or scanned_at.
        Can be overridden by scanners with more accurate data (like YouTube API).
        """

        # Try to get publication date from various sources
        pub_date = None

        # 1. Check metadata_json for published_at
        candidate_metadata = candidate.metadata_json or {}
        if candidate_metadata:
            pub_date_str = candidate_metadata.get(
                "published_at"
            ) or candidate_metadata.get("publishedTime")
            if pub_date_str:
                try:
                    pub_date = datetime.datetime.fromisoformat(
                        pub_date_str.replace("Z", "+00:00")
                    )
                except (ValueError, AttributeError):
                    pass

        # 2. Fall back to published_at field
        if not pub_date and candidate.published_at:
            pub_date = candidate.published_at

        # 3. Fall back to scanned_at
        if not pub_date and candidate.scanned_at:
            pub_date = candidate.scanned_at

        # Calculate hours since publication
        if pub_date:
            try:
                now = datetime.datetime.now(datetime.timezone.utc)
                if pub_date.tzinfo is None:
                    pub_date = pub_date.replace(tzinfo=datetime.timezone.utc)
                hours_since = (now - pub_date).total_seconds() / 3600
                hours_since = max(
                    hours_since, 0.5
                )  # At least 30 min to avoid division by zero
                return candidate.view_count / hours_since
            except (AttributeError, TypeError, ValueError):
                pass

        # 4. Ultimate fallback: estimate based on engagement
        # newer content with high engagement = higher velocity
        hours_estimated = 24  # Assume 24 hours old if unknown
        return candidate.view_count / hours_estimated

    def calculate_viral_score(self, candidate: ContentCandidate) -> int:
        """
        Calculate a composite viral score (0-100) based on multiple factors.
        Override this for platform-specific scoring.
        """
        velocity = self.identify_viral_velocity(candidate)

        # Normalize velocity (1000 views/hour = score of 100)
        velocity_score = min(velocity / 10, 50)

        # Engagement bonus (likes, comments, shares)
        engagement_bonus = 0
        if candidate.engagement_score:
            engagement_bonus = min(candidate.engagement_score / 10, 25)

        # Duration bonus (shorts/preferred durations get boosted)
        duration_bonus = 0
        if candidate.duration_seconds:
            # Optimal: 15-60 seconds for shorts
            if 15 <= candidate.duration_seconds <= 60:
                duration_bonus = 15
            elif 60 < candidate.duration_seconds <= 180:
                duration_bonus = 10

        return min(int(velocity_score + engagement_bonus + duration_bonus), 100)
