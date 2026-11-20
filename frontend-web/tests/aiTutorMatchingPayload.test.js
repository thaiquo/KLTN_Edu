import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTutorMatchingPayload } from '../src/components/matching/aiTutorMatchingPayload.js';

function requirement(overrides = {}) {
  return {
    subject: { id: 5 },
    level: { id: 9 },
    teachingMode: 'ONLINE',
    budget: { max: 200000 },
    preferredSchedules: [{ dayOfWeek: 2, startTime: '19:00', endTime: '21:00' }],
    weakTopics: [],
    tutorPreferences: [],
    ...overrides
  };
}

test('legacy requirement defaults both constraint modes to SOFT', () => {
  const payload = buildTutorMatchingPayload(requirement());
  assert.equal(payload.scheduleConstraintMode, 'SOFT');
  assert.equal(payload.budgetConstraintMode, 'SOFT');
});

test('reviewed HARD modes are sent without changing schedule or budget', () => {
  const payload = buildTutorMatchingPayload(requirement({
    scheduleConstraintMode: 'HARD',
    budgetConstraintMode: 'HARD'
  }));
  assert.equal(payload.scheduleConstraintMode, 'HARD');
  assert.equal(payload.budgetConstraintMode, 'HARD');
  assert.deepEqual(payload.preferredSchedules[0], {
    dayOfWeek: 2,
    startTime: '19:00',
    endTime: '21:00',
    timeOfDayHint: null
  });
  assert.equal(payload.budgetMax, 200000);
});
