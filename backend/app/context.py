"""Recherche de contexte pour enrichir un moment.

Selon la catégorie, on interroge une source ouverte (sans clé payante) et on
normalise les résultats en fiches : {kind, title, subtitle, image, rating, source}.

- cinema / video : TVMaze (séries, note communautaire) + iTunes (films)
- livre / etude  : Open Library (couverture, auteur, note communautaire)
- sport          : TheSportsDB (matchs : équipes, score, affiche)
- cafe / repas / sortie : OpenStreetMap Nominatim (lieux réels)

La détection automatique depuis la photo pourra remplir les mêmes fiches
plus tard — l'interface (une fiche `context` sur l'event) ne changera pas.
"""

import json
import time
import urllib.parse
import urllib.request

UA = {"User-Agent": "MomentsApp/1.0 (student project)"}
TIMEOUT = 6

# Petit cache mémoire pour ne pas marteler les APIs (question -> (ts, résultats))
_cache: dict[str, tuple[float, list[dict]]] = {}
_CACHE_TTL = 600


def _get_json(url: str):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        return json.loads(resp.read())


def _q(s: str) -> str:
    return urllib.parse.quote(s.strip())


def _search_shows(query: str) -> list[dict]:
    out = []
    try:
        for item in _get_json(f"https://api.tvmaze.com/search/shows?q={_q(query)}")[:4]:
            show = item.get("show") or {}
            year = (show.get("premiered") or "")[:4]
            out.append({
                "kind": "serie",
                "title": show.get("name"),
                "subtitle": f"Série · {year}" if year else "Série",
                "image": (show.get("image") or {}).get("medium"),
                "rating": (show.get("rating") or {}).get("average"),
                "source": "TVMaze",
            })
    except Exception:
        pass
    try:
        data = _get_json(
            f"https://itunes.apple.com/search?term={_q(query)}&media=movie&limit=4"
        )
        for m in data.get("results", []):
            year = (m.get("releaseDate") or "")[:4]
            out.append({
                "kind": "film",
                "title": m.get("trackName"),
                "subtitle": f"Film · {year}" if year else "Film",
                "image": m.get("artworkUrl100"),
                "rating": None,
                "source": "iTunes",
            })
    except Exception:
        pass
    return out


def _search_books(query: str) -> list[dict]:
    out = []
    try:
        data = _get_json(
            "https://openlibrary.org/search.json?limit=6&fields="
            "title,author_name,first_publish_year,cover_i,ratings_average"
            f"&q={_q(query)}"
        )
        for b in data.get("docs", []):
            author = (b.get("author_name") or [None])[0]
            year = b.get("first_publish_year")
            sub = " · ".join(str(x) for x in [author, year] if x)
            cover = b.get("cover_i")
            rating = b.get("ratings_average")
            out.append({
                "kind": "livre",
                "title": b.get("title"),
                "subtitle": sub or "Livre",
                "image": f"https://covers.openlibrary.org/b/id/{cover}-M.jpg" if cover else None,
                "rating": round(rating, 1) if rating else None,
                "source": "Open Library",
            })
    except Exception:
        pass
    return out


def _search_matches(query: str) -> list[dict]:
    out = []
    try:
        data = _get_json(
            f"https://www.thesportsdb.com/api/v1/json/3/searchevents.php?e={_q(query)}"
        )
        for e in (data.get("event") or [])[:6]:
            score = None
            if e.get("intHomeScore") is not None and e.get("intAwayScore") is not None:
                score = f"{e['intHomeScore']} – {e['intAwayScore']}"
            sub = " · ".join(x for x in [e.get("strLeague"), e.get("dateEvent"), score] if x)
            out.append({
                "kind": "match",
                "title": e.get("strEvent"),
                "subtitle": sub or "Match",
                "image": e.get("strThumb"),
                "rating": None,
                "source": "TheSportsDB",
            })
    except Exception:
        pass
    return out


def _search_places(query: str, city: str = "") -> list[dict]:
    out = []
    try:
        full = f"{query} {city}".strip()
        data = _get_json(
            f"https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q={_q(full)}"
        )
        for p in data:
            name = p.get("name") or p.get("display_name", "").split(",")[0]
            parts = [x.strip() for x in p.get("display_name", "").split(",")]
            sub = ", ".join(parts[1:3]) if len(parts) > 1 else (p.get("type") or "Lieu")
            out.append({
                "kind": "lieu",
                "title": name,
                "subtitle": sub,
                "image": None,
                "rating": None,
                "source": "OpenStreetMap",
            })
    except Exception:
        pass
    return out


def search_context(category: str, query: str, city: str = "") -> list[dict]:
    """Fiches candidates pour une catégorie + requête. Résultats mis en cache."""
    key = f"{category}|{query.lower().strip()}|{city.lower().strip()}"
    now = time.time()
    hit = _cache.get(key)
    if hit and now - hit[0] < _CACHE_TTL:
        return hit[1]

    if category in ("cinema", "video"):
        results = _search_shows(query)
    elif category in ("livre", "etude"):
        results = _search_books(query)
    elif category == "sport":
        results = _search_matches(query)
    elif category in ("cafe", "repas", "sortie"):
        results = _search_places(query, city)
    else:
        results = []

    results = [r for r in results if r.get("title")][:6]
    _cache[key] = (now, results)
    return results
