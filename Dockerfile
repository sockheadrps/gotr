# ── Stage 1: Build frontend ──────────────────────────────────────────────────
FROM node:22-slim AS frontend-build

WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Production image (API server only, no GPU/TTS) ──────────────────
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Only the lightweight API deps
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# App source
COPY worker.py ./
COPY static/ ./static/

# Frontend build output
COPY --from=frontend-build /build/build ./frontend/build

# Audio generated dir (bind-mounted in prod)
RUN mkdir -p ./audio/generated

ENV GENERATION_ENABLED=false

EXPOSE 7371

CMD ["uvicorn", "worker:app", "--host", "0.0.0.0", "--port", "7371"]
