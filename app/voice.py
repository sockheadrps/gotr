"""
Voice API
=========
TTS generation using Chatterbox. Plays audio locally.
"""
import uuid
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import threading
import io
import re
import wave

router = APIRouter()

# Paths
AUDIO_DIR = Path(__file__).parent.parent / "audio" / "generated"
REFERENCE_AUDIO = Path(__file__).parent.parent / "audio" / "reference" / "beemo.wav"

# Lazy load model
_model = None
_model_lock = threading.Lock()


def get_model():
    """Lazy load the Chatterbox TTS model."""
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:
                try:
                    from chatterbox.tts import ChatterboxTTS
                    print("⏳ Loading Chatterbox TTS...")
                    _model = ChatterboxTTS.from_pretrained(device="cuda")
                    print("✅ TTS Model loaded on GPU!")
                except ImportError:
                    raise HTTPException(
                        status_code=500,
                        detail="chatterbox-tts not installed. Run: pip install chatterbox-tts"
                    )
                except Exception as e:
                    raise HTTPException(status_code=500, detail=f"Failed to load TTS model: {e}")
    return _model


# === Models ===

class SpeakRequest(BaseModel):
    """Request for Beemo to speak."""
    text: str
    exaggeration: float = 0.5
    cfg_weight: float = 0.5
    play_audio: bool = True


class SpeakResponse(BaseModel):
    """Response after speaking."""
    success: bool
    message: str
    audio_path: Optional[str] = None
    duration_seconds: Optional[float] = None


class TTSRequest(BaseModel):
    """Generate TTS without playing."""
    text: str
    exaggeration: float = 0.5
    cfg_weight: float = 0.5


class TTSResponse(BaseModel):
    """Generated audio info."""
    audio_path: str
    duration_seconds: float


# === Helpers ===

def play_audio_file(filepath: str):
    """Play audio through speakers."""
    try:
        import sounddevice as sd
        import soundfile as sf
        
        data, samplerate = sf.read(filepath)
        sd.play(data, samplerate)
        sd.wait()
    except ImportError:
        print("⚠️ Install: pip install sounddevice soundfile")
    except Exception as e:
        print(f"⚠️ Playback error: {e}")


def play_audio_async(filepath: str):
    """Play in background thread."""
    thread = threading.Thread(target=play_audio_file, args=(filepath,))
    thread.start()


def split_sentences(text: str):
    """Split text into sentences for streaming."""
    # Split on punctuation followed by space/newline
    sentences = re.split(r'(?<=[.!?])\s+', text)
    return [s.strip() for s in sentences if s.strip()]


async def generate_audio_stream(text: str, exaggeration: float, cfg_weight: float):
    """Generator for streaming audio chunks."""
    try:
        model = get_model()
        audio_prompt = str(REFERENCE_AUDIO) if REFERENCE_AUDIO.exists() else None
        sentences = split_sentences(text)
        
        import torch

        for i, sentence in enumerate(sentences):
            # Generate WAV tensor
            wav = model.generate(
                text=sentence,
                audio_prompt_path=audio_prompt,
                exaggeration=exaggeration,
                cfg_weight=cfg_weight
            )
            
            # Convert to bytes
            # We want to yield raw PCM bytes or a small WAV container
            # For simplicity and client compatibility, let's yield small WAVs
            buffer = io.BytesIO()
            import torchaudio
            torchaudio.save(buffer, wav.cpu(), model.sr, format="wav")
            
            yield buffer.getvalue()
            
    except Exception as e:
        print(f"❌ Streaming error: {e}")
        yield json.dumps({"error": str(e)}).encode()


# === Endpoints ===

@router.get("/")
async def voice_status():
    """Check status."""
    return {
        "module": "voice",
        "status": "ready",
        "model_loaded": _model is not None,
        "reference_audio": REFERENCE_AUDIO.name if REFERENCE_AUDIO.exists() else None
    }


@router.post("/speak", response_model=SpeakResponse)
async def speak(req: SpeakRequest):
    """Generate TTS and play through speakers."""
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    
    try:
        model = get_model()
        audio_prompt = str(REFERENCE_AUDIO) if REFERENCE_AUDIO.exists() else None
        
        import torchaudio
        
        wav = model.generate(
            text=req.text,
            audio_prompt_path=audio_prompt,
            exaggeration=req.exaggeration,
            cfg_weight=req.cfg_weight
        )
        
        # Save
        audio_id = str(uuid.uuid4())[:8]
        filename = f"speak_{audio_id}.wav"
        output_path = AUDIO_DIR / filename
        
        torchaudio.save(str(output_path), wav.cpu(), model.sr)
        duration = wav.shape[1] / model.sr
        
        # Play if requested
        if req.play_audio:
            play_audio_async(str(output_path))
        
        return SpeakResponse(
            success=True,
            message=f"Speaking: {req.text[:50]}..." if len(req.text) > 50 else f"Speaking: {req.text}",
            audio_path=f"/audio/generated/{filename}",
            duration_seconds=round(duration, 2)
        )
        
    except Exception as e:
        return SpeakResponse(success=False, message=f"TTS failed: {e}")


@router.post("/generate", response_model=TTSResponse)
async def generate_tts(req: TTSRequest):
    """Generate TTS file without playing."""
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    
    try:
        model = get_model()
        audio_prompt = str(REFERENCE_AUDIO) if REFERENCE_AUDIO.exists() else None
        
        import torchaudio
        
        wav = model.generate(
            text=req.text,
            audio_prompt_path=audio_prompt,
            exaggeration=req.exaggeration,
            cfg_weight=req.cfg_weight
        )
        
        audio_id = str(uuid.uuid4())[:8]
        filename = f"tts_{audio_id}.wav"
        output_path = AUDIO_DIR / filename
        
        torchaudio.save(str(output_path), wav.cpu(), model.sr)
        duration = wav.shape[1] / model.sr
        
        return TTSResponse(
            audio_path=f"/audio/generated/{filename}",
            duration_seconds=round(duration, 2)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS failed: {e}")


@router.post("/stream")
async def stream_voice(req: SpeakRequest):
    """Stream TTS audio sentence by sentence."""
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    
    return StreamingResponse(
        generate_audio_stream(req.text, req.exaggeration, req.cfg_weight),
        media_type="audio/wav"
    )


@router.get("/test")
async def test_voice():
    """Test - speaks a greeting."""
    return await speak(SpeakRequest(text="Hello! Beemo voice is working.", play_audio=True))
