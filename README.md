# 📸 Moments — ton calendrier de souvenirs

> Planifie ta journée, capture chaque moment en photo, et revis ta vie en timeline visuelle.

**Concept** : chaque événement de ton calendrier (vidéo au petit-déj, ciné à midi, finale au café...)
devient un *moment* — l'app te pousse à le capturer en photo. Ta timeline devient un journal visuel
de ta vraie vie. Phase sociale et IA à venir.

## Stack

| Couche    | Tech                                   |
|-----------|----------------------------------------|
| Backend   | FastAPI (Python 3.11) + SQLite         |
| Frontend  | React 19 + Vite                        |
| Photos    | Stockage local `backend/uploads/` (S3 en Phase 2) |

## Lancer en dev

```bash
# Backend (port 8000)
cd backend
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000

# Frontend (port 5173, proxy /api -> :8000)
cd frontend
npm install
npm run dev
```

Ouvre http://localhost:5173

## API

- `GET  /api/events?date=YYYY-MM-DD` — événements du jour (avec photos)
- `GET  /api/events/range?start=&end=` — résumé par jour (badges semaine)
- `POST /api/events` — créer `{title, category, date, start_time, end_time, notes}`
- `PUT  /api/events/{id}` / `DELETE /api/events/{id}`
- `POST /api/events/{id}/photos` — upload photo (multipart)
- `DELETE /api/photos/{id}`
- `GET  /api/timeline` — moments capturés groupés par jour
- `GET  /api/stats` — compteurs globaux + par catégorie

## Roadmap

- [x] **Phase 0 — MVP solo** : calendrier jour/semaine, CRUD moments, photos par événement, timeline, stats de base
- [x] **Phase 1 — Mobile-first** : navigation en bas, bottom sheet, PWA (plein écran + caméra)
- [x] **Phase 2 — Social** : comptes (JWT), amis, feed, réactions emoji, commentaires, notifications, streak
- [x] **Phase 3 — Découverte & IA** : moments publics par ville, auto-tagging local des photos, souvenirs (« il y a 1 an »), résumé de semaine
- [ ] **Phase 4 — Polish & déploiement** : app native (React Native), vraie vision IA (modèle HuggingFace), push notifications, déploiement (Render/Railway)

### Notes techniques Phase 3
- **Auto-tagging** (`app/vision.py`) : analyse locale des pixels via Pillow (luminosité, température de couleur, saturation) + tag sémantique dérivé de la catégorie. L'interface `analyze_photo()` est conçue pour brancher plus tard un vrai modèle de vision sans toucher au reste.
- **Résumé de semaine** : génération de phrase par règles locales (pas de LLM), agrégats sur 7 jours.
- **Réactions** : la table `likes` porte un `emoji` (❤️🔥😂😍😮👏), une réaction par utilisateur par moment.
