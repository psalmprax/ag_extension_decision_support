#!/usr/bin/env python3
"""
Generate the Investor Monthly Operating Cost Model Presentation (.pptx and .pdf)
for the Ag-Extension Decision Support Platform (GPEXTS).

Grounds every line item in actual codebase subsystems (OmniRoute, RAG v2,
YOLOv8/MobileViT ONNX edge vision, Whisper STT, Sentinel Hub, Africa's Talking /
WhatsApp / Twilio, Cloudflare R2 / Backblaze B2, Postgres+pgvector, Dual Redis,
Agent Zero / CrewAI, ClamAV, Sentry/OTLP, EUDR/GS1/OCAP compliance) and models
three scaling tiers strictly within $10,000 - $50,000 / month.

Usage:
    python3 scripts/generate_cost_deck.py
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from typing import Any, Dict, List, Tuple

# Allow running cleanly whether python-pptx is in site-packages or /tmp/pptx_deps
_TMP_DEPS = Path("/tmp/pptx_deps")
if _TMP_DEPS.is_dir() and str(_TMP_DEPS) not in sys.path:
    sys.path.insert(0, str(_TMP_DEPS))

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.ticker as mtick
from matplotlib.lines import Line2D
from matplotlib.patches import Patch
import numpy as np

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.oxml import parse_xml
from pptx.util import Inches, Pt


REPO_ROOT = Path(__file__).resolve().parent.parent
PRESENTATIONS_DIR = REPO_ROOT / "presentations"
LOGO_PATH = REPO_ROOT / "ag-extension-dashboard" / "src" / "frontend" / "public" / "logo.png"
CHART_DIR = Path("/tmp/ag_cost_deck_charts")

OUT_PPTX = PRESENTATIONS_DIR / "Ag_Extension_Monthly_Cost_Model.pptx"
OUT_PDF = PRESENTATIONS_DIR / "Ag_Extension_Monthly_Cost_Model.pdf"

FONT_FAMILY = "Liberation Sans"
FONT_MONO = "Liberation Mono"

# Palette — Quiet Chrome, Botanical Authority
HEX_DARK_BG = "#0B1B14"
HEX_DARK_CARD = "#12281E"
HEX_DARK_LINE = "#234937"
HEX_LIGHT_BG = "#F7F9F8"
HEX_CARD_BG = "#FFFFFF"
HEX_SUBTLE_BG = "#EEF3F0"
HEX_BORDER = "#D5DFD9"
HEX_INK = "#0F1E17"
HEX_INK_SEC = "#3B5247"
HEX_MUTED = "#64748B"
HEX_FOREST = "#166534"
HEX_EMERALD = "#10B981"
HEX_TEAL = "#0F766E"
HEX_SLATE = "#334155"
HEX_AMBER = "#B45309"
HEX_AMBER_BRIGHT = "#D97706"
HEX_COOL_SLATE = "#64748B"
HEX_RED_MUTED = "#991B1B"


def rgb(hex_color: str) -> RGBColor:
    h = hex_color.lstrip("#")
    return RGBColor(int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def round_half_up(value: float | int | Decimal, decimals: int = 1) -> Decimal:
    q = Decimal("1") if decimals == 0 else Decimal(f"1e-{decimals}")
    return Decimal(str(value)).quantize(q, rounding=ROUND_HALF_UP)


def pct_value(numerator: float | int, denominator: float | int, decimals: int = 1) -> Decimal:
    return round_half_up((Decimal(numerator) * Decimal(100)) / Decimal(denominator), decimals)


def compute_gross_margin_pct(arpu: float, cogs_total: int, farmers: int) -> Decimal:
    rev = Decimal(str(arpu)) * Decimal(farmers)
    margin = ((rev - Decimal(cogs_total)) * Decimal(100)) / rev
    return round_half_up(margin, 1)


def compute_breakeven(phase2_opex: int) -> Dict[str, Decimal]:
    be_200_k = round_half_up(Decimal(phase2_opex) / Decimal(2000), 1)
    be_150_k = round_half_up(Decimal(phase2_opex) / Decimal(1500), 2)
    mid_k = round_half_up((be_200_k + be_150_k) / Decimal(2), 1)
    return {"be_200_k": be_200_k, "be_150_k": be_150_k, "mid_k": mid_k}


@dataclass(frozen=True)
class CostItem:
    category: str
    name: str
    detail: str
    p1: int
    p2: int
    p3: int
    is_cogs: bool  # True = Direct Platform / Variable Delivery COGS
    fte: Tuple[float, float, float] | None = None


PHASES = [
    {
        "key": "p1",
        "name": "Phase 1: Lean Pilot",
        "short": "Phase 1\nPilot",
        "coops": "3–5 Co-ops",
        "coops_val": "3–5",
        "officers": "30 Officers",
        "officers_val": "30",
        "farmers": 3_000,
        "farmers_lbl": "3,000 Farmers",
        "queries_mo": "45k AI queries",
        "voice_mo": "6k voice notes",
        "msgs_mo": "15k SMS/WA",
        "parcels": "500 parcels",
    },
    {
        "key": "p2",
        "name": "Phase 2: Commercial Growth",
        "short": "Phase 2\nGrowth",
        "coops": "25 Co-ops",
        "coops_val": "25",
        "officers": "200 Officers",
        "officers_val": "200",
        "farmers": 25_000,
        "farmers_lbl": "25,000 Farmers",
        "queries_mo": "350k AI queries",
        "voice_mo": "45k voice notes",
        "msgs_mo": "125k SMS/WA",
        "parcels": "5,000 parcels",
    },
    {
        "key": "p3",
        "name": "Phase 3: Multi-Country Scale",
        "short": "Phase 3\nScale",
        "coops": "110+ Co-ops",
        "coops_val": "110+",
        "officers": "850 Officers",
        "officers_val": "850",
        "farmers": 120_000,
        "farmers_lbl": "120,000 Farmers",
        "queries_mo": "1.6M AI queries",
        "voice_mo": "180k voice notes",
        "msgs_mo": "550k SMS/WA",
        "parcels": "30,000 parcels",
    },
]

CATEGORY_ORDER = [
    "1. Human Resources",
    "2. Core Infrastructure & DevSecOps",
    "3. AI Power & Trained Custom AI",
    "4. Telecom, Satellite & Field Delivery",
    "5. Compliance, Risk, G&A & Contingency",
]

CATEGORY_COLORS = {
    "1. Human Resources": "#14532D",
    "2. Core Infrastructure & DevSecOps": "#334155",
    "3. AI Power & Trained Custom AI": "#0F766E",
    "4. Telecom, Satellite & Field Delivery": "#B45309",
    "5. Compliance, Risk, G&A & Contingency": "#64748B",
}

COST_ITEMS: List[CostItem] = [
    # 1. Human Resources (blended global/regional EOR & specialist contractor rates)
    CostItem("1. Human Resources", "Platform, Product & Backend Eng.", "TS/Express API, Prisma, product spec & sync", 2500, 4600, 7200, False, fte=(0.60, 1.00, 1.50)),
    CostItem("1. Human Resources", "AI / ML & Computer Vision Eng.", "OmniRoute, RAG v2, ONNX CV, Whisper", 1900, 4400, 6900, False, fte=(0.50, 1.00, 1.50)),
    CostItem("1. Human Resources", "Frontend, Mobile & Edge Eng.", "React PWA, Capacitor Android/iOS, Ext", 800, 2400, 3600, False, fte=(0.25, 0.75, 1.00)),
    CostItem("1. Human Resources", "DevSecOps, SRE & Cloud Ops", "Docker Compose, CI/CD, backups, security", 400, 1100, 2600, False, fte=(0.15, 0.30, 0.75)),
    CostItem("1. Human Resources", "Lead Agronomist & Data Steward", "Pathology QA, safety guardrails, RAG", 1000, 2200, 3400, False, fte=(0.50, 1.00, 1.50)),
    CostItem("1. Human Resources", "Co-op GTM, Field Ops & CS", "B2B co-op sales/onboarding, officer CS & ops", 800, 2100, 4100, False, fte=(1.00, 2.00, 4.00)),

    # 2. Core Infrastructure & DevSecOps
    CostItem("2. Core Infrastructure & DevSecOps", "App, Agent Zero & CrewAI Compute", "Docker Compose services, Nginx, Traefik v3.7, CloakBrowser", 280, 850, 1950, True),
    CostItem("2. Core Infrastructure & DevSecOps", "Postgres 15 (pgvector) & Dual Redis", "PostGIS 3.4 + pgvector, LRU + AOF noeviction BullMQ, db-backup", 180, 550, 1300, True),
    CostItem("2. Core Infrastructure & DevSecOps", "Cloudflare R2 + Backblaze B2 & WAF", "Zero-egress media streaming ($0/GB out), cold archives, DNS/WAF", 40, 150, 400, True),
    CostItem("2. Core Infrastructure & DevSecOps", "Observability, ClamAV & CI/CD", "Sentry APM, OpenTelemetry, ClamAV upload scan, GH Actions", 100, 300, 650, True),

    # 3. AI Power & Trained Custom AI
    CostItem("3. AI Power & Trained Custom AI", "Production LLM & Reranking", "OmniRoute cascade (AIHubMix/Groq/OpenAI/Anthropic/Ollama)", 250, 850, 2100, True),
    CostItem("3. AI Power & Trained Custom AI", "RAG Embeddings & Translation", "768-dim text-embedding-3-large, co-occurrence graph, 24-lang QA", 80, 220, 480, True),
    CostItem("3. AI Power & Trained Custom AI", "Voice AI (Whisper STT & TTS)", "Local @napi-rs/whisper + OpenAI Whisper/TTS (EN/SW; FR planned)", 120, 450, 1070, True),
    CostItem("3. AI Power & Trained Custom AI", "Custom CV & ASR GPU Training", "Trains YOLOv8n + MobileViT-XXS ONNX weights & Whisper LoRA GPUs", 380, 950, 1700, False),
    CostItem("3. AI Power & Trained Custom AI", "Pathology Labeling & Evals", "Certified crop labeling (>=200/crop), dialect audio, F1 backtests", 320, 730, 1250, False),

    # 4. Telecom, Satellite & Field Delivery
    CostItem("4. Telecom, Satellite & Field Delivery", "SMS, USSD, WhatsApp & IVR", "Africa's Talking SMS/USSD, Twilio SMS & WA (WHATSAPP_TEMPLATE_SIDS)", 250, 950, 1900, True),
    CostItem("4. Telecom, Satellite & Field Delivery", "Satellite NDVI & Weather/Market", "Provisions Sentinel Hub 10m NDVI, WeatherAPI, Tavily, FX feeds", 220, 650, 1400, True),
    CostItem("4. Telecom, Satellite & Field Delivery", "Field Kits, LoRaWAN & Data Bundles", "Rugged Android amortization, LoRaWAN SIMs (501-gated), data bundles", 280, 550, 900, True),

    # 5. Compliance, Risk, G&A & Contingency
    CostItem("5. Compliance, Risk, G&A & Contingency", "Compliance, OCAP® & EUDR/GS1", "OCAP governance, EUDR DDS & GS1 rollout (501-gated), ODPC/PIPEDA", 400, 750, 1200, False),
    CostItem("5. Compliance, Risk, G&A & Contingency", "Pentests, Insurance & Payment/FX", "External pentest reserve, Cyber/E&O/D&O ins., Stripe/PayPal/M-Pesa FX", 300, 600, 1050, False),
    CostItem("5. Compliance, Risk, G&A & Contingency", "Travel, Legal/Acct & SaaS Ops", "Co-op onboarding travel, EOR/payroll, bookkeeping, dev tools", 1150, 1250, 1450, False),
    CostItem("5. Compliance, Risk, G&A & Contingency", "Operational Contingency Buffer", "Dedicated reserve for FX, satellite or API bursts", 750, 1400, 2400, False),
]

TWELVE_MONTH_RAMP = [
    ("M1", 12500, "Pilot"),
    ("M2", 12500, "Pilot"),
    ("M3", 12500, "Pilot"),
    ("M4", 12500, "Pilot"),
    ("M5", 28000, "Growth"),
    ("M6", 28000, "Growth"),
    ("M7", 28000, "Growth"),
    ("M8", 28000, "Growth"),
    ("M9", 28000, "Growth"),
    ("M10", 28000, "Growth"),
    ("M11", 38500, "Scale Ramp"),
    ("M12", 49000, "Scale"),
]


def compute_summary() -> Dict[str, Any]:
    cat_totals: Dict[str, Tuple[int, int, int]] = {}
    for cat in CATEGORY_ORDER:
        items = [i for i in COST_ITEMS if i.category == cat]
        cat_totals[cat] = (
            sum(i.p1 for i in items),
            sum(i.p2 for i in items),
            sum(i.p3 for i in items),
        )

    totals = (
        sum(v[0] for v in cat_totals.values()),
        sum(v[1] for v in cat_totals.values()),
        sum(v[2] for v in cat_totals.values()),
    )
    cogs = (
        sum(i.p1 for i in COST_ITEMS if i.is_cogs),
        sum(i.p2 for i in COST_ITEMS if i.is_cogs),
        sum(i.p3 for i in COST_ITEMS if i.is_cogs),
    )
    fixed = (totals[0] - cogs[0], totals[1] - cogs[1], totals[2] - cogs[2])

    hr_items = [i for i in COST_ITEMS if i.category == "1. Human Resources"]
    hr_ftes = tuple(
        round_half_up(
            sum((Decimal(str(i.fte[idx])) for i in hr_items if i.fte is not None), Decimal("0")),
            2,
        )
        for idx in range(3)
    )

    contingency = next(i for i in COST_ITEMS if i.name == "Operational Contingency Buffer")
    contingency_vals = (contingency.p1, contingency.p2, contingency.p3)
    contingency_pcts = tuple(
        pct_value(contingency_vals[idx], totals[idx] - contingency_vals[idx], 1)
        for idx in range(3)
    )

    breakeven = compute_breakeven(totals[1])
    margins_150 = tuple(
        compute_gross_margin_pct(1.50, cogs[idx], PHASES[idx]["farmers"])
        for idx in range(3)
    )
    margins_200 = tuple(
        compute_gross_margin_pct(2.00, cogs[idx], PHASES[idx]["farmers"])
        for idx in range(3)
    )

    return {
        "cat_totals": cat_totals,
        "totals": totals,
        "cogs": cogs,
        "fixed": fixed,
        "hr_ftes": hr_ftes,
        "contingency_pcts": contingency_pcts,
        "breakeven": breakeven,
        "margins_150": margins_150,
        "margins_200": margins_200,
        "year1_burn": sum(m[1] for m in TWELVE_MONTH_RAMP),
    }


def validate_model() -> Dict[str, Any]:
    summary = compute_summary()
    totals = summary["totals"]
    assert totals == (12500, 28000, 49000), f"Unexpected totals: {totals}"
    for t in totals:
        assert 10_000 <= t <= 50_000, f"Total {t} outside $10k-$50k target range"

    for item in COST_ITEMS:
        assert item.category in CATEGORY_ORDER, f"Unknown category: {item.category}"
        assert item.p1 <= item.p2 <= item.p3, f"Non-monotonic item {item.name}"
        if item.category == "1. Human Resources":
            assert item.fte is not None, f"HR item {item.name} missing fte allocation"

    cat_totals = summary["cat_totals"]
    for cat, vals in cat_totals.items():
        assert vals[0] < vals[1] < vals[2], f"Category {cat} did not scale monotonically"

    assert summary["hr_ftes"] == (Decimal("3.00"), Decimal("6.05"), Decimal("10.25")), (
        f"Unexpected HR FTE totals: {summary['hr_ftes']}"
    )
    assert summary["cogs"] == (1800, 5520, 12150), f"Unexpected COGS: {summary['cogs']}"
    assert summary["year1_burn"] == 305500, f"Unexpected Year-1 burn: {summary['year1_burn']}"
    return summary


# ---------------------------------------------------------------------------
# Computed Chart Specs & Matplotlib Chart Generation (300 DPI)
# ---------------------------------------------------------------------------

def build_chart_specs(summary: Dict[str, Any]) -> Dict[str, Any]:
    cat_totals: Dict[str, Tuple[int, int, int]] = summary["cat_totals"]
    totals: Tuple[int, int, int] = summary["totals"]
    cogs: Tuple[int, int, int] = summary["cogs"]
    breakeven: Dict[str, Decimal] = summary["breakeven"]

    hr_items = [i for i in COST_ITEMS if i.category == "1. Human Resources"]
    hr_roles = [
        "Platform, Product & Backend",
        "AI / ML & Vision",
        "Frontend / Mobile / Edge",
        "Agronomy & Stewardship",
        "Co-op GTM & Field Ops",
        "DevSecOps / SRE",
    ]
    hr_role_map = {
        "Platform, Product & Backend": hr_items[0],
        "AI / ML & Vision": hr_items[1],
        "Frontend / Mobile / Edge": hr_items[2],
        "Agronomy & Stewardship": hr_items[4],
        "Co-op GTM & Field Ops": hr_items[5],
        "DevSecOps / SRE": hr_items[3],
    }
    hr_cat = cat_totals["1. Human Resources"]
    hr_phase_labels = [
        f"Phase 1 (${hr_cat[0] / 1000:.1f}k)",
        f"Phase 2 (${hr_cat[1] / 1000:.1f}k)",
        f"Phase 3 (${hr_cat[2] / 1000:.1f}k)",
    ]

    r2_item = next(i for i in COST_ITEMS if "Cloudflare R2" in i.name)
    r2_b2 = [r2_item.p1, r2_item.p2, r2_item.p3]
    aws_s3 = [55, 765, 3380]
    storage_scale_save = aws_s3[2] - r2_b2[2]
    storage_scale_pct = int(pct_value(storage_scale_save, aws_s3[2], 0))

    ai_prod_items = [i for i in COST_ITEMS if i.category == "3. AI Power & Trained Custom AI"][:3]
    gpexts_ai = [
        sum(it.p1 for it in ai_prod_items),
        sum(it.p2 for it in ai_prod_items),
        sum(it.p3 for it in ai_prod_items),
    ]
    naive_ai = [1450, 5200, 13800]
    ai_savings_pcts = tuple(
        pct_value(naive - gpexts, naive, 1)
        for gpexts, naive in zip(gpexts_ai, naive_ai)
    )
    ai_savings_min = int(round_half_up(min(ai_savings_pcts), 0))
    ai_savings_max = int(round_half_up(max(ai_savings_pcts), 0))

    custom_ai_items = [i for i in COST_ITEMS if i.category == "3. AI Power & Trained Custom AI"][3:]
    gpu_train = [custom_ai_items[0].p1, custom_ai_items[0].p2, custom_ai_items[0].p3]
    labeling = [custom_ai_items[1].p1, custom_ai_items[1].p2, custom_ai_items[1].p3]

    # Step onto the $28,000 Phase 2 operating plateau across 14k-25k farmers
    farmers_k = np.array([3, 8, 12, 14, 19, 25, 40, 60, 80, 100, 120], dtype=float)
    opex_curve = np.array(
        [totals[0], 20000, 26000, totals[1], totals[1], totals[1], 33000, 38500, 42500, 46000, totals[2]],
        dtype=float,
    )
    cogs_curve = np.array(
        [cogs[0], 2750, 3450, 3850, 4650, cogs[1], 7000, 8500, 9900, 11100, cogs[2]],
        dtype=float,
    )
    rev_conserv = farmers_k * 1000.0 * 1.50
    rev_target = farmers_k * 1000.0 * 2.00

    be_x_200 = float(breakeven["be_200_k"])
    be_x_150 = float(breakeven["be_150_k"])
    be_y_k = float(totals[1]) / 1000.0
    be_arrow_xy = (float(breakeven["mid_k"]), be_y_k)

    ramp_stage_colors = {
        "Pilot": "#86EFAC",
        "Growth": "#15803D",
        "Scale Ramp": "#0F766E",
        "Scale": "#14532D",
    }
    ramp_legend_specs = [
        ("Pilot", f"M1-M4: Lean Pilot (${totals[0] / 1000:.1f}k/mo)"),
        ("Growth", f"M5-M10: Growth (${totals[1] / 1000:.1f}k/mo)"),
        ("Scale Ramp", f"M11: Scale Ramp (${TWELVE_MONTH_RAMP[10][1] / 1000:.1f}k/mo)"),
        ("Scale", f"M12: Scale (${totals[2] / 1000:.1f}k/mo)"),
    ]

    return {
        "hr_roles": hr_roles,
        "hr_role_map": hr_role_map,
        "hr_phase_labels": hr_phase_labels,
        "r2_b2": r2_b2,
        "aws_s3": aws_s3,
        "storage_scale_save": storage_scale_save,
        "storage_scale_pct": storage_scale_pct,
        "ai_prod_items": ai_prod_items,
        "gpexts_ai": gpexts_ai,
        "naive_ai": naive_ai,
        "ai_savings_pcts": ai_savings_pcts,
        "ai_savings_range_lbl": f"{ai_savings_min}–{ai_savings_max}%",
        "gpu_train": gpu_train,
        "labeling": labeling,
        "farmers_k": farmers_k,
        "opex_curve": opex_curve,
        "cogs_curve": cogs_curve,
        "rev_conserv": rev_conserv,
        "rev_target": rev_target,
        "be_x_200": be_x_200,
        "be_x_150": be_x_150,
        "be_y_k": be_y_k,
        "be_arrow_xy": be_arrow_xy,
        "ramp_stage_colors": ramp_stage_colors,
        "ramp_legend_specs": ramp_legend_specs,
        "ramp_ylim": (0, 70000),
    }


def _configure_matplotlib():
    plt.rcParams.update({
        "font.family": "sans-serif",
        "font.sans-serif": [FONT_FAMILY, "DejaVu Sans"],
        "text.parse_math": False,
        "axes.edgecolor": "#CBD5E1",
        "axes.linewidth": 0.8,
        "axes.grid": True,
        "grid.color": "#E2E8F0",
        "grid.linestyle": "--",
        "grid.linewidth": 0.6,
        "axes.axisbelow": True,
        "xtick.color": "#3B5247",
        "ytick.color": "#3B5247",
        "text.color": "#0F1E17",
        "figure.facecolor": "#FFFFFF",
        "axes.facecolor": "#FFFFFF",
    })


def generate_charts(summary: Dict[str, Any], specs: Dict[str, Any] | None = None) -> Dict[str, Path]:
    _configure_matplotlib()
    if specs is None:
        specs = build_chart_specs(summary)
    if CHART_DIR.exists():
        shutil.rmtree(CHART_DIR)
    CHART_DIR.mkdir(parents=True, exist_ok=True)
    paths: Dict[str, Path] = {}

    cat_totals: Dict[str, Tuple[int, int, int]] = summary["cat_totals"]
    totals: Tuple[int, int, int] = summary["totals"]
    cogs: Tuple[int, int, int] = summary["cogs"]
    year1_burn: int = summary["year1_burn"]

    # 1. Total Burn Scaling & Cost per Farmer (Slide 2)
    fig, ax1 = plt.subplots(figsize=(6.8, 4.35), dpi=300)
    x = np.arange(3)
    width = 0.48
    bottom = np.zeros(3)
    short_labels = [
        "1. Human Resources",
        "2. Core Cloud Infra",
        "3. AI Power & Custom ML",
        "4. Telecom, Sat & Field",
        "5. Compliance, G&A & Buffer",
    ]
    for cat, lbl in zip(CATEGORY_ORDER, short_labels):
        vals = np.array(cat_totals[cat], dtype=float)
        ax1.bar(x, vals, width, bottom=bottom, label=lbl, color=CATEGORY_COLORS[cat], edgecolor="#FFFFFF", linewidth=0.8)
        bottom += vals

    ax1.axhline(50000, color="#991B1B", linestyle=":", linewidth=1.3, label="$50k Monthly Ceiling")
    ax1.axhline(10000, color="#64748B", linestyle="--", linewidth=1.0, label="$10k Monthly Floor")

    for i, total in enumerate(totals):
        cpf = float(round_half_up(Decimal(total) / Decimal(PHASES[i]["farmers"]), 2))
        y_pos = max(total + 1200, 51400) if i == 2 else total + 1200
        ax1.text(i, y_pos, f"${total:,}/mo\n(${cpf:.2f}/farmer)", ha="center", va="bottom",
                 fontsize=9.2, fontweight="bold", color=HEX_INK)

    ax1.set_xticks(x)
    ax1.set_xticklabels([
        f"Phase 1: Pilot\n({PHASES[0]['farmers']:,} farmers)",
        f"Phase 2: Growth\n({PHASES[1]['farmers']:,} farmers)",
        f"Phase 3: Scale\n({PHASES[2]['farmers']:,} farmers)",
    ], fontsize=9.5, fontweight="bold")
    ax1.set_ylim(0, 64000)
    ax1.yaxis.set_major_formatter(mtick.FuncFormatter(lambda v, _: f"${int(v / 1000)}k"))
    ax1.spines["top"].set_visible(False)
    ax1.spines["right"].set_visible(False)
    ax1.set_ylabel("Monthly Operating Burn (USD)", fontsize=9.5, fontweight="bold")
    ax1.legend(loc="upper left", frameon=True, facecolor="#F8FAF9", edgecolor="#E2E8F0", fontsize=7.8)
    fig.tight_layout(pad=0.8)
    p = CHART_DIR / "chart_total_burn_scaling.png"
    fig.savefig(p, dpi=300)
    plt.close(fig)
    paths["burn_scaling"] = p

    # 2. HR Composition Horizontal Grouped Bars (Slide 4)
    roles: List[str] = specs["hr_roles"]
    role_map: Dict[str, CostItem] = specs["hr_role_map"]
    hr_labels: List[str] = specs["hr_phase_labels"]

    fig, ax = plt.subplots(figsize=(5.3, 4.35), dpi=300)
    y = np.arange(len(roles))
    h = 0.24
    # Plot y-h (Phase 1), y (Phase 2), y+h (Phase 3) before invert_yaxis() so top-to-bottom matches legend order
    ax.barh(y - h, [role_map[r].p1 for r in roles], h, label=hr_labels[0], color="#86EFAC", edgecolor="#166534", linewidth=0.4)
    ax.barh(y, [role_map[r].p2 for r in roles], h, label=hr_labels[1], color="#15803D")
    ax.barh(y + h, [role_map[r].p3 for r in roles], h, label=hr_labels[2], color="#14532D")
    for idx, r in enumerate(roles):
        v3 = role_map[r].p3
        ax.text(v3 + 150, idx + h, f"${v3:,}", va="center", fontsize=8, fontweight="bold", color="#14532D")
    ax.set_yticks(y)
    ax.set_yticklabels(roles, fontsize=8.4, fontweight="bold")
    ax.invert_yaxis()
    ax.set_xlim(0, 8800)
    ax.xaxis.set_major_formatter(mtick.FuncFormatter(lambda v, _: f"${int(v / 1000)}k" if v >= 1000 else "$0"))
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.set_xlabel("Monthly Fully-Loaded Cost (USD)", fontsize=9, fontweight="bold")
    ax.set_title("Role Cost Progression by Phase", fontsize=10.5, fontweight="bold", pad=8)
    ax.legend(loc="lower right", frameon=True, facecolor="#F8FAF9", edgecolor="#E2E8F0", fontsize=8)
    fig.tight_layout(pad=0.8)
    p = CHART_DIR / "chart_hr_composition.png"
    fig.savefig(p, dpi=300)
    plt.close(fig)
    paths["hr_comp"] = p

    # 3. Object Storage & Egress Savings (Slide 5)
    fig, ax = plt.subplots(figsize=(6.2, 4.1), dpi=300)
    labels = ["Phase 1\n(0.5 TB egress)", "Phase 2\n(8 TB egress)", "Phase 3\n(35 TB egress)"]
    x = np.arange(3)
    w = 0.34
    r2_b2 = specs["r2_b2"]
    aws_s3 = specs["aws_s3"]
    b1 = ax.bar(x - w / 2, r2_b2, w, label="GPEXTS (Cloudflare R2 + Backblaze B2)", color="#166534")
    b2 = ax.bar(x + w / 2, aws_s3, w, label="Legacy Cloud Object Store ($0.09/GB egress)", color="#94A3B8")
    for rect in b1:
        val = int(rect.get_height())
        ax.text(rect.get_x() + rect.get_width() / 2, val + 65, f"${val:,}", ha="center", fontsize=8.5, fontweight="bold", color="#166534")
    for rect in b2:
        val = int(rect.get_height())
        ax.text(rect.get_x() + rect.get_width() / 2, val + 65, f"${val:,}", ha="center", fontsize=8.5, fontweight="bold", color="#475569")
    ax.annotate(
        f"Saves ${specs['storage_scale_save']:,}/mo\n({specs['storage_scale_pct']}% lower)",
        xy=(2 - w / 2, 660),
        xytext=(1.08, 2150),
        arrowprops=dict(arrowstyle="->", color="#166534", lw=1.2),
        fontsize=8.5,
        fontweight="bold",
        color="#166534",
        bbox=dict(boxstyle="round,pad=0.3", fc="#DCFCE7", ec="#166534", lw=0.8),
    )
    ax.set_xticks(x)
    ax.set_xticklabels(labels, fontsize=9, fontweight="bold")
    ax.set_ylim(0, 3900)
    ax.yaxis.set_major_formatter(mtick.FuncFormatter(lambda v, _: f"${int(v):,}"))
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.set_ylabel("Monthly Media & Streaming Cost (USD)", fontsize=9, fontweight="bold")
    ax.set_title("Zero-Egress Media Architecture vs. Standard S3", fontsize=10.5, fontweight="bold", pad=8)
    ax.legend(loc="upper left", frameon=True, facecolor="#F8FAF9", edgecolor="#E2E8F0", fontsize=8)
    fig.tight_layout(pad=0.8)
    p = CHART_DIR / "chart_storage_egress_savings.png"
    fig.savefig(p, dpi=300)
    plt.close(fig)
    paths["storage_savings"] = p

    # 4. Production AI Efficiency: OmniRoute vs Unoptimized Single-Provider LLM (Slide 6)
    fig, ax = plt.subplots(figsize=(6.0, 3.85), dpi=300)
    x = np.arange(3)
    w = 0.34
    gpexts_ai = specs["gpexts_ai"]
    naive_ai = specs["naive_ai"]
    b1 = ax.bar(x - w / 2, gpexts_ai, w, label="GPEXTS (OmniRoute + 1h Policy Cache + Local Whisper)", color="#0F766E")
    b2 = ax.bar(x + w / 2, naive_ai, w, label="Unoptimized Single-Provider API Stack", color="#CBD5E1", edgecolor="#64748B", linewidth=0.7)
    for rect in b1:
        val = int(rect.get_height())
        ax.text(rect.get_x() + rect.get_width() / 2, val + 240, f"${val:,}", ha="center", fontsize=8.5, fontweight="bold", color="#0F766E")
    for rect in b2:
        val = int(rect.get_height())
        ax.text(rect.get_x() + rect.get_width() / 2, val + 240, f"${val:,}", ha="center", fontsize=8.5, fontweight="bold", color="#475569")
    ax.set_xticks(x)
    ax.set_xticklabels([
        f"Phase 1\n({PHASES[0]['queries_mo']})",
        f"Phase 2\n({PHASES[1]['queries_mo']})",
        f"Phase 3\n({PHASES[2]['queries_mo']})",
    ], fontsize=9, fontweight="bold")
    ax.set_ylim(0, 15800)
    ax.yaxis.set_major_formatter(mtick.FuncFormatter(lambda v, _: f"${int(v / 1000)}k" if v >= 1000 else "$0"))
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.set_ylabel("Monthly Production AI Cost (USD)", fontsize=9, fontweight="bold")
    ax.set_title(f"Production AI Cost Avoidance ({specs['ai_savings_range_lbl']} Savings)", fontsize=10.5, fontweight="bold", pad=8)
    ax.legend(loc="upper left", frameon=True, facecolor="#F8FAF9", edgecolor="#E2E8F0", fontsize=7.5)
    fig.tight_layout(pad=0.8)
    p = CHART_DIR / "chart_ai_cost_efficiency.png"
    fig.savefig(p, dpi=300)
    plt.close(fig)
    paths["ai_efficiency"] = p

    # 5. Trained Custom AI & Calibration Budget (Slide 7)
    fig, ax = plt.subplots(figsize=(5.8, 4.15), dpi=300)
    x = np.arange(3)
    w = 0.44
    gpu_train = np.array(specs["gpu_train"], dtype=float)
    labeling = np.array(specs["labeling"], dtype=float)
    ax.bar(x, gpu_train, w, label="Custom CV & Whisper LoRA GPU Training", color="#0F766E")
    ax.bar(x, labeling, w, bottom=gpu_train, label="Pathologist Labeling & Dialect Eval Sets", color="#5EEAD4", edgecolor="#0F766E", linewidth=0.5)
    for i in range(3):
        tot = int(gpu_train[i] + labeling[i])
        ax.text(i, tot + 80, f"${tot:,}/mo", ha="center", va="bottom", fontsize=9.5, fontweight="bold", color=HEX_INK)
        ax.text(i, gpu_train[i] / 2, f"${int(gpu_train[i]):,}", ha="center", va="center", fontsize=8.5, fontweight="bold", color="#FFFFFF")
        ax.text(i, gpu_train[i] + labeling[i] / 2, f"${int(labeling[i]):,}", ha="center", va="center", fontsize=8.5, fontweight="bold", color="#0F1E17")
    ax.set_xticks(x)
    ax.set_xticklabels(["Phase 1\n(Baseline)", "Phase 2\n(Monthly Retrain)", "Phase 3\n(8+ Crops Active)"], fontsize=9, fontweight="bold")
    ax.set_ylim(0, 3550)
    ax.yaxis.set_major_formatter(mtick.FuncFormatter(lambda v, _: f"${int(v):,}"))
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.set_ylabel("Monthly Custom AI R&D Spend (USD)", fontsize=9, fontweight="bold")
    ax.set_title("Custom Model Training & Calibration Allocation", fontsize=10.5, fontweight="bold", pad=8)
    ax.legend(loc="upper left", frameon=True, facecolor="#F8FAF9", edgecolor="#E2E8F0", fontsize=8)
    fig.tight_layout(pad=0.8)
    p = CHART_DIR / "chart_custom_ai_split.png"
    fig.savefig(p, dpi=300)
    plt.close(fig)
    paths["custom_ai"] = p

    # 6. Unit Economics & Break-Even Trajectory (Slide 10)
    fig, ax = plt.subplots(figsize=(6.5, 4.35), dpi=300)
    farmers_k = specs["farmers_k"]
    opex_curve = specs["opex_curve"]
    cogs_curve = specs["cogs_curve"]
    rev_conserv = specs["rev_conserv"]
    rev_target = specs["rev_target"]
    be_x_200 = specs["be_x_200"]
    be_x_150 = specs["be_x_150"]
    be_y_k = specs["be_y_k"]
    arrow_x, arrow_y = specs["be_arrow_xy"]

    ax.plot(farmers_k, rev_target / 1000, color="#166534", linewidth=2.4, label="Illustrative Revenue ($2.00/farmer/mo blend)")
    ax.plot(farmers_k, rev_conserv / 1000, color="#10B981", linewidth=2.0, linestyle="--", label="Conservative Revenue ($1.50/farmer/mo blend)")
    ax.plot(farmers_k, opex_curve / 1000, color="#0F1E17", linewidth=2.4, label=f"Total Monthly Operating Cost (${totals[0] / 1000:.1f}k-${totals[2] / 1000:.0f}k)")
    ax.plot(farmers_k, cogs_curve / 1000, color="#B45309", linewidth=1.8, linestyle="-.", label=f"Direct Delivery COGS (${cogs[0] / 1000:.1f}k-${cogs[2] / 1000:.1f}k)")

    ax.axvspan(be_x_200, be_x_150, color="#DCFCE7", alpha=0.85)
    ax.scatter([be_x_200, be_x_150], [be_y_k, be_y_k], color="#166534", zorder=5, s=28)
    ax.annotate(
        f"Break-even zone\n({be_x_200:.1f}k-{be_x_150:.1f}k farmers\nat ${int(be_y_k)}k Phase 2 OpEx)",
        xy=(arrow_x, arrow_y),
        xytext=(31.0, 92.0),
        arrowprops=dict(arrowstyle="->", color="#166534", lw=1.3),
        ha="left",
        fontsize=8.3,
        fontweight="bold",
        color="#166534",
        bbox=dict(boxstyle="round,pad=0.32", fc="#DCFCE7", ec="#166534", lw=0.8),
    )
    ax.set_xlim(3, 120)
    ax.set_ylim(0, 250)
    ax.xaxis.set_major_formatter(mtick.FuncFormatter(lambda v, _: f"{int(v)}k"))
    ax.yaxis.set_major_formatter(mtick.FuncFormatter(lambda v, _: f"${int(v)}k"))
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.set_xlabel("Active Enrolled Farmers (Co-op Sponsored)", fontsize=9, fontweight="bold")
    ax.set_ylabel("Monthly USD ($ Thousands)", fontsize=9, fontweight="bold")
    ax.set_title("Operating Leverage & Illustrative Break-Even Curve", fontsize=10.5, fontweight="bold", pad=8)
    ax.legend(loc="upper left", frameon=True, facecolor="#F8FAF9", edgecolor="#E2E8F0", fontsize=7.8)
    fig.tight_layout(pad=0.8)
    p = CHART_DIR / "chart_unit_economics_breakeven.png"
    fig.savefig(p, dpi=300)
    plt.close(fig)
    paths["breakeven"] = p

    # 7. 12-Month Capital Deployment Ramp (Slide 11)
    fig, ax = plt.subplots(figsize=(6.4, 4.2), dpi=300)
    months = [m[0] for m in TWELVE_MONTH_RAMP]
    burns = [m[1] for m in TWELVE_MONTH_RAMP]
    stages = [m[2] for m in TWELVE_MONTH_RAMP]
    stage_colors: Dict[str, str] = specs["ramp_stage_colors"]
    bar_colors = [stage_colors[s] for s in stages]
    x = np.arange(len(months))
    bars = ax.bar(x, burns, width=0.62, color=bar_colors, edgecolor="#0F1E17", linewidth=0.4)
    for idx, b in enumerate(bars):
        if idx in (0, 4, 10):
            val = burns[idx]
            ax.text(b.get_x() + b.get_width() / 2, val + 1200, f"${val / 1000:.1f}k", ha="center", va="bottom", fontsize=8.2, fontweight="bold", color=HEX_INK)
        elif idx == 11:
            val = burns[idx]
            # Place inside top of M12 bar so label stays completely clear of the $50k ceiling line
            ax.text(b.get_x() + b.get_width() / 2, val - 1500, f"${val / 1000:.1f}k", ha="center", va="top", rotation=90, fontsize=8.0, fontweight="bold", color="#FFFFFF")

    ax.axhline(50000, color="#991B1B", linestyle=":", linewidth=1.4)
    ax.set_xticks(x)
    ax.set_xticklabels(months, fontsize=8.5, fontweight="bold")
    ax.set_ylim(*specs["ramp_ylim"])
    ax.yaxis.set_major_formatter(mtick.FuncFormatter(lambda v, _: f"${int(v / 1000)}k"))
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.set_ylabel("Monthly Gross Cash Burn (USD)", fontsize=9, fontweight="bold")
    ax.set_title(f"Year-1 Monthly Spend Ramp (${year1_burn:,} Total Gross Burn)", fontsize=10.5, fontweight="bold", pad=8)

    legend_handles = [
        Patch(facecolor=stage_colors[stage_key], edgecolor="#0F1E17", label=label)
        for stage_key, label in specs["ramp_legend_specs"]
    ]
    legend_handles.append(Line2D([0], [0], color="#991B1B", linestyle=":", linewidth=1.4, label="$50k Monthly Ceiling"))
    ax.legend(handles=legend_handles, loc="upper left", ncol=2, frameon=True, facecolor="#F8FAF9", edgecolor="#E2E8F0", fontsize=7.2)
    fig.tight_layout(pad=0.8)
    p = CHART_DIR / "chart_12mo_runway.png"
    fig.savefig(p, dpi=300)
    plt.close(fig)
    paths["runway"] = p

    return paths


# ---------------------------------------------------------------------------
# PPTX Helper Primitives (Strict 4pt Grid, Quiet Chrome, Zero Overlap)
# ---------------------------------------------------------------------------

def _strip_shadow(shp):
    shp.shadow.inherit = False
    sp_pr = shp._element.spPr
    for child in list(sp_pr):
        if child.tag.endswith("effectLst"):
            sp_pr.remove(child)
    sp_pr.append(parse_xml('<a:effectLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"/>'))
    for child in list(shp._element):
        if child.tag.endswith("style"):
            for sub in list(child):
                if sub.tag.endswith("effectRef"):
                    sub.set("idx", "0")


def set_slide_bg(slide, prs, hex_color: str):
    bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, prs.slide_width, prs.slide_height)
    bg.fill.solid()
    bg.fill.fore_color.rgb = rgb(hex_color)
    bg.line.fill.background()
    _strip_shadow(bg)
    return bg


def add_rect(slide, x, y, w, h, fill_hex: str, border_hex: str | None = None, border_pt: float = 0.75, rounded: bool = False):
    shape_type = MSO_SHAPE.ROUNDED_RECTANGLE if rounded else MSO_SHAPE.RECTANGLE
    shp = slide.shapes.add_shape(shape_type, Inches(x), Inches(y), Inches(w), Inches(h))
    if rounded:
        shp.adjustments[0] = 0.04
    shp.fill.solid()
    shp.fill.fore_color.rgb = rgb(fill_hex)
    if border_hex:
        shp.line.color.rgb = rgb(border_hex)
        shp.line.width = Pt(border_pt)
    else:
        shp.line.fill.background()
    _strip_shadow(shp)
    return shp


def add_textbox(slide, x, y, w, h, text: str, font_size: float = 10.5, bold: bool = False,
                color_hex: str = HEX_INK, align=PP_ALIGN.LEFT, font_name: str = FONT_FAMILY,
                line_spacing: float = 1.15):
    tb = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    _strip_shadow(tb)
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = Inches(0.02)
    tf.margin_right = Inches(0.02)
    tf.margin_top = Inches(0.02)
    tf.margin_bottom = Inches(0.02)
    p = tf.paragraphs[0]
    p.text = text
    p.alignment = align
    p.line_spacing = line_spacing
    p.font.name = font_name
    p.font.size = Pt(font_size)
    p.font.bold = bold
    p.font.color.rgb = rgb(color_hex)
    return tb


def add_picture_clean(slide, path: Path, x: float, y: float, w: float, h: float | None = None):
    pic = slide.shapes.add_picture(str(path), Inches(x), Inches(y), Inches(w)) if h is None else slide.shapes.add_picture(str(path), Inches(x), Inches(y), Inches(w), Inches(h))
    _strip_shadow(pic)
    return pic


def add_header_and_footer(slide, prs, slide_num: int, total_slides: int, kicker: str, title: str, subtitle: str):
    set_slide_bg(slide, prs, HEX_LIGHT_BG)
    add_rect(slide, 0, 0, 13.333, 0.05, HEX_FOREST)

    add_textbox(slide, 0.55, 0.22, 9.0, 0.24, kicker, font_size=9.5, bold=True, color_hex=HEX_FOREST)
    add_textbox(slide, 0.55, 0.45, 11.4, 0.44, title, font_size=20.5, bold=True, color_hex=HEX_INK)
    add_textbox(slide, 0.55, 0.90, 12.2, 0.34, subtitle, font_size=10.5, bold=False, color_hex=HEX_INK_SEC)

    if LOGO_PATH.is_file():
        add_picture_clean(slide, LOGO_PATH, 12.38, 0.26, 0.40, 0.40)

    add_rect(slide, 0.55, 1.30, 12.23, 0.012, HEX_BORDER)

    add_rect(slide, 0.55, 7.05, 12.23, 0.010, HEX_BORDER)
    add_textbox(slide, 0.55, 7.11, 9.2, 0.25,
                "GPEXTS  |  Ag-Extension Decision Support  |  Monthly Operating Cost & Unit Economics Model",
                font_size=8.5, color_hex=HEX_MUTED)
    add_textbox(slide, 11.20, 7.11, 1.58, 0.25,
                f"{slide_num:02d} / {total_slides:02d}",
                font_size=8.5, bold=True, color_hex=HEX_INK_SEC, align=PP_ALIGN.RIGHT, font_name=FONT_MONO)


def style_table(table, col_widths: List[float], headers: List[str], rows: List[List[str]],
                alignments: List[PP_ALIGN], font_size: float = 9.0, header_bg: str = HEX_FOREST,
                bold_last_row: bool = False, subtotal_rows: set[int] | None = None,
                pad_v: float = 0.035):
    subtotal_rows = subtotal_rows or set()
    for idx, w in enumerate(col_widths):
        table.columns[idx].width = Inches(w)

    for c_idx, h_text in enumerate(headers):
        cell = table.cell(0, c_idx)
        cell.fill.solid()
        cell.fill.fore_color.rgb = rgb(header_bg)
        cell.vertical_anchor = MSO_ANCHOR.MIDDLE
        cell.margin_left = Inches(0.08)
        cell.margin_right = Inches(0.08)
        cell.margin_top = Inches(pad_v)
        cell.margin_bottom = Inches(pad_v)
        p = cell.text_frame.paragraphs[0]
        p.text = h_text
        p.alignment = alignments[c_idx]
        p.font.name = FONT_FAMILY
        p.font.size = Pt(font_size)
        p.font.bold = True
        p.font.color.rgb = rgb("#FFFFFF")

    total_rows = len(rows)
    for r_idx, row_vals in enumerate(rows):
        is_sub = r_idx in subtotal_rows
        is_last = bold_last_row and (r_idx == total_rows - 1)
        bg = "#DCECE2" if is_last else ("#EAF2ED" if is_sub else ("#FFFFFF" if r_idx % 2 == 0 else "#F7FAF8"))
        for c_idx, val in enumerate(row_vals):
            cell = table.cell(r_idx + 1, c_idx)
            cell.fill.solid()
            cell.fill.fore_color.rgb = rgb(bg)
            cell.vertical_anchor = MSO_ANCHOR.MIDDLE
            cell.margin_left = Inches(0.08)
            cell.margin_right = Inches(0.08)
            cell.margin_top = Inches(pad_v)
            cell.margin_bottom = Inches(pad_v)
            p = cell.text_frame.paragraphs[0]
            p.text = val
            p.alignment = alignments[c_idx]
            p.font.name = FONT_FAMILY
            p.font.size = Pt(font_size)
            p.font.bold = is_sub or is_last or (c_idx == 0 and is_sub)
            p.font.color.rgb = rgb(HEX_FOREST if is_last else HEX_INK)


def add_bullet_card(slide, x, y, w, h, title: str, items: List[Tuple[str, str]], accent_hex: str = HEX_FOREST):
    add_rect(slide, x, y, w, h, HEX_CARD_BG, HEX_BORDER, 0.75, rounded=True)
    add_rect(slide, x, y, 0.06, h, accent_hex)
    add_textbox(slide, x + 0.18, y + 0.12, w - 0.30, 0.30, title, font_size=12, bold=True, color_hex=accent_hex)

    tb = slide.shapes.add_textbox(Inches(x + 0.18), Inches(y + 0.44), Inches(w - 0.30), Inches(h - 0.54))
    _strip_shadow(tb)
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = Inches(0.02)
    tf.margin_right = Inches(0.02)
    tf.margin_top = Inches(0.02)
    for idx, (lead, body) in enumerate(items):
        p = tf.paragraphs[0] if idx == 0 else tf.add_paragraph()
        p.space_after = Pt(5)
        p.line_spacing = 1.15
        r1 = p.add_run()
        r1.text = f"{lead}: " if lead else ""
        r1.font.name = FONT_FAMILY
        r1.font.size = Pt(9.5)
        r1.font.bold = True
        r1.font.color.rgb = rgb(HEX_INK)

        r2 = p.add_run()
        r2.text = body
        r2.font.name = FONT_FAMILY
        r2.font.size = Pt(9.5)
        r2.font.bold = False
        r2.font.color.rgb = rgb(HEX_INK_SEC)


# ---------------------------------------------------------------------------
# Slide Builders (12 Slides)
# ---------------------------------------------------------------------------

def build_presentation(summary: Dict[str, Any], charts: Dict[str, Path], specs: Dict[str, Any] | None = None) -> Path:
    if specs is None:
        specs = build_chart_specs(summary)
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.500)
    blank = prs.slide_layouts[6]
    total_slides = 12

    cat_totals: Dict[str, Tuple[int, int, int]] = summary["cat_totals"]
    totals: Tuple[int, int, int] = summary["totals"]
    cogs: Tuple[int, int, int] = summary["cogs"]
    fixed: Tuple[int, int, int] = summary["fixed"]
    hr_ftes: Tuple[Decimal, Decimal, Decimal] = summary["hr_ftes"]
    contingency_pcts: Tuple[Decimal, Decimal, Decimal] = summary["contingency_pcts"]
    breakeven: Dict[str, Decimal] = summary["breakeven"]
    margins_150: Tuple[Decimal, Decimal, Decimal] = summary["margins_150"]
    margins_200: Tuple[Decimal, Decimal, Decimal] = summary["margins_200"]
    year1_burn: int = summary["year1_burn"]

    fully_loaded_cpf = [
        round_half_up(Decimal(totals[idx]) / Decimal(PHASES[idx]["farmers"]), 2)
        for idx in range(3)
    ]
    cogs_cpf = [
        round_half_up(Decimal(cogs[idx]) / Decimal(PHASES[idx]["farmers"]), 2)
        for idx in range(3)
    ]
    unit_drop_pct = int(pct_value(fully_loaded_cpf[0] - fully_loaded_cpf[2], fully_loaded_cpf[0], 0))
    annualized = [t * 12 for t in totals]

    # =========================================================================
    # SLIDE 1: Cover
    # =========================================================================
    s1 = prs.slides.add_slide(blank)
    set_slide_bg(s1, prs, HEX_DARK_BG)
    add_rect(s1, 0, 0, 0.12, 7.5, HEX_EMERALD)

    if LOGO_PATH.is_file():
        add_picture_clean(s1, LOGO_PATH, 0.75, 0.68, 0.56, 0.56)
    add_textbox(s1, 1.45, 0.78, 8.5, 0.36, "GPEXTS  |  Ag-Extension Decision Support Platform",
                font_size=12.5, bold=True, color_hex=HEX_EMERALD)

    add_textbox(s1, 0.75, 1.75, 11.4, 1.25,
                "Platform Operating Cost &\nScaling Economics",
                font_size=38, bold=True, color_hex="#F8FAF9", line_spacing=1.08)

    add_textbox(s1, 0.75, 3.25, 10.6, 0.85,
                f"Investor briefing covering full monthly operating burn (${totals[0]:,} to ${totals[2]:,}/month) across Human Resources, Cloud Infrastructure, Production AI, Custom ML Training, Telecom, Satellite Feeds, and Regulatory Compliance.",
                font_size=14, color_hex="#B6D6C5", line_spacing=1.30)

    kpis_s1 = [
        (f"${totals[0]:,} – ${totals[2]:,}", "Monthly Operating Range", "Three-stage budget strictly within $10k-$50k/mo envelope"),
        (f"${totals[1]:,} / mo", "Commercial Base Case (Phase 2)", f"Supports {PHASES[1]['coops']}, {PHASES[1]['officers_val']} officers & {PHASES[1]['farmers']:,} active farmers"),
        (f"${fully_loaded_cpf[0]:.2f} → ${fully_loaded_cpf[2]:.2f}", "Fully-Loaded Cost / Farmer / Mo", f"{unit_drop_pct}% unit-cost compression from Pilot (3k) to Scale (120k)"),
    ]
    for idx, (val, lbl, desc) in enumerate(kpis_s1):
        cx = 0.75 + idx * 4.02
        add_rect(s1, cx, 4.70, 3.78, 1.75, HEX_DARK_CARD, HEX_DARK_LINE, 1.0, rounded=True)
        add_rect(s1, cx, 4.70, 3.78, 0.05, HEX_EMERALD if idx == 1 else "#2E6F50")
        add_textbox(s1, cx + 0.22, 4.88, 3.34, 0.45, val, font_size=22, bold=True, color_hex="#FFFFFF")
        add_textbox(s1, cx + 0.22, 5.36, 3.34, 0.28, lbl, font_size=10.5, bold=True, color_hex=HEX_EMERALD)
        add_textbox(s1, cx + 0.22, 5.68, 3.34, 0.65, desc, font_size=9.5, color_hex="#9CC5B0", line_spacing=1.2)

    add_textbox(s1, 0.75, 6.92, 11.8, 0.30,
                "Investor Data Room Briefing  |  Grounded in GPEXTS Production Architecture (Node/TS, Postgres 15+pgvector, OmniRoute, Edge Vision)  |  2026",
                font_size=9, color_hex="#739A86")

    # =========================================================================
    # SLIDE 2: Executive Summary
    # =========================================================================
    s2 = prs.slides.add_slide(blank)
    add_header_and_footer(
        s2, prs, 2, total_slides,
        "Executive summary",
        f"Three-Stage Operating Envelope (${totals[0] / 1000:.1f}k to ${totals[2] / 1000:.1f}k / Month)",
        f"OpEx scales {round_half_up(Decimal(totals[2]) / Decimal(totals[0]), 1)}x from pilot to multi-country scale while active farmer capacity expands {PHASES[2]['farmers'] // PHASES[0]['farmers']}x ({PHASES[0]['farmers']:,} to {PHASES[2]['farmers']:,} farmers)."
    )

    add_rect(s2, 0.55, 1.46, 6.85, 5.42, HEX_CARD_BG, HEX_BORDER, 0.75, rounded=True)
    add_picture_clean(s2, charts["burn_scaling"], 0.68, 1.56, 6.60)
    add_textbox(s2, 0.75, 6.08, 6.45, 0.68,
                "Key takeaway: OmniRoute free-first LLM routing and on-device edge triage (with ONNX crop weights trained & calibrated by this R&D budget) keep variable tech burn low even at 120,000 farmers, concentrating spend in human agronomy & co-op onboarding.",
                font_size=8.8, color_hex=HEX_INK_SEC, line_spacing=1.2)

    t2_shape = s2.shapes.add_table(8, 4, Inches(7.58), Inches(1.46), Inches(5.20), Inches(3.25))
    style_table(
        t2_shape.table,
        col_widths=[1.96, 1.04, 1.10, 1.10],
        headers=["Operating Metric", "Phase 1\nPilot", "Phase 2\nGrowth", "Phase 3\nScale"],
        rows=[
            ["Co-op / Enterprise Tenants", PHASES[0]["coops_val"], PHASES[1]["coops_val"], PHASES[2]["coops_val"]],
            ["Field Extension Officers", PHASES[0]["officers_val"], PHASES[1]["officers_val"], PHASES[2]["officers_val"]],
            ["Active Enrolled Farmers", f"{PHASES[0]['farmers']:,}", f"{PHASES[1]['farmers']:,}", f"{PHASES[2]['farmers']:,}"],
            ["Team Headcount (FTE equiv.)", f"{hr_ftes[0]:.2f} FTE", f"{hr_ftes[1]:.2f} FTE", f"{hr_ftes[2]:.2f} FTE"],
            ["Direct Delivery COGS / Mo", f"${cogs[0]:,}", f"${cogs[1]:,}", f"${cogs[2]:,}"],
            ["Direct COGS / Farmer / Mo", f"${cogs_cpf[0]:.2f}", f"${cogs_cpf[1]:.2f}", f"${cogs_cpf[2]:.2f}"],
            ["Total Monthly Burn", f"${totals[0]:,}", f"${totals[1]:,}", f"${totals[2]:,}"],
        ],
        alignments=[PP_ALIGN.LEFT, PP_ALIGN.RIGHT, PP_ALIGN.RIGHT, PP_ALIGN.RIGHT],
        font_size=9.0,
        bold_last_row=True,
        pad_v=0.04,
    )

    add_bullet_card(
        s2, 7.58, 4.86, 5.20, 2.02,
        "Why this cost structure wins",
        [
            ("Zero-surprise budget", f"Includes SMS/WhatsApp, Sentinel-2 satellites, EUDR/OCAP rollout, custom CV GPU training, and a {min(contingency_pcts):.1f}–{max(contingency_pcts):.1f}% contingency reserve."),
            (f"{unit_drop_pct}% unit-cost drop", f"Fully-loaded cost falls from ${fully_loaded_cpf[0]:.2f} to ${fully_loaded_cpf[1]:.2f} in Phase 2 and ${fully_loaded_cpf[2]:.2f}/farmer/mo at Phase 3 scale."),
            ("Annualized run-rate", f"${annualized[0] // 1000}k (Pilot) → ${annualized[1] // 1000}k (Growth Base Case) → ${annualized[2] // 1000}k (Scale)."),
        ],
        accent_hex=HEX_FOREST,
    )

    # =========================================================================
    # SLIDE 3: Master Monthly Cost Matrix (2-Column Full Ledger)
    # =========================================================================
    s3 = prs.slides.add_slide(blank)
    add_header_and_footer(
        s3, prs, 3, total_slides,
        "Master operating ledger",
        f"Complete Line-by-Line Monthly Cost Breakdown (All {len(COST_ITEMS)} Cost Centers)",
        "Every dollar reconciled across Human Resources, Infrastructure, AI & Custom ML, Field Delivery, and Risk/Compliance."
    )

    left_cats = [CATEGORY_ORDER[0], CATEGORY_ORDER[1]]
    right_cats = [CATEGORY_ORDER[2], CATEGORY_ORDER[3], CATEGORY_ORDER[4]]

    def build_ledger_rows(cats: List[str], include_grand_total: bool = False):
        rows_out: List[List[str]] = []
        sub_idxs: set[int] = set()
        for c in cats:
            sub_idxs.add(len(rows_out))
            ct = cat_totals[c]
            rows_out.append([c, f"${ct[0]:,}", f"${ct[1]:,}", f"${ct[2]:,}"])
            for it in COST_ITEMS:
                if it.category == c:
                    rows_out.append([f"  {it.name}", f"${it.p1:,}", f"${it.p2:,}", f"${it.p3:,}"])
        if include_grand_total:
            rows_out.append(["TOTAL MONTHLY OPEX", f"${totals[0]:,}", f"${totals[1]:,}", f"${totals[2]:,}"])
        return rows_out, sub_idxs

    l_rows, l_subs = build_ledger_rows(left_cats, include_grand_total=False)
    r_rows, r_subs = build_ledger_rows(right_cats, include_grand_total=True)

    tl_shape = s3.shapes.add_table(len(l_rows) + 1, 4, Inches(0.55), Inches(1.45), Inches(5.95), Inches(4.15))
    style_table(
        tl_shape.table,
        col_widths=[3.28, 0.88, 0.89, 0.90],
        headers=["Cost Center (Part A)", "Pilot", "Growth", "Scale"],
        rows=l_rows,
        alignments=[PP_ALIGN.LEFT, PP_ALIGN.RIGHT, PP_ALIGN.RIGHT, PP_ALIGN.RIGHT],
        font_size=8.6,
        subtotal_rows=l_subs,
        pad_v=0.032,
    )

    p2_shares = [pct_value(cat_totals[c][1], totals[1], 1) for c in CATEGORY_ORDER]
    add_bullet_card(
        s3, 0.55, 5.74, 5.95, 1.14,
        "Envelope & Annualized Reconciliation",
        [
            ("Annualized OpEx", f"${annualized[0]:,} (Pilot)  |  ${annualized[1]:,} (Growth)  |  ${annualized[2]:,} (Scale)"),
            ("Share Mix (Phase 2)", f"HR {p2_shares[0]}%  |  AI & ML {p2_shares[2]}%  |  Telecom/Sat {p2_shares[3]}%  |  Infra {p2_shares[1]}%  |  Comp/G&A {p2_shares[4]}%"),
        ],
        accent_hex=HEX_TEAL,
    )

    tr_shape = s3.shapes.add_table(len(r_rows) + 1, 4, Inches(6.78), Inches(1.45), Inches(6.00), Inches(5.43))
    style_table(
        tr_shape.table,
        col_widths=[3.33, 0.88, 0.89, 0.90],
        headers=["Cost Center (Part B)", "Pilot", "Growth", "Scale"],
        rows=r_rows,
        alignments=[PP_ALIGN.LEFT, PP_ALIGN.RIGHT, PP_ALIGN.RIGHT, PP_ALIGN.RIGHT],
        font_size=8.5,
        subtotal_rows=r_subs,
        bold_last_row=True,
        pad_v=0.028,
    )

    # =========================================================================
    # SLIDE 4: Human Resources
    # =========================================================================
    s4 = prs.slides.add_slide(blank)
    hr_cat = cat_totals["1. Human Resources"]
    hr_shares = [pct_value(hr_cat[idx], totals[idx], 1) for idx in range(3)]
    add_header_and_footer(
        s4, prs, 4, total_slides,
        "Pillar 1  |  Human resources",
        f"Blended Engineering, AI, Product & GTM Team (${hr_cat[0] / 1000:.1f}k to ${hr_cat[2] / 1000:.1f}k / Mo)",
        "Lean core team pairing blended global/regional EOR & contractor engineering rates with in-country agronomists and co-op GTM leads."
    )

    hr_rows = []
    for it in COST_ITEMS:
        if it.category == "1. Human Resources" and it.fte is not None:
            fte_str = f"{it.fte[0]:.2f} / {it.fte[1]:.2f} / {it.fte[2]:.2f} FTE"
            hr_rows.append([it.name, fte_str, f"${it.p1:,}", f"${it.p2:,}", f"${it.p3:,}"])
    hr_rows.append([
        "Total Human Resources",
        f"{hr_ftes[0]:.2f} / {hr_ftes[1]:.2f} / {hr_ftes[2]:.2f} FTE",
        f"${hr_cat[0]:,}",
        f"${hr_cat[1]:,}",
        f"${hr_cat[2]:,}",
    ])

    t4_shape = s4.shapes.add_table(len(hr_rows) + 1, 5, Inches(0.55), Inches(1.48), Inches(6.80), Inches(3.25))
    style_table(
        t4_shape.table,
        col_widths=[2.34, 1.76, 0.88, 0.91, 0.91],
        headers=["Role / Function", "FTE (P1 / P2 / P3)", "Pilot", "Growth", "Scale"],
        rows=hr_rows,
        alignments=[PP_ALIGN.LEFT, PP_ALIGN.LEFT, PP_ALIGN.RIGHT, PP_ALIGN.RIGHT, PP_ALIGN.RIGHT],
        font_size=8.6,
        bold_last_row=True,
        pad_v=0.04,
    )

    add_bullet_card(
        s4, 0.55, 4.88, 6.80, 2.00,
        "Compensation Model, GTM Coverage & Non-Dilutive Upside",
        [
            ("Blended EOR & Contractors", "Uses global/regional EOR & fractional specialist rates ($3.8k–$4.8k/FTE blended) rather than full-market North American payroll."),
            ("Product, Ops & Co-op GTM", "Product spec, SRE/ops, and B2B co-op partnerships/sales sit inside the core team while partner co-ops employ field officers directly."),
            ("Grant Upside (Entity-Gated)", "Canadian NRC-IRAP / SR&ED co-funding (up to 50–70% of eligible R&D payroll) is excluded from baseline burn and requires incorporating a Canadian-controlled SME."),
        ],
        accent_hex=HEX_FOREST,
    )

    add_rect(s4, 7.55, 1.48, 5.23, 5.40, HEX_CARD_BG, HEX_BORDER, 0.75, rounded=True)
    add_picture_clean(s4, charts["hr_comp"], 7.65, 1.58, 5.03)
    add_textbox(s4, 7.75, 5.86, 4.85, 0.85,
                f"HR share stays disciplined at {min(hr_shares):.1f}%–{max(hr_shares):.1f}% of total OpEx across all phases, preserving engineering and co-op GTM velocity without outgrowing pilot revenue.",
                font_size=9.2, color_hex=HEX_INK_SEC, line_spacing=1.2)

    # =========================================================================
    # SLIDE 5: Core Infrastructure & DevSecOps
    # =========================================================================
    s5 = prs.slides.add_slide(blank)
    infra_cat = cat_totals["2. Core Infrastructure & DevSecOps"]
    infra_shares = [pct_value(infra_cat[idx], totals[idx], 1) for idx in range(3)]
    add_header_and_footer(
        s5, prs, 5, total_slides,
        "Pillar 2  |  Cloud infrastructure",
        f"Docker Compose Stack, Postgres 15, Dual Redis & Zero-Egress Media (${infra_cat[0]:,} to ${infra_cat[2]:,} / Mo)",
        "Grounded directly in GPEXTS Docker Compose topology (docker-compose.yml, Dockerfile.db) and multi-cloud S3 media optimization."
    )

    infra_rows = []
    for it in COST_ITEMS:
        if it.category == "2. Core Infrastructure & DevSecOps":
            infra_rows.append([it.name, it.detail, f"${it.p1:,}", f"${it.p2:,}", f"${it.p3:,}"])
    infra_rows.append([
        "Total Core Infrastructure",
        f"{infra_shares[0]}% / {infra_shares[1]}% / {infra_shares[2]}% of Burn",
        f"${infra_cat[0]:,}",
        f"${infra_cat[1]:,}",
        f"${infra_cat[2]:,}",
    ])

    t5_shape = s5.shapes.add_table(len(infra_rows) + 1, 5, Inches(0.55), Inches(1.48), Inches(6.25), Inches(3.25))
    style_table(
        t5_shape.table,
        col_widths=[1.85, 2.15, 0.72, 0.76, 0.77],
        headers=["Infrastructure Layer", "Actual Platform Component", "Pilot", "Growth", "Scale"],
        rows=infra_rows,
        alignments=[PP_ALIGN.LEFT, PP_ALIGN.LEFT, PP_ALIGN.RIGHT, PP_ALIGN.RIGHT, PP_ALIGN.RIGHT],
        font_size=8.4,
        bold_last_row=True,
        pad_v=0.04,
    )

    add_bullet_card(
        s5, 0.55, 4.88, 6.25, 2.00,
        "Architectural Cost Advantages Already Built",
        [
            ("No-Loss Queue Separation", "Dedicated BullMQ Redis (noeviction + AOF) isolated from LRU cache prevents dropped SMS/alert jobs without enterprise message buses."),
            ("ClamAV + Socket Proxy", "Least-privilege docker-socket-proxy + ClamAV malware scanning + SHA-256 report archival run in lightweight containers alongside Postgres 15."),
            ("Zero-Egress Streaming", "Cloudflare R2 ($0.015/GB, $0 egress) + Backblaze B2 ($0.006/GB) avoid AWS S3 $0.09/GB bandwidth traps on farmer videos & audio."),
        ],
        accent_hex=HEX_SLATE,
    )

    add_rect(s5, 7.00, 1.48, 5.78, 5.40, HEX_CARD_BG, HEX_BORDER, 0.75, rounded=True)
    add_picture_clean(s5, charts["storage_savings"], 7.12, 1.62, 5.54)
    add_textbox(s5, 7.20, 5.82, 5.38, 0.90,
                f"Egress protection impact: Streaming crop videos, field photos, and voice notes over R2+B2 saves ~${specs['storage_scale_save']:,}/month ({specs['storage_scale_pct']}% lower) at 35 TB scale vs. standard S3 pricing.",
                font_size=9.2, color_hex=HEX_INK_SEC, line_spacing=1.2)

    # =========================================================================
    # SLIDE 6: AI Power (Production Inference, RAG & Voice)
    # =========================================================================
    s6 = prs.slides.add_slide(blank)
    ai_prod_items: List[CostItem] = specs["ai_prod_items"]
    gpexts_ai: List[int] = specs["gpexts_ai"]
    add_header_and_footer(
        s6, prs, 6, total_slides,
        "Pillar 3A  |  Production AI power",
        f"OmniRoute Multi-Provider Inference, RAG v2 & Voice AI (${gpexts_ai[0]:,} to ${gpexts_ai[2]:,} / Mo)",
        f"Score-sorted free-first LLM routing, 1-hour policy-scoped answer caching, and local Whisper cut API spend by {specs['ai_savings_range_lbl']}."
    )

    add_rect(s6, 0.55, 1.48, 6.10, 4.05, HEX_CARD_BG, HEX_BORDER, 0.75, rounded=True)
    add_picture_clean(s6, charts["ai_efficiency"], 0.66, 1.56, 5.88)

    t6_shape = s6.shapes.add_table(5, 4, Inches(0.55), Inches(5.62), Inches(6.10), Inches(1.26))
    style_table(
        t6_shape.table,
        col_widths=[3.10, 0.98, 1.00, 1.02],
        headers=["Production AI Runtime Component", "Pilot", "Growth", "Scale"],
        rows=[
            [it.name, f"${it.p1:,}", f"${it.p2:,}", f"${it.p3:,}"]
            for it in ai_prod_items
        ] + [[
            "Subtotal: Production AI Inference",
            f"${gpexts_ai[0]:,}",
            f"${gpexts_ai[1]:,}",
            f"${gpexts_ai[2]:,}",
        ]],
        alignments=[PP_ALIGN.LEFT, PP_ALIGN.RIGHT, PP_ALIGN.RIGHT, PP_ALIGN.RIGHT],
        font_size=8.4,
        header_bg=HEX_TEAL,
        bold_last_row=True,
        pad_v=0.025,
    )

    add_bullet_card(
        s6, 6.85, 1.48, 5.93, 1.70,
        "1. OmniRoute Quota-Aware Cascade & Spend Cap",
        [
            ("7-Provider Router", "Rotates free/fast tiers across AIHubMix, OpenRouter, Groq, NVIDIA NIM, Hugging Face, and local Ollama before hitting paid GPT-4o/Claude."),
            ("Hard Spend Guard", "OMNIROUTE_MAX_PAID_ATTEMPTS caps paid failover per request while 15m/6h blocklists prevent retry storms."),
        ],
        accent_hex=HEX_TEAL,
    )
    add_bullet_card(
        s6, 6.85, 3.32, 5.93, 1.72,
        "2. RAG v2 Hybrid Search & 1h Policy-Scoped Cache",
        [
            ("Quarantined Grounding", "768-dim pgvector + entity co-occurrence graph with hash invalidation; FAOSTAT & unverified scrapes stay quarantined until verified."),
            ("Policy-Scoped Cache", "1-hour user/location/language policy-versioned answer cache (1-min weather/market); no shared semantic answer cache."),
        ],
        accent_hex=HEX_FOREST,
    )
    add_bullet_card(
        s6, 6.85, 5.18, 5.93, 1.70,
        "3. Multilingual Voice Pipeline (@napi-rs/whisper + TTS)",
        [
            ("Local C++ Transcription", "Runs whisper.cpp locally on backend workers for zero per-minute cost on baseline WhatsApp voice notes."),
            ("Cloud Surge + Synthesis", "OpenAI Whisper API fallback for traffic spikes plus EN/SW server audio synthesis (FR planned; browser fallback for other locales)."),
        ],
        accent_hex=HEX_SLATE,
    )

    # =========================================================================
    # SLIDE 7: Trained Custom AI & Edge Vision R&D
    # =========================================================================
    s7 = prs.slides.add_slide(blank)
    custom_totals = [specs["gpu_train"][idx] + specs["labeling"][idx] for idx in range(3)]
    ai_cat = cat_totals["3. AI Power & Trained Custom AI"]
    add_header_and_footer(
        s7, prs, 7, total_slides,
        "Pillar 3B  |  Trained custom AI",
        f"Custom Edge Vision, Vernacular ASR & Calibration (${custom_totals[0]:,} to ${custom_totals[2]:,} / Mo)",
        "Dedicated GPU fine-tuning and agronomist calibration fund the transition from shipped ONNX scaffolds to production crop weights."
    )

    add_bullet_card(
        s7, 0.55, 1.48, 6.05, 1.78,
        "On-Device Edge Vision Scaffolds (scripts/ml/)",
        [
            ("Stage 1 — YOLOv8n / v11n", "320x320 ONNX exporter (export_yolo_onnx.py) isolating foliar lesions & pest damage once trained checkpoints are supplied."),
            ("Stage 2 — MobileViT-XXS", "224x224 INT8 ONNX loader via onnxruntime-web WASM; ONNX_MIN_PROBABILITY = 0.55 holds untrained scaffolds on RGB/HSV triage until trained."),
        ],
        accent_hex=HEX_TEAL,
    )
    add_bullet_card(
        s7, 0.55, 3.40, 6.05, 1.78,
        "Custom Fine-Tuning & Vernacular Speech Adaptation",
        [
            ("Regional Crop Models", "Cloud GPU spot runs (L4/A10G/A100) training & quantizing weights for Cocoa Black Pod, Coffee Leaf Rust, Fall Armyworm & Cassava Mosaic."),
            ("Vernacular Whisper LoRA", "Fine-tuning ASR adapters on Chichewa, Kiswahili, Luganda & Twi agricultural acoustics to cut word error rate in rural noise."),
        ],
        accent_hex=HEX_FOREST,
    )
    add_bullet_card(
        s7, 0.55, 5.32, 6.05, 1.56,
        "Agronomic Ground-Truth & Calibration Protocol",
        [
            ("Certified Labeling", "Paid pathologist/officer verification (>=200 verified diagnoses per crop, >=50 recordings per dialect per FIELD_CALIBRATION_PROTOCOL.md)."),
            ("Threshold Backtests", "Monthly precision/recall/F1 sweeps governing the 0.80 edge-confirmation escalation threshold."),
        ],
        accent_hex=HEX_AMBER,
    )

    add_rect(s7, 6.80, 1.48, 5.98, 5.40, HEX_CARD_BG, HEX_BORDER, 0.75, rounded=True)
    add_picture_clean(s7, charts["custom_ai"], 6.92, 1.58, 5.74)
    add_textbox(s7, 7.00, 5.82, 5.58, 0.90,
                f"Combined AI Power + Custom AI budget: ${ai_cat[0]:,}/mo (Pilot) → ${ai_cat[1]:,}/mo (Growth) → ${ai_cat[2]:,}/mo (Scale). Once trained weights pass the 0.55/0.80 gates, edge WASM inference eliminates cloud GPU costs per leaf scan.",
                font_size=9.0, color_hex=HEX_INK_SEC, line_spacing=1.2)

    # =========================================================================
    # SLIDE 8: Other Things Missed — Part A (Telecom, Satellite & Field)
    # =========================================================================
    s8 = prs.slides.add_slide(blank)
    tel_items = [i for i in COST_ITEMS if i.category == "4. Telecom, Satellite & Field Delivery"]
    tel_cat = cat_totals["4. Telecom, Satellite & Field Delivery"]
    msg_item = tel_items[0]
    msg_cpf = [
        round_half_up(Decimal(getattr(msg_item, f"p{idx + 1}")) / Decimal(PHASES[idx]["farmers"]), 3)
        for idx in range(3)
    ]
    tel_cpf = [
        round_half_up(Decimal(tel_cat[idx]) / Decimal(PHASES[idx]["farmers"]), 3)
        for idx in range(3)
    ]
    add_header_and_footer(
        s8, prs, 8, total_slides,
        "Often-missed operating costs  |  Part A",
        f"Last-Mile Telecom, Earth Observation & Field Hardware (${tel_cat[0]:,} to ${tel_cat[2]:,} / Mo)",
        "Standard software budgets omit rural connectivity; GPEXTS funds SMS/WhatsApp, unconfigured satellite APIs, and 501-gated field rails."
    )

    missed_a = [
        ("Telecom & Rural Messaging", f"${tel_items[0].p1:,}  |  ${tel_items[0].p2:,}  |  ${tel_items[0].p3:,} / mo", HEX_AMBER, [
            ("Channels", "Africa's Talking SMS/USSD, Twilio SMS & WhatsApp (WHATSAPP_TEMPLATE_SIDS); IVR routes remain 501-gated until carrier launch."),
            ("Volume", f"{PHASES[0]['msgs_mo']} (Pilot) → {PHASES[1]['msgs_mo']} (Growth) → {PHASES[2]['msgs_mo']} (Scale) outbound hazard & spray alerts."),
            ("Cost Trajectory", f"2G-first concise templates + BullMQ batching compress messaging from ${msg_cpf[0]:.3f} (Pilot) → ${msg_cpf[1]:.3f} (Growth) → ${msg_cpf[2]:.3f}/farmer/mo (Scale)."),
        ]),
        ("Satellite & Live Data Feeds", f"${tel_items[1].p1:,}  |  ${tel_items[1].p2:,}  |  ${tel_items[1].p3:,} / mo", HEX_TEAL, [
            ("Earth Observation", "Provisions Sentinel Hub Process API (10m bands; UNCONFIGURED until SENTINEL_HUB_* keys funded) for 5–10 day NDVI/EVI/NDWI."),
            ("Weather & Market", "WeatherAPI 48h hazard triggers, Tavily search, FX feeds, and FAOSTAT baseline verification."),
            ("Cost Control", "Cloud-cover gating (<40%) & polygon bounding-box batching avoid paying for obscured pixels."),
        ]),
        ("Field Kits & Connectivity", f"${tel_items[2].p1:,}  |  ${tel_items[2].p2:,}  |  ${tel_items[2].p3:,} / mo", HEX_FOREST, [
            ("Hardware Amortization", "Monthly depreciation/replacement reserve for ruggedized Android officer phones & agro-dealer diagnostic kiosks."),
            ("IoT & Offline Sync", "Activates LoRaWAN telemetry routes (currently 501 specification-gated until gateways deploy) + officer cellular data bundles."),
            ("Design Reality", "IndexedDB + localStorage mirrored sync queue means officers operate 100% offline and burst-sync once daily."),
        ]),
    ]
    for idx, (title_c, val_c, acc_c, bullets) in enumerate(missed_a):
        cx = 0.55 + idx * 4.14
        add_rect(s8, cx, 1.48, 3.94, 4.10, HEX_CARD_BG, HEX_BORDER, 0.75, rounded=True)
        add_rect(s8, cx, 1.48, 3.94, 0.06, acc_c)
        add_textbox(s8, cx + 0.18, 1.66, 3.58, 0.30, title_c, font_size=12.5, bold=True, color_hex=HEX_INK)
        add_textbox(s8, cx + 0.18, 1.98, 3.58, 0.30, val_c, font_size=11, bold=True, color_hex=acc_c, font_name=FONT_MONO)
        tb = s8.shapes.add_textbox(Inches(cx + 0.18), Inches(2.38), Inches(3.58), Inches(3.05))
        _strip_shadow(tb)
        tf = tb.text_frame
        tf.word_wrap = True
        for b_i, (bl, bb) in enumerate(bullets):
            p = tf.paragraphs[0] if b_i == 0 else tf.add_paragraph()
            p.space_after = Pt(7)
            p.line_spacing = 1.16
            r1 = p.add_run()
            r1.text = f"{bl}: "
            r1.font.name = FONT_FAMILY
            r1.font.size = Pt(9.2)
            r1.font.bold = True
            r1.font.color.rgb = rgb(HEX_INK)
            r2 = p.add_run()
            r2.text = bb
            r2.font.name = FONT_FAMILY
            r2.font.size = Pt(9.2)
            r2.font.color.rgb = rgb(HEX_INK_SEC)

    t8_shape = s8.shapes.add_table(2, 4, Inches(0.55), Inches(5.76), Inches(12.23), Inches(1.12))
    style_table(
        t8_shape.table,
        col_widths=[4.43, 2.60, 2.60, 2.60],
        headers=[
            "Field Delivery & External Feeds Summary",
            f"Phase 1 ({PHASES[0]['farmers']:,} Farmers)",
            f"Phase 2 ({PHASES[1]['farmers']:,} Farmers)",
            f"Phase 3 ({PHASES[2]['farmers']:,} Farmers)",
        ],
        rows=[[
            "Total Telecom + Satellite + Hardware / Mo (Per-Farmer Cost)",
            f"${tel_cat[0]:,}  (${round_half_up(tel_cpf[0], 2):.2f} / farmer)",
            f"${tel_cat[1]:,}  (${tel_cpf[1]:.3f} / farmer)",
            f"${tel_cat[2]:,}  (${tel_cpf[2]:.3f} / farmer)",
        ]],
        alignments=[PP_ALIGN.LEFT, PP_ALIGN.RIGHT, PP_ALIGN.RIGHT, PP_ALIGN.RIGHT],
        font_size=9.5,
        header_bg=HEX_AMBER,
        bold_last_row=True,
        pad_v=0.05,
    )

    # =========================================================================
    # SLIDE 9: Other Things Missed — Part B (Compliance, Risk, G&A & Buffer)
    # =========================================================================
    s9 = prs.slides.add_slide(blank)
    comp_items = [i for i in COST_ITEMS if i.category == "5. Compliance, Risk, G&A & Contingency"]
    comp_cat = cat_totals["5. Compliance, Risk, G&A & Contingency"]
    add_header_and_footer(
        s9, prs, 9, total_slides,
        "Often-missed operating costs  |  Part B",
        f"Compliance, Sovereignty, Security, G&A & Contingency (${comp_cat[0]:,} to ${comp_cat[2]:,} / Mo)",
        f"Enterprise-grade governance, payment/FX friction, and a {min(contingency_pcts):.1f}%–{max(contingency_pcts):.1f}% contingency buffer ensure zero unexpected cash shocks."
    )

    quad_cards = [
        ("Data Sovereignty & Export Compliance", f"${comp_items[0].p1:,}  |  ${comp_items[0].p2:,}  |  ${comp_items[0].p3:,} / mo", HEX_FOREST, [
            ("OCAP® Governance", "First Nations & community consent reviews, tiered PII isolation, and data-residency auditing."),
            ("EUDR & GS1 Activation", "Funds commercial activation of currently 501 specification-gated EUDR DDS retention & GS1 Digital Link passport signing."),
            ("Regulatory Datasets", "Periodic validation against Fertilizers Act, PCPB/KEPHIS, Kenya ODPC, and Canada PIPEDA."),
        ]),
        ("Security Audits, Insurance & Payment Rails", f"${comp_items[1].p1:,}  |  ${comp_items[1].p2:,}  |  ${comp_items[1].p3:,} / mo", HEX_SLATE, [
            ("External Pentests & SOC", "Amortized annual penetration test, Trivy/Gitleaks remediation, and enterprise security readiness."),
            ("Insurance Coverage", "Cyber liability, Tech E&O (agronomic software safeguard), and corporate D&O coverage."),
            ("Payment & FX Friction", "Stripe (2.9%+$0.30), PayPal cross-border, and M-Pesa Daraja settlement / FX spreads."),
        ]),
        ("Co-op Onboarding Travel, Legal & Tools", f"${comp_items[2].p1:,}  |  ${comp_items[2].p2:,}  |  ${comp_items[2].p3:,} / mo", HEX_TEAL, [
            ("In-Person Launches", "Field onboarding workshops with cocoa/coffee unions, buyer grading sign-offs, and pilot QA travel."),
            ("Legal, Tax & Accounting", "Multi-jurisdiction bookkeeping, annual financial review, EOR payroll admin, and IP filings."),
            ("SaaS & Store Accounts", "GitHub Team/Actions, Apple Developer ($99/yr), Google Play, Chrome Web Store, design/ops tools."),
        ]),
        ("Dedicated Operational Contingency Reserve", f"${comp_items[3].p1:,}  |  ${comp_items[3].p2:,}  |  ${comp_items[3].p3:,} / mo", HEX_AMBER, [
            ("Explicit Variance Buffer", f"Sized at {contingency_pcts[0]:.1f}% (Pilot), {contingency_pcts[1]:.1f}% (Growth), and {contingency_pcts[2]:.1f}% (Scale) of non-contingency operating spend."),
            ("Shock Absorption", "Protects runway against local currency devaluation, peak-season pest SMS bursts, or emergency GPU runs."),
            ("Governance Rule", "Unspent contingency rolls forward quarterly or offsets emergency field calibration needs."),
        ]),
    ]

    coords_q = [(0.55, 1.48), (6.78, 1.48), (0.55, 4.24), (6.78, 4.24)]
    for (qx, qy), (qt, qv, qacc, qbullets) in zip(coords_q, quad_cards):
        add_rect(s9, qx, qy, 6.00, 2.60, HEX_CARD_BG, HEX_BORDER, 0.75, rounded=True)
        add_rect(s9, qx, qy, 0.06, 2.60, qacc)
        add_textbox(s9, qx + 0.18, qy + 0.12, 5.65, 0.28, qt, font_size=12.0, bold=True, color_hex=HEX_INK)
        add_textbox(s9, qx + 0.18, qy + 0.42, 5.65, 0.24, qv, font_size=10.2, bold=True, color_hex=qacc, font_name=FONT_MONO)
        tb = s9.shapes.add_textbox(Inches(qx + 0.18), Inches(qy + 0.74), Inches(5.65), Inches(1.78))
        _strip_shadow(tb)
        tf = tb.text_frame
        tf.word_wrap = True
        for b_i, (bl, bb) in enumerate(qbullets):
            p = tf.paragraphs[0] if b_i == 0 else tf.add_paragraph()
            p.space_after = Pt(5)
            p.line_spacing = 1.15
            r1 = p.add_run()
            r1.text = f"{bl}: "
            r1.font.name = FONT_FAMILY
            r1.font.size = Pt(9.2)
            r1.font.bold = True
            r1.font.color.rgb = rgb(HEX_INK)
            r2 = p.add_run()
            r2.text = bb
            r2.font.name = FONT_FAMILY
            r2.font.size = Pt(9.2)
            r2.font.color.rgb = rgb(HEX_INK_SEC)

    # =========================================================================
    # SLIDE 10: Unit Economics & Break-Even Trajectory
    # =========================================================================
    s10 = prs.slides.add_slide(blank)
    add_header_and_footer(
        s10, prs, 10, total_slides,
        "Unit economics & margin profile",
        f"{margins_150[0]:.0f}–{margins_200[0]:.0f}% Pilot to {margins_200[2]:.1f}% Scale Gross Margin; Break-Even at {breakeven['be_200_k']:.0f}k–{round_half_up(breakeven['be_150_k'], 0):.0f}k",
        "B2B co-op SaaS, per-hectare monitoring, EUDR batch passports, and offtake fees scale over low marginal delivery COGS."
    )

    add_rect(s10, 0.55, 1.48, 6.70, 5.40, HEX_CARD_BG, HEX_BORDER, 0.75, rounded=True)
    add_picture_clean(s10, charts["breakeven"], 0.68, 1.58, 6.44)
    add_textbox(s10, 0.75, 6.02, 6.30, 0.78,
                "Note: Blended ARPU ($1.50–$2.00/farmer/mo paid by co-ops, exporters, and buyers — never out-of-pocket by smallholders) is an illustrative model pending signed pilot price lists.",
                font_size=8.6, color_hex=HEX_MUTED, line_spacing=1.2)

    t10_shape = s10.shapes.add_table(8, 4, Inches(7.45), Inches(1.48), Inches(5.33), Inches(3.22))
    style_table(
        t10_shape.table,
        col_widths=[2.33, 0.98, 1.00, 1.02],
        headers=["Unit Economics Metric", "Pilot\n(3k)", "Growth\n(25k)", "Scale\n(120k)"],
        rows=[
            ["Direct Delivery COGS / Mo", f"${cogs[0]:,}", f"${cogs[1]:,}", f"${cogs[2]:,}"],
            ["Fixed R&D, HR & G&A / Mo", f"${fixed[0]:,}", f"${fixed[1]:,}", f"${fixed[2]:,}"],
            ["Total Monthly OpEx", f"${totals[0]:,}", f"${totals[1]:,}", f"${totals[2]:,}"],
            ["Direct COGS / Farmer / Mo", f"${cogs_cpf[0]:.2f}", f"${cogs_cpf[1]:.2f}", f"${cogs_cpf[2]:.2f}"],
            ["Fully-Loaded / Farmer / Mo", f"${fully_loaded_cpf[0]:.2f}", f"${fully_loaded_cpf[1]:.2f}", f"${fully_loaded_cpf[2]:.2f}"],
            ["Gross Margin @ $1.50 ARPU", f"{margins_150[0]:.1f}%", f"{margins_150[1]:.1f}%", f"{margins_150[2]:.1f}%"],
            ["Gross Margin @ $2.00 ARPU", f"{margins_200[0]:.1f}%", f"{margins_200[1]:.1f}%", f"{margins_200[2]:.1f}%"],
        ],
        alignments=[PP_ALIGN.LEFT, PP_ALIGN.RIGHT, PP_ALIGN.RIGHT, PP_ALIGN.RIGHT],
        font_size=8.8,
        subtotal_rows={2},
        pad_v=0.04,
    )

    add_bullet_card(
        s10, 7.45, 4.86, 5.33, 2.02,
        "Revenue Layers Capturing Value (B2B2C)",
        [
            ("Co-op SaaS (~70–75%)", "Annual workspace license + per-officer seat + enrolled farmer tier."),
            ("EUDR Passports & Offtake", "Per-batch GS1/EUDR certificate (once 501-gated rails activate) + 5–8% export premium facilitation."),
            ("Break-Even Inflection", f"At ~15–20 co-ops ({breakeven['be_200_k']:.1f}k–{breakeven['be_150_k']:.1f}k farmers), recurring revenue covers full Phase 2 burn (${totals[1] // 1000}k/mo)."),
        ],
        accent_hex=HEX_FOREST,
    )

    # =========================================================================
    # SLIDE 11: 12-Month Capital Deployment & Cost Guardrails
    # =========================================================================
    s11 = prs.slides.add_slide(blank)
    pilot_4m = sum(m[1] for m in TWELVE_MONTH_RAMP[:4])
    growth_6m = sum(m[1] for m in TWELVE_MONTH_RAMP[4:10])
    scale_2m = sum(m[1] for m in TWELVE_MONTH_RAMP[10:])
    avg_y1 = int(round_half_up(Decimal(year1_burn) / Decimal(12), 0))
    add_header_and_footer(
        s11, prs, 11, total_slides,
        "Capital deployment & cost governance",
        f"Year-1 Spend Ramp (${year1_burn / 1000:.1f}k Gross) & Engineered Cost Guardrails",
        "Phased milestone gating ties spend expansion to co-op contracts, backed by hard technical caps already enforced in production code."
    )

    add_rect(s11, 0.55, 1.48, 6.58, 5.40, HEX_CARD_BG, HEX_BORDER, 0.75, rounded=True)
    add_picture_clean(s11, charts["runway"], 0.68, 1.58, 6.32)
    add_textbox(s11, 0.75, 5.95, 6.20, 0.85,
                f"Year-1 Trajectory: Months 1–4 run lean at ${totals[0] / 1000:.1f}k/mo (${pilot_4m // 1000}k); Months 5–10 expand to Commercial Growth at ${totals[1] / 1000:.1f}k/mo (${growth_6m // 1000}k); Months 11–12 step into Scale (${scale_2m / 1000:.1f}k) — ${year1_burn:,} total gross burn (${avg_y1:,}/mo avg).",
                font_size=8.9, color_hex=HEX_INK_SEC, line_spacing=1.2)

    guardrails = [
        ("1. OMNIROUTE_MAX_PAID_ATTEMPTS", "Hard per-call cap on paid LLM attempts + 15m/6h provider blocklists eliminate runaway API bills during upstream outages."),
        ("2. On-Device Edge Inference (WASM)", "Once custom weights are trained via this R&D budget and clear the 0.55 WASM confidence gate, YOLOv8n + MobileViT-XXS run locally on phones with zero GPU scan cost."),
        ("3. R2 + B2 Media Separation", "Presigned browser-to-bucket uploads bypass Node.js RAM; Cloudflare R2 zero-egress eliminates $0.09/GB streaming penalties."),
        ("4. Grant & Entity-Gated R&D Credits", "Separating pilot field delivery (grants) and R&D labor (NRC-IRAP/SR&ED upside contingent on Canadian SME incorporation) protects equity capital."),
    ]
    for idx, (g_title, g_desc) in enumerate(guardrails):
        gy = 1.48 + idx * 1.38
        add_rect(s11, 7.33, gy, 5.45, 1.24, HEX_CARD_BG, HEX_BORDER, 0.75, rounded=True)
        add_rect(s11, 7.33, gy, 0.06, 1.24, HEX_TEAL if idx % 2 == 0 else HEX_FOREST)
        add_textbox(s11, 7.51, gy + 0.12, 5.12, 0.28, g_title, font_size=10.8, bold=True, color_hex=HEX_INK)
        add_textbox(s11, 7.51, gy + 0.44, 5.12, 0.72, g_desc, font_size=9.0, color_hex=HEX_INK_SEC, line_spacing=1.18)

    # =========================================================================
    # SLIDE 12: Closing / Investor Takeaways (Dark Executive Theme)
    # =========================================================================
    s12 = prs.slides.add_slide(blank)
    set_slide_bg(s12, prs, HEX_DARK_BG)
    add_rect(s12, 0, 0, 13.333, 0.06, HEX_EMERALD)

    if LOGO_PATH.is_file():
        add_picture_clean(s12, LOGO_PATH, 0.65, 0.45, 0.42, 0.42)
    add_textbox(s12, 1.18, 0.50, 9.0, 0.30, "Investor Summary  |  Operating Cost Discipline",
                font_size=11.5, bold=True, color_hex=HEX_EMERALD)

    add_textbox(s12, 0.65, 1.02, 11.8, 0.65,
                "Capital-Efficient Operating Model Engineered for AgTech Scale",
                font_size=26, bold=True, color_hex="#F8FAF9")

    closing_cards = [
        ("Strict $10k–$50k/mo Envelope", f"${totals[0] / 1000:.1f}k (Pilot) → ${totals[1] / 1000:.1f}k (Growth) → ${totals[2] / 1000:.1f}k (Scale)",
         f"Three milestone-gated operating tiers stay cleanly within $10k–$50k/mo while supporting up to {PHASES[2]['farmers']:,} farmers and {PHASES[2]['coops']}."),
        ("Zero Hidden Cost Blind Spots", "Full Field + AI + Compliance Accounting",
         "Explicitly budgets SMS/USSD/Twilio WA, Sentinel-2 activation, GPU model training, pathologist labeling, EUDR/OCAP compliance, pentests, FX fees, and 5–6% contingency."),
        ("Architectural Margin Moat", f"Direct COGS Drops to ${cogs_cpf[2]:.2f} / Farmer / Mo",
         f"Trained on-device ONNX vision, OmniRoute free-first routing, policy-scoped caching, and zero-egress R2 drive {margins_150[1]:.1f}%–{margins_200[2]:.1f}% commercial margins (from {margins_150[0]:.0f}%–{margins_200[0]:.0f}% in Pilot)."),
        ("Clear Path to Self-Funding", f"Break-Even Inside Phase 2 (~{breakeven['be_200_k']:.0f}k–{round_half_up(breakeven['be_150_k'], 0):.0f}k Farmers)",
         f"At $1.50–$2.00/farmer/mo blended B2B revenue, 15–20 co-op contracts cover the full ${totals[1] // 1000}k/mo Commercial Growth run-rate."),
    ]
    for idx, (ctitle, cmetric, cbody) in enumerate(closing_cards):
        col = idx % 2
        row = idx // 2
        cx = 0.65 + col * 6.12
        cy = 1.92 + row * 2.15
        add_rect(s12, cx, cy, 5.90, 1.96, HEX_DARK_CARD, HEX_DARK_LINE, 1.0, rounded=True)
        add_rect(s12, cx, cy, 0.06, 1.96, HEX_EMERALD if idx in (0, 2) else HEX_AMBER_BRIGHT)
        add_textbox(s12, cx + 0.22, cy + 0.16, 5.48, 0.30, ctitle, font_size=13, bold=True, color_hex="#FFFFFF")
        add_textbox(s12, cx + 0.22, cy + 0.48, 5.48, 0.30, cmetric, font_size=11.5, bold=True,
                    color_hex=HEX_EMERALD if idx in (0, 2) else "#FBBF24")
        add_textbox(s12, cx + 0.22, cy + 0.86, 5.48, 0.96, cbody, font_size=9.8, color_hex="#B6D6C5", line_spacing=1.22)

    add_rect(s12, 0.65, 6.32, 12.02, 0.66, "#143326", HEX_EMERALD, 0.9, rounded=True)
    add_textbox(s12, 0.85, 6.46, 11.62, 0.38,
                f"Recommended Seed Operating Plan: Deploy ${year1_burn / 1000:.1f}k over 12 months (${totals[1] // 1000}k/mo target base case) to convert 25 co-ops / 25,000 farmers into self-sustaining recurring cash flow.",
                font_size=11.0, bold=True, color_hex="#F8FAF9", align=PP_ALIGN.CENTER)

    add_textbox(s12, 0.65, 7.12, 9.0, 0.24,
                "GPEXTS  |  Ag-Extension Decision Support  |  Investor Cost Model",
                font_size=8.5, color_hex="#739A86")
    add_textbox(s12, 11.10, 7.12, 1.58, 0.24,
                f"12 / {total_slides:02d}",
                font_size=8.5, bold=True, color_hex="#9CC5B0", align=PP_ALIGN.RIGHT, font_name=FONT_MONO)

    PRESENTATIONS_DIR.mkdir(parents=True, exist_ok=True)
    prs.save(str(OUT_PPTX))
    return OUT_PPTX


def convert_pptx_to_pdf(pptx_path: Path) -> Path:
    cmd = [
        "soffice",
        "--headless",
        "--convert-to",
        "pdf",
        "--outdir",
        str(pptx_path.parent),
        str(pptx_path),
    ]
    res = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if res.returncode != 0:
        raise RuntimeError(f"LibreOffice PDF conversion failed ({res.returncode}): {res.stderr}\n{res.stdout}")
    pdf_path = pptx_path.with_suffix(".pdf")
    if not pdf_path.is_file():
        raise RuntimeError(f"Expected PDF not produced at {pdf_path}")
    return pdf_path


def main() -> int:
    summary = validate_model()
    specs = build_chart_specs(summary)
    charts = generate_charts(summary, specs)
    pptx_path = build_presentation(summary, charts, specs)
    pdf_path = convert_pptx_to_pdf(pptx_path)
    print(f"Generated PPTX: {pptx_path} ({pptx_path.stat().st_size:,} bytes)")
    print(f"Generated PDF : {pdf_path} ({pdf_path.stat().st_size:,} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
