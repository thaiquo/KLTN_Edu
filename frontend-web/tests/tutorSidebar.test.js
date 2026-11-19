import test from "node:test";
import assert from "node:assert/strict";

import {
  TUTOR_SIDEBAR_ENTRIES,
  getTutorSidebarGroupId,
  getTutorSidebarPageIds,
} from "../src/portal/components/tutorSidebarConfig.js";
import { getAllowedPortalPages } from "../src/portal/portalAccess.js";

test("Tutor sidebar keeps the requested order without adding or dropping menu functions", () => {
  assert.deepEqual(
    TUTOR_SIDEBAR_ENTRIES.map((entry) =>
      entry.type === "group"
        ? [entry.label, entry.items.map((item) => [item.label, item.id])]
        : [entry.label, entry.id]
    ),
    [
      ["Tổng quan", "dashboard"],
      ["Bảng tin", "community"],
      ["Giảng dạy", [["Lớp học", "my-classes"], ["Quản lý buổi học", "sessions"], ["Quản lý bài tập", "homework"], ["Môn học", "subjects"]]],
      ["Lịch dạy", "schedule"],
      ["Yêu cầu học", "requests"],
      ["Tin nhắn", "messages"],
      ["Hợp đồng & thanh toán", [["Hợp đồng & ký quỹ", "contracts"], ["Ví của tôi", "wallet"]]],
      ["Khiếu nại lớp học", "complaints"],
    ]
  );

  const pageIds = getTutorSidebarPageIds();
  assert.equal(new Set(pageIds).size, pageIds.length);
  assert.deepEqual(
    new Set(pageIds),
    new Set(getAllowedPortalPages("tutor").filter((page) => !["class-management", "settings", "help"].includes(page)))
  );
});

test("Tutor deep links resolve only to their containing dropdown", () => {
  assert.equal(getTutorSidebarGroupId("homework"), "teaching");
  assert.equal(getTutorSidebarGroupId("sessions"), "teaching");
  assert.equal(getTutorSidebarGroupId("contracts"), "contracts-payments");
  assert.equal(getTutorSidebarGroupId("wallet"), "contracts-payments");
  for (const page of ["dashboard", "community", "schedule", "requests", "messages", "complaints", "unknown"]) {
    assert.equal(getTutorSidebarGroupId(page), null, page);
  }
});

test("Admin, Staff, and Student access lists remain unchanged", () => {
  assert.deepEqual(getAllowedPortalPages("student"), ["community", "my-classes", "homework", "contracts", "messages", "complaints", "settings", "help"]);
  assert.deepEqual(getAllowedPortalPages("staff"), ["dashboard", "tutor-approval", "class-management", "contracts", "complaints", "escalations", "community-moderation", "duty-roster", "settings", "help"]);
  assert.equal(getAllowedPortalPages("admin").includes("chatbot-knowledge"), true);
});
