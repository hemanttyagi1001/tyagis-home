"""Build all Tyagi's Home app assets from the Claude Design logo.

This is the script that produced the CURRENT branding. The mark comes from the
Claude Design project "Tyagi's Home Logo" (viewBox 0 0 100 100); `logo_source.html`
in this directory holds that SVG.

Usage:
    1. Render logo_source.html to mark_raw.png at 1024x1024, e.g.
         msedge --headless --screenshot=mark_raw.png --window-size=1024,1024 \
                --hide-scrollbars file:///<abs-path>/logo_source.html
    2. python build_icons_from_design.py

Requires Pillow.
"""
import os
from PIL import Image

SP = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(SP, "..", "assets")

GREEN = (74, 103, 65)      # #4A6741
GOLD = (212, 168, 67)      # #D4A843
WHITE = (255, 255, 255)

RAW = os.path.join(SP, "mark_raw.png")


def load_mark_transparent():
    """Load the Edge render and knock out the white background."""
    img = Image.open(RAW).convert("RGBA")
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            # The render is on solid white; make near-white fully transparent.
            if r > 244 and g > 244 and b > 244:
                px[x, y] = (r, g, b, 0)
    return img


def trim(img):
    """Crop to the non-transparent bounding box."""
    bbox = img.getbbox()
    return img.crop(bbox) if bbox else img


def fit_into(mark, canvas_size, coverage, bg=None, radius_frac=None):
    """Place `mark` centered on a canvas, scaled to `coverage` of the canvas."""
    canvas = Image.new("RGBA", (canvas_size, canvas_size), bg or (0, 0, 0, 0))

    target = int(canvas_size * coverage)
    m = mark.copy()
    ratio = min(target / m.width, target / m.height)
    m = m.resize((max(1, int(m.width * ratio)), max(1, int(m.height * ratio))), Image.LANCZOS)

    x = (canvas_size - m.width) // 2
    y = (canvas_size - m.height) // 2
    canvas.paste(m, (x, y), m)
    return canvas


def main():
    mark = trim(load_mark_transparent())
    print(f"Trimmed mark: {mark.size[0]}x{mark.size[1]}")

    # --- icon.png : full-bleed white tile, green mark. Matches the design card
    # (white rounded square, green border) but square for store requirements.
    icon = Image.new("RGBA", (1024, 1024), WHITE + (255,))
    m = mark.copy()
    ratio = min(760 / m.width, 760 / m.height)
    m = m.resize((int(m.width * ratio), int(m.height * ratio)), Image.LANCZOS)
    icon.paste(m, ((1024 - m.width) // 2, (1024 - m.height) // 2), m)
    icon.convert("RGB").save(os.path.join(ASSETS, "icon.png"))
    print("icon.png            1024x1024  white bg, opaque")

    # --- adaptive-icon.png : Android masks this to a circle and crops the outer
    # ~17%. Keep the mark inside the centre 60% so nothing is clipped.
    adaptive = fit_into(mark, 1024, 0.58, bg=WHITE + (255,))
    adaptive.convert("RGB").save(os.path.join(ASSETS, "adaptive-icon.png"))
    print("adaptive-icon.png   1024x1024  safe zone 58%")

    # --- splash-icon.png : transparent, sits on the #4A6741 splash background.
    # Swap green<->white so the mark reads on green. Both directions are needed:
    # a one-way green->white turns the white door and coin outline invisible
    # against the newly-white house body.
    splash_src = mark.copy()
    px = splash_src.load()
    for y in range(splash_src.height):
        for x in range(splash_src.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if abs(r - GREEN[0]) < 40 and abs(g - GREEN[1]) < 40 and abs(b - GREEN[2]) < 40:
                px[x, y] = WHITE + (a,)          # house body -> white
            elif r > 225 and g > 225 and b > 225:
                px[x, y] = GREEN + (a,)          # door frame / coin ring -> green
    splash = fit_into(splash_src, 1024, 0.80)
    splash.save(os.path.join(ASSETS, "splash-icon.png"))
    print("splash-icon.png     1024x1024  transparent, white mark")

    # --- favicon.png : tiny, so drop the wordmark detail by just scaling down.
    fav = fit_into(mark, 48, 0.88, bg=WHITE + (255,))
    fav.convert("RGB").save(os.path.join(ASSETS, "favicon.png"))
    print("favicon.png         48x48")

    # --- logo.png : in-app HomeScreen header, rendered at 240x100 on the green
    # header. The wordmark now lives inside the house, so this is just the mark
    # centered - no separate text lockup, and no dead space beside it.
    W, H = 600, 250
    logo = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    lm = splash_src.copy()          # already white/gold on transparent
    ratio = min((H * 0.94) / lm.height, (W * 0.94) / lm.width)
    lm = lm.resize((int(lm.width * ratio), int(lm.height * ratio)), Image.LANCZOS)
    logo.paste(lm, ((W - lm.width) // 2, (H - lm.height) // 2), lm)
    logo.save(os.path.join(ASSETS, "logo.png"))
    print(f"logo.png            {W}x{H}   transparent, centered mark")


if __name__ == "__main__":
    main()
    print("\nAll assets written to", ASSETS)
