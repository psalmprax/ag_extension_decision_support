#!/usr/bin/env python3
"""
Generate all mobile, PWA, iOS, Android, and browser extension icons from the master logo.png.
"""
import os
import shutil
from PIL import Image

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) # ag-extension-dashboard
ROOT_DIR = os.path.dirname(BASE_DIR)
FRONTEND_DIR = os.path.join(BASE_DIR, "src", "frontend")
EXT_DIR = os.path.join(ROOT_DIR, "ag-extension-browser-ext")

SRC_LOGO = os.path.join(FRONTEND_DIR, "public", "logo.png")

print(f"Loading source logo from: {SRC_LOGO}")
img = Image.open(SRC_LOGO).convert("RGBA")

def resize_icon(image, size, pad_ratio=0.0, bg_color=None):
    """Resize image to target size with optional padding and background."""
    target_canvas = Image.new("RGBA", (size, size), bg_color if bg_color else (0, 0, 0, 0))
    inner_size = int(size * (1.0 - pad_ratio))
    
    # Calculate aspect ratio preserved resize
    w, h = image.size
    scale = min(inner_size / w, inner_size / h)
    new_w = max(1, int(w * scale))
    new_h = max(1, int(h * scale))
    
    resized = image.resize((new_w, new_h), Image.Resampling.LANCZOS)
    offset_x = (size - new_w) // 2
    offset_y = (size - new_h) // 2
    
    target_canvas.paste(resized, (offset_x, offset_y), resized)
    return target_canvas

# 1. PWA and Web Frontend Icons
pwa_public = os.path.join(FRONTEND_DIR, "public")
os.makedirs(pwa_public, exist_ok=True)

print("1. Generating Frontend & PWA icons...")
# Apple touch icon (180x180, slightly padded for iOS home screen curve)
resize_icon(img, 180, pad_ratio=0.1, bg_color=(12, 10, 9, 255)).save(os.path.join(pwa_public, "apple-touch-icon.png"))

# PWA icons
resize_icon(img, 192, pad_ratio=0.05).save(os.path.join(pwa_public, "pwa-192x192.png"))
resize_icon(img, 512, pad_ratio=0.05).save(os.path.join(pwa_public, "pwa-512x512.png"))

# PWA Maskable icons (with dark slate circular safe zone)
resize_icon(img, 192, pad_ratio=0.25, bg_color=(12, 10, 9, 255)).save(os.path.join(pwa_public, "pwa-maskable-192x192.png"))
resize_icon(img, 512, pad_ratio=0.25, bg_color=(12, 10, 9, 255)).save(os.path.join(pwa_public, "pwa-maskable-512x512.png"))

# Favicon
resize_icon(img, 64).save(os.path.join(pwa_public, "favicon.png"))
resize_icon(img, 32).save(os.path.join(pwa_public, "favicon-32x32.png"))

# 2. Native iOS Xcode AppIcon
ios_iconset = os.path.join(FRONTEND_DIR, "ios", "App", "App", "Assets.xcassets", "AppIcon.appiconset")
if os.path.exists(ios_iconset):
    print("2. Generating Native iOS AppIcon (1024x1024)...")
    resize_icon(img, 1024, pad_ratio=0.12, bg_color=(12, 10, 9, 255)).save(os.path.join(ios_iconset, "AppIcon-512@2x.png"))

# 3. Native Android Mipmap Icons
android_res = os.path.join(FRONTEND_DIR, "android", "app", "src", "main", "res")
if os.path.exists(android_res):
    print("3. Generating Native Android Mipmap icons...")
    densities = {
        "mipmap-mdpi": 48,
        "mipmap-hdpi": 72,
        "mipmap-xhdpi": 96,
        "mipmap-xxhdpi": 144,
        "mipmap-xxxhdpi": 192,
    }
    for folder, dim in densities.items():
        folder_path = os.path.join(android_res, folder)
        os.makedirs(folder_path, exist_ok=True)
        # Standard launcher
        resize_icon(img, dim, pad_ratio=0.08, bg_color=(12, 10, 9, 255)).save(os.path.join(folder_path, "ic_launcher.png"))
        # Round launcher
        resize_icon(img, dim, pad_ratio=0.15, bg_color=(12, 10, 9, 255)).save(os.path.join(folder_path, "ic_launcher_round.png"))
        # Foreground
        resize_icon(img, dim, pad_ratio=0.2).save(os.path.join(folder_path, "ic_launcher_foreground.png"))

# 4. Browser Extension Public Icons
ext_public = os.path.join(EXT_DIR, "public")
os.makedirs(ext_public, exist_ok=True)

print("4. Generating Browser Extension icons in public/...")
shutil.copy(SRC_LOGO, os.path.join(ext_public, "logo.png"))
resize_icon(img, 16).save(os.path.join(ext_public, "icon-16.png"))
resize_icon(img, 32).save(os.path.join(ext_public, "icon-32.png"))
resize_icon(img, 48).save(os.path.join(ext_public, "icon-48.png"))
resize_icon(img, 128).save(os.path.join(ext_public, "icon-128.png"))

print("All mobile, native, PWA, and browser extension logo assets successfully generated!")
