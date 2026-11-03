export const BLOCKING_CLASS_STATUSES = Object.freeze([
  'PENDING_APPROVAL',
  'ACTIVE',
  'PRIVATE',
  'PUBLISHED',
  'LOCKED'
]);

const blockingClassStatusSet = new Set(BLOCKING_CLASS_STATUSES);

export function blocksTutorSchedule(status) {
  return blockingClassStatusSet.has(status);
}
