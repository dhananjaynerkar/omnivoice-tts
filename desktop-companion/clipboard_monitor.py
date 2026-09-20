import time
import threading
import pyperclip
from server import clean_markdown_for_speech, tts_engine

def start_clipboard_monitor():
    """
    Monitors the Windows clipboard for Rapid Double Ctrl+C (or Double Copy).
    When the user highlights any text (in VS Code Markdown Preview, editor, terminal, or any app)
    and presses Ctrl+C twice in rapid succession (< 800ms), it immediately speaks the text aloud!
    """
    def monitor_loop():
        last_text = ""
        last_copy_time = 0.0

        while True:
            try:
                time.sleep(0.12)
                current = pyperclip.paste()
                if not current or not current.strip():
                    continue

                now = time.time()
                # If same text is copied twice within 0.8 seconds -> TRIGGER SPEECH!
                if current == last_text:
                    if 0.08 < (now - last_copy_time) < 0.85:
                        last_copy_time = 0.0  # Reset trigger
                        preview = current[:60].replace("\n", " ") + ("..." if len(current) > 60 else "")
                        print(f"\n[Double-Copy Triggered] Reading: \"{preview}\"", flush=True)
                        cleaned = clean_markdown_for_speech(current)
                        tts_engine.speak(cleaned)
                    continue

                # First copy: remember text and timestamp
                last_text = current
                last_copy_time = now
            except Exception:
                time.sleep(0.3)

    thread = threading.Thread(target=monitor_loop, daemon=True, name="ClipboardMonitor")
    thread.start()
    print("[Clipboard Monitor] Rapid Double Ctrl+C listener active (Press Ctrl+C twice to speak!)")
