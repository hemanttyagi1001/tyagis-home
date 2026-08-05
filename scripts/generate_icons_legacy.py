"""DEPRECATED - generates the OLD (pre-2026) app icons.

The current assets in ../assets are rendered from the Claude Design logo
("Tyagi's Home Logo"), not from this script. Running this file will OVERWRITE
those assets with the old house-and-text design.

Kept only for reference. Do not run unless you intend to revert the branding.
"""
from PIL import Image, ImageDraw, ImageFont
import os


def get_font(size):
    """Try to load a bold font, fallback to default."""
    for name in ["arialbd.ttf", "arial.ttf", "calibrib.ttf", "segoeui.ttf",
                  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]:
        try:
            return ImageFont.truetype(name, size)
        except (IOError, OSError):
            continue
    return ImageFont.load_default()


def draw_home(draw, cx, cy, s, house_color=(255, 255, 255)):
    """Draw a detailed home icon."""
    r, g, b = house_color

    # Chimney
    chim_w = s * 0.15
    chim_x = cx + s * 0.35
    draw.rectangle(
        [chim_x, cy - s * 1.15, chim_x + chim_w, cy - s * 0.5],
        fill=(r, g, b, 220)
    )

    # Roof (triangle)
    roof_points = [
        (cx, cy - s * 1.05),
        (cx - s * 1.4, cy - s * 0.05),
        (cx + s * 1.4, cy - s * 0.05),
    ]
    draw.polygon(roof_points, fill=(r, g, b, 255))

    # House body
    body_left = cx - s * 1.0
    body_top = cy - s * 0.08
    body_right = cx + s * 1.0
    body_bottom = cy + s * 0.8
    draw.rectangle([body_left, body_top, body_right, body_bottom], fill=(r, g, b, 240))

    # Door with arch
    door_w = s * 0.3
    door_h = s * 0.5
    door_left = cx - door_w / 2
    door_right = cx + door_w / 2
    door_top = body_bottom - door_h
    door_bottom = body_bottom
    door_fill = (74, 103, 65, 230) if r > 200 else (40, 60, 35, 230)

    draw.rectangle([door_left, door_top + s * 0.06, door_right, door_bottom], fill=door_fill)
    draw.pieslice(
        [door_left, door_top - s * 0.06, door_right, door_top + s * 0.18],
        180, 360, fill=door_fill
    )

    # Door knob
    knob_x = cx + door_w * 0.25
    knob_y = door_top + door_h * 0.55
    knob_r = max(s * 0.03, 2)
    draw.ellipse([knob_x - knob_r, knob_y - knob_r, knob_x + knob_r, knob_y + knob_r],
                 fill=(212, 168, 67, 255))

    # Windows with cross panes
    win_size = s * 0.24
    win_fill = (180, 215, 240, 255)
    pane_color = (r, g, b, 180)
    pane_w = max(int(s * 0.025), 1)

    for wx in [cx - s * 0.62, cx + s * 0.38]:
        wy = cy + s * 0.12
        draw.rectangle([wx, wy, wx + win_size, wy + win_size], fill=win_fill)
        mid_x = wx + win_size / 2
        mid_y = wy + win_size / 2
        draw.rectangle([mid_x - pane_w / 2, wy, mid_x + pane_w / 2, wy + win_size], fill=pane_color)
        draw.rectangle([wx, mid_y - pane_w / 2, wx + win_size, mid_y + pane_w / 2], fill=pane_color)

    # Base line
    draw.rectangle(
        [body_left - s * 0.05, body_bottom, body_right + s * 0.05, body_bottom + s * 0.045],
        fill=(r, g, b, 180)
    )


def create_icon(size, output_path, include_text=True):
    """Create app icon."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Gradient green background
    for y in range(size):
        ratio = y / size
        r = int(55 + (85 - 55) * ratio)
        g = int(80 + (125 - 80) * ratio)
        b = int(47 + (75 - 47) * ratio)
        draw.line([(0, y), (size, y)], fill=(r, g, b, 255))

    cx, cy = size // 2, int(size * 0.40)
    s = size * 0.30

    draw_home(draw, cx, cy, s)

    if include_text:
        font_main = get_font(int(size * 0.115))
        font_sub = get_font(int(size * 0.07))

        text_main = "Tyagi's"
        bbox = draw.textbbox((0, 0), text_main, font=font_main)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        text_y = cy + s * 1.0

        draw.text(((size - tw) // 2 + 2, text_y + 2), text_main, fill=(0, 0, 0, 50), font=font_main)
        draw.text(((size - tw) // 2, text_y), text_main, fill=(255, 255, 255, 255), font=font_main)

        text_sub = "Home"
        bbox2 = draw.textbbox((0, 0), text_sub, font=font_sub)
        tw2 = bbox2[2] - bbox2[0]
        draw.text(((size - tw2) // 2, text_y + th + size * 0.015),
                  text_sub, fill=(212, 168, 67, 255), font=font_sub)

    img.save(output_path, 'PNG')
    print(f"Created: {output_path} ({size}x{size})")


def create_splash_icon(size, output_path):
    """Create splash screen icon."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    cx, cy = size // 2, int(size * 0.36)
    s = size * 0.24

    draw_home(draw, cx, cy, s, house_color=(74, 103, 65))

    font_main = get_font(int(size * 0.095))
    font_sub = get_font(int(size * 0.065))

    text = "Tyagi's"
    bbox = draw.textbbox((0, 0), text, font=font_main)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    text_y = cy + s * 1.1
    draw.text(((size - tw) // 2, text_y), text, fill=(74, 103, 65, 255), font=font_main)

    sub = "Home"
    bbox2 = draw.textbbox((0, 0), sub, font=font_sub)
    tw2 = bbox2[2] - bbox2[0]
    draw.text(((size - tw2) // 2, text_y + th + 3), sub, fill=(212, 168, 67, 255), font=font_sub)

    img.save(output_path, 'PNG')
    print(f"Created: {output_path} ({size}x{size})")


def create_logo(width, height, output_path):
    """Create in-app logo for home screen (on green background)."""
    img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Home icon centered-left
    home_cx = int(width * 0.22)
    home_cy = int(height * 0.50)
    s = height * 0.38
    draw_home(draw, home_cx, home_cy, s)

    # "Tyagi's" and "Home" text to the right
    font_main = get_font(int(height * 0.28))
    font_sub = get_font(int(height * 0.17))

    text_x = int(width * 0.40)
    text_main = "Tyagi's"
    bbox = draw.textbbox((0, 0), text_main, font=font_main)
    th = bbox[3] - bbox[1]
    draw.text((text_x, int(height * 0.12)), text_main, fill=(255, 255, 255, 255), font=font_main)
    draw.text((text_x, int(height * 0.12) + th + 4), "Home", fill=(212, 168, 67, 255), font=font_sub)

    img.save(output_path, 'PNG')
    print(f"Created: {output_path} ({width}x{height})")


if __name__ == '__main__':
    assets_dir = os.path.join(os.path.dirname(__file__), '..', 'assets')

    create_icon(1024, os.path.join(assets_dir, 'icon.png'))
    create_icon(1024, os.path.join(assets_dir, 'adaptive-icon.png'))
    create_icon(48, os.path.join(assets_dir, 'favicon.png'), include_text=False)
    create_splash_icon(200, os.path.join(assets_dir, 'splash-icon.png'))
    create_logo(600, 250, os.path.join(assets_dir, 'logo.png'))

    print("\nAll icons generated!")
