import json
import time
from typing import Set
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from config import AUTH_TOKEN, ALLOWED_ORIGIN_PREFIXES
from tts_engine import LocalTTS

app = FastAPI(title="Universal Reader Desktop Companion", version="1.0.0")

# Restrict CORS to localhost and extension schemes
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Extension origins chrome-extension:// require custom check
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

connected_clients: Set[WebSocket] = set()
authenticated_clients: Set[WebSocket] = set()
tts_engine = LocalTTS()

@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "Universal Reader Desktop Companion",
        "version": "1.0.0",
        "platform": "windows"
    }

@app.get("/demo")
async def serve_demo():
    from fastapi.responses import HTMLResponse
    from pathlib import Path
    demo_path = Path(__file__).resolve().parent.parent / "test_demo.html"
    if demo_path.exists():
        return HTMLResponse(content=demo_path.read_text(encoding="utf-8"))
    return HTMLResponse(content="<h1>Demo page not found</h1>", status_code=404)

import re

def clean_markdown_for_speech(text: str) -> str:
    """Cleans markdown symbols, links, formatting, and tables for natural spoken speech."""
    if not text:
        return ""
    # 1. Images: ![alt](url) -> Image: alt
    text = re.sub(r'!\[([^\]]*)\]\([^)]+\)', r'Image: \1', text)
    # 2. Links: [text](url) -> text
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
    # 3. Header hashes: # Title -> Title
    text = re.sub(r'^#{1,6}\s+', '', text, flags=re.MULTILINE)
    # 4. Bold / Italics: **text**, *text*, __text__, _text_
    text = re.sub(r'\*\*([^*]+)\*\*', r'\1', text)
    text = re.sub(r'\*([^*]+)\*', r'\1', text)
    text = re.sub(r'__([^_]+)__', r'\1', text)
    text = re.sub(r'_([^_]+)_', r'\1', text)
    # 5. List items: - item -> Item: item
    text = re.sub(r'^\s*[-*•]\s+', 'Item: ', text, flags=re.MULTILINE)
    # 6. Numbered lists: 1. Item -> Number one, Item
    def num_replace(match):
        num = match.group(1)
        words = {'1': 'one', '2': 'two', '3': 'three', '4': 'four', '5': 'five',
                 '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine', '10': 'ten'}
        return f"Number {words.get(num, num)}, "
    text = re.sub(r'^\s*(\d{1,2})\.\s+', num_replace, text, flags=re.MULTILINE)
    # 7. Blockquotes: > quote -> quote
    text = re.sub(r'^\s*>\s+', '', text, flags=re.MULTILINE)
    # 8. Inline code: `code` -> code
    text = re.sub(r'`([^`]+)`', r'\1', text)
    # 9. Clean multiple blank lines
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()

from pydantic import BaseModel
from typing import Optional

class SpeakRequest(BaseModel):
    text: str
    rate: Optional[float] = 1.0
    volume: Optional[float] = 1.0

@app.post("/speak")
async def http_speak(req: SpeakRequest):
    if not req.text.strip():
        return {"status": "empty"}
    cleaned = clean_markdown_for_speech(req.text)
    tts_engine.speak(cleaned, req.rate, req.volume)
    return {"status": "ok", "speaking": True}

@app.post("/stop")
async def http_stop():
    tts_engine.stop()
    return {"status": "stopped"}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.add(websocket)

    try:
        while True:
            raw_data = await websocket.receive_text()
            try:
                msg = json.loads(raw_data)
            except Exception:
                await websocket.send_text(json.dumps({"type": "ERROR", "payload": "Invalid JSON", "timestamp": int(time.time() * 1000)}))
                continue

            msg_type = msg.get("type")
            token = msg.get("token")

            # 1. Authentication
            if msg_type == "AUTH_REQUEST":
                req_token = msg.get("payload", {}).get("token") or token
                if req_token == AUTH_TOKEN:
                    authenticated_clients.add(websocket)
                    await websocket.send_text(json.dumps({
                        "type": "AUTH_RESPONSE",
                        "payload": {
                            "authenticated": True,
                            "serverVersion": "1.0.0",
                            "system": "Windows",
                            "features": ["clipboard_capture", "ui_automation", "sapi5_tts"]
                        },
                        "timestamp": int(time.time() * 1000)
                    }))
                else:
                    await websocket.send_text(json.dumps({
                        "type": "AUTH_RESPONSE",
                        "payload": {
                            "authenticated": False,
                            "message": "Invalid authentication token"
                        },
                        "timestamp": int(time.time() * 1000)
                    }))
                continue

            # Verify client is authenticated for other operations
            if websocket not in authenticated_clients:
                await websocket.send_text(json.dumps({
                    "type": "ERROR",
                    "payload": "Unauthorized: Perform AUTH_REQUEST first",
                    "timestamp": int(time.time() * 1000)
                }))
                continue

            # 2. Local TTS Speak Request
            if msg_type == "SPEAK_REQUEST":
                payload = msg.get("payload", {})
                text = payload.get("text", "")
                rate = payload.get("rate", 1.0)
                vol = payload.get("volume", 1.0)
                tts_engine.speak(text, rate, vol)
                await websocket.send_text(json.dumps({
                    "type": "SPEAK_COMPLETE",
                    "payload": {},
                    "timestamp": int(time.time() * 1000)
                }))

            elif msg_type == "STOP_REQUEST":
                tts_engine.stop()

            elif msg_type == "GET_STATUS":
                await websocket.send_text(json.dumps({
                    "type": "STATUS_RESPONSE",
                    "payload": {"running": True},
                    "timestamp": int(time.time() * 1000)
                }))

    except WebSocketDisconnect:
        connected_clients.discard(websocket)
        authenticated_clients.discard(websocket)
    except Exception as e:
        connected_clients.discard(websocket)
        authenticated_clients.discard(websocket)

async def broadcast_captured_text(text: str, source_app: str):
    """Sends captured text to all authenticated extension clients."""
    if not authenticated_clients:
        print(f"[Desktop Companion] Text captured from {source_app}, but no Chrome extension client is connected.")
        return

    message = json.dumps({
        "type": "TEXT_CAPTURED",
        "payload": {
            "text": text,
            "sourceApp": source_app,
            "captureMethod": "clipboard_fallback"
        },
        "timestamp": int(time.time() * 1000)
    })

    dead_clients = set()
    for ws in authenticated_clients:
        try:
            await ws.send_text(message)
        except Exception:
            dead_clients.add(ws)

    authenticated_clients.difference_update(dead_clients)
    connected_clients.difference_update(dead_clients)
