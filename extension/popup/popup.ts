import { getSettings, saveSettings } from '../utils/storage.ts';
import { UserSettings, ExtensionAction, PlayerStatus } from '../../shared/types.ts';

document.addEventListener('DOMContentLoaded', async () => {
  let currentSettings: UserSettings = await getSettings();

  // Elements
  const privacyBadge = document.getElementById('privacy-badge') as HTMLElement;
  const btnOpenOptions = document.getElementById('btn-open-options') as HTMLButtonElement;
  const btnReadSelection = document.getElementById('btn-read-selection') as HTMLButtonElement;
  const btnReadPage = document.getElementById('btn-read-page') as HTMLButtonElement;

  const statusLabel = document.getElementById('status-label') as HTMLElement;
  const progressCounter = document.getElementById('progress-counter') as HTMLElement;
  const statusPreview = document.getElementById('status-text-preview') as HTMLElement;

  const btnPlayPause = document.getElementById('btn-play-pause') as HTMLButtonElement;
  const btnStop = document.getElementById('btn-stop') as HTMLButtonElement;
  const btnSkipPrev = document.getElementById('btn-skip-prev') as HTMLButtonElement;
  const btnSkipNext = document.getElementById('btn-skip-next') as HTMLButtonElement;

  const providerSelect = document.getElementById('provider-select') as HTMLSelectElement;
  const voiceSelect = document.getElementById('voice-select') as HTMLSelectElement;
  const rateSlider = document.getElementById('rate-slider') as HTMLInputElement;
  const rateValue = document.getElementById('rate-value') as HTMLElement;
  const volumeSlider = document.getElementById('volume-slider') as HTMLInputElement;
  const volumeValue = document.getElementById('volume-value') as HTMLElement;

  const chkAutoRead = document.getElementById('chk-auto-read') as HTMLInputElement;
  const chkHighlight = document.getElementById('chk-highlight') as HTMLInputElement;
  const chkAiCleanup = document.getElementById('chk-ai-cleanup') as HTMLInputElement;
  const chkAiSummarize = document.getElementById('chk-ai-summarize') as HTMLInputElement;

  // Initialize UI values
  function applySettingsToUI(settings: UserSettings) {
    providerSelect.value = settings.ttsProvider;
    rateSlider.value = settings.rate.toString();
    rateValue.textContent = `${settings.rate}x`;
    volumeSlider.value = settings.volume.toString();
    volumeValue.textContent = `${Math.round(settings.volume * 100)}%`;

    chkAutoRead.checked = settings.autoReadSelection;
    chkHighlight.checked = settings.highlightText;
    chkAiCleanup.checked = settings.aiMode === 'natural';
    chkAiSummarize.checked = settings.aiMode === 'summarize';

    updatePrivacyBadge(settings.ttsProvider);
  }

  function updatePrivacyBadge(provider: UserSettings['ttsProvider']) {
    if (provider === 'google') {
      privacyBadge.textContent = '☁ Google AI';
      privacyBadge.className = 'badge-cloud';
      privacyBadge.title = 'Text processed via Google AI Studio API';
    } else {
      privacyBadge.textContent = '🔒 Local';
      privacyBadge.className = 'badge-local';
      privacyBadge.title = 'Text stays 100% on your device (zero network transfer)';
    }
  }

  applySettingsToUI(currentSettings);

  // Load Voices
  function populateVoices() {
    if (typeof window.speechSynthesis === 'undefined') return;
    const voices = window.speechSynthesis.getVoices();
    voiceSelect.innerHTML = '<option value="">Default System Voice</option>';

    // Group voices into English, Hindi, Marathi, and Others
    const enVoices: SpeechSynthesisVoice[] = [];
    const inVoices: SpeechSynthesisVoice[] = [];
    const otherVoices: SpeechSynthesisVoice[] = [];

    for (const v of voices) {
      const l = v.lang.toLowerCase();
      if (l.startsWith('hi') || l.startsWith('mr')) {
        inVoices.push(v);
      } else if (l.startsWith('en')) {
        enVoices.push(v);
      } else {
        otherVoices.push(v);
      }
    }

    const appendGroup = (label: string, list: SpeechSynthesisVoice[]) => {
      if (list.length === 0) return;
      const optGroup = document.createElement('optgroup');
      optGroup.label = label;
      for (const voice of list) {
        const opt = document.createElement('option');
        opt.value = voice.voiceURI;
        opt.textContent = `${voice.name} (${voice.lang})`;
        if (voice.voiceURI === currentSettings.voiceURI) {
          opt.selected = true;
        }
        optGroup.appendChild(opt);
      }
      voiceSelect.appendChild(optGroup);
    };

    appendGroup('Indian Languages (Hindi / Marathi)', inVoices);
    appendGroup('English Voices', enVoices);
    appendGroup('Other Languages', otherVoices);
  }

  populateVoices();
  if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = populateVoices;
  }

  // Active Tab Messaging Helper
  async function sendActionToActiveTab(action: ExtensionAction): Promise<unknown> {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabId = tabs[0]?.id;
    if (!tabId) return;

    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, action, (response) => {
        if (chrome.runtime.lastError) {
          // If script not injected yet, inject it
          chrome.scripting.executeScript({
            target: { tabId },
            files: ['content/content-script.js']
          }).then(() => {
            setTimeout(() => {
              chrome.tabs.sendMessage(tabId, action, resolve);
            }, 100);
          }).catch(() => resolve(null));
        } else {
          resolve(response);
        }
      });
    });
  }

  // Update playback status
  async function refreshStatus() {
    const status = (await sendActionToActiveTab({ type: 'GET_PLAYER_STATUS' })) as PlayerStatus | undefined;
    if (!status) return;

    statusLabel.textContent = status.state.toUpperCase();
    if (status.state === 'playing') {
      btnPlayPause.textContent = '⏸';
      statusLabel.style.color = '#38bdf8';
    } else {
      btnPlayPause.textContent = '▶';
      statusLabel.style.color = '#94a3b8';
    }

    if (status.totalChunks > 0) {
      progressCounter.textContent = `${status.currentChunkIndex + 1} / ${status.totalChunks}`;
    } else {
      progressCounter.textContent = '0 / 0';
    }

    if (status.currentText) {
      statusPreview.textContent = status.currentText;
    }
  }

  // Refresh status on popup open and every 1s
  refreshStatus();
  const statusInterval = setInterval(refreshStatus, 800);
  window.addEventListener('unload', () => clearInterval(statusInterval));

  // Event Listeners for Actions
  btnReadSelection.addEventListener('click', async () => {
    await sendActionToActiveTab({ type: 'READ_SELECTION' });
    setTimeout(refreshStatus, 150);
  });

  btnReadPage.addEventListener('click', async () => {
    await sendActionToActiveTab({ type: 'READ_PAGE' });
    setTimeout(refreshStatus, 150);
  });

  btnPlayPause.addEventListener('click', async () => {
    const status = (await sendActionToActiveTab({ type: 'GET_PLAYER_STATUS' })) as PlayerStatus | undefined;
    if (status?.state === 'playing') {
      await sendActionToActiveTab({ type: 'PAUSE_PLAYBACK' });
    } else if (status?.state === 'paused') {
      await sendActionToActiveTab({ type: 'RESUME_PLAYBACK' });
    } else {
      await sendActionToActiveTab({ type: 'REPLAY_CHUNK' });
    }
    setTimeout(refreshStatus, 100);
  });

  btnStop.addEventListener('click', async () => {
    await sendActionToActiveTab({ type: 'STOP_PLAYBACK' });
    setTimeout(refreshStatus, 100);
  });

  btnSkipPrev.addEventListener('click', async () => {
    await sendActionToActiveTab({ type: 'SKIP_BACKWARD' });
    setTimeout(refreshStatus, 100);
  });

  btnSkipNext.addEventListener('click', async () => {
    await sendActionToActiveTab({ type: 'SKIP_FORWARD' });
    setTimeout(refreshStatus, 100);
  });

  btnOpenOptions.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Settings changes
  providerSelect.addEventListener('change', async () => {
    currentSettings = await saveSettings({ ttsProvider: providerSelect.value as UserSettings['ttsProvider'] });
    updatePrivacyBadge(currentSettings.ttsProvider);
    await sendActionToActiveTab({ type: 'SETTINGS_UPDATED', settings: currentSettings });
  });

  voiceSelect.addEventListener('change', async () => {
    currentSettings = await saveSettings({ voiceURI: voiceSelect.value });
    await sendActionToActiveTab({ type: 'SETTINGS_UPDATED', settings: currentSettings });
  });

  rateSlider.addEventListener('input', () => {
    const val = parseFloat(rateSlider.value);
    rateValue.textContent = `${val.toFixed(1)}x`;
  });

  rateSlider.addEventListener('change', async () => {
    const rate = parseFloat(rateSlider.value);
    currentSettings = await saveSettings({ rate });
    await sendActionToActiveTab({ type: 'SET_RATE', rate });
  });

  volumeSlider.addEventListener('input', () => {
    const val = parseFloat(volumeSlider.value);
    volumeValue.textContent = `${Math.round(val * 100)}%`;
  });

  volumeSlider.addEventListener('change', async () => {
    const volume = parseFloat(volumeSlider.value);
    currentSettings = await saveSettings({ volume });
    await sendActionToActiveTab({ type: 'SETTINGS_UPDATED', settings: currentSettings });
  });

  chkAutoRead.addEventListener('change', async () => {
    currentSettings = await saveSettings({ autoReadSelection: chkAutoRead.checked });
    await sendActionToActiveTab({ type: 'SETTINGS_UPDATED', settings: currentSettings });
  });

  chkHighlight.addEventListener('change', async () => {
    currentSettings = await saveSettings({ highlightText: chkHighlight.checked });
    await sendActionToActiveTab({ type: 'SETTINGS_UPDATED', settings: currentSettings });
  });

  chkAiCleanup.addEventListener('change', async () => {
    const aiMode = chkAiCleanup.checked ? 'natural' : 'direct';
    currentSettings = await saveSettings({ aiMode });
    await sendActionToActiveTab({ type: 'SETTINGS_UPDATED', settings: currentSettings });
  });

  chkAiSummarize.addEventListener('change', async () => {
    const aiMode = chkAiSummarize.checked ? 'summarize' : 'direct';
    currentSettings = await saveSettings({ aiMode });
    await sendActionToActiveTab({ type: 'SETTINGS_UPDATED', settings: currentSettings });
  });
});
