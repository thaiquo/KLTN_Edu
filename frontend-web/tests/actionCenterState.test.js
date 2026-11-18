import test from "node:test";
import assert from "node:assert/strict";
import {
  buildActionQueueSnapshot,
  projectAdditionalWorkItemQueues,
  projectAdminSlaMetrics,
  projectSlaPresentation
} from "../src/portal/components/staff/actionCenterState.js";

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

test("projects Community and Support totals without turning unavailable into zero", () => {
  const result = projectAdditionalWorkItemQueues({
    content: [
      { source: "COMMUNITY_MODERATION", resourceId: "1" },
      { source: "SUPPORT_TICKET", resourceId: "2" },
      { source: "DISPUTE", resourceId: "3" }
    ],
    sourceTotals: { COMMUNITY_MODERATION: 4, SUPPORT_TICKET: null },
    sources: [
      { source: "COMMUNITY_MODERATION", status: "SUCCESS" },
      { source: "SUPPORT_TICKET", status: "UNAVAILABLE", errorCode: "HTTP_503" }
    ]
  });
  assert.deepEqual(result.totals, { community: 4, support: null });
  assert.equal(result.errors.support, "HTTP_503");
  assert.equal(result.items.length, 2);
});

test("renders server-authoritative due-soon and overdue SLA states", () => {
  const fallback = { urgency: "NORMAL", urgencyTone: "blue", urgencyLabel: "Chờ xử lý" };
  assert.deepEqual(projectSlaPresentation({
    slaState: "DUE_SOON", remainingMinutes: 45, dueAt: "2026-11-18T00:00:00Z"
  }, fallback), {
    urgency: "MEDIUM", urgencyTone: "amber", urgencyLabel: "Sắp đến hạn · còn 45 phút",
    dueAt: "2026-11-18T00:00:00Z", slaState: "DUE_SOON"
  });
  assert.equal(projectSlaPresentation({ slaState: "OVERDUE", overdueByMinutes: 12 }, fallback).urgencyLabel,
    "Quá hạn 12 phút");
});

test("admin SLA summary preserves unavailable sources instead of reporting zero health", () => {
  assert.deepEqual(projectAdminSlaMetrics({
    dueSoon: 2,
    overdue: 1,
    sources: [{ source: "DISPUTE", status: "UNAVAILABLE" }, { source: "SUPPORT_TICKET", status: "SUCCESS" }]
  }), { dueSoon: 2, overdue: 1, unavailableSources: ["DISPUTE"] });
});
