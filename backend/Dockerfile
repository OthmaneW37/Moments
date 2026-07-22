# Image de déploiement du backend Moments (FastAPI).
# Fonctionne sur Fly.io, Railway, Koyeb, Render (Docker), etc.
FROM python:3.12-slim

WORKDIR /app

# Dépendances d'abord (cache Docker)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Code applicatif
COPY . .

# La plupart des plateformes injectent $PORT ; sinon on écoute sur 8080.
EXPOSE 8080
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
