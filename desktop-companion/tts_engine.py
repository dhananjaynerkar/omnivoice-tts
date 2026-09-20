import sys
import time
import threading
from typing import Optional

class LocalTTS:
    """
    High-performance Windows SAPI5 Speech Synthesizer.
    Uses a SINGLE persistent COM object per thread with proper locking
    so that SVSFPurgeBeforeSpeak actually cancels previous speech,
    and stop() actually stops the active voice.
    """
    def __init__(self):
        self._lock = threading.Lock()
        self._speaker = None
        self._speaker_thread_id = None
        self._last_speak_time = 0.0
        self._debounce_ms = 400  # Ignore duplicate speak() calls within 400ms
        self._init_engine()

    def _init_engine(self):
        if sys.platform == "win32":
            try:
                import win32com.client
                import pythoncom
                pythoncom.CoInitialize()
                self._speaker = win32com.client.Dispatch("SAPI.SpVoice")
                self._speaker_thread_id = threading.current_thread().ident
                print("[Companion TTS] Native Windows SAPI5 Speech Engine initialized.")
            except Exception as e:
                print(f"[Companion TTS] Could not initialize Windows SAPI: {e}")

    def _get_speaker(self):
        """Get or create the SpVoice COM object for the current thread.
        COM objects are thread-affine, so if called from a different thread
        we must create a new one. But we keep it for reuse on that thread."""
        current_thread = threading.current_thread().ident
        if self._speaker is not None and self._speaker_thread_id == current_thread:
            return self._speaker
        # Different thread - create a new COM object for this thread
        try:
            import pythoncom
            import win32com.client
            pythoncom.CoInitialize()
            speaker = win32com.client.Dispatch("SAPI.SpVoice")
            # Store it so subsequent calls from this same thread reuse it
            self._speaker = speaker
            self._speaker_thread_id = current_thread
            return speaker
        except Exception as e:
            print(f"[Companion TTS] COM init error: {e}")
            return None

    def speak(self, text: str, rate: Optional[float] = None, volume: Optional[float] = None):
        if not text or not text.strip():
            return

        # Debounce: ignore duplicate calls within 400ms (prevents double-speaking)
        now = time.time()
        if (now - self._last_speak_time) < (self._debounce_ms / 1000.0):
            print(f"[Companion TTS] Debounced duplicate speak() call (within {self._debounce_ms}ms)")
            return
        self._last_speak_time = now

        with self._lock:
            try:
                speaker = self._get_speaker()
                if not speaker:
                    return

                # SAPI rate is from -10 to +10 (0 is normal)
                if rate:
                    sapi_rate = int((rate - 1.0) * 5)
                    speaker.Rate = max(-10, min(10, sapi_rate))

                # SAPI volume is from 0 to 100
                if volume is not None:
                    speaker.Volume = int(max(0.0, min(1.0, volume)) * 100)

                # SVSFlagsAsync = 1 (Async speech so it doesn't block the caller)
                # SVSFPurgeBeforeSpeak = 2 (Stop any previous speech on THIS instance)
                SVSFlagsAsync = 1
                SVSFPurgeBeforeSpeak = 2
                flags = SVSFlagsAsync | SVSFPurgeBeforeSpeak
                speaker.Speak(text, flags)
            except Exception as e:
                print(f"[Companion TTS] Speech error: {e}")
                # Reset speaker on error so it's recreated next time
                self._speaker = None
                self._speaker_thread_id = None

    def stop(self):
        with self._lock:
            try:
                speaker = self._get_speaker()
                if speaker:
                    # Purge on the SAME instance that is currently speaking
                    speaker.Speak("", 2)  # SVSFPurgeBeforeSpeak
                    print("[Companion TTS] Speech stopped.")
            except Exception as e:
                print(f"[Companion TTS] Stop error: {e}")
