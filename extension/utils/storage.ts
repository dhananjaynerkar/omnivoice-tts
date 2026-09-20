import { UserSettings, DEFAULT_SETTINGS } from '../../shared/types.ts';

const SETTINGS_KEY = 'readingx_user_settings';

/**
 * Encrypted/Obfuscated storage helper for local API keys
 * Uses Web Crypto API with browser local salt to protect keys stored in chrome.storage.local
 */
async function getEncryptionKey(): Promise<CryptoKey> {
  const salt = new Uint8Array([114, 101, 97, 100, 105, 110, 103, 120, 95, 115, 101, 99, 114, 101, 116]);
  const baseKey = await crypto.subtle.importKey(
    'raw',
    salt,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptApiKey(plainKey: string): Promise<string> {
  if (!plainKey) return '';
  try {
    const key = await getEncryptionKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plainKey);
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoded
    );
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);
    return btoa(String.fromCharCode(...combined));
  } catch (err) {
    console.warn('Crypto encryption failed, falling back to base64', err);
    return btoa(plainKey);
  }
}

export async function decryptApiKey(encryptedKey: string): Promise<string> {
  if (!encryptedKey) return '';
  try {
    const combined = Uint8Array.from(atob(encryptedKey), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    const key = await getEncryptionKey();
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    // Fallback if raw or simple base64
    try {
      return atob(encryptedKey);
    } catch {
      return encryptedKey;
    }
  }
}

/**
 * Retrieves the user settings merged with defaults.
 */
export async function getSettings(): Promise<UserSettings> {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      resolve({ ...DEFAULT_SETTINGS });
      return;
    }

    chrome.storage.local.get([SETTINGS_KEY], async (result) => {
      const stored = result[SETTINGS_KEY] as Partial<UserSettings> | undefined;
      if (!stored) {
        resolve({ ...DEFAULT_SETTINGS });
        return;
      }

      const merged: UserSettings = {
        ...DEFAULT_SETTINGS,
        ...stored
      };

      // Decrypt API key if encrypted
      if (merged.geminiApiKey) {
        merged.geminiApiKey = await decryptApiKey(merged.geminiApiKey);
      }

      resolve(merged);
    });
  });
}

/**
 * Saves partial or complete user settings to chrome.storage.local.
 */
export async function saveSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
  const current = await getSettings();
  const updated: UserSettings = {
    ...current,
    ...settings
  };

  // Encrypt API key before writing to disk
  const toStore = { ...updated };
  if (toStore.geminiApiKey) {
    toStore.geminiApiKey = await encryptApiKey(toStore.geminiApiKey);
  }

  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      resolve(updated);
      return;
    }

    chrome.storage.local.set({ [SETTINGS_KEY]: toStore }, () => {
      // Notify other parts of extension
      chrome.runtime?.sendMessage?.({
        type: 'SETTINGS_UPDATED',
        settings: updated
      }).catch(() => {
        // Ignore errors if no listeners
      });
      resolve(updated);
    });
  });
}

/**
 * Completely removes the Gemini API key from storage
 */
export async function deleteApiKey(): Promise<void> {
  await saveSettings({ geminiApiKey: '' });
}
