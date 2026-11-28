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

    draw.text((36, 24), "GPExts  |  Officer dashboard", font=load_font(22, bold=True), fill=TEXT)
    draw.text((36, 56), "Schematic of the screen regions (not a screenshot)", font=load_font(13), fill=MUTED)

    # Top bar
    topbar = (36, 88, WIDTH - 36, 136)
    draw.rounded_rectangle(topbar, radius=10, fill=PANEL, outline=BORDER, width=1)
    draw.rounded_rectangle((320, 100, 640, 124), radius=8, fill=(13, 33, 25), outline=BORDER)
    draw.text((334, 104), "Search system or location", font=load_font(12), fill=MUTED)
    for x, label in [(664, "Location  ·  12 °C"), (840, "Language"), (944, "Light / dark"), (1060, "Notifications"), (1180, "Settings"), (1270, "Profile")]:
        draw.text((x, 104), label, font=load_font(12), fill=MUTED)
    pin(draw, (300, 112), "2")

    # Sidebar
    sidebar = (36, 152, 300, HEIGHT - 36)
    draw.rounded_rectangle(sidebar, radius=12, fill=PANEL_ALT, outline=BORDER, width=1)
    sections = [
        ("Field work", ["Dashboard", "AI agronomist", "Farmer chat", "Knowledge", "Farmers", "Visits",
                        "Crops & fields", "Disease diagnosis", "Advisory Studio"]),
        ("Insights", ["Reports", "Analytics", "Farm map"]),
        ("Operations", ["Outreach", "Billing & subscription"]),
        ("Administration", ["System", "Staff & officers"]),
    ]
    y = 168
    for title, items in sections:
        draw.text((54, y), title, font=load_font(11, bold=True), fill=MUTED)
        y += 18
        for item in items:
            current = item == "Dashboard"
            draw.rounded_rectangle((54, y, 282, y + 22), radius=6, fill=(31, 71, 55) if current else PANEL_ALT,
                                   outline=BORDER if current else PANEL_ALT)
            draw.text((66, y + 4), item, font=load_font(12), fill=TEXT if current else MUTED)
            y += 25
        y += 6
    pin(draw, (282, 172), "1")

    # Page header over a field photo, with the connection status on the right
    header = (324, 152, WIDTH - 36, 236)
    draw.rounded_rectangle(header, radius=12, fill=PANEL, outline=BORDER, width=1)
    draw.rounded_rectangle((760, 153, WIDTH - 37, 235), radius=12, fill=(34, 74, 44))
    draw.text((344, 168), "Dashboard", font=load_font(26, bold=True), fill=TEXT)
    draw.text((344, 206), "Welcome back, Peter.", font=load_font(13), fill=MUTED)
    draw.rounded_rectangle((1150, 180, WIDTH - 56, 208), radius=8, fill=(13, 33, 25), outline=BORDER)
    draw.text((1164, 186), "Online · all changes saved", font=load_font(11), fill=TEXT)
    pin(draw, (744, 168), "3")

    # Quick actions and zone filter
    x = 324
    for label in ["Diagnose a crop photo", "Register farmer", "Plan visits", "Farmer messages"]:
        w = int(draw.textlength(label, font=load_font(12))) + 28
        draw.rounded_rectangle((x, 252, x + w, 282), radius=8, fill=PANEL, outline=BORDER)
        draw.text((x + 14, 260), label, font=load_font(12), fill=TEXT)
        x += w + 10
    draw.rounded_rectangle((WIDTH - 240, 252, WIDTH - 36, 282), radius=8, fill=PANEL, outline=BORDER)
    draw.text((WIDTH - 226, 260), "Zone: All villages", font=load_font(12), fill=TEXT)
    pin(draw, (x + 8, 267), "4")

    # Metric cards
    cards = [("Total farmers", "12", "+4.2% vs last month"), ("Active conversations", "9", "+6.1% vs last month"),
             ("Visits this month", "7", "+3.4% vs last month"), ("Avg satisfaction", "4.6/5", "+0.2% vs last month")]
    x = 324
    card_w = (WIDTH - 36 - 324 - 3 * 16) // 4
    for title, value, sub in cards:
        draw.rounded_rectangle((x, 298, x + card_w, 384), radius=10, fill=PANEL, outline=BORDER, width=1)
        draw.text((x + 14, 310), title, font=load_font(13, bold=True), fill=TEXT)
        draw.text((x + 14, 330), value, font=load_font(24, bold=True), fill=ACCENT)
        draw.text((x + 14, 362), sub, font=load_font(11), fill=MUTED)
        x += card_w + 16
    pin(draw, (324 + card_w - 22, 312), "5")

    # Farm locations map
    box(draw, (324, 400, 1000, 700), "Farm locations", "Farms by crop; street, satellite or terrain")
    draw.rounded_rectangle((346, 456, 978, 680), radius=8, fill=(15, 38, 28), outline=BORDER)
    for cx, cy, col in [(500, 540, (234, 179, 8)), (540, 580, ACCENT), (620, 520, (59, 130, 246)), (700, 600, ACCENT), (820, 560, (234, 179, 8))]:
        draw.ellipse((cx - 7, cy - 7, cx + 7, cy + 7), fill=col)
    pin(draw, (978, 414), "6")

    # Rain and temperature, and support
    box(draw, (1024, 400, WIDTH - 36, 548), "Rain and temperature", "Last two weeks, measured by NASA POWER")
    points = [(1048, 520), (1110, 500), (1170, 512), (1230, 480), (1290, 492), (1340, 470)]
    draw.line(points, fill=ACCENT, width=3, joint="curve")
    pin(draw, (WIDTH - 58, 414), "7")
    box(draw, (1024, 564, WIDTH - 36, 700), "Support", "Questions resolved, and how farmers rated the help")

    # Further cards
    x = 324
    w = (WIDTH - 36 - 324 - 2 * 16) // 3
    for title, sub in [("Advisories", "Alerts sent to farmers"), ("Follow-ups", "Whether the advice worked"),
                       ("Field tools", "Calculators that work offline")]:
        box(draw, (x, 716, x + w, HEIGHT - 36), title, sub)
        x += w + 16
    pin(draw, (WIDTH - 58, 730), "8")

    image.save(out)
    print(f"Wrote {out.relative_to(Path.cwd()) if out.is_relative_to(Path.cwd()) else out}")


if __name__ == "__main__":
    main()
