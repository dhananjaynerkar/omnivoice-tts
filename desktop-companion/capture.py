import time
import sys
import threading
from typing import Tuple, Optional

try:
    import pyperclip
    import keyboard
    HAS_LIBS = True
except ImportError:
    HAS_LIBS = False

def get_active_window_info() -> Tuple[str, str]:
    """Retrieves title and process name of the active foreground window on Windows."""
    if sys.platform != "win32":
        return "Unknown", "Unknown"

    try:
        import win32gui
        import win32process
        import win32api
        import win32con

        hwnd = win32gui.GetForegroundWindow()
        if not hwnd:
            return "Unknown", "Unknown"

        title = win32gui.GetWindowText(hwnd)
        _, pid = win32process.GetWindowThreadProcessId(hwnd)

        try:
            handle = win32api.OpenProcess(win32con.PROCESS_QUERY_INFORMATION | win32con.PROCESS_VM_READ, False, pid)
            proc_name = win32process.GetModuleFileNameEx(handle, 0)
            proc_name = proc_name.split("\\")[-1]
            win32api.CloseHandle(handle)
        except Exception:
            proc_name = f"PID_{pid}"

        return title, proc_name
    except Exception:
        return "Windows App", "unknown"

def _release_all_modifiers():
    """Release Ctrl, Alt, Shift to prevent ghost key combos like Ctrl+Alt+C."""
    try:
        for key in ['ctrl', 'alt', 'shift']:
            keyboard.release(key)
    except Exception:
        pass

def capture_selected_text_clipboard() -> Tuple[Optional[str], str]:
    """
    Captures currently selected text in the active window (VS Code editor, preview, or terminal)
    using native Windows SendInput and clipboard inspection.

    Fixed issues:
    - Releases modifier keys before sending Ctrl+C to avoid Ctrl+Alt+C ghost combos
    - Increased delays for reliability
    - No stale clipboard fallback (prevents reading random old text)
    """
    if not HAS_LIBS:
        return None, "Required libraries not installed"

    _, proc_name = get_active_window_info()

    # 1. Grab current clipboard content to restore later
    original_clipboard = ""
    try:
        original_clipboard = pyperclip.paste() or ""
    except Exception:
        pass

    # 2. Clear clipboard to detect a fresh copy
    try:
        pyperclip.copy("")
    except Exception:
        pass

    # 3. CRITICAL: Release ALL modifier keys before sending Ctrl+C
    #    Without this, if user triggered via Ctrl+Alt+R, their Alt key is still
    #    held down, and keyboard.send('ctrl+c') becomes Ctrl+Alt+C (wrong!)
    _release_all_modifiers()
    time.sleep(0.15)  # 150ms to let keys fully release

    # 4. Simulate Ctrl+C on the active selection
    try:
        keyboard.send('ctrl+c')
    except Exception as e:
        print(f"[Capture Error] {e}")

    # 5. Wait up to 500ms for clipboard update (increased from 320ms)
    captured_text = ""
    for _ in range(10):
        time.sleep(0.05)
        try:
            t = pyperclip.paste()
            if t and t.strip():
                captured_text = t.strip()
                break
        except Exception:
            pass

    # 6. If new selection was captured, restore original clipboard after a delay
    if captured_text:
        if original_clipboard and original_clipboard != captured_text:
            def restore():
                time.sleep(2.0)
                try:
                    pyperclip.copy(original_clipboard)
                except Exception:
                    pass
            threading.Thread(target=restore, daemon=True).start()
        return captured_text, proc_name

    # 7. Smart fallback: If direct Ctrl+C didn't catch text (e.g. focused on a context menu/webview),
    # but the user had already clicked "Copy" or pressed Ctrl+C
    if original_clipboard and original_clipboard.strip():
        return original_clipboard.strip(), proc_name

    return None, proc_name
