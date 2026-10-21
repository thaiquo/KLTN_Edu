import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizedSearch, registrationSteps, statusLabel, validTeachingDetails } from './teachingRegistration.ts';

test('academic and skill registrations follow the web branch order', () => {
  assert.deepEqual(registrationSteps('ACADEMIC'), ['program', 'education', 'category', 'subject', 'level', 'details', 'evidence', 'review']);
  assert.deepEqual(registrationSteps('SKILL', true), ['program', 'category', 'subject', 'proposal', 'details', 'evidence', 'review']);
});

test('subject search ignores Vietnamese diacritics and distinguishes đ', () => {
  assert.equal(normalizedSearch('Vật lý').includes(normalizedSearch('vat ly')), true);
  assert.equal(normalizedSearch('Địa lý').includes(normalizedSearch('dia ly')), true);
});

test('teaching detail validation requires real experience, ordered fees, and description', () => {
  assert.ok(validTeachingDetails('', '100000', '200000', 'Có kinh nghiệm'));
  assert.ok(validTeachingDetails('0', '200000', '100000', 'Có kinh nghiệm'));
  assert.ok(validTeachingDetails('0', '100000', '200000', ''));
  assert.equal(validTeachingDetails('0', '100000', '200000', 'Có kinh nghiệm'), null);
});

test('registration statuses are localized', () => {
  assert.equal(statusLabel('APPROVED'), 'Đã duyệt');
  assert.equal(statusLabel('PENDING'), 'Chờ duyệt');
  assert.equal(statusLabel('REJECTED'), 'Bị từ chối');
});
