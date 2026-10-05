const STORAGE_PREFIX = 'educonnect:class-marketplace-search:v1';
const SESSION_VERSION = 1;
const TTL_MS = 2 * 60 * 60 * 1000;
const DEFAULT_ACTIVE_MODE = 'MANUAL';

function hasStorage() {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

function ownerKey(user) {
  const identity = user?.id ?? user?.userId ?? user?.email ?? 'guest';
  return String(identity).trim().toLowerCase() || 'guest';
}

function storageKey(user) {
  return `${STORAGE_PREFIX}:${ownerKey(user)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function expiresAtFromNow() {
  return new Date(Date.now() + TTL_MS).toISOString();
}

function isExpired(session) {
  return !session?.expiresAt || Date.parse(session.expiresAt) <= Date.now();
}

function normalizeActiveMode(value) {
  return value === 'AI' ? 'AI' : DEFAULT_ACTIVE_MODE;
}

function createEnvelope(user, overrides = {}) {
  const timestamp = nowIso();
  return {
    version: SESSION_VERSION,
    ownerKey: ownerKey(user),
    activeMode: DEFAULT_ACTIVE_MODE,
    manual: null,
    ai: null,
    updatedAt: timestamp,
    expiresAt: expiresAtFromNow(),
    ...overrides
  };
}

function readRaw(user) {
  if (!hasStorage()) return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey(user));
    return raw ? JSON.parse(raw) : null;
  } catch {
    clearSession(user);
    return null;
  }
}

function writeRaw(user, session) {
  if (!hasStorage()) return null;
  try {
    const next = {
      ...session,
      version: SESSION_VERSION,
      ownerKey: ownerKey(user),
      activeMode: normalizeActiveMode(session?.activeMode),
      updatedAt: nowIso(),
      expiresAt: expiresAtFromNow()
    };
    window.sessionStorage.setItem(storageKey(user), JSON.stringify(next));
    return next;
  } catch {
    return null;
  }
}

function loadSession(user) {
  const session = readRaw(user);
  if (!session) return null;
  if (session.version !== SESSION_VERSION || session.ownerKey !== ownerKey(user) || isExpired(session)) {
    clearSession(user);
    return null;
  }
  return session;
}

function updateSession(user, updater) {
  const current = loadSession(user) || createEnvelope(user);
  return writeRaw(user, updater(current));
}

function saveManualState(user, manualState, options = {}) {
  return updateSession(user, (current) => ({
    ...current,
    activeMode: options.activeMode || current.activeMode || DEFAULT_ACTIVE_MODE,
    manual: {
      filters: manualState?.filters || {},
      sort: manualState?.sort || 'newest',
      page: Number.isInteger(manualState?.page) ? manualState.page : 1
    }
  }));
}

function saveAiState(user, aiState) {
  return updateSession(user, (current) => ({
    ...current,
    activeMode: 'AI',
    ai: {
      originalMessage: aiState?.originalMessage || '',
      analyzedRequirement: aiState?.analyzedRequirement || null,
      groundedRequirement: aiState?.groundedRequirement || null,
      matchingResult: aiState?.matchingResult || null,
      updatedAt: nowIso()
    }
  }));
}

function setActiveMode(user, activeMode) {
  return updateSession(user, (current) => ({
    ...current,
    activeMode: normalizeActiveMode(activeMode)
  }));
}

function clearSession(user) {
  if (!hasStorage()) return;
  try {
    window.sessionStorage.removeItem(storageKey(user));
  } catch {
    // Class Marketplace should continue normally when browser storage is unavailable.
  }
}

function clearAllSessions() {
  if (!hasStorage()) return;
  try {
    Object.keys(window.sessionStorage)
      .filter((key) => key.startsWith(`${STORAGE_PREFIX}:`))
      .forEach((key) => window.sessionStorage.removeItem(key));
  } catch {
    // Ignore storage cleanup failures on logout/unauthorized transitions.
  }
}

export const CLASS_MARKETPLACE_SESSION_TTL_MS = TTL_MS;
export const CLASS_MARKETPLACE_SESSION_VERSION = SESSION_VERSION;

export const classMarketplaceSearchSessionStore = {
  loadSession,
  saveManualState,
  saveAiState,
  setActiveMode,
  clearSession,
  clearAllSessions,
  isExpired,
  ownerKey
};
