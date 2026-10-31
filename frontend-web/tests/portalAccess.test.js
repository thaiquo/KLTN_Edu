import test from "node:test";
import assert from "node:assert/strict";

import {
  canAccessPortalPage,
  getAllowedPortalPages,
  resolvePortalPage,
} from "../src/portal/portalAccess.js";

test("admin inherits every staff portal page", () => {
  for (const page of getAllowedPortalPages("staff")) {
    assert.equal(canAccessPortalPage("admin", page), true, page);
  }
});

test("staff cannot open admin-only pages through a query parameter", () => {
  for (const page of ["admin-finance", "user-management", "subject-catalog"]) {
    assert.equal(canAccessPortalPage("staff", page), false, page);
    assert.equal(resolvePortalPage("staff", page), "tutor-approval", page);
  }
});

test("student and tutor cannot open management pages", () => {
  for (const role of ["student", "tutor"]) {
    for (const page of ["tutor-approval", "reports", "admin-finance", "user-management"]) {
      assert.equal(canAccessPortalPage(role, page), false, `${role}:${page}`);
    }
  }
});

test("valid role navigation remains available", () => {
  assert.equal(resolvePortalPage("staff", "complaints"), "complaints");
  assert.equal(resolvePortalPage("admin", "reports"), "reports");
  assert.equal(resolvePortalPage("tutor", "sessions"), "sessions");
  assert.equal(resolvePortalPage("student", "my-classes"), "my-classes");
});
