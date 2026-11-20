export function canWriteForDuty(activeRole, status) {
  const role = String(activeRole || "").toUpperCase();
  if (role === "ADMIN") return true;
  if (role !== "STAFF") return true;
  return Boolean(status?.writeAllowed);
}
