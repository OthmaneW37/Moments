"""SQLite helpers for Moments — Phase 3 (réactions, découverte, tags IA)."""
import json
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "moments.db"


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    with get_conn() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
                display_name  TEXT NOT NULL,
                emoji         TEXT NOT NULL DEFAULT '😎',
                password_hash TEXT NOT NULL,
                created_at    TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS events (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                title       TEXT NOT NULL,
                category    TEXT NOT NULL DEFAULT 'autre',
                date        TEXT NOT NULL,          -- YYYY-MM-DD
                start_time  TEXT,                   -- HH:MM
                end_time    TEXT,                   -- HH:MM
                notes       TEXT DEFAULT '',
                created_at  TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS photos (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id    INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
                filename    TEXT NOT NULL,
                uploaded_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS friendships (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                addressee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                status       TEXT NOT NULL DEFAULT 'pending',  -- pending | accepted
                created_at   TEXT DEFAULT (datetime('now')),
                UNIQUE(requester_id, addressee_id)
            );

            CREATE TABLE IF NOT EXISTS likes (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                event_id   INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
                created_at TEXT DEFAULT (datetime('now')),
                UNIQUE(user_id, event_id)
            );

            CREATE TABLE IF NOT EXISTS comments (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id   INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
                user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                text       TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS notifications (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- destinataire
                actor_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- qui a agi
                type       TEXT NOT NULL,   -- friend_request | friend_accept | like | comment
                event_id   INTEGER REFERENCES events(id) ON DELETE CASCADE,
                read       INTEGER NOT NULL DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now'))
            );

            CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
            CREATE INDEX IF NOT EXISTS idx_photos_event ON photos(event_id);
            CREATE INDEX IF NOT EXISTS idx_likes_event ON likes(event_id);
            CREATE INDEX IF NOT EXISTS idx_comments_event ON comments(event_id);
            CREATE INDEX IF NOT EXISTS idx_notifs_user ON notifications(user_id, read);
            """
        )
        # Migrations incrémentales (idempotentes)
        def cols(table: str) -> list[str]:
            return [r[1] for r in conn.execute(f"PRAGMA table_info({table})").fetchall()]

        if "user_id" not in cols("events"):
            conn.execute("ALTER TABLE events ADD COLUMN user_id INTEGER REFERENCES users(id)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id)")
        # Phase 3 : visibilité des moments (friends | public)
        if "visibility" not in cols("events"):
            conn.execute("ALTER TABLE events ADD COLUMN visibility TEXT NOT NULL DEFAULT 'friends'")
        # Phase 3 : ville de l'utilisateur (pour le feed Découverte)
        if "city" not in cols("users"):
            conn.execute("ALTER TABLE users ADD COLUMN city TEXT NOT NULL DEFAULT ''")
        # Phase 3 : emoji de réaction (le like devient une réaction)
        if "emoji" not in cols("likes"):
            conn.execute("ALTER TABLE likes ADD COLUMN emoji TEXT NOT NULL DEFAULT '❤️'")
        # Phase 3 : tags auto générés par analyse d'image (JSON)
        if "tags" not in cols("photos"):
            conn.execute("ALTER TABLE photos ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'")
        # Phase 4 : fiche contextuelle (film/livre/match/lieu + notes) en JSON
        if "context" not in cols("events"):
            conn.execute("ALTER TABLE events ADD COLUMN context TEXT NOT NULL DEFAULT ''")
        # Phase 5 : compte privé (les abonnements demandent une approbation)
        if "is_private" not in cols("users"):
            conn.execute("ALTER TABLE users ADD COLUMN is_private INTEGER NOT NULL DEFAULT 0")
        # Phase 5 : friendships devient une table de FOLLOWS directionnels
        # (requester = abonné, addressee = suivi). Les amitiés acceptées de
        # l'ancien modèle deviennent des abonnements mutuels — on insère la
        # ligne inverse manquante (idempotent).
        conn.execute(
            """
            INSERT OR IGNORE INTO friendships (requester_id, addressee_id, status)
            SELECT addressee_id, requester_id, 'accepted'
            FROM friendships WHERE status = 'accepted'
            """
        )


def row_to_event(row: sqlite3.Row, photos: list[dict] | None = None) -> dict:
    keys = row.keys()
    context = None
    if "context" in keys and row["context"]:
        try:
            context = json.loads(row["context"])
        except (TypeError, ValueError):
            context = None
    return {
        "id": row["id"],
        "title": row["title"],
        "category": row["category"],
        "date": row["date"],
        "start_time": row["start_time"],
        "end_time": row["end_time"],
        "notes": row["notes"],
        "visibility": row["visibility"] if "visibility" in keys else "friends",
        "context": context,
        "created_at": row["created_at"],
        "photos": photos or [],
    }


def photos_for_events(conn: sqlite3.Connection, event_ids: list[int]) -> dict[int, list[dict]]:
    """Map event_id -> list of photo dicts."""
    if not event_ids:
        return {}
    placeholders = ",".join("?" * len(event_ids))
    rows = conn.execute(
        f"SELECT id, event_id, filename, uploaded_at, tags FROM photos "
        f"WHERE event_id IN ({placeholders}) ORDER BY uploaded_at",
        event_ids,
    ).fetchall()
    out: dict[int, list[dict]] = {}
    for r in rows:
        try:
            tags = json.loads(r["tags"]) if r["tags"] else []
        except (json.JSONDecodeError, TypeError):
            tags = []
        out.setdefault(r["event_id"], []).append(
            {
                "id": r["id"],
                "url": f"/uploads/{r['filename']}",
                "uploaded_at": r["uploaded_at"],
                "tags": tags,
            }
        )
    return out


def notify(conn: sqlite3.Connection, user_id: int, actor_id: int,
           notif_type: str, event_id: int | None = None) -> None:
    """Crée une notification (jamais pour soi-même)."""
    if user_id == actor_id:
        return
    conn.execute(
        "INSERT INTO notifications (user_id, actor_id, type, event_id) VALUES (?, ?, ?, ?)",
        (user_id, actor_id, notif_type, event_id),
    )


def following_ids(conn: sqlite3.Connection, user_id: int) -> list[int]:
    """IDs des comptes que user_id suit (abonnements acceptés)."""
    rows = conn.execute(
        "SELECT addressee_id FROM friendships WHERE requester_id = ? AND status = 'accepted'",
        (user_id,),
    ).fetchall()
    return [r["addressee_id"] for r in rows]


def follower_ids(conn: sqlite3.Connection, user_id: int) -> list[int]:
    """IDs des abonnés de user_id (acceptés)."""
    rows = conn.execute(
        "SELECT requester_id FROM friendships WHERE addressee_id = ? AND status = 'accepted'",
        (user_id,),
    ).fetchall()
    return [r["requester_id"] for r in rows]


# Alias legacy : partout où "amis" voulait dire "cercle visible", le cercle
# est désormais les comptes que je SUIS.
friend_ids = following_ids


def can_view_user(conn: sqlite3.Connection, viewer_id: int, author_row) -> bool:
    """Un viewer peut voir le contenu non-public d'un auteur s'il le suit.
    Pour un compte privé, même le contenu 'public' est réservé aux abonnés."""
    if author_row["id"] == viewer_id:
        return True
    return author_row["id"] in following_ids(conn, viewer_id)
