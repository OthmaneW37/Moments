"""Configuration runtime — chemins de données et secrets.

En local, tout vit dans le dossier `backend/`. En production (Render, etc.),
on peut monter un disque persistant et pointer `MOMENTS_DATA_DIR` dessus pour
conserver la base SQLite et les uploads entre les redéploiements.
"""
import os
from pathlib import Path

_BACKEND_ROOT = Path(__file__).resolve().parent.parent

# Dossier où sont stockés moments.db, uploads/ et secret.key
DATA_DIR = Path(os.environ.get("MOMENTS_DATA_DIR", str(_BACKEND_ROOT)))
DATA_DIR.mkdir(parents=True, exist_ok=True)
