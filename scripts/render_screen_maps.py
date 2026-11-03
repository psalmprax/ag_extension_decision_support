#!/usr/bin/env python3
"""Draw the dashboard layout map used in docs/USER_MANUAL.md.

The map is a schematic of the screen regions, not a screenshot: authenticated
screens need a seeded database, and a drawn map stays accurate when copy or
data changes. Numbered pins match the legend in the manual.

Usage:
    python3 scripts/render_screen_maps.py
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

WIDTH, HEIGHT = 1400, 880
BG = (11, 25, 18)
PANEL = (19, 46, 35)
PANEL_ALT = (24, 56, 43)
BORDER = (45, 90, 72)
TEXT = (229, 231, 235)
MUTED = (148, 163, 184)
ACCENT = (16, 185, 129)
PIN_BG = (22, 101, 52)
WHITE = (255, 255, 255)

FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    index = 1 if bold else 0
    for candidate in ([FONT_CANDIDATES[index]] + FONT_CANDIDATES):
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            continue
    return ImageFont.load_default()


def box(draw: ImageDraw.ImageDraw, xy, label: str, sub: str | None = None) -> None:
    draw.rounded_rectangle(xy, radius=10, fill=PANEL, outline=BORDER, width=1)
    x0, y0, x1, _ = xy
    draw.text((x0 + 14, y0 + 12), label, font=load_font(16, bold=True), fill=TEXT)
    if sub:
        draw.text((x0 + 14, y0 + 36), sub, font=load_font(12), fill=MUTED)


def pin(draw: ImageDraw.ImageDraw, center, number: str) -> None:
    cx, cy = center
    r = 16
    draw.ellipse((cx - r - 3, cy - r - 3, cx + r + 3, cy + r + 3), fill=(220, 252, 231))
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=PIN_BG)
    font = load_font(15, bold=True)
    text_w = draw.textlength(number, font=font)
    draw.text((cx - text_w / 2, cy - 9), number, font=font, fill=WHITE)


def main() -> None:
    out = Path(__file__).resolve().parent.parent / "docs" / "manual" / "figures" / "dashboard-layout-map.png"
    out.parent.mkdir(parents=True, exist_ok=True)

    image = Image.new("RGB", (WIDTH, HEIGHT), BG)
    draw = ImageDraw.Draw(image)

    draw.text((36, 24), "GPEXTS  |  Officer dashboard", font=load_font(22, bold=True), fill=TEXT)
    draw.text((36, 56), "Schematic of the screen regions (not a screenshot)", font=load_font(13), fill=MUTED)

    # Sidebar
    sidebar = (36, 96, 300, HEIGHT - 36)
    draw.rounded_rectangle(sidebar, radius=12, fill=PANEL_ALT, outline=BORDER, width=1)
    draw.text((54, 116), "SIDEBAR", font=load_font(12, bold=True), fill=ACCENT)
    sections = [
        ("FIELD WORK", ["Dashboard", "AI Assistant", "Knowledge Base", "Farmers", "Visits", "Fields"]),
        ("INSIGHTS", ["Reports", "Analytics", "WorldMonitor"]),
        ("OPERATIONS", ["SMS", "Billing"]),
        ("ADMINISTRATION", ["Telemetry", "System Health", "User Management"]),
    ]
    y = 146
    for title, items in sections:
        draw.text((54, y), title, font=load_font(11, bold=True), fill=MUTED)
        y += 20
        for item in items:
            draw.rounded_rectangle((54, y, 282, y + 24), radius=6, fill=(31, 71, 55) if item == "Dashboard" else PANEL_ALT,
                                   outline=(45, 90, 72) if item == "Dashboard" else PANEL_ALT)
            draw.text((66, y + 4), item, font=load_font(12), fill=TEXT if item == "Dashboard" else MUTED)
            y += 28
        y += 8
    pin(draw, (282, 160), "1")

    # Header
    header = (324, 96, WIDTH - 36, 156)
    draw.rounded_rectangle(header, radius=12, fill=PANEL, outline=BORDER, width=1)
    draw.rounded_rectangle((344, 114, 900, 140), radius=8, fill=(13, 33, 25), outline=BORDER)
    draw.text((358, 118), "Search farmers, visits, reports", font=load_font(12), fill=MUTED)
    draw.text((940, 118), "Notifications", font=load_font(12), fill=MUTED)
    draw.text((1090, 118), "Help", font=load_font(12), fill=MUTED)
    draw.text((1200, 118), "Profile", font=load_font(12), fill=MUTED)
    pin(draw, (886, 126), "2")

    # Metric cards
    cards = [
        ("Farmers", "Portfolio size"),
        ("Visits", "This period"),
        ("Open follow-ups", "Needs action"),
        ("Resolution rate", "Closed with outcome"),
    ]
    x = 324
    card_w = (WIDTH - 36 - 324 - 3 * 16) // 4
    for title, sub in cards:
        box(draw, (x, 176, x + card_w, 268), title, sub)
        draw.text((x + 14, 224), "0", font=load_font(26, bold=True), fill=ACCENT)
        x += card_w + 16
    pin(draw, (324 + card_w - 24, 190), "3")

    # Chart
    box(draw, (324, 288, 840, 560), "Performance", "Visit volume and completion trend")
    chart = (348, 344, 816, 536)
    draw.rectangle(chart, outline=BORDER)
    points = [(348, 500), (430, 470), (512, 486), (594, 430), (676, 450), (758, 400), (816, 418)]
    draw.line(points, fill=ACCENT, width=3, joint="curve")
    pin(draw, (820, 302), "4")

    # Map
    box(draw, (864, 288, WIDTH - 36, 560), "Farmer map", "Registered locations")
    draw.rounded_rectangle((886, 344, WIDTH - 58, 536), radius=8, fill=(15, 38, 28), outline=BORDER)
    for cx, cy in [(990, 420), (1120, 390), (1200, 470), (1060, 500)]:
        draw.ellipse((cx - 5, cy - 5, cx + 5, cy + 5), fill=ACCENT)
    pin(draw, (WIDTH - 60, 302), "5")

    # Activity + alerts
    box(draw, (324, 580, 1000, HEIGHT - 36), "Recent activity", "Latest visits, diagnoses and advisories")
    for i in range(4):
        yy = 636 + i * 44
        draw.rounded_rectangle((348, yy, 976, yy + 32), radius=6, fill=PANEL_ALT, outline=BORDER)
        draw.text((362, yy + 8), "Visit recorded", font=load_font(12), fill=TEXT)
        draw.text((760, yy + 8), "2 hours ago", font=load_font(11), fill=MUTED)
    pin(draw, (976, 594), "6")

    box(draw, (1024, 580, WIDTH - 36, HEIGHT - 36), "Alerts", "Weather, pest and follow-ups")
    for i, label in enumerate(["Weather warning", "Pest sighting nearby", "Follow-up due"]):
        yy = 636 + i * 44
        draw.rounded_rectangle((1048, yy, WIDTH - 60, yy + 32), radius=6, fill=(52, 42, 20), outline=(120, 92, 32))
        draw.text((1060, yy + 8), label, font=load_font(11), fill=(253, 230, 138))
    pin(draw, (WIDTH - 60, 594), "7")

    image.save(out)
    print(f"Wrote {out.relative_to(Path.cwd()) if out.is_relative_to(Path.cwd()) else out}")


if __name__ == "__main__":
    main()
