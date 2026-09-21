from __future__ import annotations

from pathlib import Path
from typing import Iterable
import math

from PIL import Image, ImageColor, ImageDraw, ImageFilter, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
REPOSITORY_ROOT = ROOT.parent
LOGO_PATH = next(
    (path for path in (ROOT / "public" / "logo.png", REPOSITORY_ROOT / "CHAMA LOGO.png") if path.exists()),
    ROOT / "public" / "logo.png",
)
ICON_PATH = next(
    (path for path in (ROOT / "public" / "brand-symbol.png", REPOSITORY_ROOT / "CHAMA ICON.png") if path.exists()),
    ROOT / "public" / "brand-symbol.png",
)
RES_DIR = ROOT / "android" / "app" / "src" / "main" / "res"
MOBILE_ASSET_DIR = ROOT / "mobile-assets"

BACKGROUND_TOP = "#071F19"
BACKGROUND_BOTTOM = "#075B45"
GLOW_A = "#0B8F68"
GLOW_B = "#D9A441"
CARD_FILL = "#f8fafc"
CARD_STROKE = "#dbeafe"
TEXT_COLOR = "#f8fafc"
SUBTEXT_COLOR = "#cbd5e1"
LAUNCHER_BACKGROUND = "#F5FBF8"

MDPI = 1.0
DENSITIES = {
  "mdpi": 1.0,
  "hdpi": 1.5,
  "xhdpi": 2.0,
  "xxhdpi": 3.0,
  "xxxhdpi": 4.0,
}

ICON_BASE = 1024
CARD_RATIO = 0.62
LOGO_RATIO = 0.52
SPLASH_LOGO_RATIO = 0.58


def color(value: str) -> tuple[int, int, int, int]:
    return ImageColor.getcolor(value, "RGBA")


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        Path("C:/Windows/Fonts/segoeuib.ttf") if bold else Path("C:/Windows/Fonts/segoeui.ttf"),
        Path("C:/Windows/Fonts/arialbd.ttf") if bold else Path("C:/Windows/Fonts/arial.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default()


def ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def load_logo(path: Path = LOGO_PATH) -> Image.Image:
    logo = Image.open(path).convert("RGBA")
    return logo


def add_vertical_gradient(canvas: Image.Image, top_hex: str, bottom_hex: str) -> None:
    width, height = canvas.size
    top = color(top_hex)
    bottom = color(bottom_hex)
    pixels = canvas.load()
    for y in range(height):
        t = y / max(height - 1, 1)
        r = round(lerp(top[0], bottom[0], t))
        g = round(lerp(top[1], bottom[1], t))
        b = round(lerp(top[2], bottom[2], t))
        a = round(lerp(top[3], bottom[3], t))
        for x in range(width):
            pixels[x, y] = (r, g, b, a)


def add_glow_layer(canvas: Image.Image, bounds: tuple[int, int, int, int], fill_hex: str, blur: int) -> None:
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    draw.ellipse(bounds, fill=color(fill_hex))
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    canvas.alpha_composite(layer)


def make_background(size: tuple[int, int], top_hex: str = BACKGROUND_TOP, bottom_hex: str = BACKGROUND_BOTTOM) -> Image.Image:
    canvas = Image.new("RGBA", size, color(top_hex))
    add_vertical_gradient(canvas, top_hex, bottom_hex)

    width, height = size
    add_glow_layer(canvas, (-width // 5, -height // 5, width // 2, height // 2), "#14b8a633", max(20, min(size) // 18))
    add_glow_layer(canvas, (width // 2, height // 5, width + width // 4, height + height // 4), "#f59e0b26", max(24, min(size) // 20))

    grid = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(grid)
    step = max(24, min(size) // 24)
    line_color = (255, 255, 255, 12)
    for x in range(0, width, step):
        draw.line((x, 0, x, height), fill=line_color, width=1)
    for y in range(0, height, step):
        draw.line((0, y, width, y), fill=line_color, width=1)
    grid = grid.filter(ImageFilter.GaussianBlur(0.5))
    canvas.alpha_composite(grid)
    return canvas


def make_card(target_size: int, plate_size: int, logo_scale: float, source_path: Path = LOGO_PATH) -> Image.Image:
    canvas = Image.new("RGBA", (target_size, target_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    cx = target_size // 2
    cy = target_size // 2

    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_box = (
        cx - plate_size // 2 + target_size // 48,
        cy - plate_size // 2 + target_size // 48,
        cx + plate_size // 2 + target_size // 48,
        cy + plate_size // 2 + target_size // 48,
    )
    shadow_draw.rounded_rectangle(shadow_box, radius=plate_size // 6, fill=(0, 0, 0, 100))
    shadow = shadow.filter(ImageFilter.GaussianBlur(target_size // 36))
    canvas.alpha_composite(shadow)

    plate_box = (
        cx - plate_size // 2,
        cy - plate_size // 2,
        cx + plate_size // 2,
        cy + plate_size // 2,
    )
    draw.rounded_rectangle(plate_box, radius=plate_size // 6, fill=color(CARD_FILL), outline=color(CARD_STROKE), width=max(2, target_size // 256))

    logo = load_logo(source_path)
    logo_target = int(plate_size * logo_scale)
    logo = ImageOps.contain(logo, (logo_target, logo_target), Image.Resampling.LANCZOS)
    logo_x = cx - logo.width // 2
    logo_y = cy - logo.height // 2
    canvas.alpha_composite(logo, (logo_x, logo_y))
    return canvas


def make_icon(size: int) -> Image.Image:
    canvas = make_background((size, size), "#f0fdf4", "#d1fae5")
    # The official icon source already contains its own framed lockup, so keep it
    # large enough to remain identifiable at legacy launcher-icon sizes.
    plate_size = int(size * 0.9)
    card = make_card(size, plate_size, 0.7, ICON_PATH)
    canvas.alpha_composite(card)
    return canvas


def make_foreground(size: int) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    plate_size = int(size * 0.9)
    card = make_card(size, plate_size, 0.7, ICON_PATH)
    canvas.alpha_composite(card)
    return canvas


def fit_text(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont, max_width: int) -> ImageFont.ImageFont:
    current = font
    if not text:
        return current
    while True:
        bbox = draw.textbbox((0, 0), text, font=current)
        if bbox[2] - bbox[0] <= max_width or getattr(current, "size", 12) <= 10:
            return current
        current = load_font(max(getattr(current, "size", 12) - 2, 10), bold=True)


def make_splash(width: int, height: int) -> Image.Image:
    canvas = make_background((width, height))
    draw = ImageDraw.Draw(canvas)
    landscape = width > height
    center_y = height // 2

    if landscape:
        plate_size = int(min(width, height) * 0.54)
        card = make_card(plate_size, plate_size, SPLASH_LOGO_RATIO)
        card_x = max(width // 10, width // 4 - plate_size // 2)
        card_y = center_y - plate_size // 2
        canvas.alpha_composite(card, (card_x, card_y))

        title_font = load_font(max(28, height // 8), bold=True)
        subtitle_font = load_font(max(16, height // 16), bold=False)
        title_x = card_x + plate_size + width // 18
        title_top = max(height // 6, center_y - height // 6)
        title = "CHAMA360"
        title_font = fit_text(draw, title, title_font, width - title_x - width // 10)
        draw.text((title_x, title_top), title, fill=TEXT_COLOR, font=title_font)
        subtitle = "Together. Grow. Prosper."
        draw.text((title_x, title_top + getattr(title_font, "size", 28) + height // 30), subtitle, fill=SUBTEXT_COLOR, font=subtitle_font)
    else:
        plate_size = int(min(width, height) * 0.52)
        card = make_card(plate_size, plate_size, SPLASH_LOGO_RATIO)
        card_x = width // 2 - plate_size // 2
        card_y = height // 2 - plate_size
        canvas.alpha_composite(card, (card_x, card_y))

        title = "CHAMA360"
        subtitle = "Together. Grow. Prosper."
        title_font = load_font(max(28, width // 10), bold=True)
        subtitle_font = load_font(max(16, width // 16), bold=False)
        title_font = fit_text(draw, title, title_font, int(width * 0.78))
        bbox = draw.textbbox((0, 0), title, font=title_font)
        title_w = bbox[2] - bbox[0]
        text_x = width // 2 - title_w // 2
        title_y = card_y + plate_size + height // 28
        draw.text((text_x, title_y), title, fill=TEXT_COLOR, font=title_font)
        sub_bbox = draw.textbbox((0, 0), subtitle, font=subtitle_font)
        sub_w = sub_bbox[2] - sub_bbox[0]
        sub_x = width // 2 - sub_w // 2
        draw.text((sub_x, title_y + getattr(title_font, "size", 28) + height // 45), subtitle, fill=SUBTEXT_COLOR, font=subtitle_font)

    return canvas


def write_png(image: Image.Image, path: Path) -> None:
    ensure_parent(path)
    image.save(path, format="PNG")


def write_android_resources() -> None:
    # Launcher colors and theme colors.
    colors_xml = """<?xml version=\"1.0\" encoding=\"utf-8\"?>
<resources>
    <color name=\"colorPrimary\">#0B8F68</color>
    <color name=\"colorPrimaryDark\">#075B45</color>
    <color name=\"colorAccent\">#D9A441</color>
</resources>
"""
    ensure_parent(RES_DIR / "values" / "colors.xml")
    (RES_DIR / "values" / "colors.xml").write_text(colors_xml, encoding="utf-8")
    (RES_DIR / "values" / "ic_launcher_background.xml").write_text(
        """<?xml version=\"1.0\" encoding=\"utf-8\"?>
<resources>
    <color name=\"ic_launcher_background\">#F5FBF8</color>
</resources>
""",
        encoding="utf-8",
    )


def generate_assets() -> None:
    MOBILE_ASSET_DIR.mkdir(parents=True, exist_ok=True)

    icon_master = make_icon(ICON_BASE)
    write_png(icon_master, MOBILE_ASSET_DIR / "icon-master.png")

    splash_portrait = make_splash(1440, 2560)
    splash_landscape = make_splash(2560, 1440)
    write_png(splash_portrait, MOBILE_ASSET_DIR / "splash-portrait.png")
    write_png(splash_landscape, MOBILE_ASSET_DIR / "splash-landscape.png")

    for density, scale in DENSITIES.items():
        icon_size = int(48 * scale)
        foreground_size = int(108 * scale)
        port_w = int(320 * scale)
        port_h = int(480 * scale)
        land_w = int(480 * scale)
        land_h = int(320 * scale)

        write_png(icon_master.resize((icon_size, icon_size), Image.Resampling.LANCZOS), RES_DIR / f"mipmap-{density}" / "ic_launcher.png")
        write_png(icon_master.resize((icon_size, icon_size), Image.Resampling.LANCZOS), RES_DIR / f"mipmap-{density}" / "ic_launcher_round.png")
        write_png(make_foreground(foreground_size), RES_DIR / f"mipmap-{density}" / "ic_launcher_foreground.png")

        write_png(make_splash(port_w, port_h), RES_DIR / f"drawable-port-{density}" / "splash.png")
        write_png(make_splash(land_w, land_h), RES_DIR / f"drawable-land-{density}" / "splash.png")

    write_android_resources()


if __name__ == "__main__":
    if not LOGO_PATH.exists():
        raise SystemExit(f"Missing logo source at {LOGO_PATH}")
    if not ICON_PATH.exists():
        raise SystemExit(f"Missing icon source at {ICON_PATH}")
    generate_assets()
    print("Generated Android icon and splash assets.")
