# Déploiement du backend Moments depuis la RACINE du repo.
# Nécessaire pour les lanceurs web (Fly.io « Deploy from GitHub », Railway…)
# qui construisent depuis la racine et ne regardent pas dans les sous-dossiers.
FROM python:3.12-slim

WORKDIR /app

# Dépendances d'abord (cache Docker)
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Code du backend
COPY backend/ .

# La plupart des plateformes injectent $PORT ; sinon on écoute sur 8080.
EXPOSE 8080
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
