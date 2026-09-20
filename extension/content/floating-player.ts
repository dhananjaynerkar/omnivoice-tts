import { PlayerStatus, UserSettings } from '../../shared/types.ts';
import { AudioPlayer } from '../tts/audio-player.ts';

export class FloatingPlayer {
  private player: AudioPlayer;
  private settings: UserSettings;
  private hostEl: HTMLElement | null = null;
  private shadowRoot: ShadowRoot | null = null;
  private isMinimized = false;
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private initialX = 0;
  private initialY = 0;

  constructor(player: AudioPlayer, settings: UserSettings) {
    this.player = player;
    this.settings = settings;

    this.initUI();
    this.attachPlayerListeners();
  }

  updateSettings(settings: UserSettings): void {
    this.settings = settings;
    if (!settings.showFloatingPlayer) {
      this.hide();
    }
    this.updatePrivacyBadge();
  }

  private initUI(): void {
    if (typeof document === 'undefined') return;

    this.hostEl = document.createElement('div');
    this.hostEl.id = 'readingx-floating-player-host';
    this.hostEl.style.cssText = 'all: initial; position: fixed; bottom: 24px; right: 24px; z-index: 2147483646;';
    document.documentElement.appendChild(this.hostEl);

    this.shadowRoot = this.hostEl.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
      :host {
        all: initial;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      }
      .player-card {
        width: 320px;
        background: #0f172a;
        color: #f8fafc;
        border-radius: 12px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        user-select: none;
        transition: transform 0.15s ease, opacity 0.15s ease;
      }
      .player-card.hidden {
        display: none;
      }
      .player-card.minimized .player-body {
        display: none;
      }
      .player-header {
        background: #1e293b;
        padding: 8px 12px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: grab;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }
      .player-header:active {
        cursor: grabbing;
      }
      .header-title {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        font-weight: 600;
        color: #94a3b8;
      }
      .privacy-badge {
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 10px;
        background: #064e3b;
        color: #34d399;
        font-weight: 600;
      }
      .privacy-badge.cloud {
        background: #1e3a8a;
        color: #60a5fa;
      }
      .header-actions {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .icon-btn {
        all: unset;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        color: #94a3b8;
        cursor: pointer;
        font-size: 14px;
        transition: background 0.1s, color 0.1s;
      }
      .icon-btn:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #f8fafc;
      }
      .player-body {
        padding: 12px 14px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .preview-text {
        font-size: 12px;
        color: #cbd5e1;
        line-height: 1.4;
        max-height: 38px;
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
      }
      .progress-bar-container {
        width: 100%;
        height: 4px;
        background: #334155;
        border-radius: 2px;
        overflow: hidden;
      }
      .progress-fill {
        height: 100%;
        width: 0%;
        background: #38bdf8;
        transition: width 0.2s ease;
      }
      .controls-row {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
      }
      .ctrl-btn {
        all: unset;
        cursor: pointer;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #334155;
        color: #f8fafc;
        font-size: 14px;
        transition: background 0.15s, transform 0.1s;
      }
      .ctrl-btn:hover {
        background: #475569;
        transform: scale(1.05);
      }
      .ctrl-btn.primary {
        width: 40px;
        height: 40px;
        background: #0284c7;
        font-size: 18px;
      }
      .ctrl-btn.primary:hover {
        background: #0369a1;
      }
      .meta-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 11px;
        color: #94a3b8;
        border-top: 1px solid rgba(255, 255, 255, 0.05);
        padding-top: 8px;
      }
      .speed-select {
        all: unset;
        background: #1e293b;
        color: #e2e8f0;
        padding: 2px 6px;
        border-radius: 4px;
        cursor: pointer;
        border: 1px solid #475569;
        font-size: 11px;
      }
    `;

    const card = document.createElement('div');
    card.className = 'player-card hidden';
    card.setAttribute('role', 'region');
    card.setAttribute('aria-label', 'Text-to-Speech Player Controls');

    card.innerHTML = `
      <div class="player-header" id="drag-handle">
        <div class="header-title">
          <span>🔊 Universal Reader</span>
          <span class="privacy-badge" id="badge-privacy">🔒 Local</span>
        </div>
        <div class="header-actions">
          <button class="icon-btn" id="btn-minimize" aria-label="Minimize Player" title="Minimize">_</button>
          <button class="icon-btn" id="btn-close" aria-label="Close Player" title="Close">✕</button>
        </div>
      </div>
      <div class="player-body">
        <div class="preview-text" id="text-preview">Ready to read...</div>
        <div class="progress-bar-container">
          <div class="progress-fill" id="progress-fill"></div>
        </div>
        <div class="controls-row">
          <button class="ctrl-btn" id="btn-prev" aria-label="Previous Sentence" title="Previous">⏮</button>
          <button class="ctrl-btn primary" id="btn-play-pause" aria-label="Play or Pause" title="Play / Pause">▶</button>
          <button class="ctrl-btn" id="btn-stop" aria-label="Stop Playback" title="Stop">⏹</button>
          <button class="ctrl-btn" id="btn-next" aria-label="Next Sentence" title="Next">⏭</button>
        </div>
        <div class="meta-row">
          <span id="chunk-info">Chunk 0 / 0</span>
          <label style="display: flex; align-items: center; gap: 4px;">
            Speed:
            <select class="speed-select" id="speed-select" aria-label="Playback Speed">
              <option value="0.75">0.75x</option>
              <option value="1.0" selected>1.0x</option>
              <option value="1.25">1.25x</option>
              <option value="1.5">1.5x</option>
              <option value="2.0">2.0x</option>
            </select>
          </label>
        </div>
      </div>
    `;

    this.shadowRoot.appendChild(style);
    this.shadowRoot.appendChild(card);

    this.setupInteractivity();
  }

  private setupInteractivity(): void {
    if (!this.shadowRoot) return;

    // Controls
    const btnPlayPause = this.shadowRoot.getElementById('btn-play-pause');
    const btnStop = this.shadowRoot.getElementById('btn-stop');
    const btnPrev = this.shadowRoot.getElementById('btn-prev');
    const btnNext = this.shadowRoot.getElementById('btn-next');
    const btnClose = this.shadowRoot.getElementById('btn-close');
    const btnMin = this.shadowRoot.getElementById('btn-minimize');
    const speedSelect = this.shadowRoot.getElementById('speed-select') as HTMLSelectElement;

    btnPlayPause?.addEventListener('click', () => {
      const status = this.player.getStatus();
      if (status.state === 'playing') {
        this.player.pause();
      } else if (status.state === 'paused') {
        this.player.resume();
      } else {
        this.player.replayChunk();
      }
    });

    btnStop?.addEventListener('click', () => {
      this.player.stop();
    });

    btnPrev?.addEventListener('click', () => {
      this.player.skipBackward();
    });

    btnNext?.addEventListener('click', () => {
      this.player.skipForward();
    });

    btnClose?.addEventListener('click', () => {
      this.player.stop();
      this.hide();
    });

    btnMin?.addEventListener('click', () => {
      const card = this.shadowRoot?.querySelector('.player-card');
      this.isMinimized = !this.isMinimized;
      card?.classList.toggle('minimized', this.isMinimized);
      if (btnMin) btnMin.textContent = this.isMinimized ? '□' : '_';
    });

    speedSelect?.addEventListener('change', () => {
      const speed = parseFloat(speedSelect.value);
      this.player.setRate(speed);
    });

    // Drag handling
    const dragHandle = this.shadowRoot.getElementById('drag-handle');
    dragHandle?.addEventListener('mousedown', (e) => {
      if ((e.target as HTMLElement).closest('.icon-btn')) return;
      this.isDragging = true;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;

      const rect = this.hostEl!.getBoundingClientRect();
      this.initialX = rect.left;
      this.initialY = rect.top;

      const onMouseMove = (moveEvent: MouseEvent) => {
        if (!this.isDragging || !this.hostEl) return;
        const deltaX = moveEvent.clientX - this.dragStartX;
        const deltaY = moveEvent.clientY - this.dragStartY;
        this.hostEl.style.left = `${this.initialX + deltaX}px`;
        this.hostEl.style.top = `${this.initialY + deltaY}px`;
        this.hostEl.style.right = 'auto';
        this.hostEl.style.bottom = 'auto';
      };

      const onMouseUp = () => {
        this.isDragging = false;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  }

  private attachPlayerListeners(): void {
    this.player.onStateChange((status: PlayerStatus) => {
      this.renderStatus(status);
    });
  }

  private renderStatus(status: PlayerStatus): void {
    if (!this.shadowRoot) return;
    const card = this.shadowRoot.querySelector('.player-card');
    const playPauseBtn = this.shadowRoot.getElementById('btn-play-pause');
    const previewEl = this.shadowRoot.getElementById('text-preview');
    const chunkInfoEl = this.shadowRoot.getElementById('chunk-info');
    const progressFill = this.shadowRoot.getElementById('progress-fill');

    if (!card) return;

    if (status.state === 'playing' || status.state === 'paused') {
      if (this.settings.showFloatingPlayer) {
        card.classList.remove('hidden');
      }
    }

    if (playPauseBtn) {
      playPauseBtn.textContent = status.state === 'playing' ? '⏸' : '▶';
    }

    if (previewEl) {
      previewEl.textContent = status.currentText || 'Universal Reader active...';
    }

    if (chunkInfoEl) {
      const current = status.currentChunkIndex >= 0 ? status.currentChunkIndex + 1 : 0;
      chunkInfoEl.textContent = `Part ${current} / ${status.totalChunks}`;
    }

    if (progressFill) {
      const pct = status.totalChunks > 0 ? ((status.currentChunkIndex + 1) / status.totalChunks) * 100 : 0;
      progressFill.style.width = `${Math.min(100, Math.max(0, pct))}%`;
    }

    this.updatePrivacyBadge();
  }

  private updatePrivacyBadge(): void {
    if (!this.shadowRoot) return;
    const badge = this.shadowRoot.getElementById('badge-privacy');
    if (!badge) return;

    if (this.settings.ttsProvider === 'google') {
      badge.textContent = '☁ Google AI';
      badge.className = 'privacy-badge cloud';
    } else {
      badge.textContent = '🔒 Local';
      badge.className = 'privacy-badge';
    }
  }

  show(): void {
    const card = this.shadowRoot?.querySelector('.player-card');
    card?.classList.remove('hidden');
  }

  hide(): void {
    const card = this.shadowRoot?.querySelector('.player-card');
    card?.classList.add('hidden');
  }

  destroy(): void {
    this.hostEl?.remove();
  }
}
