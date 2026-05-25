from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime, timezone


class ContentCandidate(BaseModel):
    """Unified content candidate model covering both discovery and search results.
    Spans fields from ContentCandidateDB and additional metadata.

    Note: Uses 'metadata' as alias for 'metadata_json' to maintain consistency
    with ContentCandidateDB field name via model_config.
    """
    model_config = ConfigDict(populate_by_name=True)

    id: str
    platform: str
    source_uri: str

    # Creator fields
    creator_name: str | None = None
    creator_id: str | None = None

    title: str | None = None
    description: str | None = None
    thumbnail_uri: str | None = None
    # Timestamps
    published_at: datetime | None = None
    scanned_at: datetime | None = None
    # Metrics
    view_count: int = 0
    like_count: int = 0
    comment_count: int = 0
    share_count: int = 0
    # Velocity (views per hour) - calculated from view count and time since publish
    velocity: float = 0.0
    engagement_score: float = 0.0
    viral_score: int = 0
    duration_seconds: float = 0.0
    # Categorization
    category: str = "video"
    tags: list[str] = []
    niche: str | None = None
    region: str | None = "US"
    # Quality & analysis
    quality_score: float = 1.0
    quality_flags: list[str] = []
    analysis_results: dict | None = None
    analyzed_at: datetime | None = None
    # Misc
    external_id: str | None = None
    discovery_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    # Use metadata_json to match DB field name, with 'metadata' as alias for convenience
    metadata_json: dict = Field(default_factory=dict, alias="metadata")


class ViralPattern(BaseModel):
    id: str
    hook_score: float
    retention_estimate: float
    pacing_bpm: int | None = None
    style_keywords: list[str] = []
    emotional_triggers: list[str] = []
