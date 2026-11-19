import test from 'node:test';
import assert from 'node:assert/strict';
import { candidateScopeKey, canonicalCandidateSnapshot, normalizeCandidate } from './candidate-snapshot.mjs';

test('uses the P5 canonical subject:level:mode scope representation', () => {
  const query = {
    groundedSubject: { id: 5 },
    groundedLevel: { id: 9 },
    teachingMode: 'ONLINE'
  };

  assert.equal(candidateScopeKey(query), '5:9:ONLINE');
});

test('sorts scopes without changing their normalized candidate payloads', () => {
  const firstCandidates = [{ pseudonymousTutorId: 'T-a' }];
  const secondCandidates = [{ pseudonymousTutorId: 'T-b' }];
  const snapshot = canonicalCandidateSnapshot(new Map([
    ['5:9:ONLINE', secondCandidates],
    ['1:138:OFFLINE', firstCandidates]
  ]));

  assert.deepEqual(snapshot, [
    { scope: '1:138:OFFLINE', candidates: firstCandidates },
    { scope: '5:9:ONLINE', candidates: secondCandidates }
  ]);
  assert.equal(snapshot[0].candidates, firstCandidates);
  assert.equal(snapshot[1].candidates, secondCandidates);
});

test('normalizes the exact candidate fields shared by P4 and P5', () => {
  const normalized = normalizeCandidate({
    tutorId: 42,
    approvedOrVerified: true,
    teachingModes: ['ONLINE', 'OFFLINE'],
    subjects: [{
      subjectId: 5,
      levels: [{ levelId: 12 }, { levelId: 9 }],
      experienceYears: 4,
      tuitionMin: 180000,
      tuitionMax: 260000,
      description: 'geometry'
    }],
    availability: [
      { dayOfWeek: 4, startTime: '19:00', endTime: '21:00' },
      { dayOfWeek: 2, startTime: '19:00', endTime: '21:00' }
    ],
    averageRating: 4.8,
    reviewCount: 12,
    fullName: 'must not enter the snapshot'
  }, 'p4-runtime-2026-11-12');

  assert.deepEqual(normalized.teachingModes, ['OFFLINE', 'ONLINE']);
  assert.deepEqual(normalized.capabilities[0].levelIds, [9, 12]);
  assert.deepEqual(normalized.availability.map(slot => slot.dayOfWeek), [2, 4]);
  assert.equal(Object.hasOwn(normalized, 'fullName'), false);
  assert.deepEqual(Object.keys(normalized), [
    'pseudonymousTutorId', 'approved', 'teachingModes', 'capabilities',
    'availability', 'averageRating', 'reviewCount'
  ]);
});
