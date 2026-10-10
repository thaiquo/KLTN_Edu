import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isClassLiveNow } from './scheduleUtils.js';

const currentDate = new Date(2026, 9, 2, 15, 30);
const schedules = [{ dayOfWeek: 6, startTime: '15:00', endTime: '16:30' }];
const session = { sequenceNumber: 2, sessionDate: '2026-10-02', startTime: '15:00', endTime: '16:30', status: 'SCHEDULED' };
const check = (options = {}) => isClassLiveNow({ currentDate, schedules, ...options }).isLive;

test('cancelled or closed class never becomes live from its weekly schedule', () => {
  for (const classStatus of ['CANCELLED', 'CLOSED']) assert.equal(check({ classStatus }), false);
});
test('concrete sessions override recurring schedule even when empty or finished', () => {
  assert.equal(check({ sessions: [] }), false);
  for (const status of ['COMPLETED', 'CANCELLED']) assert.equal(check({ sessions: [{ ...session, status }] }), false);
});
test('old IN_PROGRESS session is not live today', () => {
  assert.equal(check({ sessions: [{ ...session, status: 'IN_PROGRESS', sessionDate: '2026-09-25' }] }), false);
});
test('hold applies per session and per participant without stopping other participants', () => {
  assert.equal(check({ sessions: [session] }), true);
  assert.equal(check({ sessions: [{ ...session, attendanceStopped: true }] }), false);
  assert.equal(check({ sessions: [session], terminationCutoffSession: 1 }), false);
  assert.equal(check({ sessions: [session], terminationCutoffSession: 2 }), true);
  assert.equal(check({ terminationCutoffSession: 0 }), false);
});
