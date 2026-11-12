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
