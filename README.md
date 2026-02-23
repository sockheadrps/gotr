# Voice Worker (ChatterboxTTS)

Text-to-speech worker using ChatterboxTTS. Connects to BeemoTooling Hub and generates audio on demand.

**Requires GPU** — runs on a machine with CUDA-capable GPU.

## Setup

```bash
cd workers/voice
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
# or: .venv\Scripts\activate  # Windows

# Install PyTorch with CUDA first
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu121

# Then other dependencies
pip install -r requirements.txt
```

## Configuration

Copy `.env.example` to `.env` and adjust:

```bash
cp .env.example .env
```

Environment variables:
| Variable | Description | Default |
|----------|-------------|---------|
| `HUB_HOST` | Hub hostname | `localhost` |
| `HUB_PORT` | Hub port | `8300` |
| `HUB_SSL` | Use secure WebSocket | `false` |
| `HUB_AUTH_TOKEN` | API key for hub auth | (none) |

## Reference Audio

Place a reference audio file at `audio/reference/beemo.wav` for voice cloning. This determines the voice style used for TTS.

## Run

```bash
# Local development
python worker.py

# With explicit hub connection
python worker.py --hub-host localhost --hub-port 8300

# Production (remote hub over HTTPS)
python worker.py --hub-host beemo.yourdomain.com --hub-port 443 --ssl --token YOUR_API_KEY

# Custom audio server port (default 8301)
python worker.py --audio-port 8302
```

## How It Works

1. Worker connects to hub via WebSocket
2. Receives `speak` or `generate` commands with text
3. Generates audio using ChatterboxTTS on GPU
4. Serves audio file via built-in HTTP server
5. Returns URL to the generated audio

## Commands

| Command | Description |
|---------|-------------|
| `speak` | Generate TTS and queue for playback |
| `generate` | Generate TTS and return URL only |
| `stop` | Stop current generation |
| `status` | Get model/GPU status |
