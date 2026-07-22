"""Moments API — Phase 3 : réactions emoji, feed Découverte, auto-tagging & souvenirs.

Chaque utilisateur a son calendrier privé ; les moments capturés (avec photo)
sont visibles par ses amis dans le feed, ou publiquement dans la Découverte.
"""
import json
import re
import uuid
from collections import Counter
from datetime import date as date_cls, datetime, timedelta
from pathlib import Path

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .auth import create_token, current_user, hash_password, verify_password
from .config import DATA_DIR
from .context import search_context
from .db import (friend_ids, follower_ids, following_ids, get_conn, init_db,
                 notify, photos_for_events, row_to_event)
from .vision import analyze_photo

REACTION_EMOJIS = ["❤️", "🔥", "😂", "😍", "😮", "👏"]
VISIBILITIES = {"friends", "public"}

UPLOADS_DIR = DATA_DIR / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
VIDEO_EXT = {".mp4", ".webm", ".mov", ".m4v", ".ogg"}
ALLOWED_EXT = IMAGE_EXT | VIDEO_EXT
CATEGORIES = ["cinema", "livre", "cafe", "sport", "video", "sortie", "etude", "repas", "autre"]

# Clés autorisées dans la fiche contextuelle d'un moment
CONTEXT_KEYS = {"kind", "title", "subtitle", "image", "rating", "source", "my_rating"}
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
USERNAME_RE = re.compile(r"^[a-zA-Z0-9_.]{3,20}$")

app = FastAPI(title="Moments API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    # Auth par jeton Bearer (pas de cookie) → on peut autoriser toutes les
    # origines : navigateur en dev, frontend déployé, et l'app native
    # Capacitor (origines capacitor://localhost, http(s)://localhost…).
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")


@app.on_event("startup")
def _startup() -> None:
    init_db()


# ---------- Schemas ----------

class EventIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    category: str = "autre"
    date: str  # YYYY-MM-DD
    start_time: str | None = None  # HH:MM
    end_time: str | None = None
    notes: str = ""
    visibility: str = "friends"  # friends | public
    context: dict | None = None  # fiche œuvre/match/lieu + note perso


class SignupIn(BaseModel):
    username: str = Field(min_length=3, max_length=20)
    display_name: str = Field(min_length=1, max_length=40)
    password: str = Field(min_length=6, max_length=100)
    emoji: str = "😎"
    city: str = ""


class ProfileUpdateIn(BaseModel):
    city: str | None = Field(default=None, max_length=60)
    is_private: bool | None = None


class ReactionIn(BaseModel):
    emoji: str


class LoginIn(BaseModel):
    username: str
    password: str


class FriendRequestIn(BaseModel):
    username: str


class FriendRespondIn(BaseModel):
    request_id: int
    accept: bool


class CommentIn(BaseModel):
    text: str = Field(min_length=1, max_length=500)


class WorkCommentIn(BaseModel):
    kind: str = Field(min_length=1, max_length=30)
    title: str = Field(min_length=1, max_length=200)
    text: str = Field(min_length=1, max_length=500)


class MessageIn(BaseModel):
    text: str = Field(min_length=1, max_length=1000)


def public_user(row) -> dict:
    keys = row.keys()
    return {
        "id": row["id"],
        "username": row["username"],
        "display_name": row["display_name"],
        "emoji": row["emoji"],
        "city": row["city"] if "city" in keys else "",
        "is_private": bool(row["is_private"]) if "is_private" in keys else False,
    }


# ---------- Auth ----------

@app.post("/api/auth/signup", status_code=201)
def signup(body: SignupIn):
    if not USERNAME_RE.match(body.username):
        raise HTTPException(400, "Pseudo invalide : 3-20 caractères (lettres, chiffres, _ ou .)")
    with get_conn() as conn:
        exists = conn.execute(
            "SELECT id FROM users WHERE username = ?", (body.username,)
        ).fetchone()
        if exists:
            raise HTTPException(409, "Ce pseudo est déjà pris")
        cur = conn.execute(
            "INSERT INTO users (username, display_name, emoji, password_hash, city) "
            "VALUES (?, ?, ?, ?, ?)",
            (body.username, body.display_name, body.emoji or "😎",
             hash_password(body.password), body.city.strip()),
        )
        user_id = cur.lastrowid
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return {"token": create_token(user_id), "user": public_user(row)}


@app.post("/api/auth/login")
def login(body: LoginIn):
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE username = ?", (body.username,)
        ).fetchone()
    if row is None or not verify_password(body.password, row["password_hash"]):
        raise HTTPException(401, "Pseudo ou mot de passe incorrect")
    return {"token": create_token(row["id"]), "user": public_user(row)}


@app.get("/api/auth/me")
def me(user: dict = Depends(current_user)):
    return public_user(user)


@app.put("/api/profile")
def update_profile(body: ProfileUpdateIn, user: dict = Depends(current_user)):
    with get_conn() as conn:
        if body.city is not None:
            conn.execute("UPDATE users SET city = ? WHERE id = ?", (body.city.strip(), user["id"]))
        if body.is_private is not None:
            conn.execute("UPDATE users SET is_private = ? WHERE id = ?", (int(body.is_private), user["id"]))
            # Passage en public : les demandes en attente sont acceptées d'office
            if not body.is_private:
                conn.execute(
                    "UPDATE friendships SET status = 'accepted' WHERE addressee_id = ? AND status = 'pending'",
                    (user["id"],),
                )
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()
    return public_user(row)


# ---------- Events CRUD (privé par compte) ----------

@app.get("/api/categories")
def list_categories():
    return CATEGORIES


@app.get("/api/events")
def list_events(date: str, user: dict = Depends(current_user)):
    if not DATE_RE.match(date):
        raise HTTPException(400, "date must be YYYY-MM-DD")
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM events WHERE date = ? AND user_id = ? "
            "ORDER BY COALESCE(start_time, '99:99'), id",
            (date, user["id"]),
        ).fetchall()
        photo_map = photos_for_events(conn, [r["id"] for r in rows])
        return [row_to_event(r, photo_map.get(r["id"])) for r in rows]


@app.get("/api/events/range")
def events_range(start: str, end: str, user: dict = Depends(current_user)):
    """Résumé par jour (badges de la barre semaine) : nb events / nb photos."""
    if not (DATE_RE.match(start) and DATE_RE.match(end)):
        raise HTTPException(400, "start/end must be YYYY-MM-DD")
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT e.date,
                   COUNT(DISTINCT e.id) AS events,
                   COUNT(p.id)          AS photos
            FROM events e
            LEFT JOIN photos p ON p.event_id = e.id
            WHERE e.date BETWEEN ? AND ? AND e.user_id = ?
            GROUP BY e.date
            """,
            (start, end, user["id"]),
        ).fetchall()
        return {r["date"]: {"events": r["events"], "photos": r["photos"]} for r in rows}


def _clean_context(context: dict | None) -> str:
    """Ne garde que les clés connues de la fiche ; '' si pas de fiche."""
    if not context or not isinstance(context, dict) or not context.get("title"):
        return ""
    clean = {k: v for k, v in context.items() if k in CONTEXT_KEYS and v is not None}
    my = clean.get("my_rating")
    if my is not None:
        try:
            clean["my_rating"] = max(1, min(5, int(my)))
        except (TypeError, ValueError):
            clean.pop("my_rating", None)
    return json.dumps(clean, ensure_ascii=False)


@app.get("/api/context/search")
def context_search(category: str, q: str, user: dict = Depends(current_user)):
    """Fiches candidates (film/série, livre, match, lieu) pour enrichir un moment."""
    if len(q.strip()) < 2:
        return []
    return search_context(category, q, city=user.get("city") or "")


@app.post("/api/events", status_code=201)
def create_event(body: EventIn, user: dict = Depends(current_user)):
    if not DATE_RE.match(body.date):
        raise HTTPException(400, "date must be YYYY-MM-DD")
    if body.category not in CATEGORIES:
        raise HTTPException(400, f"category must be one of {CATEGORIES}")
    visibility = body.visibility if body.visibility in VISIBILITIES else "friends"
    context_json = _clean_context(body.context)
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO events (title, category, date, start_time, end_time, notes, user_id, visibility, context) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (body.title, body.category, body.date, body.start_time, body.end_time,
             body.notes, user["id"], visibility, context_json),
        )
        row = conn.execute("SELECT * FROM events WHERE id = ?", (cur.lastrowid,)).fetchone()
        return row_to_event(row)


@app.put("/api/events/{event_id}")
def update_event(event_id: int, body: EventIn, user: dict = Depends(current_user)):
    if body.category not in CATEGORIES:
        raise HTTPException(400, f"category must be one of {CATEGORIES}")
    visibility = body.visibility if body.visibility in VISIBILITIES else "friends"
    context_json = _clean_context(body.context)
    with get_conn() as conn:
        cur = conn.execute(
            "UPDATE events SET title=?, category=?, date=?, start_time=?, end_time=?, notes=?, visibility=?, context=? "
            "WHERE id=? AND user_id=?",
            (body.title, body.category, body.date, body.start_time, body.end_time,
             body.notes, visibility, context_json, event_id, user["id"]),
        )
        if cur.rowcount == 0:
            raise HTTPException(404, "event not found")
        row = conn.execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone()
        photo_map = photos_for_events(conn, [event_id])
        return row_to_event(row, photo_map.get(event_id))


@app.delete("/api/events/{event_id}", status_code=204)
def delete_event(event_id: int, user: dict = Depends(current_user)):
    with get_conn() as conn:
        photos = conn.execute(
            "SELECT p.filename FROM photos p JOIN events e ON e.id = p.event_id "
            "WHERE p.event_id = ? AND e.user_id = ?",
            (event_id, user["id"]),
        ).fetchall()
        cur = conn.execute(
            "DELETE FROM events WHERE id = ? AND user_id = ?", (event_id, user["id"])
        )
        if cur.rowcount == 0:
            raise HTTPException(404, "event not found")
    for p in photos:  # remove files after the DB commit
        (UPLOADS_DIR / p["filename"]).unlink(missing_ok=True)


# ---------- Photos ----------

@app.post("/api/events/{event_id}/photos", status_code=201)
def upload_photo(event_id: int, file: UploadFile = File(...), user: dict = Depends(current_user)):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(400, f"file type must be one of {sorted(ALLOWED_EXT)}")
    is_video = ext in VIDEO_EXT
    with get_conn() as conn:
        event = conn.execute(
            "SELECT id, category FROM events WHERE id = ? AND user_id = ?", (event_id, user["id"])
        ).fetchone()
        if event is None:
            raise HTTPException(404, "event not found")
        filename = f"{event_id}_{uuid.uuid4().hex[:12]}{ext}"
        path = UPLOADS_DIR / filename
        path.write_bytes(file.file.read())
        # Auto-tagging seulement pour les images (analyse de pixels)
        tags = [] if is_video else analyze_photo(path, event["category"])
        media_type = "video" if is_video else "photo"
        cur = conn.execute(
            "INSERT INTO photos (event_id, filename, tags, media_type) VALUES (?, ?, ?, ?)",
            (event_id, filename, json.dumps(tags), media_type),
        )
        return {"id": cur.lastrowid, "url": f"/uploads/{filename}", "tags": tags, "media_type": media_type}


@app.delete("/api/photos/{photo_id}", status_code=204)
def delete_photo(photo_id: int, user: dict = Depends(current_user)):
    with get_conn() as conn:
        row = conn.execute(
            "SELECT p.filename FROM photos p JOIN events e ON e.id = p.event_id "
            "WHERE p.id = ? AND e.user_id = ?",
            (photo_id, user["id"]),
        ).fetchone()
        if row is None:
            raise HTTPException(404, "photo not found")
        conn.execute("DELETE FROM photos WHERE id = ?", (photo_id,))
    (UPLOADS_DIR / row["filename"]).unlink(missing_ok=True)


# ---------- Amis ----------

# ---------- Abonnements (follow, façon réseau social) ----------

def _follow_state(conn, me: int, target: int) -> str:
    """none | pending | following (moi -> target)."""
    row = conn.execute(
        "SELECT status FROM friendships WHERE requester_id = ? AND addressee_id = ?",
        (me, target),
    ).fetchone()
    if row is None:
        return "none"
    return "following" if row["status"] == "accepted" else "pending"


@app.post("/api/users/{username}/follow")
def toggle_follow(username: str, user: dict = Depends(current_user)):
    """S'abonner / annuler la demande / se désabonner (toggle).
    Compte public -> abonnement immédiat ; compte privé -> demande en attente."""
    with get_conn() as conn:
        target = conn.execute(
            "SELECT * FROM users WHERE username = ?", (username.lower().strip(),)
        ).fetchone()
        if target is None:
            raise HTTPException(404, "Aucun utilisateur avec ce pseudo")
        if target["id"] == user["id"]:
            raise HTTPException(400, "Tu ne peux pas t'abonner à toi-même 😅")
        state = _follow_state(conn, user["id"], target["id"])
        if state != "none":
            # Déjà abonné ou demande envoyée -> on annule
            conn.execute(
                "DELETE FROM friendships WHERE requester_id = ? AND addressee_id = ?",
                (user["id"], target["id"]),
            )
            new_state = "none"
        else:
            is_private = bool(target["is_private"]) if "is_private" in target.keys() else False
            status = "pending" if is_private else "accepted"
            conn.execute(
                "INSERT INTO friendships (requester_id, addressee_id, status) VALUES (?, ?, ?)",
                (user["id"], target["id"], status),
            )
            notify(conn, target["id"], user["id"],
                   "follow_request" if status == "pending" else "follow")
            new_state = "pending" if status == "pending" else "following"
        followers = len(follower_ids(conn, target["id"]))
    return {"state": new_state, "followers": followers}


@app.get("/api/follow/requests")
def follow_requests(user: dict = Depends(current_user)):
    """Demandes d'abonnement en attente (pour un compte privé)."""
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT f.id AS request_id, u.id, u.username, u.display_name, u.emoji, u.city
            FROM friendships f JOIN users u ON u.id = f.requester_id
            WHERE f.addressee_id = ? AND f.status = 'pending'
            ORDER BY f.created_at DESC
            """,
            (user["id"],),
        ).fetchall()
    return [{**public_user(r), "request_id": r["request_id"]} for r in rows]


@app.post("/api/follow/respond")
def respond_follow_request(body: FriendRespondIn, user: dict = Depends(current_user)):
    """Accepter / refuser une demande d'abonnement reçue."""
    with get_conn() as conn:
        req = conn.execute(
            "SELECT * FROM friendships WHERE id = ? AND addressee_id = ? AND status = 'pending'",
            (body.request_id, user["id"]),
        ).fetchone()
        if req is None:
            raise HTTPException(404, "Demande introuvable")
        if body.accept:
            conn.execute(
                "UPDATE friendships SET status = 'accepted' WHERE id = ?", (body.request_id,)
            )
            notify(conn, req["requester_id"], user["id"], "follow_accept")
        else:
            conn.execute("DELETE FROM friendships WHERE id = ?", (body.request_id,))
    return {"ok": True}


def _user_list(conn, rows, me: int) -> list[dict]:
    out = []
    for r in rows:
        out.append({**public_user(r), "is_me": r["id"] == me,
                    "follow_state": _follow_state(conn, me, r["id"])})
    return out


@app.get("/api/users/{username}/followers")
def list_followers(username: str, user: dict = Depends(current_user)):
    with get_conn() as conn:
        target = conn.execute("SELECT * FROM users WHERE username = ?",
                              (username.lower().strip(),)).fetchone()
        if target is None:
            raise HTTPException(404, "utilisateur introuvable")
        _require_profile_access(conn, user["id"], target)
        rows = conn.execute(
            """
            SELECT u.* FROM friendships f JOIN users u ON u.id = f.requester_id
            WHERE f.addressee_id = ? AND f.status = 'accepted' ORDER BY u.display_name
            """,
            (target["id"],),
        ).fetchall()
        return _user_list(conn, rows, user["id"])


@app.get("/api/users/{username}/following")
def list_following(username: str, user: dict = Depends(current_user)):
    with get_conn() as conn:
        target = conn.execute("SELECT * FROM users WHERE username = ?",
                              (username.lower().strip(),)).fetchone()
        if target is None:
            raise HTTPException(404, "utilisateur introuvable")
        _require_profile_access(conn, user["id"], target)
        rows = conn.execute(
            """
            SELECT u.* FROM friendships f JOIN users u ON u.id = f.addressee_id
            WHERE f.requester_id = ? AND f.status = 'accepted' ORDER BY u.display_name
            """,
            (target["id"],),
        ).fetchall()
        return _user_list(conn, rows, user["id"])


def _require_profile_access(conn, me: int, target) -> None:
    """Un profil privé n'expose ses listes/moments qu'à ses abonnés (et à lui-même)."""
    is_private = bool(target["is_private"]) if "is_private" in target.keys() else False
    if not is_private or target["id"] == me:
        return
    if target["id"] not in following_ids(conn, me):
        raise HTTPException(403, "Compte privé — abonne-toi pour voir")


# ---------- Feed social ----------

def _enrich_moments(conn, rows, user_id: int) -> list[dict]:
    """Transforme des lignes d'events (jointes à users) en moments avec réactions/commentaires."""
    photo_map = photos_for_events(conn, [r["id"] for r in rows])
    event_ids = [r["id"] for r in rows]
    reactions: dict[int, dict[str, int]] = {}
    comment_counts: dict[int, int] = {}
    my_reaction: dict[int, str] = {}
    if event_ids:
        ph = ",".join("?" * len(event_ids))
        for r in conn.execute(
            f"SELECT event_id, emoji, COUNT(*) AS n FROM likes WHERE event_id IN ({ph}) "
            f"GROUP BY event_id, emoji",
            event_ids,
        ).fetchall():
            reactions.setdefault(r["event_id"], {})[r["emoji"]] = r["n"]
        for r in conn.execute(
            f"SELECT event_id, COUNT(*) AS n FROM comments WHERE event_id IN ({ph}) GROUP BY event_id",
            event_ids,
        ).fetchall():
            comment_counts[r["event_id"]] = r["n"]
        for r in conn.execute(
            f"SELECT event_id, emoji FROM likes WHERE user_id = ? AND event_id IN ({ph})",
            [user_id, *event_ids],
        ).fetchall():
            my_reaction[r["event_id"]] = r["emoji"]

    out = []
    for r in rows:
        evt = row_to_event(r, photo_map.get(r["id"]))
        evt["author"] = {
            "username": r["username"],
            "display_name": r["display_name"],
            "emoji": r["emoji"],
            "is_me": r["user_id"] == user_id,
        }
        rx = reactions.get(r["id"], {})
        evt["reactions"] = rx
        evt["reaction_total"] = sum(rx.values())
        evt["my_reaction"] = my_reaction.get(r["id"])
        evt["comments"] = comment_counts.get(r["id"], 0)
        out.append(evt)
    return out


@app.get("/api/feed")
def feed(user: dict = Depends(current_user)):
    """Moments capturés (>= 1 photo) de mes amis et moi, plus récents d'abord."""
    with get_conn() as conn:
        ids = friend_ids(conn, user["id"]) + [user["id"]]
        placeholders = ",".join("?" * len(ids))
        rows = conn.execute(
            f"""
            SELECT DISTINCT e.*, u.username, u.display_name, u.emoji
            FROM events e
            JOIN photos p ON p.event_id = e.id
            JOIN users u ON u.id = e.user_id
            WHERE e.user_id IN ({placeholders})
            ORDER BY e.date DESC, COALESCE(e.start_time, '99:99') DESC, e.id DESC
            LIMIT 100
            """,
            ids,
        ).fetchall()
        return _enrich_moments(conn, rows, user["id"])


@app.get("/api/events/{event_id}/moment")
def event_moment(event_id: int, user: dict = Depends(current_user)):
    """Un moment enrichi par id — pour ouvrir directement depuis une notification."""
    with get_conn() as conn:
        _can_see_event(conn, event_id, user["id"])  # 404/403 selon visibilité
        row = conn.execute(
            """
            SELECT e.*, u.username, u.display_name, u.emoji
            FROM events e JOIN users u ON u.id = e.user_id WHERE e.id = ?
            """,
            (event_id,),
        ).fetchone()
        moments = _enrich_moments(conn, [row], user["id"])
        if not moments or not moments[0]["photos"]:
            raise HTTPException(404, "Ce moment n'a plus de média")
        return moments[0]


@app.get("/api/discover")
def discover(user: dict = Depends(current_user)):
    """Moments PUBLICS des autres — en priorité de ta ville, puis le reste."""
    with get_conn() as conn:
        my_ids = set(friend_ids(conn, user["id"]) + [user["id"]])
        city = (user.get("city") or "").strip().lower()
        rows = conn.execute(
            """
            SELECT DISTINCT e.*, u.username, u.display_name, u.emoji, u.city,
                   (LOWER(TRIM(u.city)) = ? AND ? <> '') AS same_city
            FROM events e
            JOIN photos p ON p.event_id = e.id
            JOIN users u ON u.id = e.user_id
            WHERE e.visibility = 'public' AND u.is_private = 0
            ORDER BY same_city DESC, e.date DESC, COALESCE(e.start_time, '99:99') DESC, e.id DESC
            LIMIT 100
            """,
            (city, city),
        ).fetchall()
        # Exclut mes propres moments et ceux de mes amis (déjà dans le feed)
        rows = [r for r in rows if r["user_id"] not in my_ids]
        moments = _enrich_moments(conn, rows, user["id"])
        for evt, r in zip(moments, rows):
            evt["author"]["city"] = r["city"]
            evt["same_city"] = bool(r["same_city"])
        return {"city": user.get("city", ""), "moments": moments}


@app.post("/api/events/{event_id}/react")
def react(event_id: int, body: ReactionIn, user: dict = Depends(current_user)):
    """Pose / change / retire une réaction emoji. Renvoyer le même emoji = retirer."""
    if body.emoji not in REACTION_EMOJIS:
        raise HTTPException(400, f"emoji must be one of {REACTION_EMOJIS}")
    with get_conn() as conn:
        _can_see_event(conn, event_id, user["id"])
        evt = conn.execute("SELECT user_id, visibility FROM events WHERE id = ?", (event_id,)).fetchone()
        existing = conn.execute(
            "SELECT id, emoji FROM likes WHERE user_id = ? AND event_id = ?", (user["id"], event_id)
        ).fetchone()
        if existing and existing["emoji"] == body.emoji:
            conn.execute("DELETE FROM likes WHERE id = ?", (existing["id"],))
            mine = None
        elif existing:
            conn.execute("UPDATE likes SET emoji = ? WHERE id = ?", (body.emoji, existing["id"]))
            mine = body.emoji
        else:
            conn.execute(
                "INSERT INTO likes (user_id, event_id, emoji) VALUES (?, ?, ?)",
                (user["id"], event_id, body.emoji),
            )
            mine = body.emoji
            notify(conn, evt["user_id"], user["id"], "like", event_id)
        breakdown = {
            r["emoji"]: r["n"]
            for r in conn.execute(
                "SELECT emoji, COUNT(*) AS n FROM likes WHERE event_id = ? GROUP BY emoji",
                (event_id,),
            ).fetchall()
        }
    return {"my_reaction": mine, "reactions": breakdown, "reaction_total": sum(breakdown.values())}


# ---------- Commentaires ----------

def _can_see_event(conn, event_id: int, user_id: int):
    """L'event existe et est visible -> row, sinon 404/403.
    Visible si : c'est le mien, OU je suis abonné à l'auteur, OU l'event est
    public ET l'auteur n'est pas un compte privé."""
    evt = conn.execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone()
    if evt is None:
        raise HTTPException(404, "event not found")
    if evt["user_id"] == user_id or evt["user_id"] in following_ids(conn, user_id):
        return evt
    author = conn.execute("SELECT is_private FROM users WHERE id = ?", (evt["user_id"],)).fetchone()
    if evt["visibility"] == "public" and author and not author["is_private"]:
        return evt
    raise HTTPException(403, "Réservé aux abonnés")


@app.get("/api/events/{event_id}/reactions")
def event_reactions(event_id: int, user: dict = Depends(current_user)):
    """Qui a réagi avec quoi sur un moment visible."""
    with get_conn() as conn:
        _can_see_event(conn, event_id, user["id"])
        rows = conn.execute(
            """
            SELECT l.emoji AS reaction, u.username, u.display_name, u.emoji,
                   (l.user_id = ?) AS is_me
            FROM likes l JOIN users u ON u.id = l.user_id
            WHERE l.event_id = ?
            ORDER BY l.created_at
            """,
            (user["id"], event_id),
        ).fetchall()
        return [dict(r) for r in rows]


@app.get("/api/events/{event_id}/comments")
def list_comments(event_id: int, user: dict = Depends(current_user)):
    with get_conn() as conn:
        _can_see_event(conn, event_id, user["id"])
        rows = conn.execute(
            """
            SELECT c.id, c.text, c.created_at, u.username, u.display_name, u.emoji,
                   (c.user_id = ?) AS is_me
            FROM comments c JOIN users u ON u.id = c.user_id
            WHERE c.event_id = ?
            ORDER BY c.created_at, c.id
            """,
            (user["id"], event_id),
        ).fetchall()
        return [dict(r) for r in rows]


@app.post("/api/events/{event_id}/comments", status_code=201)
def add_comment(event_id: int, body: CommentIn, user: dict = Depends(current_user)):
    with get_conn() as conn:
        evt = _can_see_event(conn, event_id, user["id"])
        cur = conn.execute(
            "INSERT INTO comments (event_id, user_id, text) VALUES (?, ?, ?)",
            (event_id, user["id"], body.text.strip()),
        )
        notify(conn, evt["user_id"], user["id"], "comment", event_id)
        row = conn.execute(
            """
            SELECT c.id, c.text, c.created_at, u.username, u.display_name, u.emoji,
                   1 AS is_me
            FROM comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?
            """,
            (cur.lastrowid,),
        ).fetchone()
        return dict(row)


@app.delete("/api/comments/{comment_id}", status_code=204)
def delete_comment(comment_id: int, user: dict = Depends(current_user)):
    with get_conn() as conn:
        cur = conn.execute(
            "DELETE FROM comments WHERE id = ? AND user_id = ?", (comment_id, user["id"])
        )
        if cur.rowcount == 0:
            raise HTTPException(404, "comment not found")


# ---------- Profils publics & fiches ----------

@app.get("/api/users/{username}")
def user_profile(username: str, user: dict = Depends(current_user)):
    """Page profil d'un utilisateur : infos, compteurs, état d'abonnement,
    et ses moments que J'AI le droit de voir."""
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE username = ?", (username.lower().strip(),)
        ).fetchone()
        if row is None:
            raise HTTPException(404, "utilisateur introuvable")
        target = dict(row)
        is_me = target["id"] == user["id"]
        i_follow = target["id"] in following_ids(conn, user["id"])
        is_private = bool(target.get("is_private", 0))
        locked = is_private and not is_me and not i_follow

        if locked:
            rows = []
        else:
            vis_clause = "" if (is_me or i_follow) else "AND e.visibility = 'public'"
            rows = conn.execute(
                f"""
                SELECT DISTINCT e.*, u.username, u.display_name, u.emoji
                FROM events e
                JOIN photos p ON p.event_id = e.id
                JOIN users u ON u.id = e.user_id
                WHERE e.user_id = ? {vis_clause}
                ORDER BY e.date DESC, COALESCE(e.start_time, '99:99') DESC, e.id DESC
                LIMIT 60
                """,
                (target["id"],),
            ).fetchall()
        moments = _enrich_moments(conn, rows, user["id"])
        stats = conn.execute(
            "SELECT COUNT(DISTINCT p.id) AS photos, COUNT(DISTINCT e.date) AS days "
            "FROM events e JOIN photos p ON p.event_id = e.id WHERE e.user_id = ?",
            (target["id"],),
        ).fetchone()
        return {
            "username": target["username"],
            "display_name": target["display_name"],
            "emoji": target["emoji"],
            "city": target["city"],
            "is_me": is_me,
            "is_private": is_private,
            "locked": locked,
            "follow_state": _follow_state(conn, user["id"], target["id"]),
            "follows_me": user["id"] in following_ids(conn, target["id"]),
            "followers": len(follower_ids(conn, target["id"])),
            "following": len(following_ids(conn, target["id"])),
            "photos": stats["photos"],
            "days": stats["days"],
            "moments": moments,
        }


@app.get("/api/context/detail")
def context_detail(kind: str, title: str, user: dict = Depends(current_user)):
    """Page d'une fiche (film/série/livre/match/lieu) : notes des utilisateurs
    + moments visibles qui en parlent."""
    with get_conn() as conn:
        my_circle = set(following_ids(conn, user["id"]) + [user["id"]])
        rows = conn.execute(
            """
            SELECT DISTINCT e.*, u.username, u.display_name, u.emoji, u.is_private
            FROM events e
            JOIN photos p ON p.event_id = e.id
            JOIN users u ON u.id = e.user_id
            WHERE e.context <> ''
            ORDER BY e.date DESC, e.id DESC
            """
        ).fetchall()
        # Filtre en Python : même fiche (kind+title) ET visible pour moi
        matching = []
        for r in rows:
            try:
                ctx = json.loads(r["context"])
            except (TypeError, ValueError):
                continue
            if ctx.get("kind") != kind or (ctx.get("title") or "").lower() != title.lower():
                continue
            if r["user_id"] not in my_circle and (r["visibility"] != "public" or r["is_private"]):
                continue
            matching.append((r, ctx))
        if not matching:
            raise HTTPException(404, "fiche introuvable")

        moments = _enrich_moments(conn, [r for r, _ in matching], user["id"])
        ratings = [c.get("my_rating") for _, c in matching if c.get("my_rating")]
        fiche = dict(matching[0][1])
        fiche.pop("my_rating", None)
        # Fil de discussion sur l'œuvre (indépendant des moments)
        discussion = conn.execute(
            """
            SELECT w.id, w.text, w.created_at, u.username, u.display_name, u.emoji,
                   (w.user_id = ?) AS is_me
            FROM work_comments w JOIN users u ON u.id = w.user_id
            WHERE w.kind = ? AND w.title_key = ?
            ORDER BY w.created_at, w.id
            """,
            (user["id"], kind, title.lower().strip()),
        ).fetchall()
        return {
            "context": fiche,
            "app_rating": round(sum(ratings) / len(ratings), 1) if ratings else None,
            "app_rating_count": len(ratings),
            "moments": moments,
            "discussion": [dict(r) for r in discussion],
        }


@app.post("/api/work/comments", status_code=201)
def add_work_comment(body: WorkCommentIn, user: dict = Depends(current_user)):
    """Poster un message dans le fil de discussion d'une œuvre/fiche."""
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO work_comments (kind, title_key, title, user_id, text) VALUES (?, ?, ?, ?, ?)",
            (body.kind, body.title.lower().strip(), body.title.strip(), user["id"], body.text.strip()),
        )
        row = conn.execute(
            """
            SELECT w.id, w.text, w.created_at, u.username, u.display_name, u.emoji, 1 AS is_me
            FROM work_comments w JOIN users u ON u.id = w.user_id WHERE w.id = ?
            """,
            (cur.lastrowid,),
        ).fetchone()
        return dict(row)


@app.delete("/api/work/comments/{comment_id}", status_code=204)
def delete_work_comment(comment_id: int, user: dict = Depends(current_user)):
    with get_conn() as conn:
        cur = conn.execute(
            "DELETE FROM work_comments WHERE id = ? AND user_id = ?", (comment_id, user["id"])
        )
        if cur.rowcount == 0:
            raise HTTPException(404, "comment not found")


# ---------- Recherche de comptes ----------

@app.get("/api/search/users")
def search_users(q: str, user: dict = Depends(current_user)):
    """Recherche de comptes par pseudo ou nom (préfixe / sous-chaîne)."""
    term = q.strip()
    if len(term) < 1:
        return []
    like = f"%{term}%"
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT * FROM users
            WHERE (username LIKE ? OR display_name LIKE ?) AND id != ?
            ORDER BY
                CASE WHEN username LIKE ? THEN 0 ELSE 1 END,
                display_name
            LIMIT 25
            """,
            (like, like, user["id"], f"{term}%"),
        ).fetchall()
        return _user_list(conn, rows, user["id"])


# ---------- Partage public d'un moment ----------

@app.post("/api/events/{event_id}/share")
def share_event(event_id: int, user: dict = Depends(current_user)):
    """Génère (ou renvoie) un lien de partage public en lecture seule pour MON moment."""
    with get_conn() as conn:
        evt = conn.execute(
            "SELECT id, share_token FROM events WHERE id = ? AND user_id = ?",
            (event_id, user["id"]),
        ).fetchone()
        if evt is None:
            raise HTTPException(404, "event not found")
        token = evt["share_token"]
        if not token:
            token = uuid.uuid4().hex[:16]
            conn.execute("UPDATE events SET share_token = ? WHERE id = ?", (token, event_id))
    return {"token": token, "path": f"/s/{token}"}


@app.get("/api/shared/{token}")
def shared_event(token: str):
    """Vue publique d'un moment partagé — AUCUNE authentification requise."""
    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT e.*, u.username, u.display_name, u.emoji, u.city
            FROM events e JOIN users u ON u.id = e.user_id
            WHERE e.share_token = ?
            """,
            (token,),
        ).fetchone()
        if row is None:
            raise HTTPException(404, "Lien invalide ou expiré")
        photo_map = photos_for_events(conn, [row["id"]])
        evt = row_to_event(row, photo_map.get(row["id"]))
        evt["author"] = {
            "username": row["username"], "display_name": row["display_name"],
            "emoji": row["emoji"], "city": row["city"],
        }
        rx = {
            r["emoji"]: r["n"]
            for r in conn.execute(
                "SELECT emoji, COUNT(*) AS n FROM likes WHERE event_id = ? GROUP BY emoji",
                (row["id"],),
            ).fetchall()
        }
        evt["reactions"] = rx
        evt["reaction_total"] = sum(rx.values())
        return evt


# ---------- Messagerie privée (DM) ----------

def _get_or_create_conv(conn, u1: int, u2: int) -> int:
    a, b = sorted((u1, u2))
    row = conn.execute(
        "SELECT id FROM conversations WHERE user_a = ? AND user_b = ?", (a, b)
    ).fetchone()
    if row:
        return row["id"]
    cur = conn.execute("INSERT INTO conversations (user_a, user_b) VALUES (?, ?)", (a, b))
    return cur.lastrowid


@app.get("/api/conversations")
def list_conversations(user: dict = Depends(current_user)):
    """Liste des conversations, avec dernier message et compteur de non-lus."""
    with get_conn() as conn:
        convs = conn.execute(
            """
            SELECT c.id,
                   CASE WHEN c.user_a = ? THEN c.user_b ELSE c.user_a END AS other_id
            FROM conversations c
            WHERE c.user_a = ? OR c.user_b = ?
            """,
            (user["id"], user["id"], user["id"]),
        ).fetchall()
        out = []
        for c in convs:
            other = conn.execute("SELECT * FROM users WHERE id = ?", (c["other_id"],)).fetchone()
            last = conn.execute(
                "SELECT text, created_at, sender_id FROM messages WHERE conv_id = ? "
                "ORDER BY id DESC LIMIT 1",
                (c["id"],),
            ).fetchone()
            if last is None:
                continue  # conversation vide, on ne l'affiche pas
            unread = conn.execute(
                "SELECT COUNT(*) AS n FROM messages WHERE conv_id = ? AND sender_id != ? AND read = 0",
                (c["id"], user["id"]),
            ).fetchone()["n"]
            out.append({
                "id": c["id"],
                "other": public_user(other),
                "last_text": last["text"],
                "last_at": last["created_at"],
                "last_from_me": last["sender_id"] == user["id"],
                "unread": unread,
            })
        out.sort(key=lambda x: x["last_at"], reverse=True)
        total_unread = sum(x["unread"] for x in out)
        return {"conversations": out, "unread": total_unread}


@app.get("/api/conversations/with/{username}")
def open_conversation(username: str, user: dict = Depends(current_user)):
    """Ouvre (ou crée) la conversation avec un utilisateur et renvoie ses messages."""
    with get_conn() as conn:
        other = conn.execute(
            "SELECT * FROM users WHERE username = ?", (username.lower().strip(),)
        ).fetchone()
        if other is None:
            raise HTTPException(404, "utilisateur introuvable")
        if other["id"] == user["id"]:
            raise HTTPException(400, "Tu ne peux pas t'écrire à toi-même")
        conv_id = _get_or_create_conv(conn, user["id"], other["id"])
        conn.execute(
            "UPDATE messages SET read = 1 WHERE conv_id = ? AND sender_id != ?",
            (conv_id, user["id"]),
        )
        msgs = conn.execute(
            "SELECT id, sender_id, text, created_at, (sender_id = ?) AS is_me "
            "FROM messages WHERE conv_id = ? ORDER BY id",
            (user["id"], conv_id),
        ).fetchall()
        return {"conv_id": conv_id, "other": public_user(other),
                "messages": [dict(m) for m in msgs]}


@app.post("/api/conversations/with/{username}", status_code=201)
def send_message(username: str, body: MessageIn, user: dict = Depends(current_user)):
    with get_conn() as conn:
        other = conn.execute(
            "SELECT * FROM users WHERE username = ?", (username.lower().strip(),)
        ).fetchone()
        if other is None:
            raise HTTPException(404, "utilisateur introuvable")
        if other["id"] == user["id"]:
            raise HTTPException(400, "Tu ne peux pas t'écrire à toi-même")
        conv_id = _get_or_create_conv(conn, user["id"], other["id"])
        cur = conn.execute(
            "INSERT INTO messages (conv_id, sender_id, text) VALUES (?, ?, ?)",
            (conv_id, user["id"], body.text.strip()),
        )
        notify(conn, other["id"], user["id"], "message")
        row = conn.execute(
            "SELECT id, sender_id, text, created_at, 1 AS is_me FROM messages WHERE id = ?",
            (cur.lastrowid,),
        ).fetchone()
        return dict(row)


# ---------- Notifications ----------

@app.get("/api/notifications")
def list_notifications(user: dict = Depends(current_user)):
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT n.id, n.type, n.event_id, n.read, n.created_at,
                   u.username, u.display_name, u.emoji,
                   e.title AS event_title
            FROM notifications n
            JOIN users u ON u.id = n.actor_id
            LEFT JOIN events e ON e.id = n.event_id
            WHERE n.user_id = ?
            ORDER BY n.created_at DESC, n.id DESC
            LIMIT 50
            """,
            (user["id"],),
        ).fetchall()
        unread = conn.execute(
            "SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read = 0",
            (user["id"],),
        ).fetchone()["n"]
    return {
        "unread": unread,
        "items": [
            {
                "id": r["id"],
                "type": r["type"],
                "event_id": r["event_id"],
                "event_title": r["event_title"],
                "read": bool(r["read"]),
                "created_at": r["created_at"],
                "actor": {
                    "username": r["username"],
                    "display_name": r["display_name"],
                    "emoji": r["emoji"],
                },
            }
            for r in rows
        ],
    }


@app.post("/api/notifications/read")
def mark_notifications_read(user: dict = Depends(current_user)):
    with get_conn() as conn:
        conn.execute(
            "UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0", (user["id"],)
        )
    return {"ok": True}


# ---------- Timeline & stats (perso) ----------

@app.get("/api/timeline")
def timeline(user: dict = Depends(current_user)):
    """Mes moments capturés, groupés par jour, du plus récent au plus ancien."""
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT DISTINCT e.* FROM events e
            JOIN photos p ON p.event_id = e.id
            WHERE e.user_id = ?
            ORDER BY e.date DESC, COALESCE(e.start_time, '99:99')
            """,
            (user["id"],),
        ).fetchall()
        photo_map = photos_for_events(conn, [r["id"] for r in rows])
        days: dict[str, list[dict]] = {}
        for r in rows:
            days.setdefault(r["date"], []).append(row_to_event(r, photo_map.get(r["id"])))
        return [{"date": d, "moments": evts} for d, evts in days.items()]


@app.get("/api/stats")
def stats(user: dict = Depends(current_user)):
    with get_conn() as conn:
        by_cat = conn.execute(
            "SELECT category, COUNT(*) AS n FROM events WHERE user_id = ? "
            "GROUP BY category ORDER BY n DESC",
            (user["id"],),
        ).fetchall()
        totals = conn.execute(
            """
            SELECT (SELECT COUNT(*) FROM events WHERE user_id = :uid) AS events,
                   (SELECT COUNT(*) FROM photos p JOIN events e ON e.id = p.event_id
                    WHERE e.user_id = :uid) AS photos,
                   (SELECT COUNT(DISTINCT date) FROM events WHERE user_id = :uid) AS days,
                   (SELECT COUNT(*) FROM likes l JOIN events e ON e.id = l.event_id
                    WHERE e.user_id = :uid) AS likes_received
            """,
            {"uid": user["id"]},
        ).fetchone()
        # Streak : jours consécutifs (jusqu'à aujourd'hui ou hier) avec >= 1 moment capturé
        captured_days = {
            r["date"]
            for r in conn.execute(
                "SELECT DISTINCT e.date FROM events e JOIN photos p ON p.event_id = e.id "
                "WHERE e.user_id = ?",
                (user["id"],),
            ).fetchall()
        }
        cursor = date_cls.today()
        if cursor.isoformat() not in captured_days:
            cursor -= timedelta(days=1)  # la journée en cours ne casse pas le streak
        streak = 0
        while cursor.isoformat() in captured_days:
            streak += 1
            cursor -= timedelta(days=1)

        return {
            "events": totals["events"],
            "photos": totals["photos"],
            "days": totals["days"],
            "likes_received": totals["likes_received"],
            "streak": streak,
            "by_category": {r["category"]: r["n"] for r in by_cat},
        }


# ---------- Rétro (récap façon « Wrapped ») ----------

def _max_streak(days: set[str]) -> int:
    """Plus longue série de jours consécutifs dans un ensemble de dates ISO."""
    best = 0
    for d in days:
        try:
            cur = datetime.strptime(d, "%Y-%m-%d").date()
        except ValueError:
            continue
        if (cur - timedelta(days=1)).isoformat() in days:
            continue  # pas un début de série
        length = 1
        while (cur + timedelta(days=1)).isoformat() in days:
            cur += timedelta(days=1)
            length += 1
        best = max(best, length)
    return best


@app.get("/api/recap")
def recap(user: dict = Depends(current_user)):
    """Toutes les données de la page Rétro : heatmap, top moment, lifestyle, records."""
    today = date_cls.today()
    with get_conn() as conn:
        captured = conn.execute(
            """
            SELECT e.id, e.title, e.category, e.date, COUNT(p.id) AS nphotos
            FROM events e JOIN photos p ON p.event_id = e.id
            WHERE e.user_id = ?
            GROUP BY e.id
            """,
            (user["id"],),
        ).fetchall()
        rx_by_event = {
            r["event_id"]: r["n"]
            for r in conn.execute(
                """
                SELECT l.event_id, COUNT(*) AS n FROM likes l
                JOIN events e ON e.id = l.event_id
                WHERE e.user_id = ? GROUP BY l.event_id
                """,
                (user["id"],),
            ).fetchall()
        }
        comments_received = conn.execute(
            """
            SELECT COUNT(*) AS n FROM comments c JOIN events e ON e.id = c.event_id
            WHERE e.user_id = ? AND c.user_id != ?
            """,
            (user["id"], user["id"]),
        ).fetchone()["n"]

        captured_days = {r["date"] for r in captured}
        total_photos = sum(r["nphotos"] for r in captured)
        total_reactions = sum(rx_by_event.values())

        # Heatmap : 12 dernières semaines, alignées sur un lundi
        start = today - timedelta(days=83)
        start -= timedelta(days=start.weekday())  # remonter au lundi
        per_day: dict[str, int] = {}
        for r in captured:
            if start.isoformat() <= r["date"] <= today.isoformat():
                per_day[r["date"]] = per_day.get(r["date"], 0) + 1

        # Top moment : le plus de réactions, puis le plus récent
        top = None
        if captured:
            best = max(captured, key=lambda r: (rx_by_event.get(r["id"], 0), r["date"]))
            photo = conn.execute(
                "SELECT filename FROM photos WHERE event_id = ? ORDER BY uploaded_at LIMIT 1",
                (best["id"],),
            ).fetchone()
            top = {
                "id": best["id"],
                "title": best["title"],
                "category": best["category"],
                "date": best["date"],
                "reactions": rx_by_event.get(best["id"], 0),
                "photo_url": f"/uploads/{photo['filename']}" if photo else None,
            }

        by_cat: dict[str, int] = {}
        for r in captured:
            by_cat[r["category"]] = by_cat.get(r["category"], 0) + 1

        return {
            "moments_captured": len(captured),
            "photos": total_photos,
            "days_captured": len(captured_days),
            "reactions_received": total_reactions,
            "comments_received": comments_received,
            "friends": len(follower_ids(conn, user["id"])),  # abonnés
            "max_streak": _max_streak(captured_days),
            "first_capture": min(captured_days) if captured_days else None,
            "heatmap": {"start": start.isoformat(), "end": today.isoformat(), "days": per_day},
            "top_moment": top,
            "by_category": dict(sorted(by_cat.items(), key=lambda kv: -kv[1])),
        }


# ---------- Phase IA : souvenirs & résumé ----------

CAT_LABEL = {
    "cinema": "ciné", "cafe": "café", "sport": "sport", "video": "vidéos",
    "sortie": "sorties", "etude": "études", "repas": "repas", "autre": "moments",
}


@app.get("/api/memories")
def memories(user: dict = Depends(current_user)):
    """« Il y a un an / un mois » : moments capturés le même jour du calendrier auparavant."""
    today = date_cls.today()
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT DISTINCT e.* FROM events e
            JOIN photos p ON p.event_id = e.id
            WHERE e.user_id = ? AND e.date < ?
            ORDER BY e.date DESC
            """,
            (user["id"], today.isoformat()),
        ).fetchall()
        out = []
        for r in rows:
            try:
                d = datetime.strptime(r["date"], "%Y-%m-%d").date()
            except ValueError:
                continue
            label = None
            if d.day == today.day and d.month == today.month:
                years = today.year - d.year
                label = f"Il y a {years} an{'s' if years > 1 else ''}"
            elif d.day == today.day:
                months = (today.year - d.year) * 12 + (today.month - d.month)
                if months > 0:
                    label = f"Il y a {months} mois"
            if label:
                photo_map = photos_for_events(conn, [r["id"]])
                evt = row_to_event(r, photo_map.get(r["id"]))
                evt["memory_label"] = label
                out.append(evt)
        return out


@app.get("/api/week-summary")
def week_summary(user: dict = Depends(current_user)):
    """Résumé auto de tes 7 derniers jours (agrégats + phrase générée localement)."""
    today = date_cls.today()
    start = today - timedelta(days=6)
    with get_conn() as conn:
        events = conn.execute(
            """
            SELECT e.id, e.category, e.date, e.start_time, e.title,
                   (SELECT COUNT(*) FROM photos p WHERE p.event_id = e.id) AS nphotos
            FROM events e
            WHERE e.user_id = ? AND e.date BETWEEN ? AND ?
            """,
            (user["id"], start.isoformat(), today.isoformat()),
        ).fetchall()
        reactions = conn.execute(
            """
            SELECT COUNT(*) AS n FROM likes l
            JOIN events e ON e.id = l.event_id
            WHERE e.user_id = ? AND e.date BETWEEN ? AND ?
            """,
            (user["id"], start.isoformat(), today.isoformat()),
        ).fetchone()["n"]
        # Moment le plus aimé de la semaine (pour l'insight)
        top_moment = conn.execute(
            """
            SELECT e.title, COUNT(l.id) AS n FROM events e
            JOIN likes l ON l.event_id = e.id
            WHERE e.user_id = ? AND e.date BETWEEN ? AND ?
            GROUP BY e.id ORDER BY n DESC LIMIT 1
            """,
            (user["id"], start.isoformat(), today.isoformat()),
        ).fetchone()

    total = len(events)
    captured = sum(1 for e in events if e["nphotos"] > 0)
    photos = sum(e["nphotos"] for e in events)
    active_days = len({e["date"] for e in events if e["nphotos"] > 0})
    cats = Counter(e["category"] for e in events)
    top_cat = cats.most_common(1)[0][0] if cats else None

    # Génération de phrase (règles locales, pas de LLM)
    if total == 0:
        headline = "Semaine tranquille 🌙"
        text = "Aucun moment planifié cette semaine. Et si tu prévoyais une sortie ?"
    else:
        parts = [f"{captured} moment{'s' if captured != 1 else ''} capturé{'s' if captured != 1 else ''}",
                 f"{photos} photo{'s' if photos != 1 else ''}"]
        if reactions:
            parts.append(f"{reactions} réaction{'s' if reactions != 1 else ''} reçue{'s' if reactions != 1 else ''}")
        moods = {
            "sport": "Semaine sportive 🏟️", "cafe": "Semaine café ☕", "cinema": "Semaine ciné 🎬",
            "sortie": "Semaine festive 🌆", "etude": "Semaine studieuse 📚", "repas": "Semaine gourmande 🍽️",
            "video": "Semaine cocooning 📺",
        }
        headline = moods.get(top_cat, "Belle semaine ✨") if active_days >= 3 else "Semaine posée 🙂"
        detail = f" Surtout du {CAT_LABEL.get(top_cat, 'moments')}." if top_cat else ""
        text = " · ".join(parts) + "." + detail

    # ---- Insight : une seule phrase naturelle, choisie selon le signal le plus fort ----
    insight = _week_insight(events, captured, active_days, cats, top_cat, reactions, top_moment)

    return {
        "start": start.isoformat(),
        "end": today.isoformat(),
        "headline": headline,
        "text": text,
        "insight": insight,
        "total": total,
        "captured": captured,
        "photos": photos,
        "active_days": active_days,
        "reactions": reactions,
        "by_category": dict(cats),
    }


def _part_of_day(hhmm: str | None) -> str | None:
    if not hhmm:
        return None
    try:
        h = int(hhmm[:2])
    except ValueError:
        return None
    if h < 6:
        return "nuit"
    if h < 12:
        return "matin"
    if h < 18:
        return "après-midi"
    return "soirée"


def _week_insight(events, captured, active_days, cats, top_cat, reactions, top_moment) -> str:
    """Une phrase d'insight naturelle basée sur le pattern le plus marquant."""
    if captured == 0:
        return "Tu n'as encore rien capturé cette semaine — un petit moment aujourd'hui ?"

    # 1) Un moment se détache par les réactions
    if top_moment and top_moment["n"] >= 2:
        return f"Ton moment le plus aimé cette semaine : « {top_moment['title']} »."

    # 2) Une catégorie domine nettement
    if top_cat and cats[top_cat] >= 3 and cats[top_cat] / max(sum(cats.values()), 1) >= 0.5:
        phr = {
            "sport": "Le sport a rythmé ta semaine 🏟️", "cafe": "Beaucoup de cafés cette semaine ☕",
            "cinema": "Semaine très ciné 🎬", "sortie": "Tu es beaucoup sorti·e cette semaine 🌆",
            "etude": "Une semaine studieuse 📚", "repas": "Semaine gourmande 🍽️",
            "video": "Semaine cocooning devant un écran 📺", "livre": "Tu as beaucoup lu cette semaine 📖",
        }
        return phr.get(top_cat, f"Surtout du {CAT_LABEL.get(top_cat, 'moments')} cette semaine.")

    # 3) Régularité
    if active_days >= 4:
        return f"{active_days} jours avec un moment capturé — belle régularité ✨"

    # 4) Pattern horaire (quand tu captures)
    moments_pod = [_part_of_day(e["start_time"]) for e in events if e["nphotos"] > 0]
    pod = Counter(p for p in moments_pod if p)
    if pod and pod.most_common(1)[0][1] >= 2:
        best = pod.most_common(1)[0][0]
        return f"Tu captures surtout tes moments en {best}."

    # 5) Fallback chaleureux
    if reactions >= 3:
        return f"Tes moments ont récolté {reactions} réactions cette semaine 💛"
    return f"{captured} moment{'s' if captured > 1 else ''} capturé{'s' if captured > 1 else ''} cette semaine — continue à garder trace."
