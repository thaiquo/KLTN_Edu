import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectTerminationCase } from './terminationState.js';

const makeCase = (id, agreementId, status, wholeClass = false) => ({
  request: { id, classroomId: 5, status, wholeClass, createdAt: `2026-10-0${id}` },
  items: [{ agreementId }]
});
test('a pending individual request is visible before refund items exist', () => {
  const pending = { request: { classroomId: 5, anchorAgreementId: 'mine', status: 'REQUESTED' }, items: [] };
  assert.equal(selectTerminationCase([pending], { classroomId: 5, agreementId: 'mine' }), pending);
  assert.equal(selectTerminationCase([pending], { classroomId: 5, agreementId: 'other' }), undefined);
});
test('individual cancellation is attached only to the affected agreement', () => {
  const cases = [makeCase(1, 'old', 'COMPLETED'), makeCase(2, 'other', 'APPROVED')];
  assert.equal(selectTerminationCase(cases, { classroomId: 5, agreementId: 'current' }), undefined);
  assert.equal(selectTerminationCase(cases, { classroomId: 5, wholeClassOnly: true }), undefined);
});
test('rejected cases do not keep a class stopped and latest applicable case wins', () => {
  const cases = [makeCase(1, 'a', 'REQUESTED', true), makeCase(3, 'a', 'REJECTED', true), makeCase(2, 'a', 'APPROVED', true)];
  assert.equal(selectTerminationCase(cases, { classroomId: 5, agreementId: 'a' }).request.id, 2);
  assert.equal(selectTerminationCase([cases[1]], { classroomId: 5 }), undefined);
});
