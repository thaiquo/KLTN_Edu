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

export function projectAdditionalWorkItemQueues(response) {
  const totals = { community: null, support: null };
  const errors = {};
  const sources = new Map((response?.sources || []).map(source => [source.source, source]));
  const apply = (source, key) => {
    const health = sources.get(source);
    if (health?.status === "SUCCESS") totals[key] = response?.sourceTotals?.[source] ?? 0;
    else errors[key] = health?.errorCode || "Nguồn không khả dụng";
  };
  apply("COMMUNITY_MODERATION", "community");
  apply("SUPPORT_TICKET", "support");
  const items = (response?.content || []).filter(item =>
    item.source === "COMMUNITY_MODERATION" || item.source === "SUPPORT_TICKET");
  return { totals, errors, items };
}

export function projectSlaPresentation(workItem, fallback) {
  if (!workItem) return fallback;
  if (workItem.slaState === "OVERDUE") {
    return {
      urgency: "HIGH",
      urgencyTone: "rose",
      urgencyLabel: `Quá hạn ${workItem.overdueByMinutes ?? 0} phút`,
      dueAt: workItem.dueAt ?? null,
      slaState: workItem.slaState
    };
  }
  if (workItem.slaState === "DUE_SOON") {
    return {
      urgency: "MEDIUM",
      urgencyTone: "amber",
      urgencyLabel: `Sắp đến hạn · còn ${workItem.remainingMinutes ?? 0} phút`,
      dueAt: workItem.dueAt ?? null,
      slaState: workItem.slaState
    };
  }
  return {
    ...fallback,
    dueAt: workItem.dueAt ?? null,
    slaState: workItem.slaState || "NOT_APPLICABLE"
  };
}

export function projectAdminSlaMetrics(summary) {
  if (!summary) return { dueSoon: null, overdue: null, unavailableSources: [] };
  return {
    dueSoon: Number(summary.dueSoon ?? 0),
    overdue: Number(summary.overdue ?? 0),
    unavailableSources: Array.isArray(summary.sources)
      ? summary.sources.filter((source) => source.status !== "SUCCESS").map((source) => source.source)
      : []
  };
}
