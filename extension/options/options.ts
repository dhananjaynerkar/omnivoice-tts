import { getSettings, saveSettings, deleteApiKey } from '../utils/storage.ts';
import { UserSettings } from '../../shared/types.ts';
import { GoogleGeminiTTSProvider } from '../tts/google-tts.ts';

document.addEventListener('DOMContentLoaded', async () => {
  let currentSettings: UserSettings = await getSettings();

  // Tab switching
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      tabButtons.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      const target = document.getElementById(`tab-${tabId}`);
      target?.classList.add('active');
    });
  });

  // Form elements
  const chkAutoRead = document.getElementById('chk-gen-auto-read') as HTMLInputElement;
  const chkFloatingBtn = document.getElementById('chk-gen-floating-btn') as HTMLInputElement;
  const chkFloatingPlayer = document.getElementById('chk-gen-floating-player') as HTMLInputElement;
  const chkHighlight = document.getElementById('chk-gen-highlight') as HTMLInputElement;
  const chkAutoscroll = document.getElementById('chk-gen-autoscroll') as HTMLInputElement;

  const providerSelect = document.getElementById('opt-provider-select') as HTMLSelectElement;
  const voiceSelect = document.getElementById('opt-voice-select') as HTMLSelectElement;
  const rateSlider = document.getElementById('opt-rate-slider') as HTMLInputElement;
  const rateLabel = document.getElementById('opt-rate-label') as HTMLElement;
  const pitchSlider = document.getElementById('opt-pitch-slider') as HTMLInputElement;
  const pitchLabel = document.getElementById('opt-pitch-label') as HTMLElement;
  const volSlider = document.getElementById('opt-vol-slider') as HTMLInputElement;
  const volLabel = document.getElementById('opt-vol-label') as HTMLElement;
  const btnTestVoice = document.getElementById('btn-test-voice') as HTMLButtonElement;

  const geminiKeyInput = document.getElementById('opt-gemini-key') as HTMLInputElement;
  const btnToggleKey = document.getElementById('btn-toggle-key-visibility') as HTMLButtonElement;
  const btnSaveKey = document.getElementById('btn-save-key') as HTMLButtonElement;
  const btnTestKey = document.getElementById('btn-test-key') as HTMLButtonElement;
  const btnDeleteKey = document.getElementById('btn-delete-key') as HTMLButtonElement;
  const geminiStatus = document.getElementById('gemini-test-status') as HTMLElement;
  const geminiModel = document.getElementById('opt-gemini-model') as HTMLSelectElement;
  const aiMode = document.getElementById('opt-ai-mode') as HTMLSelectElement;
  const targetLang = document.getElementById('opt-target-lang') as HTMLSelectElement;

  const codeMode = document.getElementById('opt-code-mode') as HTMLSelectElement;
  const chkMath = document.getElementById('chk-math-norm') as HTMLInputElement;
  const chkUrl = document.getElementById('chk-url-norm') as HTMLInputElement;
  const chkList = document.getElementById('chk-list-norm') as HTMLInputElement;
  const chunkSize = document.getElementById('opt-chunk-size') as HTMLInputElement;
  const sentPause = document.getElementById('opt-sentence-pause') as HTMLInputElement;
  const paraPause = document.getElementById('opt-para-pause') as HTMLInputElement;

  const chkCompanion = document.getElementById('chk-companion-enabled') as HTMLInputElement;
  const compPort = document.getElementById('opt-companion-port') as HTMLInputElement;
  const compToken = document.getElementById('opt-companion-token') as HTMLInputElement;
  const btnTestComp = document.getElementById('btn-test-companion') as HTMLButtonElement;
  const compStatusMsg = document.getElementById('companion-status-msg') as HTMLElement;

  // Initialize UI with settings
  function loadForm(s: UserSettings) {
    chkAutoRead.checked = s.autoReadSelection;
    chkFloatingBtn.checked = s.showFloatingButton;
    chkFloatingPlayer.checked = s.showFloatingPlayer;
    chkHighlight.checked = s.highlightText;
    chkAutoscroll.checked = s.autoScroll;

    providerSelect.value = s.ttsProvider;
    rateSlider.value = s.rate.toString();
    rateLabel.textContent = `${s.rate.toFixed(1)}x`;
    pitchSlider.value = s.pitch.toString();
    pitchLabel.textContent = s.pitch.toFixed(1);
    volSlider.value = s.volume.toString();
    volLabel.textContent = `${Math.round(s.volume * 100)}%`;

    geminiKeyInput.value = s.geminiApiKey || '';
    geminiModel.value = s.geminiModel;
    aiMode.value = s.aiMode;
    targetLang.value = s.targetLanguage;

    codeMode.value = s.codeHandling;
    chkMath.checked = s.mathNormalization;
    chkUrl.checked = s.urlNormalization;
    chkList.checked = s.listNormalization;
    chunkSize.value = s.chunkSize.toString();
    sentPause.value = s.sentencePauseMs.toString();
    paraPause.value = s.paragraphPauseMs.toString();

    chkCompanion.checked = s.companionEnabled;
    compPort.value = s.companionPort.toString();
    compToken.value = s.companionToken || '';
  }

  loadForm(currentSettings);

  // Load Voices
  function populateVoices() {
    if (typeof window.speechSynthesis === 'undefined') return;
    const voices = window.speechSynthesis.getVoices();
    voiceSelect.innerHTML = '<option value="">Default System Voice</option>';

    const inGroup = document.createElement('optgroup');
    inGroup.label = 'Indian Languages (Hindi / Marathi)';
    const enGroup = document.createElement('optgroup');
    enGroup.label = 'English Voices';
    const otherGroup = document.createElement('optgroup');
    otherGroup.label = 'Other Languages';

    for (const v of voices) {
      const opt = document.createElement('option');
      opt.value = v.voiceURI;
      opt.textContent = `${v.name} (${v.lang})`;
      if (v.voiceURI === currentSettings.voiceURI) {
        opt.selected = true;
      }

      const l = v.lang.toLowerCase();
      if (l.startsWith('hi') || l.startsWith('mr')) {
        inGroup.appendChild(opt);
      } else if (l.startsWith('en')) {
        enGroup.appendChild(opt);
      } else {
        otherGroup.appendChild(opt);
      }
    }

    if (inGroup.children.length > 0) voiceSelect.appendChild(inGroup);
    if (enGroup.children.length > 0) voiceSelect.appendChild(enGroup);
    if (otherGroup.children.length > 0) voiceSelect.appendChild(otherGroup);
  }

  populateVoices();
  if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = populateVoices;
  }

  // Auto-save helpers
  async function persist(diff: Partial<UserSettings>) {
    currentSettings = await saveSettings(diff);
  }

  // General listeners
  chkAutoRead.addEventListener('change', () => persist({ autoReadSelection: chkAutoRead.checked }));
  chkFloatingBtn.addEventListener('change', () => persist({ showFloatingButton: chkFloatingBtn.checked }));
  chkFloatingPlayer.addEventListener('change', () => persist({ showFloatingPlayer: chkFloatingPlayer.checked }));
  chkHighlight.addEventListener('change', () => persist({ highlightText: chkHighlight.checked }));
  chkAutoscroll.addEventListener('change', () => persist({ autoScroll: chkAutoscroll.checked }));

  // Voice listeners
  providerSelect.addEventListener('change', () => persist({ ttsProvider: providerSelect.value as UserSettings['ttsProvider'] }));
  voiceSelect.addEventListener('change', () => persist({ voiceURI: voiceSelect.value }));

  rateSlider.addEventListener('input', () => {
    const val = parseFloat(rateSlider.value);
    rateLabel.textContent = `${val.toFixed(1)}x`;
  });
  rateSlider.addEventListener('change', () => persist({ rate: parseFloat(rateSlider.value) }));

  pitchSlider.addEventListener('input', () => {
    const val = parseFloat(pitchSlider.value);
    pitchLabel.textContent = val.toFixed(1);
  });
  pitchSlider.addEventListener('change', () => persist({ pitch: parseFloat(pitchSlider.value) }));

  volSlider.addEventListener('input', () => {
    const val = parseFloat(volSlider.value);
    volLabel.textContent = `${Math.round(val * 100)}%`;
  });
  volSlider.addEventListener('change', () => persist({ volume: parseFloat(volSlider.value) }));

  btnTestVoice.addEventListener('click', () => {
    if (typeof window.speechSynthesis === 'undefined') return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance('Hello! This is a voice test from Universal Reader.');
    utterance.rate = parseFloat(rateSlider.value);
    utterance.pitch = parseFloat(pitchSlider.value);
    utterance.volume = parseFloat(volSlider.value);
    if (voiceSelect.value) {
      const selected = window.speechSynthesis.getVoices().find(v => v.voiceURI === voiceSelect.value);
      if (selected) utterance.voice = selected;
    }
    window.speechSynthesis.speak(utterance);
  });

  // AI & Gemini listeners
  btnToggleKey.addEventListener('click', () => {
    const isPass = geminiKeyInput.type === 'password';
    geminiKeyInput.type = isPass ? 'text' : 'password';
    btnToggleKey.textContent = isPass ? '🔒' : '👁';
  });

  btnSaveKey.addEventListener('click', async () => {
    await persist({ geminiApiKey: geminiKeyInput.value.trim() });
    geminiStatus.className = 'test-status-msg success';
    geminiStatus.textContent = '✓ Key saved locally and encrypted with AES-GCM.';
  });

  btnTestKey.addEventListener('click', async () => {
    geminiStatus.className = 'test-status-msg';
    geminiStatus.textContent = 'Testing connection to Google AI Studio...';
    const key = geminiKeyInput.value.trim();
    const model = geminiModel.value;
    const res = await GoogleGeminiTTSProvider.testConnection(key, model);
    if (res.success) {
      geminiStatus.className = 'test-status-msg success';
      geminiStatus.textContent = `✓ ${res.message}`;
    } else {
      geminiStatus.className = 'test-status-msg error';
      geminiStatus.textContent = `✗ ${res.message}`;
    }
  });

  btnDeleteKey.addEventListener('click', async () => {
    if (confirm('Are you sure you want to delete your stored Google AI Studio API key?')) {
      await deleteApiKey();
      geminiKeyInput.value = '';
      geminiStatus.className = 'test-status-msg';
      geminiStatus.textContent = 'API key deleted from storage.';
    }
  });

  geminiModel.addEventListener('change', () => persist({ geminiModel: geminiModel.value }));
  aiMode.addEventListener('change', () => persist({ aiMode: aiMode.value as UserSettings['aiMode'] }));
  targetLang.addEventListener('change', () => persist({ targetLanguage: targetLang.value }));

  // Reading Rules listeners
  codeMode.addEventListener('change', () => persist({ codeHandling: codeMode.value as UserSettings['codeHandling'] }));
  chkMath.addEventListener('change', () => persist({ mathNormalization: chkMath.checked }));
  chkUrl.addEventListener('change', () => persist({ urlNormalization: chkUrl.checked }));
  chkList.addEventListener('change', () => persist({ listNormalization: chkList.checked }));
  chunkSize.addEventListener('change', () => persist({ chunkSize: parseInt(chunkSize.value, 10) || 250 }));
  sentPause.addEventListener('change', () => persist({ sentencePauseMs: parseInt(sentPause.value, 10) || 150 }));
  paraPause.addEventListener('change', () => persist({ paragraphPauseMs: parseInt(paraPause.value, 10) || 400 }));

  // Desktop Companion listeners
  chkCompanion.addEventListener('change', () => persist({ companionEnabled: chkCompanion.checked }));
  compPort.addEventListener('change', () => persist({ companionPort: parseInt(compPort.value, 10) || 8765 }));
  compToken.addEventListener('change', () => persist({ companionToken: compToken.value.trim() }));

  btnTestComp.addEventListener('click', async () => {
    compStatusMsg.className = 'test-status-msg';
    compStatusMsg.textContent = 'Checking Desktop Companion on 127.0.0.1...';

    const port = compPort.value.trim() || '8765';
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        const data = await res.json();
        compStatusMsg.className = 'test-status-msg success';
        compStatusMsg.textContent = `✓ Desktop Companion is RUNNING! Version: ${data.version || '1.0.0'}`;
      } else {
        compStatusMsg.className = 'test-status-msg error';
        compStatusMsg.textContent = `✗ Companion returned HTTP ${res.status}`;
      }
    } catch {
      compStatusMsg.className = 'test-status-msg error';
      compStatusMsg.textContent = `✗ Could not connect to Desktop Companion on port ${port}. Please make sure 'python main.py' is running.`;
    }
  });
});
