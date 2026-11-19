import test from 'node:test';
import assert from 'node:assert/strict';

import { getLoginProtectionMessage, parseRetryAfter } from '../src/utils/loginProtection.js';

test('maps login protection codes to stable user-facing messages', () => {
  assert.equal(
    getLoginProtectionMessage('LOGIN_CHALLENGE_REQUIRED'),
    'Vui lòng xác minh để thử đăng nhập lại.'
  );
  assert.equal(getLoginProtectionMessage('LOGIN_PROTECTION_UNAVAILABLE'), getLoginProtectionMessage('LOGIN_RATE_LIMIT_UNAVAILABLE'));
  assert.equal(getLoginProtectionMessage('UNKNOWN'), null);
});

test('accepts only positive numeric Retry-After seconds', () => {
  assert.equal(parseRetryAfter('17'), 17);
  assert.equal(parseRetryAfter('0'), null);
  assert.equal(parseRetryAfter('-2'), null);
  assert.equal(parseRetryAfter('not-a-number'), null);
});
