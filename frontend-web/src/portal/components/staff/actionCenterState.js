export const ACTION_QUEUE_KEYS = ["tutors", "teaching", "classes", "disputes", "terminations"];

export function buildActionQueueSnapshot(results) {
  const totals = Object.fromEntries(ACTION_QUEUE_KEYS.map((key) => [key, null]));
  const errors = {};
  const items = {};

  ACTION_QUEUE_KEYS.forEach((key, index) => {
    const result = results[index];
    if (result?.status === "fulfilled") {
      const value = result.value;
      const rows = Array.isArray(value?.content) ? value.content : Array.isArray(value) ? value : [];
      items[key] = rows;
      totals[key] = Number.isFinite(Number(value?.totalElements)) ? Number(value.totalElements) : rows.length;
      return;
    }
    items[key] = [];
    errors[key] = result?.reason?.message || "Không thể tải nguồn dữ liệu";
  });

  const knownTotal = Object.values(totals).reduce((sum, value) => sum + (value ?? 0), 0);
  return { totals, errors, items, knownTotal, complete: Object.keys(errors).length === 0 };
}
