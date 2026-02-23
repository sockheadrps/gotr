"""
Beemo Voice Service
===================
Standalone TTS server using Chatterbox.
Runs on the machine with GPU. Beemo calls this to speak.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.voice import router as voice_router

app = FastAPI(
    title="Beemo Voice Service",
    description="TTS generation with Chatterbox",
    version="0.1.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files for generated audio
AUDIO_DIR = Path(__file__).parent.parent / "audio"
AUDIO_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/audio", StaticFiles(directory=str(AUDIO_DIR)), name="audio")

# Voice routes
app.include_router(voice_router, prefix="/api/voice", tags=["voice"])


@app.get("/")
async def root():
    return {
        "service": "Beemo Voice",
        "status": "online",
        "endpoints": {
            "speak": "POST /api/voice/speak",
            "generate": "POST /api/voice/generate",
            "status": "GET /api/voice/",
            "test": "GET /api/voice/test"
        }
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}
