import test from 'node:test';
import assert from 'node:assert/strict';
import { emailValid, otpValid, passwordValid, phoneValid } from './validation.ts';
import { themeForRole } from '../theme/tokens.ts';

test('registration and reset inputs follow backend length and shape rules', () => {
  assert.equal(emailValid('student@example.com'), true);
  assert.equal(emailValid('invalid-email'), false);
  assert.equal(otpValid('123456'), true);
  assert.equal(otpValid('12345'), false);
  assert.equal(otpValid('12345a'), false);
  assert.equal(passwordValid('12345678'), true);
  assert.equal(passwordValid('short'), false);
  assert.equal(passwordValid('x'.repeat(101)), false);
  assert.equal(phoneValid('+84901234567'), true);
  assert.equal(phoneValid('123'), false);
});

test('Student and Tutor receive distinct active-role identities', () => {
  assert.equal(themeForRole('STUDENT').primary, '#2463ae');
  assert.equal(themeForRole('TUTOR').primary, '#a92f69');
  assert.notEqual(themeForRole('STUDENT').primarySoft, themeForRole('TUTOR').primarySoft);
});
