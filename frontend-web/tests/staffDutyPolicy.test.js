import test from "node:test";
import assert from "node:assert/strict";
import { canWriteForDuty } from "../src/portal/hooks/staffDutyPolicy.js";

test("admin is exempt from the Staff duty gate", () => {
  assert.equal(canWriteForDuty("ADMIN", null), true);
  assert.equal(canWriteForDuty("ADMIN", { writeAllowed: false }), true);
});

test("Staff is fail-closed until an on-duty status allows writes", () => {
  assert.equal(canWriteForDuty("STAFF", null), false);
  assert.equal(canWriteForDuty("STAFF", { writeAllowed: false }), false);
  assert.equal(canWriteForDuty("STAFF", { writeAllowed: true }), true);
});

test("Student and Tutor behavior is not changed by the Staff duty gate", () => {
  assert.equal(canWriteForDuty("STUDENT", null), true);
  assert.equal(canWriteForDuty("TUTOR", null), true);
});

test("an open Staff portal follows ON_DUTY to OFF_DUTY transitions fail-closed", () => {
  const states = [{ writeAllowed: true }, { writeAllowed: false }];
  assert.deepEqual(states.map(status => canWriteForDuty("STAFF", status)), [true, false]);
});

test("an open Staff portal follows OFF_DUTY to ON_DUTY transitions", () => {
  const states = [{ writeAllowed: false }, { writeAllowed: true }];
  assert.deepEqual(states.map(status => canWriteForDuty("STAFF", status)), [false, true]);
});
