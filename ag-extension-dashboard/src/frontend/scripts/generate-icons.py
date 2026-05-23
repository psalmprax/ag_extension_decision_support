#!/usr/bin/env python3
"""Generate PWA icons and apple-touch-icon for the Ag-Extension Dashboard."""
import math
from PIL import Image, ImageDraw


def create_icon(size):
    """Create an agriculture-themed icon with leaf/sprout design."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Colors
    bg_color = (240, 253, 244, 255)        # green-50
    border_color = (34, 197, 94, 255)       # green-500 (#22c55e)
    leaf1_color = (22, 163, 74, 255)        # green-600
    leaf2_color = (34, 197, 94, 255)        # green-500
    stem_color = (21, 128, 61, 255)         # green-700
    seed_color = (22, 163, 74, 255)         # green-600

    # Base scale factors
    cx, cy = size / 2, size / 2
    r = size * 0.47  # background circle radius
    leaf_w = size * 0.28
    leaf_h = size * 0.34
    stem_len = size * 0.24
    stem_w = max(size * 0.055, 2)

    # Background circle - anti-aliased via ellipse
    draw.ellipse(
        [cx - r, cy - r, cx + r, cy + r],
        fill=bg_color,
        outline=border_color,
        width=max(int(size * 0.035), 1),
    )

    # Left leaf (rotated -25 degrees)
    ll_cx = cx - leaf_w * 0.30
    ll_cy = cy - leaf_h * 0.05
    _draw_leaf(img, draw, ll_cx, ll_cy, leaf_w, leaf_h, -25, leaf1_color)

    # Right leaf (rotated +25 degrees)
    rl_cx = cx + leaf_w * 0.30
    rl_cy = cy - leaf_h * 0.05
    _draw_leaf(img, draw, rl_cx, rl_cy, leaf_w, leaf_h, 25, leaf2_color)

    # Stem
    stem_top = cy + leaf_h * 0.15
    stem_bot = stem_top + stem_len
    draw.line(
        [(cx, stem_top), (cx, stem_bot)],
        fill=stem_color,
        width=int(stem_w),
    )

    # Seed dot at bottom of stem
    seed_r = max(size * 0.045, 1.5)
    draw.ellipse(
        [cx - seed_r, stem_bot - seed_r, cx + seed_r, stem_bot + seed_r],
        fill=seed_color,
    )

    return img


def _draw_leaf(img, draw, cx, cy, w, h, angle_deg, color):
    """Draw a leaf shape (teardrop/oval) at given position and angle."""
    angle = math.radians(angle_deg)
    cos_a = math.cos(angle)
    sin_a = math.sin(angle)

    # Create a temporary image for the leaf
    leaf_r = max(w, h) * 0.6
    leaf_size = int(leaf_r * 2.5) + 4
    leaf_img = Image.new("RGBA", (leaf_size, leaf_size), (0, 0, 0, 0))
    ldraw = ImageDraw.Draw(leaf_img)

    # Draw ellipse centered in leaf_img
    lcx = leaf_size / 2
    lcy = leaf_size / 2
    ldraw.ellipse(
        [lcx - w / 2, lcy - h / 2, lcx + w / 2, lcy + h / 2],
        fill=color,
    )

    # Rotate
    leaf_img = leaf_img.rotate(angle_deg, center=(lcx, lcy), resample=Image.BICUBIC, expand=False)

    # Paste onto main image
    paste_x = int(cx - leaf_size / 2)
    paste_y = int(cy - leaf_size / 2)
    img.paste(leaf_img, (paste_x, paste_y), leaf_img)


if __name__ == "__main__":
    import os

    public_dir = os.path.join(os.path.dirname(__file__), "..", "public")
    os.makedirs(public_dir, exist_ok=True)

    sizes = [
        ("pwa-192x192.png", 192),
        ("pwa-512x512.png", 512),
        ("apple-touch-icon.png", 180),
    ]

    for filename, size in sizes:
        img = create_icon(size)
        filepath = os.path.join(public_dir, filename)
        img.save(filepath, "PNG")
        print(f"Created {filepath} ({size}x{size})")
