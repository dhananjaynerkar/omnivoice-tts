import asyncio
import threading
import sys
import uvicorn
from config import HOST, PORT, AUTH_TOKEN, TOKEN_FILE
from server import app, broadcast_captured_text, authenticated_clients, tts_engine, clean_markdown_for_speech
from capture import capture_selected_text_clipboard

loop = None
registered_hooks = []

def _do_capture_and_speak():
    """
    Runs text capture and TTS in a worker thread (NOT on the keyboard hook thread).
    This is critical because Windows will silently remove our keyboard hook
    if the hook callback takes longer than ~200-300ms (LowLevelHooksTimeout).
    capture_selected_text_clipboard() takes ~650ms, so it MUST run off-hook.
    """
    text, source_app = capture_selected_text_clipboard()
    if text and text.strip():
        preview = text[:70].replace("\n", " ") + ("..." if len(text) > 70 else "")
        print(f"[Captured from {source_app}]: \"{preview}\"")

        cleaned = clean_markdown_for_speech(text)
        print(f"[Desktop Companion] Speaking directly with Windows Native voice...")
        tts_engine.speak(cleaned)

        # Also forward to connected Chrome extension tab if active
        if len(authenticated_clients) > 0 and loop:
            print(f"[Desktop Companion] Forwarding to {len(authenticated_clients)} connected Chrome tab(s)...")
            asyncio.run_coroutine_threadsafe(broadcast_captured_text(text, source_app), loop)
    else:
        print(f"[Captured from {source_app}]: No text selected or clipboard empty.")

def on_hotkey_triggered():
    """Called by the keyboard hook thread — must return FAST (<200ms)."""
    print("\n[Hotkey Triggered] Capturing selected text from active window...")
    # Spawn a worker thread so the hook thread returns immediately
    t = threading.Thread(target=_do_capture_and_speak, daemon=True)
    t.start()

def on_stop_triggered():
    print("\n[Stop Triggered] Stopping speech playback...")
    tts_engine.stop()

def start_hotkey_listener():
    global registered_hooks
    try:
        import keyboard
        # Register reading hotkeys: F8, Ctrl+Shift+R, Ctrl+Alt+R
        hook1 = keyboard.add_hotkey('f8', on_hotkey_triggered, suppress=False)
        hook2 = keyboard.add_hotkey('ctrl+shift+r', on_hotkey_triggered, suppress=False)
        hook3 = keyboard.add_hotkey('ctrl+alt+r', on_hotkey_triggered, suppress=False)
        # Register stopping hotkeys: F9, Ctrl+Shift+X, Ctrl+Alt+X
        hook4 = keyboard.add_hotkey('f9', on_stop_triggered, suppress=False)
        hook5 = keyboard.add_hotkey('ctrl+shift+x', on_stop_triggered, suppress=False)
        hook6 = keyboard.add_hotkey('ctrl+alt+x', on_stop_triggered, suppress=False)
        registered_hooks.extend([hook1, hook2, hook3, hook4, hook5, hook6])
        print("[Global Hotkeys Registered]")
        print("  * READ SELECTION:  [F8]  or  [Ctrl + Shift + R]  or  [Ctrl + Alt + R]")
        print("  * STOP SPEECH:     [F9]  or  [Ctrl + Shift + X]  or  [Ctrl + Alt + X]")
    except Exception as e:
        print(f"[Global Hotkey Warning] Could not register global hotkey: {e}")
        print("Selection capture will still be available via VS Code extension & HTTP API.")

from clipboard_monitor import start_clipboard_monitor

def print_banner():
    print("=" * 68)
    print("   UNIVERSAL READER - DESKTOP COMPANION (VS CODE & WINDOWS)")
    print("=" * 68)
    print(f" * Server Host:       http://{HOST}:{PORT}")
    print(f" * WebSocket URL:     ws://{HOST}:{PORT}/ws")
    print(f" * Security Token:    {AUTH_TOKEN}")
    print(f" * Double-Copy:       Press Ctrl+C twice on any highlighted text")
    print(f" * Read Hotkeys:      F8   or   Ctrl + Shift + R   or   Ctrl + Alt + R")
    print(f" * Stop Hotkeys:      F9   or   Ctrl + Shift + X   or   Ctrl + Alt + X")
    print("-" * 68)
    print("HOW TO READ IN VS CODE (PREVIEW OR EDITOR):")
    print("  1. Highlight/select any text in VS Code.")
    print("  2. Press: Ctrl + C twice  (or  F8  or  Ctrl + Shift + R)")
    print("     -> Text is spoken aloud immediately through your speakers!")
    print("  3. Press [Ctrl + Shift + X]  or  [F9] to stop speech.")
    print("=" * 68)

if __name__ == "__main__":
    print_banner()
    start_hotkey_listener()
    start_clipboard_monitor()

    # Capture asyncio loop for thread-safe websocket broadcasts
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    config = uvicorn.Config(app, host=HOST, port=PORT, loop="asyncio", log_level="info")
    server = uvicorn.Server(config)
    loop.run_until_complete(server.serve())
