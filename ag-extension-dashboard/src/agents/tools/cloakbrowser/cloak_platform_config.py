"""
CloakBrowser Platform Configuration Registry

Defines how each platform should be scraped via the CloakBrowser stealth engine.
Specifically tailored for Tropical Knowledge Base sources in the RAG pipeline.
"""

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class CloakPlatformConfig:
    """Configuration for a single platform's CloakBrowser scraping."""

    name: str
    id_prefix: str
    platform_label: str
    search_url_template: str
    scrape_endpoint: str = "/scrape/web"
    use_generic_endpoint: bool = True
    timeout: float = 45.0
    max_results: int = 10
    max_retries: int = 2
    retry_backoff: float = 2.0
    category: str = "document"
    extra_params: dict = field(default_factory=dict)
    requires_scroll: bool = False
    wait_selector: Optional[str] = None
    tags_extra: list = field(default_factory=list)


CLOAK_PLATFORMS: dict[str, CloakPlatformConfig] = {
    "fao_crop_guides": CloakPlatformConfig(
        name="FAO Crop Guides",
        id_prefix="cloak_fao",
        platform_label="FAO Publications",
        search_url_template="https://www.fao.org/search/en/?q={query}",
        timeout=45.0,
        max_results=5,
        category="document",
        wait_selector=".gsc-result",
        tags_extra=["fao", "tropical-agriculture", "validated"],
    ),
    "iita_agronomy": CloakPlatformConfig(
        name="IITA Agronomy",
        id_prefix="cloak_iita",
        platform_label="CGIAR/IITA",
        search_url_template="https://www.iita.org/?s={query}",
        timeout=40.0,
        max_results=5,
        category="document",
        wait_selector="article",
        tags_extra=["cgiar", "iita", "roots", "tubers", "validated"],
    ),
    "cabi_plantwise": CloakPlatformConfig(
        name="CABI Plantwise",
        id_prefix="cloak_cabi",
        platform_label="CABI Plantwise Knowledge Bank",
        search_url_template="https://plantwiseplusknowledgebank.org/action/doSearch?AllField={query}",
        timeout=50.0,
        max_results=5,
        category="document",
        wait_selector=".search-resultItem",
        tags_extra=["cabi", "plant-health", "pest", "disease", "validated"],
    ),
    "fews_net": CloakPlatformConfig(
        name="FEWS NET",
        id_prefix="cloak_fews",
        platform_label="FEWS NET Climate/Food Security",
        search_url_template="https://fews.net/search?keywords={query}",
        timeout=40.0,
        max_results=5,
        category="document",
        wait_selector=".search-result",
        tags_extra=["fews-net", "climate", "food-security", "validated"],
    ),
    "africarice": CloakPlatformConfig(
        name="AfricaRice",
        id_prefix="cloak_ar",
        platform_label="AfricaRice / IRRI",
        search_url_template="https://www.google.com/search?q=site:africarice.org+{query}",
        timeout=35.0,
        max_results=5,
        category="document",
        wait_selector=".g",
        tags_extra=["africarice", "rice", "agronomy", "validated"],
    ),
}


def get_platform_config(platform: str) -> Optional[CloakPlatformConfig]:
    """Retrieve a platform config by key."""
    return CLOAK_PLATFORMS.get(platform.lower())


def get_all_platform_keys() -> list[str]:
    """Return all available platform keys."""
    return list(CLOAK_PLATFORMS.keys())
