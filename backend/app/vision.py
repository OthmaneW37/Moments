"""Analyse d'image locale pour l'auto-tagging des photos.

Approche 100 % locale (Pillow, pas d'API externe) : on calcule la luminosité,
la température de couleur et la saturation des pixels pour en déduire des tags
d'ambiance. Le tag « sémantique » (ciné, café...) vient de la catégorie du moment.

Ce module expose `analyze_photo()` qui renvoie une liste de tags. L'interface est
conçue pour pouvoir brancher plus tard un vrai modèle de vision (ex. un modèle
HuggingFace) en remplaçant l'implémentation, sans toucher au reste de l'app.
"""
from pathlib import Path

try:
    from PIL import Image
    _PIL_OK = True
except ImportError:  # dégradation propre si Pillow absent
    _PIL_OK = False

CATEGORY_TAG = {
    "cinema": "🎬 Ciné",
    "cafe": "☕ Café",
    "sport": "🏟️ Sport",
    "video": "📺 Écran",
    "sortie": "🌆 Sortie",
    "etude": "📚 Studieux",
    "repas": "🍽️ Food",
    "autre": None,
}


def _ambiance_tags(path: Path) -> list[str]:
    """Tags dérivés de l'analyse réelle des pixels."""
    tags: list[str] = []
    try:
        with Image.open(path) as im:
            im = im.convert("RGB")
            im.thumbnail((80, 80))  # sous-échantillonnage : rapide et suffisant
            pixels = list(im.getdata())
    except Exception:
        return tags

    n = len(pixels)
    if n == 0:
        return tags

    r_sum = g_sum = b_sum = 0
    lum_sum = 0.0
    sat_sum = 0.0
    for r, g, b in pixels:
        r_sum += r
        g_sum += g
        b_sum += b
        lum_sum += 0.299 * r + 0.587 * g + 0.114 * b
        mx, mn = max(r, g, b), min(r, g, b)
        sat_sum += 0 if mx == 0 else (mx - mn) / mx

    avg_lum = lum_sum / n          # 0..255
    avg_sat = sat_sum / n          # 0..1
    avg_r, avg_b = r_sum / n, b_sum / n

    # Luminosité -> jour / soirée
    if avg_lum >= 145:
        tags.append("☀️ Lumineux")
    elif avg_lum <= 70:
        tags.append("🌙 Soirée")

    # Température de couleur -> chaud / froid
    if avg_r - avg_b > 25:
        tags.append("🔥 Tons chauds")
    elif avg_b - avg_r > 25:
        tags.append("❄️ Tons froids")

    # Saturation -> coloré / sobre
    if avg_sat >= 0.45:
        tags.append("🎨 Coloré")
    elif avg_sat <= 0.12:
        tags.append("🖤 Sobre")

    return tags


def analyze_photo(path: Path, category: str) -> list[str]:
    """Renvoie jusqu'à ~4 tags pour une photo : 1 sémantique (catégorie) + ambiance."""
    tags: list[str] = []
    semantic = CATEGORY_TAG.get(category)
    if semantic:
        tags.append(semantic)
    if _PIL_OK:
        tags.extend(_ambiance_tags(path))
    return tags[:4]
