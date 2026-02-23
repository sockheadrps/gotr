# ── Stage 1: Build frontend ──────────────────────────────────────────────────
FROM node:22-slim AS frontend-build

WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Production image ────────────────────────────────────────────────
FROM nvidia/cuda:12.8.0-runtime-ubuntu24.04

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv git ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Python deps (torch cu128 needs extra index)
COPY requirements.txt ./
RUN python3 -m venv /venv && \
    /venv/bin/pip install --upgrade pip && \
    /venv/bin/pip install -r requirements.txt

ENV PATH="/venv/bin:$PATH"

# App source
COPY worker.py ./
COPY app/ ./app/
COPY static/ ./static/
COPY audio/reference/ ./audio/reference/
COPY templates/ ./templates/

# Frontend build output
COPY --from=frontend-build /build/build ./frontend/build

# Audio generated dir (bind-mounted in prod, pre-create for safety)
RUN mkdir -p ./audio/generated

EXPOSE 7371

CMD ["uvicorn", "worker:app", "--host", "0.0.0.0", "--port", "7371"]
