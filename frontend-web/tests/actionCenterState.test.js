import test from "node:test";
import assert from "node:assert/strict";
import { buildActionQueueSnapshot } from "../src/portal/components/staff/actionCenterState.js";

test("uses backend totals instead of first-page lengths", () => {
  const result = buildActionQueueSnapshot([
    { status: "fulfilled", value: { content: Array(10), totalElements: 61 } },
    { status: "fulfilled", value: { content: Array(10), totalElements: 52 } },
    { status: "fulfilled", value: { content: Array(10), totalElements: 11 } },
    { status: "fulfilled", value: { content: Array(3), totalElements: 3 } },
    { status: "fulfilled", value: { content: [], totalElements: 0 } }
  ]);

  assert.equal(result.knownTotal, 127);
  assert.equal(result.totals.tutors, 61);
  assert.equal(result.totals.teaching, 52);
  assert.equal(result.complete, true);
});

test("keeps successful totals and marks a failed source unavailable", () => {
  const result = buildActionQueueSnapshot([
    { status: "fulfilled", value: { content: [], totalElements: 0 } },
    { status: "rejected", reason: new Error("503") },
    { status: "fulfilled", value: { content: Array(2), totalElements: 20 } },
    { status: "fulfilled", value: { content: Array(1), totalElements: 1 } },
    { status: "fulfilled", value: { content: Array(4), totalElements: 4 } }
  ]);

  assert.equal(result.knownTotal, 25);
  assert.equal(result.totals.teaching, null);
  assert.equal(result.errors.teaching, "503");
  assert.equal(result.complete, false);
});
