const STAFF_PAGES = [
  "dashboard",
  "tutor-approval",
  "class-management",
  "contracts",
  "complaints",
  "escalations",
  "community-moderation",
  "reports",
  "settings",
  "help",
];

const PAGES_BY_ROLE = {
  student: new Set([
    "community",
    "my-classes",
    "homework",
    "contracts",
    "messages",
    "complaints",
    "settings",
    "help",
  ]),
  tutor: new Set([
    "community",
    "dashboard",
    "subjects",
    "my-classes",
    "homework",
    "sessions",
    "contracts",
    "wallet",
    "requests",
    "messages",
    "schedule",
    "complaints",
    "class-management",
    "settings",
    "help",
  ]),
  staff: new Set(STAFF_PAGES),
  admin: new Set([
    ...STAFF_PAGES,
    "admin-finance",
    "user-management",
    "subject-catalog",
  ]),
};

const DEFAULT_PAGE_BY_ROLE = {
  student: "my-classes",
  tutor: "dashboard",
  staff: "tutor-approval",
  admin: "dashboard",
};

export function canAccessPortalPage(role, page) {
  return Boolean(page && PAGES_BY_ROLE[role]?.has(page));
}

export function getDefaultPortalPage(role) {
  return DEFAULT_PAGE_BY_ROLE[role] || "my-classes";
}

export function resolvePortalPage(role, requestedPage) {
  return canAccessPortalPage(role, requestedPage)
    ? requestedPage
    : getDefaultPortalPage(role);
}

export function getAllowedPortalPages(role) {
  return Array.from(PAGES_BY_ROLE[role] || []);
}
