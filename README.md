# Universal Reader (ReadingX) 🔊

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Manifest V3](https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-success.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.10%2B-blue?logo=python)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![Tests](https://img.shields.io/badge/Tests-21%20Passed-brightgreen.svg)]()
[![Use Cases](https://img.shields.io/badge/Documentation-Use%20Cases-orange.svg)](USE_CASES.md)

> A production-quality, privacy-first **Universal Text-to-Speech (TTS) Ecosystem** featuring a **Chrome Manifest V3 Extension**, **Native VS Code Extension**, and **Windows Desktop Companion**. Read highlighted text, articles, documentation, PDFs, code, and Markdown files with zero-lag offline local voices or Google AI (Gemini).

👉 **[Explore Real-World Use Cases & Applications 🎯](USE_CASES.md)**

---

## 🌟 Key Features

### 1. Universal Reading Anywhere
* **In Chrome & Webpages**:
  * **Floating Read Button**: Highlight any text on any webpage (Wikipedia, documentation, blogs, news) and a sleek **🔊 Read** button appears at your cursor.
  * **Auto-Read Selection**: Optional mode that immediately speaks text upon mouse selection.
  * **Smart Article Reader (Reader Mode)**: Extracts clean article content, removing ads, cookie popups, and sidebars.
  * **Sentence Highlighting & Auto-Scroll**: Synchronously highlights each spoken sentence in real-time.
* **In VS Code & Markdown Files**:
  * **⭐ Rapid Double <kbd>Ctrl</kbd> + <kbd>C</kbd>**: Highlight any text in VS Code (Markdown Preview, source code, diff view, terminal) and press <kbd>Ctrl</kbd> + <kbd>C</kbd> twice quickly — it immediately reads the selection aloud!
  * **Right-Click Context Menu**: In source files, right-click highlighted code/Markdown $\rightarrow$ **Universal Reader: Read Selected Portion**.
  * **Status Bar & Editor Toolbar**: Dedicated **`🔊 Read Selection`** buttons in the bottom status bar and top-right editor header.
* **In Any Windows Application**:
  * Works across **Notepad**, **Microsoft Word**, **Slack**, **Discord**, **PDF viewers**, and terminals via the Desktop Companion.

### 2. Technical Text & Math Normalization
* **Mathematical Expressions**: Spoken equations in plain English:
  * `y = mx + c` $\rightarrow$ *"y equals m x plus c"*
  * `x^2 + y^2` $\rightarrow$ *"x squared plus y squared"*
  * `1/2` $\rightarrow$ *"one half"*
  * LaTeX equations and Greek symbols (`\pi`, `\alpha`, `\theta`) spoken naturally.
* **Code Blocks & Syntax**: Intelligent punctuation filtering so programming symbols (`{`, `}`, `=>`, `===`) don't disrupt speech flow.
* **Clean Markdown Speech**: Markdown headers (`#`), bullet points (`-`, `*`), bold/italics (`**`, `*`), blockquotes (`>`), and image links are cleaned into smooth, natural spoken sentences.
* **Smart URL Abbreviation**: Long 100+ character URLs are condensed into readable summaries (e.g. *"Link: github dot com, repository"*).

### 3. Modular Multi-Engine Voice Architecture
* **Browser Native SpeechSynthesis (Default)**:
  * **Zero API keys required**, 100% private, completely offline.
  * Native controls for Rate (0.5x – 3.0x), Pitch, Volume, and Voice picker.
  * Full multilingual support: **English**, **Hindi (हिंदी)**, and **Marathi (मराठी)**.
* **Windows Native SAPI5 (Desktop Companion)**:
  * Instant, offline, zero-lag speech synthesis directly through Windows COM API.
  * Thread-safe single-instance management with automatic 400ms debounce.
* **Google AI Studio (Gemini Flash / Pro)**:
  * Optional AI preprocessing: **Natural Reading**, **Summarize Then Read**, **Explain Code Then Read**, and **Translate Then Read**.
  * Encrypted local API key storage using Web Crypto AES-GCM (256-bit).

### 4. Privacy & Security by Design
* **🔒 100% Local Processing**: No audio or text leaves your machine when using offline voices.
* **Localhost-Only Binding**: Desktop Companion binds strictly to `127.0.0.1` with token authentication.
* **Prompt-Injection Defense**: Untrusted webpage text is strictly enclosed in boundary tags to prevent LLM hijacking.
* **Zero Telemetry**: No tracking, no external telemetry, no data collection.

---

## 🏗 System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CHROME EXTENSION (MV3)                          │
│                                                                        │
│  ┌──────────────────┐   ┌────────────────────┐   ┌──────────────────┐  │
│  │  Content Scripts │   │   Service Worker   │   │  Popup / Options │  │
│  │  - Selection UI  │◄─►│ - Context Menus    │◄─►│ - Settings       │  │
│  │  - Floating Plyr │   │ - Shortcuts / Cmds │   │ - Voice Picker   │  │
│  │  - Page Extractor│   │ - Tab Coordinator  │   │ - Gemini Config  │  │
│  │  - Highlighter   │   │ - Companion WS Clt │   │ - Privacy Badge  │  │
│  └──────────────────┘   └────────────────────┘   └──────────────────┘  │
│           │                       │                                    │
│           ▼                       ▼                                    │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      TTS Engine & Audio Queue                    │  │
│  │  - Browser SpeechSynthesis (Local, Offline, 0-API-Key default)   │  │
│  │  - Google AI Studio (Gemini Flash Preprocessor)                  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Localhost WebSocket / HTTP
                                    │ (Token-authenticated, Port 8765)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     WINDOWS DESKTOP COMPANION                          │
│                                                                        │
│  ┌──────────────────┐   ┌────────────────────┐   ┌──────────────────┐  │
│  │ Double-Copy Mon. │   │ Global Hotkeys     │   │ FastAPI Server   │  │
│  │ (Ctrl+C x2)      │──►│ (F8, Ctrl+Alt+R)   │──►│ (127.0.0.1:8765) │  │
│  └──────────────────┘   └────────────────────┘   └──────────────────┘  │
│           │                       │                       │            │
│           ▼                       ▼                       ▼            │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │             Windows Native SAPI5 Engine (Offline TTS)            │  │
│  │             - Markdown Cleaner & Text Normalizer                 │  │
│  │             - Thread-safe persistent COM voice synthesizer       │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────▲────────────────────────────────────┘
                                    │ HTTP POST /speak
                                    │
┌───────────────────────────────────┴────────────────────────────────────┐
│                       VS CODE EXTENSION                                │
│                                                                        │
│  - Right-Click Context Menu: "Universal Reader: Read Selected Portion" │
│  - Editor Header Action Button (🔊)                                    │
│  - Bottom Status Bar Item: "🔊 Read Selection"                         │
│  - Seamless Markdown Preview & Source Editor Support                   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## ⌨️ How to Read Text

| Context | Action | Shortcut / Trigger |
| :--- | :--- | :--- |
| **Everywhere (Universal)** | Read any highlighted text | **Press <kbd>Ctrl</kbd> + <kbd>C</kbd> twice quickly** |
| **VS Code Markdown Preview** | Read highlighted portion | Press <kbd>Ctrl</kbd> + <kbd>C</kbd> twice (or <kbd>F8</kbd>) |
| **VS Code Source Editor** | Read highlighted code | Right-click $\rightarrow$ **Universal Reader: Read Selected Portion** |
| **VS Code Toolbar** | Read active selection | Click **`🔊 Read Selection`** in bottom status bar |
| **Chrome Webpage** | Read selected text | Click floating **🔊 Read** button or <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Space</kbd> |
| **Chrome Full Article** | Read reader-mode article | Click extension popup $\rightarrow$ **Read Page** |
| **Stop Speech (Anywhere)** | Immediately stop voice | Press <kbd>F9</kbd> or <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>X</kbd> |

---

## 🚀 Quick Start Guide

### Option A: One-Click Launcher (Windows Recommended)

Simply double-click **[`START.bat`](START.bat)** in the root directory!

It automatically:
1. Verifies your Node.js and Python environments.
2. Builds the Chrome extension into `dist/`.
3. Installs the VS Code extension into `~/.vscode/extensions/`.
4. Copies the `dist/` path to your clipboard for instant Chrome loading.
5. Launches the Desktop Companion server in its own persistent window.
6. Opens Google Chrome to `chrome://extensions` and the interactive test demo.

---

### Option B: Manual Setup

#### 1. Build the Chrome Extension
```bash
# Clone the repository
git clone https://github.com/your-username/readingx-tts.git
cd readingx-tts

# Install dependencies
npm install

# Run unit tests (21 tests)
npm test

# Build production Chrome extension
npm run build
```

#### 2. Load Extension in Google Chrome
1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** (toggle in top-right corner).
3. Click **Load unpacked** (top-left button).
4. Select the `dist/` folder inside the project directory.
5. Pin **Universal Reader** 🔊 to your Chrome toolbar!

#### 3. Run Desktop Companion (for VS Code & Desktop Apps)
```bash
cd desktop-companion

# Create virtual environment & install dependencies
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt

# Run the server
python main.py
```
*(Or simply double-click [`desktop-companion/run.bat`](desktop-companion/run.bat))*

#### 4. Install VS Code Extension
Copy the `vscode-extension` directory into your VS Code extensions folder:
```powershell
xcopy /y /e /i /q "vscode-extension" "%USERPROFILE%\.vscode\extensions\universal-reader-tts"
```
In VS Code, press <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd> $\rightarrow$ `Developer: Reload Window`.

---

## 📂 Project Structure

```text
readingx-tts/
├── START.bat                  # One-click automated setup & launcher
├── package.json               # Node build scripts & dependencies
├── tsconfig.json              # TypeScript strict configuration
├── vite.config.ts             # Vite bundler configuration
├── .gitignore                 # Clean Git ignore rules (node, python, secrets)
├── .env.example               # Environment variables template
├── test_demo.html             # Interactive browser test page
│
├── extension/                 # Chrome Extension (Manifest V3)
│   ├── manifest.json          # MV3 configuration & permissions
│   ├── background/            # Service worker & companion WebSocket client
│   ├── content/               # Content scripts, floating player, selection detector
│   ├── popup/                 # Quick-access popup interface
│   ├── options/               # Multi-tab settings panel (Voices, Gemini, Companion)
│   ├── tts/                   # Modular TTS engines (Browser, Gemini, Companion)
│   ├── utils/                 # Chunker, math parser, normalizer, security
│   └── assets/                # Extension icons (16, 32, 48, 128px)
│
├── desktop-companion/         # Windows Desktop Companion (Python)
│   ├── main.py                # Server entry point & global hotkey hooks
│   ├── clipboard_monitor.py   # Rapid Double-Ctrl+C auto-read engine
│   ├── server.py              # FastAPI REST & WebSocket server
│   ├── tts_engine.py          # Windows SAPI5 persistent COM voice engine
│   ├── capture.py             # Active window selection capture & modifier release
│   ├── config.py              # Localhost configuration & secure auth token
│   ├── requirements.txt       # Python dependencies (FastAPI, uvicorn, pywin32, etc.)
│   ├── run.bat                # Standalone companion runner
│   └── test_companion.py      # Companion unit test suite
│
├── vscode-extension/          # Native VS Code Extension
│   ├── package.json           # VS Code extension manifest, menus & commands
│   └── extension.js           # Selection extraction & companion HTTP bridge
│
├── shared/                    # Shared types & WebSocket protocol
│   ├── types.ts               # Shared TypeScript data models
│   └── protocol.ts            # Client-companion message schemas
│
├── scripts/                   # Build & icon generation utilities
│   ├── build.js               # Multi-target build orchestrator
│   └── generate-icons.js      # Pure Node.js icon generator
│
└── tests/                     # Automated Vitest unit test suite (21 tests)
    ├── chunker.test.ts        # Sentence boundary & chunk limit tests
    ├── math-parser.test.ts    # Mathematical equation conversion tests
    ├── text-normalizer.test.ts# List, code, and URL normalization tests
    ├── security.test.ts       # Prompt-injection defense tests
    └── language-detector.test.ts # Multilingual detection tests
```

---

## 🧪 Testing

Run the full automated test suite:

```bash
# Run Chrome extension unit tests (Vitest)
npm test

# Run Desktop companion tests (FastAPI / SAPI5)
cd desktop-companion
python test_companion.py
```

All 21 extension tests and all companion endpoint tests run offline with zero external network dependencies.

---

## 🔒 Security & Privacy

* **Zero-API-Key Offline Mode**: By default, speech is synthesized entirely on your local machine using the browser SpeechSynthesis API or Windows SAPI5.
* **Encrypted API Keys**: When using Google AI Studio (Gemini), API keys are encrypted with **Web Crypto PBKDF2 + AES-GCM (256-bit)** before storage in `chrome.storage.local`.
* **Prompt Injection Protection**: Web content is isolated within strict boundary delimiters (`<<<UNTRUSTED_CONTENT>>>`) to prevent malicious instruction override.
* **Localhost-Only Socket**: Desktop companion strictly binds to `127.0.0.1` and requires cryptographic token authentication on all WebSocket connections.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
Built with accessibility, privacy, and productivity in mind.
