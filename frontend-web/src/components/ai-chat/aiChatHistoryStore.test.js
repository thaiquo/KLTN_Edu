import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clearLegacyAiChatHistory,
  getAiChatStorageKey,
  loadAiChatHistory,
  saveAiChatHistory
} from './aiChatHistoryStore.js';

function installSessionStorage() {
  const store = new Map();
  global.window = {
    sessionStorage: {
      getItem: (key) => store.has(key) ? store.get(key) : null,
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key)
    }
  };
  return store;
}

test('builds authenticated history keys by user id and active role', () => {
  assert.equal(
    getAiChatStorageKey({ authenticated: true, userId: 920001, activeRole: 'STUDENT' }),
    'AI_CHAT_HISTORY:920001:STUDENT'
  );
  assert.equal(
    getAiChatStorageKey({ authenticated: true, userId: 920001, activeRole: 'tutor' }),
    'AI_CHAT_HISTORY:920001:TUTOR'
  );
});

test('uses a separate guest history key', () => {
  assert.equal(getAiChatStorageKey({ authenticated: false }), 'AI_CHAT_HISTORY:GUEST');
  assert.equal(getAiChatStorageKey({ authenticated: true, userId: null, activeRole: 'STUDENT' }), 'AI_CHAT_HISTORY:GUEST');
});

test('stores different users and roles independently', () => {
  installSessionStorage();
  const studentKey = getAiChatStorageKey({ authenticated: true, userId: 920001, activeRole: 'STUDENT' });
  const tutorKey = getAiChatStorageKey({ authenticated: true, userId: 920001, activeRole: 'TUTOR' });
  const otherUserKey = getAiChatStorageKey({ authenticated: true, userId: 920002, activeRole: 'STUDENT' });

  saveAiChatHistory(studentKey, [{ role: 'USER', content: 'student private' }]);
  saveAiChatHistory(tutorKey, [{ role: 'USER', content: 'tutor private' }]);
  saveAiChatHistory(otherUserKey, [{ role: 'USER', content: 'other user' }]);

  assert.equal(loadAiChatHistory(studentKey)[0].content, 'student private');
  assert.equal(loadAiChatHistory(tutorKey)[0].content, 'tutor private');
  assert.equal(loadAiChatHistory(otherUserKey)[0].content, 'other user');
});

test('does not migrate legacy global history into role-scoped histories', () => {
  const store = installSessionStorage();
  store.set('AI_CHAT_HISTORY', JSON.stringify({ messages: [{ role: 'USER', content: 'mixed legacy' }] }));
  store.set('educonnect:ai-chat-history', JSON.stringify({ messages: [{ role: 'USER', content: 'old mixed legacy' }] }));

  clearLegacyAiChatHistory();

  assert.equal(store.has('AI_CHAT_HISTORY'), false);
  assert.equal(store.has('educonnect:ai-chat-history'), false);
  assert.deepEqual(loadAiChatHistory('AI_CHAT_HISTORY:920001:STUDENT'), []);
});
