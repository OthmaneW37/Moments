# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Moments** — a mobile-first PWA where users plan their day, capture each event as a photo, and share those captured moments with friends (feed, reactions, comments) or publicly (Découverte). It's a "real life, real moments" social app targeted at young users. FastAPI + SQLite backend, React (Vite) frontend. No native app — it runs in the phone browser.

## Running it

Two servers, run from their own directories:

```bash
# Backend — MUST use port 8001 (port 8000 is blocked by permissions on the dev machine → WinError 10013)
cd backend
.venv\Scripts\python -m uvicorn app.main:app --reload --port 8001

# Frontend — Vite dev server on 5173, proxies /api and /uploads to 127.0.0.1:8001
cd frontend
npm run dev            # local only
npm run dev -- --host  # expose on LAN to test on a real phone (same Wi-Fi)
```

Frontend at http://localhost:5173. The Vite proxy (`frontend/vite.config.js`) points `/api` and `/uploads` at `127.0.0.1:8001` — **if you change the backend port, update the proxy too.**

Other commands:
- `npm run lint` (oxlint) · `npm run build` · `npm run preview`
- Install backend deps: `.venv\Scripts\pip install -r backend/requirements.txt`

There is **no automated test suite**. Verify changes by exercising the API (e.g. `Invoke-RestMethod`) or driving the UI in the browser. A seeded set of test accounts exists in `moments.db`: `othmane`, `karim`, `lea`, all with password `test123`.

## Architecture

### Backend (`backend/app/`)
- **`main.py`** — every route lives here (auth, events CRUD, photos, follows (`/api/users/{u}/follow`, `/api/follow/requests`, `/api/follow/respond`, followers/following lists), feed, discover, reactions, comments, notifications, timeline, stats, memories, week-summary, recap, `/api/users/{username}` public profile, `/api/context/detail` work page). One flat FastAPI app.
- **`db.py`** — SQLite access (`get_conn`), the full schema in `init_db()`, and shared helpers: `row_to_event`, `photos_for_events`, `friend_ids`, `notify`.
- **`auth.py`** — password hashing (PBKDF2 via stdlib, no external hash lib) and JWT. `current_user` is the FastAPI dependency that guards every protected route; the signing key auto-generates into `backend/secret.key`.
- **`vision.py`** — local photo auto-tagging. `analyze_photo(path, category)` computes brightness / colour-temperature / saturation from the pixels (Pillow) and returns ambiance tags plus a category tag. **This is a local heuristic, not a real vision model** — the interface is intentionally shaped so a real model (e.g. HuggingFace) can replace the implementation without touching callers.
- **`context.py`** — context-card search (`search_context(category, query, city)`), the Letterboxd/Goodreads-style enrichment. Free keyless APIs per category: TVMaze + iTunes (cinema/video), Open Library (livre/etude), TheSportsDB (sport), Nominatim (cafe/repas/sortie). Results are normalised to `{kind, title, subtitle, image, rating, source}` and cached in memory. The chosen card (+ user's `my_rating` 1–5) is stored as JSON in `events.context` (`_clean_context` in main.py whitelists keys). Future photo-based auto-detection should fill the same card shape.

### Frontend (`frontend/src/`)
- **`api.js`** — the single API client (`api.*`), token storage in `localStorage` (a 401 auto-clears it), date helpers, and the shared UI constants **`CATEGORY_META`** (category → label/emoji/colour) and **`REACTION_EMOJIS`**.
- **`components/Icon.jsx`** — maps every emoji the UI uses to a hand-drawn SVG in `frontend/public/icons/` (all ~1 KB vectors in the app palette; falls back to the raw emoji for unmapped ones). New UI should render emojis through `<Icon emoji=… size=…/>`, not raw text emojis.
- **`App.jsx`** — root component. No router: it holds a `view` state (`feed | discover | day | profile | notifs | recap`) switched by the bottom nav, plus the event-form modal and the day/timeline sub-tab. Owns auth gating and the notifications poll. The feed view adds `.screen--immersive` (zero padding, full height) to the scroll container.
- **`useReaction.js`** — shared hook for emoji reactions (optimistic update + double-tap-❤️ helper), used by every surface that can react.
- **`components/`** — `AuthScreen`, `WeekStrip`, `EventCard`/`EventForm` (agenda), `Feed` → `ImmersiveFeed` (full-screen vertical scroll-snap feed, one moment per screen, TikTok-style with agenda overlay), `Discover` (4:5 immersive `MomentCard`s + category filter chips), `MomentViewer` (fullscreen vertical viewer opened from Discover), `Comments` (shared), `Notifications`, `Memories` (rendered inside `Timeline`), `Profile`, `Recap`, `Timeline`.

### Key cross-cutting conventions
- **Everything is per-account.** Events carry `user_id`; every query filters by the authenticated user. A user only ever sees their own calendar plus followed-accounts'/public moments in the social views.
- **Follow model (Phase 5).** The `friendships` table stores DIRECTIONAL follows: `requester_id` = follower, `addressee_id` = followed, status `pending|accepted`. `users.is_private` gates follows: following a public account is instant (`accepted`), a private account creates a `pending` request the target must accept (`POST /api/follow/respond`). `db.following_ids()` / `follower_ids()` are the canonical helpers; `friend_ids` is a legacy alias for `following_ids`. Visibility rule everywhere (`_can_see_event`): own event, OR viewer follows the author, OR event is public AND author is not private. Private accounts are excluded from Découverte and their profile/lists are locked to non-followers.
- **Schema migrations go in `init_db()`.** New columns are added with idempotent `PRAGMA table_info(...)` checks + `ALTER TABLE` (see the `user_id`, `visibility`, `city`, `emoji`, `tags` migrations). Follow that pattern — don't rely on dropping the DB.
- **The `likes` table stores emoji reactions** (a legacy name). One row per user per event, with an `emoji` column; re-reacting with the same emoji removes it, a different emoji replaces it.
- **A "moment" in the social sense = an event that has ≥1 photo.** Feed/Discover/Timeline/memories all filter on `JOIN photos`.
- **Feed vs Discover:** feed = me + accounts I follow; discover = `visibility='public'` events from non-private accounts *except* me and those I follow, with same-city results ranked first. Both build cards through the shared `_enrich_moments()` helper in `main.py`.
- **Notifications** are written via `db.notify()` (silently skips notifying yourself). Types: `follow`, `follow_request`, `follow_accept`, `like`, `comment` (legacy rows may still carry `friend_request`/`friend_accept`).
- **Categories must stay in sync**: backend `CATEGORIES` (main.py) and frontend `CATEGORY_META` (api.js) list the same keys. Reaction set is `REACTION_EMOJIS` in both `main.py` and `api.js`.
- Photos are written to `backend/uploads/` and served at `/uploads`; tags are computed on upload and stored as a JSON string in `photos.tags`.

## Not in version control yet

The project is **not a git repository**. `.gitignore` already excludes `backend/.venv/`, `backend/moments.db`, `backend/uploads/`, `backend/secret.key`, and `frontend/node_modules/`.

# Frontend rules

- Never generate generic SaaS UI.
- Avoid neon blue, purple gradients, glowing blobs, and startup-style dark themes.
- Prefer light warm backgrounds by default.
- Use product-specific visual identity derived from the app concept.
- Build mobile-first layouts.
- Design proper loading, empty, and error states.
- Use asymmetry and editorial rhythm instead of repetitive 3-card grids.
- Keep UI clean, premium, and intentional.