import { getSettings } from '../utils/storage.ts';
import { ExtensionAction, UserSettings } from '../../shared/types.ts';
import { CompanionMessage } from '../../shared/protocol.ts';

// 1. Install & Context Menus initialization
chrome.runtime.onInstalled.addListener(async () => {
  setupContextMenus();
});

function setupContextMenus(): void {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'read_selection',
      title: '🔊 Read selected text',
      contexts: ['selection']
    });

    chrome.contextMenus.create({
      id: 'read_page',
      title: '📖 Read entire page',
      contexts: ['page']
    });

    chrome.contextMenus.create({
      id: 'summarize_and_read',
      title: '📝 Summarize and read',
      contexts: ['selection']
    });

    chrome.contextMenus.create({
      id: 'translate_and_read',
      title: '🌐 Translate and read',
      contexts: ['selection']
    });

    chrome.contextMenus.create({
      id: 'separator_1',
      type: 'separator',
      contexts: ['selection', 'page']
    });

    chrome.contextMenus.create({
      id: 'open_settings',
      title: '⚙ Extension settings',
      contexts: ['action', 'page']
    });
  });
}

// 2. Context Menu Click Handlers
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'open_settings') {
    chrome.runtime.openOptionsPage();
    return;
  }

  if (!tab?.id) return;

  if (info.menuItemId === 'read_selection') {
    const text = info.selectionText;
    sendMessageToTab(tab.id, { type: 'READ_SELECTION', text });
  } else if (info.menuItemId === 'read_page') {
    sendMessageToTab(tab.id, { type: 'READ_PAGE' });
  } else if (info.menuItemId === 'summarize_and_read') {
    // Force AI mode to summarize
    const text = info.selectionText;
    sendMessageToTab(tab.id, { type: 'READ_SELECTION', text });
  } else if (info.menuItemId === 'translate_and_read') {
    const text = info.selectionText;
    sendMessageToTab(tab.id, { type: 'READ_SELECTION', text });
  }
});

// 3. Keyboard Shortcuts Listener
chrome.commands.onCommand.addListener(async (command, tab) => {
  const targetTabId = tab?.id || (await getActiveTabId());
  if (!targetTabId) return;

  switch (command) {
    case 'read_selection':
      sendMessageToTab(targetTabId, { type: 'READ_SELECTION' });
      break;
    case 'pause_resume': {
      // Toggle pause/resume
      chrome.tabs.sendMessage(targetTabId, { type: 'GET_PLAYER_STATUS' }, (res) => {
        if (chrome.runtime.lastError) return;
        if (res?.state === 'playing') {
          sendMessageToTab(targetTabId, { type: 'PAUSE_PLAYBACK' });
        } else if (res?.state === 'paused') {
          sendMessageToTab(targetTabId, { type: 'RESUME_PLAYBACK' });
        }
      });
      break;
    }
    case 'stop_playback':
      sendMessageToTab(targetTabId, { type: 'STOP_PLAYBACK' });
      break;
    case 'read_page':
      sendMessageToTab(targetTabId, { type: 'READ_PAGE' });
      break;
  }
});

async function getActiveTabId(): Promise<number | undefined> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0]?.id;
}

function sendMessageToTab(tabId: number, message: ExtensionAction): void {
  chrome.tabs.sendMessage(tabId, message).catch((err) => {
    // If content script is not yet injected on this page (e.g. newly loaded tab)
    console.debug('Could not send message to tab, injecting script...', err);
    chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/content-script.js']
    }).then(() => {
      setTimeout(() => {
        chrome.tabs.sendMessage(tabId, message).catch(() => {});
      }, 100);
    }).catch(() => {
      // Content scripts cannot be injected into restricted chrome:// URLs
    });
  });
}

// 4. Companion WebSocket Client (in background)
let companionSocket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

async function checkAndConnectCompanion(): Promise<void> {
  const settings = await getSettings();
  if (!settings.companionEnabled) {
    if (companionSocket) {
      companionSocket.close();
      companionSocket = null;
    }
    return;
  }

  if (companionSocket && companionSocket.readyState === WebSocket.OPEN) {
    return;
  }

  try {
    const url = `ws://${settings.companionHost}:${settings.companionPort}/ws`;
    companionSocket = new WebSocket(url);

    companionSocket.onopen = () => {
      console.log('Background connected to Desktop Companion');
      // Authenticate
      const authMsg: CompanionMessage = {
        type: 'AUTH_REQUEST',
        token: settings.companionToken,
        payload: {
          token: settings.companionToken,
          clientVersion: '1.0.0',
          origin: `chrome-extension://${chrome.runtime.id}`
        },
        timestamp: Date.now()
      };
      companionSocket?.send(JSON.stringify(authMsg));
    };

    companionSocket.onmessage = async (evt) => {
      try {
        const data: CompanionMessage = JSON.parse(evt.data);
        if (data.type === 'TEXT_CAPTURED') {
          const payload = data.payload as { text: string; sourceApp?: string };
          if (payload?.text) {
            // Forward captured text from VS Code/Word to the active tab
            const activeTabId = await getActiveTabId();
            if (activeTabId) {
              sendMessageToTab(activeTabId, {
                type: 'COMPANION_CAPTURE_RECEIVED',
                text: payload.text,
                sourceApp: payload.sourceApp
              });
            }
          }
        }
      } catch (err) {
        console.error('Companion message parsing error:', err);
      }
    };

    companionSocket.onerror = () => {
      companionSocket = null;
    };

    companionSocket.onclose = () => {
      companionSocket = null;
      // Reconnect attempt after delay
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(checkAndConnectCompanion, 5000);
    };
  } catch (err) {
    companionSocket = null;
    console.debug('Failed to connect to Desktop Companion:', err);
  }
}

// Initialize companion check
checkAndConnectCompanion();

// Listen for settings changes to re-evaluate companion connection
chrome.runtime.onMessage.addListener((msg: ExtensionAction) => {
  if (msg.type === 'SETTINGS_UPDATED') {
    checkAndConnectCompanion();
  }
});
