import test from "node:test";
import assert from "node:assert/strict";

import {
  ADMIN_OVERVIEW_ITEM,
  ADMIN_SIDEBAR_GROUPS,
  getAdminSidebarGroupId,
} from "../src/portal/components/adminSidebarConfig.js";
import { getAllowedPortalPages } from "../src/portal/portalAccess.js";

const EXPECTED_GROUPS = [
  ["Người dùng & học vụ", ["user-management", "tutor-approval", "class-management", "subject-catalog"]],
  ["Tài chính & hợp đồng", ["admin-finance", "contracts"]],
  ["Kiểm duyệt & khiếu nại", ["community-moderation", "escalations", "complaints"]],
  ["Vận hành", ["staff-duty-management", "reports"]],
  ["AI & hệ thống", ["chatbot-knowledge", "settings"]],
];

test("admin sidebar keeps overview standalone and groups every remaining Admin page once", () => {
  assert.equal(ADMIN_OVERVIEW_ITEM.id, "dashboard");
  assert.deepEqual(
    ADMIN_SIDEBAR_GROUPS.map((group) => [group.label, group.items.map((item) => item.id)]),
    EXPECTED_GROUPS
  );

  const groupedPages = ADMIN_SIDEBAR_GROUPS.flatMap((group) => group.items.map((item) => item.id));
  assert.equal(new Set(groupedPages).size, groupedPages.length);
  assert.deepEqual(
    new Set([ADMIN_OVERVIEW_ITEM.id, ...groupedPages]),
    new Set(getAllowedPortalPages("admin").filter((page) => page !== "help" && page !== "duty-roster"))
  );
});

test("direct and history navigation resolves the containing Admin group exactly", () => {
  assert.equal(getAdminSidebarGroupId("subject-catalog"), "users-academics");
  assert.equal(getAdminSidebarGroupId("contracts"), "finance-contracts");
  assert.equal(getAdminSidebarGroupId("complaints"), "moderation-disputes");
  assert.equal(getAdminSidebarGroupId("reports"), "operations");
  assert.equal(getAdminSidebarGroupId("chatbot-knowledge"), "ai-system");
  assert.equal(getAdminSidebarGroupId("dashboard"), null);
  assert.equal(getAdminSidebarGroupId("unknown"), null);
});

test("Admin grouping does not add, remove, or reorder Staff pages", () => {
  assert.deepEqual(getAllowedPortalPages("staff"), [
    "dashboard",
    "tutor-approval",
    "class-management",
    "contracts",
    "complaints",
    "escalations",
    "community-moderation",
    "duty-roster",
    "settings",
    "help",
  ]);
});
