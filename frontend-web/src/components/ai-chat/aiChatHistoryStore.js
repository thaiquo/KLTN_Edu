const STORAGE_PREFIX = 'AI_CHAT_HISTORY';
const LEGACY_STORAGE_KEYS = [
  'AI_CHAT_HISTORY',
  'educonnect:ai-chat-history',
  'ai-chat-history'
];

function normalizeKeyPart(value) {
  return String(value || '').trim().toUpperCase();
}

function canUseSessionStorage() {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

export function getAiChatStorageKey({ authenticated = false, userId = null, activeRole = null } = {}) {
  if (!authenticated || userId == null || userId === '') {
    return `${STORAGE_PREFIX}:GUEST`;
  }
  const role = normalizeKeyPart(activeRole) || 'UNKNOWN';
  return `${STORAGE_PREFIX}:${userId}:${role}`;
}

export function loadAiChatHistory(storageKey) {
  if (!canUseSessionStorage() || !storageKey) return [];
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.messages) ? parsed.messages : [];
  } catch {
    return [];
  }
}

export function saveAiChatHistory(storageKey, messages) {
  if (!canUseSessionStorage() || !storageKey) return;
  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify({
      messages: Array.isArray(messages) ? messages : []
    }));
  } catch {
    // Ignore storage quota or private-mode errors; chat still works in memory.
  }
}

export function clearLegacyAiChatHistory() {
  if (!canUseSessionStorage()) return;
  for (const key of LEGACY_STORAGE_KEYS) {
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // Ignore browser storage failures.
    }
  }
}
