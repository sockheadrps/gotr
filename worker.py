import io
import os
import uuid
import json
import textwrap
import uvicorn
import threading
import subprocess
from pathlib import Path
from pydantic import BaseModel
from fastapi import FastAPI, Response, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()
DEV = os.getenv("DEV", "").strip().upper() == "TRUE"
# Set GENERATION_ENABLED=false in production to skip GPU/TTS imports
GENERATION_ENABLED = os.getenv("GENERATION_ENABLED", "true").strip().lower() != "false"

if GENERATION_ENABLED:
    import torch
    import torchaudio
    from chatterbox.tts_turbo import ChatterboxTurboTTS

# --- 1. Configuration & Paths ---
BASE_DIR = Path(__file__).parent
STATIC_DIR = BASE_DIR / "static"
TEMPLATE_DIR = BASE_DIR / "templates"
AUDIO_DIR = BASE_DIR / "audio"
GENERATED_DIR = AUDIO_DIR / "generated"
CHAPTERS_ROOT = STATIC_DIR / "chapters" 
REFERENCE_FILE = AUDIO_DIR / "reference" / "beemo.wav"

for d in [GENERATED_DIR, STATIC_DIR, TEMPLATE_DIR, CHAPTERS_ROOT]:
    d.mkdir(parents=True, exist_ok=True)

# --- 2. Lazy Model Logic (Thread-Safe) ---
# Global variables for model persistence
_model_lock = threading.Lock()
_loaded_model = None 

def get_model():
    """Triggered ONLY when audio generation is requested. Prevents multiple loads."""
    if not GENERATION_ENABLED:
        raise RuntimeError("Audio generation is disabled in this environment (GENERATION_ENABLED=false).")
    global _loaded_model

    # Only one request can enter this block; others wait until it finishes
    with _model_lock:
        if _loaded_model is None:
            print("\n" + "="*40)
            print("⏳ LAZY LOADING TTS MODEL INTO VRAM...")
            print("="*40)
            
            device = "cuda" if torch.cuda.is_available() else "cpu"
            # Actual heavy lifting happens here
            _loaded_model = ChatterboxTurboTTS.from_pretrained(device=device)
            
            if torch.cuda.is_available():
                torch.backends.cudnn.benchmark = True
                print(f"✅ Model loaded on {device}: {torch.cuda.get_device_name(0)}")
            else:
                print("✅ Model loaded on CPU")
            print("="*40 + "\n")
        
    return _loaded_model

# --- 3. Pydantic Models ---
class ChunkUpdate(BaseModel):
    index: int
    text: str

class TrimRequest(BaseModel):
    file_path: str
    end_time: float

class PadRequest(BaseModel):
    file_path: str
    pad_seconds: float  # silence to append at the end

class SetActiveRequest(BaseModel):
    iteration: int

class IterationChunkUpdate(BaseModel):
    chunk_type: str  # "story" | "lesson"
    index: int
    text: str

class IterationInsertRequest(BaseModel):
    chunk_type: str  # "story" | "lesson"
    index: int       # -1 = append

class IterationDeleteRequest(BaseModel):
    chunk_type: str
    index: int

# --- 4. Terminal UI Helpers ---
def print_gen_status(index, text):
    cyan, yellow, reset, bold = "\033[96m", "\033[93m", "\033[0m", "\033[1m"
    clean_text = text.replace('\n', ' ').strip()
    wrapped_lines = textwrap.wrap(clean_text, width=78)
    print(f"\n{cyan}    ┌{'─'*80}┐{reset}")
    print(f"{cyan}    │{reset} {bold}GENERATING AUDIO{reset} {cyan}│{reset} {yellow}Chunk #{index}{reset}")
    print(f"{cyan}    ├{'─'*80}┤{reset}")
    for line in wrapped_lines:
        print(f"{cyan}    │{reset} {line:<78} {cyan}│{reset}")
    print(f"{cyan}    └{'─'*80}┘{reset}")

def print_trim_status(filename, old_len, new_len):
    magenta, reset, bold = "\033[95m", "\033[0m", "\033[1m"
    saved = old_len - new_len
    print(f"\n{magenta}    ┌{'─'*80}┐{reset}")
    print(f"{magenta}    │{reset} {bold}AUDIO TRIMMED{reset} {magenta}│{reset} {filename}")
    print(f"{magenta}    ├{'─'*80}┤{reset}")
    print(f"{magenta}    │{reset} Duration: {old_len:.2f}s -> {new_len:.2f}s")
    print(f"{magenta}    │{reset} Reduction: {magenta}-{saved:.2f}s{reset}")
    print(f"{magenta}    └{'─'*80}┘{reset}")

# --- 5. Core Logic Helpers ---
def get_beemo_voice(text: str):
    current_model = get_model() 
    ref_path = str(REFERENCE_FILE) if REFERENCE_FILE.exists() else None
    with torch.inference_mode():
        wav = current_model.generate(text=text, audio_prompt_path=ref_path)
        return wav.cpu()

def get_chapter_paths(chapter_id: str):
    folder_path = CHAPTERS_ROOT / chapter_id
    return {
        "folder": folder_path,
        "chunks": folder_path / "audio_chunks.json",
        "summary": folder_path / "summary.json"
    }

def get_iteration_paths(chapter_id: str, iteration: int):
    iter_dir = CHAPTERS_ROOT / chapter_id / "iterations" / f"iteration-{iteration}"
    audio_dir = GENERATED_DIR / chapter_id / f"iteration-{iteration}" / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)
    chunks_path = iter_dir / "audio_chunks.json"
    # Fallback: scan for any .json that isn't summary.json (handles typo'd filenames)
    if not chunks_path.exists() and iter_dir.exists():
        candidates = [f for f in iter_dir.glob("*.json") if f.name != "summary.json"]
        if candidates:
            chunks_path = candidates[0]
    return {
        "iter_dir": iter_dir,
        "chunks": chunks_path,
        "summary": iter_dir / "summary.json",
        "audio_dir": audio_dir,
    }

def normalize_iteration_data(raw: dict) -> dict:
    """Convert any iteration JSON format to standard {title, story_chunks, lesson_chunks}."""
    if "commandments" in raw:
        story_chunks = []
        for c in raw["commandments"]:
            n = c["number"]
            story_chunks.append(f"Commandment {n}: {c['title']}")
            story_chunks.append(c["text"])
            story_chunks.append(f"Taken from the teachings of the Real, chapter {n}, {c['source_chapter']}")
        return {"title": raw.get("title", "The Commandments"), "story_chunks": story_chunks, "lesson_chunks": []}
    return raw

def get_chapter_meta(chapter_id: str) -> dict:
    p = CHAPTERS_ROOT / chapter_id / "chapter.json"
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}

def set_chapter_meta(chapter_id: str, meta: dict):
    p = CHAPTERS_ROOT / chapter_id / "chapter.json"
    p.write_text(json.dumps(meta, indent=2), encoding="utf-8")

def save_mp3(tensor, sr: int, out_path: Path, bitrate: str = "192k"):
    """Save a waveform tensor as MP3 via ffmpeg (WAV pipe → MP3)."""
    buf = io.BytesIO()
    torchaudio.save(buf, tensor, sr, format="wav", bits_per_sample=16)
    buf.seek(0)
    subprocess.run(
        ["ffmpeg", "-y", "-f", "wav", "-i", "pipe:0",
         "-af", "apad=pad_dur=0.7", "-b:a", bitrate, str(out_path)],
        input=buf.read(), check=True, capture_output=True,
    )

def iter_audio_url(chapter_id: str, iteration: int, chunk_type: str, index: int) -> str | None:
    audio_dir = GENERATED_DIR / chapter_id / f"iteration-{iteration}" / "audio"
    for ext in ("mp3", "wav"):
        fname = f"chunk-{chunk_type}-{index}.{ext}"
        if (audio_dir / fname).exists():
            return f"/files/{chapter_id}/iteration-{iteration}/audio/{fname}"
    return None

def iter_chunk_path(audio_dir: Path, ctype: str, index: int) -> Path | None:
    """Return the actual path of a chunk file (mp3 or wav), or None if missing."""
    for ext in ("mp3", "wav"):
        p = audio_dir / f"chunk-{ctype}-{index}.{ext}"
        if p.exists():
            return p
    return None

def iter_chunk_delete(audio_dir: Path, ctype: str, index: int):
    """Delete all format variants of a chunk file."""
    for ext in ("mp3", "wav"):
        p = audio_dir / f"chunk-{ctype}-{index}.{ext}"
        if p.exists():
            p.unlink()

def list_iterations(chapter_id: str) -> list[int]:
    iters_dir = CHAPTERS_ROOT / chapter_id / "iterations"
    if not iters_dir.exists():
        return []
    result = []
    for d in sorted(iters_dir.iterdir()):
        if d.is_dir() and d.name.startswith("iteration-"):
            try:
                result.append(int(d.name.split("-")[1]))
            except (IndexError, ValueError):
                pass
    return result

# --- 6. FastAPI Setup ---
FRONTEND_BUILD = BASE_DIR / "frontend" / "build"

app = FastAPI(title="Voice Gen Studio Backend")
app.add_middleware(CORSMiddleware, allow_origins=["*"])
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

if FRONTEND_BUILD.exists():
    app.mount("/_app", StaticFiles(directory=str(FRONTEND_BUILD / "_app")), name="svelte_assets")

# --- 7. API Routes ---

@app.get("/files/{file_path:path}")
def serve_generated_file(file_path: str):
    full_path = GENERATED_DIR / file_path
    if not full_path.exists():
        return Response(status_code=404)
    return FileResponse(full_path, media_type="audio/wav", filename=os.path.basename(full_path))

@app.get("/chapters")
def list_chapters():
    if not CHAPTERS_ROOT.exists(): return []
    return sorted([d.name for d in CHAPTERS_ROOT.iterdir() if d.is_dir()])

@app.get("/chapters/{chapter_id}")
def get_chapter(chapter_id: str):
    meta = get_chapter_meta(chapter_id)
    active_iter = meta.get("active_iteration")

    # --- Iteration-based path ---
    if active_iter is not None:
        ipaths = get_iteration_paths(chapter_id, active_iter)
        if not ipaths["chunks"].exists():
            raise HTTPException(status_code=404, detail="Active iteration metadata missing.")
        with open(ipaths["chunks"], "r", encoding="utf-8") as f:
            data = normalize_iteration_data(json.load(f))
        summary_data = {}
        if ipaths["summary"].exists():
            with open(ipaths["summary"], "r", encoding="utf-8") as f:
                summary_data = json.load(f)
        story_chunks = data.get("story_chunks", [])
        lesson_chunks = data.get("lesson_chunks", [])
        story_audio_urls = [iter_audio_url(chapter_id, active_iter, "story", i) for i in range(len(story_chunks))]
        lesson_audio_urls = [iter_audio_url(chapter_id, active_iter, "lesson", i) for i in range(len(lesson_chunks))]
        audio_dir = ipaths["audio_dir"]
        summary_audio = next((f"/files/{chapter_id}/iteration-{active_iter}/audio/summary.{ext}" for ext in ("mp3","wav") if (audio_dir / f"summary.{ext}").exists()), None)
        full_audio = next((f"/files/{chapter_id}/iteration-{active_iter}/audio/full.{ext}" for ext in ("mp3","wav") if (audio_dir / f"full.{ext}").exists()), None)
        return {
            "title": data.get("title", chapter_id.replace('-', ' ').title()),
            "story_chunks": story_chunks,
            "lesson_chunks": lesson_chunks,
            "story_audio_urls": story_audio_urls,
            "lesson_audio_urls": lesson_audio_urls,
            "summary": summary_data,
            "summary_audio_filename": summary_audio,
            "full_audio_filename": full_audio,
            "active_iteration": active_iter,
        }

    # --- No active iteration: check if any iterations exist (e.g. commandments) ---
    iter_list = list_iterations(chapter_id)
    if iter_list:
        # Use first iteration's data as a stub for the card/carousel
        ipaths = get_iteration_paths(chapter_id, iter_list[0])
        if ipaths["chunks"].exists():
            with open(ipaths["chunks"], "r", encoding="utf-8") as f:
                file_data = json.load(f)
            raw = normalize_iteration_data(file_data)
            stub_summary = {
                "chapter": 0,
                "gospel_title": raw.get("title", chapter_id.replace('-', ' ').title()),
                "subtitle": "",
                "original_topic": "",
                "ideology_summary": "",
            }
            return {
                "title": raw.get("title", ""),
                "story_chunks": [],
                "lesson_chunks": [],
                "story_audio_urls": [],
                "lesson_audio_urls": [],
                "summary": stub_summary,
                "summary_audio_filename": None,
                "full_audio_filename": None,
                "active_iteration": None,
                # Pass through raw structured data (e.g. commandments[])
                "commandments": file_data.get("commandments"),
            }

    # --- Legacy flat path (backward compat) ---
    paths = get_chapter_paths(chapter_id)
    if not paths["chunks"].exists():
        raise HTTPException(status_code=404, detail="Metadata missing.")
    with open(paths["chunks"], "r", encoding="utf-8") as f:
        data = json.load(f)
    summary_data = {}
    if paths["summary"].exists():
        with open(paths["summary"], "r", encoding="utf-8") as f:
            summary_data = json.load(f)
    chunks = data.get("chunks", [])
    audio_urls = []
    for i in range(len(chunks)):
        filename = f"{chapter_id}_chunk{i}.wav"
        audio_urls.append(f"/files/{filename}" if (GENERATED_DIR / filename).exists() else None)
    return {
        "title": chapter_id.replace('-', ' ').title(),
        "chunks": chunks,
        "audio_urls": audio_urls,
        "summary": summary_data,
        "full_audio_filename": data.get("full_audio_filename"),
        "summary_audio_filename": data.get("summary_audio_filename"),
        "active_iteration": None,
    }

@app.post("/generate")
def generate_file(text: str, chapter_id: str, chunk_index: int, force: bool = False,
                  iteration: int = None, chunk_type: str = None):
    # Iteration-scoped generation
    if iteration is not None and chunk_type is not None:
        ipaths = get_iteration_paths(chapter_id, iteration)
        fname = f"chunk-{chunk_type}-{chunk_index}.mp3"
        output_path = ipaths["audio_dir"] / fname
        url = f"/files/{chapter_id}/iteration-{iteration}/audio/{fname}"
        if output_path.exists() and not force:
            return {"success": True, "url": url, "cached": True}
        print_gen_status(chunk_index, text)
        wav_cpu = get_beemo_voice(text)
        # Delete stale .wav before writing .mp3
        stale_wav = ipaths["audio_dir"] / f"chunk-{chunk_type}-{chunk_index}.wav"
        if stale_wav.exists(): stale_wav.unlink()
        save_mp3(wav_cpu, get_model().sr, output_path)
        if torch.cuda.is_available(): torch.cuda.empty_cache()
        return {"success": True, "url": url, "cached": False}

    # Legacy flat generation
    file_id = f"{chapter_id}_chunk{chunk_index}.wav"
    output_path = GENERATED_DIR / file_id
    if output_path.exists() and not force:
        return {"success": True, "url": f"/files/{file_id}", "cached": True}
    print_gen_status(chunk_index, text)
    wav_cpu = get_beemo_voice(text)
    torchaudio.save(str(output_path), wav_cpu, get_model().sr, bits_per_sample=16)
    if torch.cuda.is_available(): torch.cuda.empty_cache()
    return {"success": True, "url": f"/files/{file_id}", "cached": False}

@app.get("/stream")
def stream_audio(text: str):
    wav_cpu = get_beemo_voice(text)
    buffer = io.BytesIO()
    torchaudio.save(buffer, wav_cpu, get_model().sr, format="wav", bits_per_sample=16)
    return Response(content=buffer.getvalue(), media_type="audio/wav")

def save_audio(tensor, sr: int, path: Path):
    """Save to the format implied by path extension (.mp3 or .wav)."""
    if path.suffix == ".mp3":
        save_mp3(tensor, sr, path)
    else:
        torchaudio.save(str(path), tensor, sr, bits_per_sample=16)

@app.post("/api/trim")
def trim_audio(request: TrimRequest):
    relative_path = request.file_path.replace("/files/", "").split('?')[0]
    full_path = GENERATED_DIR / relative_path
    if not full_path.exists(): return {"success": False, "error": "File missing"}
    waveform, sr = torchaudio.load(str(full_path))
    old_duration = waveform.shape[1] / sr
    trim_frame = int(request.end_time * sr)
    trimmed_waveform = waveform[:, :trim_frame]
    save_audio(trimmed_waveform, sr, full_path)
    print_trim_status(relative_path, old_duration, trimmed_waveform.shape[1]/sr)
    return {"success": True, "url": f"/files/{relative_path}?t={uuid.uuid4().hex[:4]}"}

@app.post("/api/pad")
def pad_audio(request: PadRequest):
    relative_path = request.file_path.replace("/files/", "").split('?')[0]
    full_path = GENERATED_DIR / relative_path
    if not full_path.exists(): return {"success": False, "error": "File missing"}
    if request.pad_seconds <= 0: return {"success": False, "error": "pad_seconds must be > 0"}
    waveform, sr = torchaudio.load(str(full_path))
    silence_frames = int(request.pad_seconds * sr)
    silence = torch.zeros(waveform.shape[0], silence_frames)
    padded = torch.cat([waveform, silence], dim=1)
    save_audio(padded, sr, full_path)
    new_dur = padded.shape[1] / sr
    print(f"    ✚ Padded {relative_path} +{request.pad_seconds:.2f}s → {new_dur:.2f}s total")
    return {"success": True, "url": f"/files/{relative_path}?t={uuid.uuid4().hex[:4]}"}

@app.post("/chapters/{chapter_id}/concatenate")
def concatenate_chapter(chapter_id: str):
    paths = get_chapter_paths(chapter_id)
    with open(paths["chunks"], "r", encoding="utf-8") as f:
        data = json.load(f)
    
    all_chunks = []
    for i in range(len(data.get("chunks", []))):
        f_path = GENERATED_DIR / f"{chapter_id}_chunk{i}.wav"
        if not f_path.exists():
            return {"success": False, "error": f"Chunk {i} missing."}
        waveform, _ = torchaudio.load(str(f_path))
        all_chunks.append(waveform)

    full_audio = torch.cat(all_chunks, dim=1)
    final_filename = f"{chapter_id}_Full.wav"
    final_path = GENERATED_DIR / final_filename
    
    # Save using the model's sample rate
    torchaudio.save(str(final_path), full_audio, get_model().sr, bits_per_sample=16)

    data["full_audio_filename"] = final_filename
    with open(paths["chunks"], "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    return {"success": True, "url": f"/files/{final_filename}", "filename": final_filename}

def chunk_sentences(text: str, size: int = 3) -> list[str]:
    """Split text into groups of `size` sentences."""
    import re
    sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', text) if s.strip()]
    return [" ".join(sentences[i:i+size]) for i in range(0, len(sentences), size)]


def generate_summary_wav(chapter_id: str, summary_text: str) -> str:
    """Generate chunked TTS for summary text, concatenate, return filename."""
    chunks = chunk_sentences(summary_text, size=3)
    wavs = []
    for i, chunk in enumerate(chunks):
        print_gen_status(f"summary chunk {i+1}/{len(chunks)}", chunk)
        wav_cpu = get_beemo_voice(chunk)
        wavs.append(wav_cpu)
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

    combined = torch.cat(wavs, dim=1)
    filename = f"{chapter_id}_summary.wav"
    torchaudio.save(str(GENERATED_DIR / filename), combined, get_model().sr, bits_per_sample=16)
    return filename


@app.post("/chapters/{chapter_id}/generate-summary")
def generate_summary_audio(chapter_id: str):
    paths = get_chapter_paths(chapter_id)
    if not paths["summary"].exists():
        raise HTTPException(status_code=404, detail="summary.json not found.")

    with open(paths["summary"], "r", encoding="utf-8") as f:
        summary_data = json.load(f)

    summary_text = summary_data.get("summary", "").strip()
    if not summary_text:
        raise HTTPException(status_code=400, detail="No summary text found.")

    filename = generate_summary_wav(chapter_id, summary_text)

    if paths["chunks"].exists():
        with open(paths["chunks"], "r", encoding="utf-8") as f:
            data = json.load(f)
        data["summary_audio_filename"] = filename
        with open(paths["chunks"], "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

    return {"success": True, "url": f"/files/{filename}", "filename": filename}


@app.post("/chapters/generate-all-summaries")
def generate_all_summaries():
    if not CHAPTERS_ROOT.exists():
        return {"success": False, "error": "No chapters found."}
    results = []
    for chapter_dir in sorted(CHAPTERS_ROOT.iterdir()):
        if not chapter_dir.is_dir():
            continue
        chapter_id = chapter_dir.name
        summary_path = chapter_dir / "summary.json"
        chunks_path = chapter_dir / "audio_chunks.json"
        if not summary_path.exists():
            results.append({"chapter_id": chapter_id, "skipped": True, "reason": "no summary.json"})
            continue
        with open(summary_path, "r", encoding="utf-8") as f:
            summary_data = json.load(f)
        summary_text = summary_data.get("summary", "").strip()
        if not summary_text:
            results.append({"chapter_id": chapter_id, "skipped": True, "reason": "empty summary"})
            continue
        filename = generate_summary_wav(chapter_id, summary_text)
        if chunks_path.exists():
            with open(chunks_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            data["summary_audio_filename"] = filename
            with open(chunks_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
        results.append({"chapter_id": chapter_id, "success": True, "url": f"/files/{filename}"})
    return {"success": True, "results": results}


# --- Iteration endpoints ---

@app.get("/chapters/{chapter_id}/iterations")
def get_iterations(chapter_id: str):
    meta = get_chapter_meta(chapter_id)
    return {
        "iterations": list_iterations(chapter_id),
        "active_iteration": meta.get("active_iteration"),
    }

@app.get("/chapters/{chapter_id}/iterations/{iteration}")
def get_iteration(chapter_id: str, iteration: int):
    ipaths = get_iteration_paths(chapter_id, iteration)
    if not ipaths["chunks"].exists():
        raise HTTPException(status_code=404, detail="Iteration not found.")
    with open(ipaths["chunks"], "r", encoding="utf-8") as f:
        data = normalize_iteration_data(json.load(f))
    summary_data = {}
    if ipaths["summary"].exists():
        with open(ipaths["summary"], "r", encoding="utf-8") as f:
            summary_data = json.load(f)
    story_chunks = data.get("story_chunks", [])
    lesson_chunks = data.get("lesson_chunks", [])
    story_audio_urls = [iter_audio_url(chapter_id, iteration, "story", i) for i in range(len(story_chunks))]
    lesson_audio_urls = [iter_audio_url(chapter_id, iteration, "lesson", i) for i in range(len(lesson_chunks))]
    audio_dir = ipaths["audio_dir"]
    summary_audio = next((f"/files/{chapter_id}/iteration-{iteration}/audio/summary.{ext}" for ext in ("mp3","wav") if (audio_dir / f"summary.{ext}").exists()), None)
    full_audio = next((f"/files/{chapter_id}/iteration-{iteration}/audio/full.{ext}" for ext in ("mp3","wav") if (audio_dir / f"full.{ext}").exists()), None)
    return {
        "title": data.get("title", ""),
        "story_chunks": story_chunks,
        "lesson_chunks": lesson_chunks,
        "story_audio_urls": story_audio_urls,
        "lesson_audio_urls": lesson_audio_urls,
        "summary": summary_data,
        "summary_audio_url": summary_audio,
        "full_audio_url": full_audio,
    }

@app.post("/chapters/{chapter_id}/set-active")
def set_active_iteration(chapter_id: str, request: SetActiveRequest):
    meta = get_chapter_meta(chapter_id)
    meta["active_iteration"] = request.iteration
    set_chapter_meta(chapter_id, meta)
    return {"success": True}

class SummaryUpdateRequest(BaseModel):
    summary: str

@app.put("/chapters/{chapter_id}/iterations/{iteration}/summary")
def update_iteration_summary(chapter_id: str, iteration: int, request: SummaryUpdateRequest):
    ipaths = get_iteration_paths(chapter_id, iteration)
    if not ipaths["summary"].exists():
        raise HTTPException(status_code=404, detail="summary.json not found.")
    with open(ipaths["summary"], "r", encoding="utf-8") as f:
        data = json.load(f)
    data["summary"] = request.summary
    with open(ipaths["summary"], "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    return {"success": True}

@app.post("/chapters/{chapter_id}/iterations/{iteration}/generate-summary")
def generate_iteration_summary(chapter_id: str, iteration: int):
    ipaths = get_iteration_paths(chapter_id, iteration)
    if not ipaths["summary"].exists():
        raise HTTPException(status_code=404, detail="summary.json not found.")
    with open(ipaths["summary"], "r", encoding="utf-8") as f:
        summary_data = json.load(f)
    summary_text = summary_data.get("summary", "").strip()
    if not summary_text:
        # Fall back to joining summary_chunks array if present
        summary_chunks_list = summary_data.get("summary_chunks", [])
        summary_text = " ".join(summary_chunks_list).strip()
    if not summary_text:
        raise HTTPException(status_code=400, detail="No summary text.")
    chunks_text = chunk_sentences(summary_text, size=3)
    wavs = []
    for i, chunk in enumerate(chunks_text):
        print_gen_status(f"iter-{iteration} summary {i+1}/{len(chunks_text)}", chunk)
        wavs.append(get_beemo_voice(chunk))
        if torch.cuda.is_available(): torch.cuda.empty_cache()
    combined = torch.cat(wavs, dim=1)
    out_path = ipaths["audio_dir"] / "summary.mp3"
    save_mp3(combined, get_model().sr, out_path)
    url = f"/files/{chapter_id}/iteration-{iteration}/audio/summary.mp3"
    return {"success": True, "url": url}

@app.post("/chapters/{chapter_id}/iterations/{iteration}/concatenate")
def concatenate_iteration(chapter_id: str, iteration: int):
    ipaths = get_iteration_paths(chapter_id, iteration)
    if not ipaths["chunks"].exists():
        return {"success": False, "error": "Iteration not found."}
    with open(ipaths["chunks"], "r", encoding="utf-8") as f:
        data = json.load(f)
    story_chunks = data.get("story_chunks", [])
    lesson_chunks = data.get("lesson_chunks", [])
    audio_dir = ipaths["audio_dir"]
    all_wavs = []
    for i in range(len(story_chunks)):
        p = next((audio_dir / f"chunk-story-{i}.{ext}" for ext in ("mp3","wav") if (audio_dir / f"chunk-story-{i}.{ext}").exists()), None)
        if not p: return {"success": False, "error": f"story chunk {i} missing."}
        wf, _ = torchaudio.load(str(p))
        all_wavs.append(wf)
    for i in range(len(lesson_chunks)):
        p = next((audio_dir / f"chunk-lesson-{i}.{ext}" for ext in ("mp3","wav") if (audio_dir / f"chunk-lesson-{i}.{ext}").exists()), None)
        if not p: return {"success": False, "error": f"lesson chunk {i} missing."}
        wf, _ = torchaudio.load(str(p))
        all_wavs.append(wf)
    full = torch.cat(all_wavs, dim=1)
    out_path = audio_dir / "full.mp3"
    save_mp3(full, get_model().sr, out_path)
    url = f"/files/{chapter_id}/iteration-{iteration}/audio/full.mp3"
    return {"success": True, "url": url}

@app.post("/chapters/{chapter_id}/iterations/{iteration}/insert")
def insert_iteration_chunk(chapter_id: str, iteration: int, request: IterationInsertRequest):
    ipaths = get_iteration_paths(chapter_id, iteration)
    if not ipaths["chunks"].exists():
        return {"success": False, "error": "Iteration not found."}
    with open(ipaths["chunks"], "r", encoding="utf-8") as f:
        data = json.load(f)
    key = f"{request.chunk_type}_chunks"
    chunks = data.get(key, [])
    insert_at = len(chunks) if request.index == -1 else max(0, min(request.index, len(chunks)))
    chunks.insert(insert_at, "")
    audio_dir = ipaths["audio_dir"]
    ctype = request.chunk_type
    for i in range(len(chunks) - 1, insert_at, -1):
        src = iter_chunk_path(audio_dir, ctype, i - 1)
        if src:
            src.rename(audio_dir / f"chunk-{ctype}-{i}{src.suffix}")
    data[key] = chunks
    data.pop("full_audio_filename", None)
    with open(ipaths["chunks"], "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    return {"success": True}

@app.post("/chapters/{chapter_id}/iterations/{iteration}/delete")
def delete_iteration_chunk(chapter_id: str, iteration: int, request: IterationDeleteRequest):
    ipaths = get_iteration_paths(chapter_id, iteration)
    if not ipaths["chunks"].exists():
        return {"success": False, "error": "Iteration not found."}
    with open(ipaths["chunks"], "r", encoding="utf-8") as f:
        data = json.load(f)
    key = f"{request.chunk_type}_chunks"
    chunks = data.get(key, [])
    if request.index < 0 or request.index >= len(chunks):
        return {"success": False, "error": "Index out of range."}
    chunks.pop(request.index)
    audio_dir = ipaths["audio_dir"]
    ctype = request.chunk_type
    iter_chunk_delete(audio_dir, ctype, request.index)
    for i in range(request.index, len(chunks)):
        src = iter_chunk_path(audio_dir, ctype, i + 1)
        if src:
            src.rename(audio_dir / f"chunk-{ctype}-{i}{src.suffix}")
    data[key] = chunks
    with open(ipaths["chunks"], "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    return {"success": True}

@app.post("/chapters/{chapter_id}/iterations/{iteration}/update")
def update_iteration_chunk(chapter_id: str, iteration: int, request: IterationChunkUpdate):
    ipaths = get_iteration_paths(chapter_id, iteration)
    if not ipaths["chunks"].exists():
        return {"success": False, "error": "Iteration not found."}
    with open(ipaths["chunks"], "r", encoding="utf-8") as f:
        data = json.load(f)
    key = f"{request.chunk_type}_chunks"
    chunks = data.get(key, [])
    if request.index < 0 or request.index >= len(chunks):
        return {"success": False, "error": "Index out of range."}
    chunks[request.index] = request.text
    iter_chunk_delete(ipaths["audio_dir"], request.chunk_type, request.index)
    data[key] = chunks
    with open(ipaths["chunks"], "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    return {"success": True}

@app.post("/chapters/{chapter_id}/iterations/{iteration}/fix-alignment")
def fix_iteration_alignment(chapter_id: str, iteration: int):
    ipaths = get_iteration_paths(chapter_id, iteration)
    if not ipaths["chunks"].exists():
        return {"success": False, "error": "Iteration not found."}
    with open(ipaths["chunks"], "r", encoding="utf-8") as f:
        data = json.load(f)
    audio_dir = ipaths["audio_dir"]
    removed = []
    for ctype in ("story", "lesson"):
        count = len(data.get(f"{ctype}_chunks", []))
        i = count
        while True:
            orphan = iter_chunk_path(audio_dir, ctype, i)
            if not orphan: break
            removed.append(orphan.name)
            orphan.unlink()
            i += 1
    with open(ipaths["chunks"], "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    return {"success": True, "removed": removed}


# --- Legacy chunk endpoints (backward compat) ---

class InsertRequest(BaseModel):
    index: int  # -1 means append

@app.post("/chapters/{chapter_id}/insert")
def insert_chunk(chapter_id: str, request: InsertRequest):
    paths = get_chapter_paths(chapter_id)
    if not paths["chunks"].exists():
        return {"success": False, "error": "Chapter not found."}
    with open(paths["chunks"], "r", encoding="utf-8") as f:
        data = json.load(f)
    chunks = data.get("chunks", [])
    insert_at = len(chunks) if request.index == -1 else max(0, min(request.index, len(chunks)))
    chunks.insert(insert_at, "")
    # Shift existing audio files for indices >= insert_at
    for i in range(len(chunks) - 1, insert_at, -1):
        old_path = GENERATED_DIR / f"{chapter_id}_chunk{i - 1}.wav"
        new_path = GENERATED_DIR / f"{chapter_id}_chunk{i}.wav"
        if old_path.exists():
            old_path.rename(new_path)
    data["chunks"] = chunks
    data.pop("full_audio_filename", None)
    with open(paths["chunks"], "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    return {"success": True}


class DeleteRequest(BaseModel):
    index: int

@app.post("/chapters/{chapter_id}/delete")
def delete_chunk(chapter_id: str, request: DeleteRequest):
    paths = get_chapter_paths(chapter_id)
    if not paths["chunks"].exists():
        return {"success": False, "error": "Chapter not found."}
    with open(paths["chunks"], "r", encoding="utf-8") as f:
        data = json.load(f)
    chunks = data.get("chunks", [])
    if request.index < 0 or request.index >= len(chunks):
        return {"success": False, "error": "Index out of range."}
    chunks.pop(request.index)
    # Remove audio file for deleted chunk, shift remaining down
    deleted_path = GENERATED_DIR / f"{chapter_id}_chunk{request.index}.wav"
    if deleted_path.exists():
        deleted_path.unlink()
    for i in range(request.index, len(chunks)):
        old_path = GENERATED_DIR / f"{chapter_id}_chunk{i + 1}.wav"
        new_path = GENERATED_DIR / f"{chapter_id}_chunk{i}.wav"
        if old_path.exists():
            old_path.rename(new_path)
    data["chunks"] = chunks
    data.pop("full_audio_filename", None)
    with open(paths["chunks"], "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    return {"success": True}


@app.post("/chapters/{chapter_id}/update")
def update_chunk(chapter_id: str, request: ChunkUpdate):
    paths = get_chapter_paths(chapter_id)
    if not paths["chunks"].exists():
        return {"success": False, "error": "Chapter not found."}
    with open(paths["chunks"], "r", encoding="utf-8") as f:
        data = json.load(f)
    chunks = data.get("chunks", [])
    if request.index < 0 or request.index >= len(chunks):
        return {"success": False, "error": "Index out of range."}
    chunks[request.index] = request.text
    # Invalidate audio for this chunk since text changed
    stale_path = GENERATED_DIR / f"{chapter_id}_chunk{request.index}.wav"
    if stale_path.exists():
        stale_path.unlink()
    data["chunks"] = chunks
    data.pop("full_audio_filename", None)
    with open(paths["chunks"], "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    return {"success": True}


@app.post("/chapters/{chapter_id}/fix-alignment")
def fix_alignment(chapter_id: str):
    """Remove orphan audio files that have no corresponding chunk."""
    paths = get_chapter_paths(chapter_id)
    if not paths["chunks"].exists():
        return {"success": False, "error": "Chapter not found."}
    with open(paths["chunks"], "r", encoding="utf-8") as f:
        data = json.load(f)
    chunk_count = len(data.get("chunks", []))
    removed = []
    i = chunk_count
    while True:
        orphan = GENERATED_DIR / f"{chapter_id}_chunk{i}.wav"
        if not orphan.exists():
            break
        orphan.unlink()
        removed.append(str(orphan.name))
        i += 1
    data.pop("full_audio_filename", None)
    with open(paths["chunks"], "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    return {"success": True, "removed": removed}


if FRONTEND_BUILD.exists():
    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_svelte(full_path: str):
        target = FRONTEND_BUILD / full_path
        if target.is_file():
            return FileResponse(target)
        return FileResponse(FRONTEND_BUILD / "index.html")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8100)