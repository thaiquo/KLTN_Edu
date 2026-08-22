import { apiRequest } from './client';

function normalizeSuggestion(item) {
  if (!item || typeof item !== 'object') return item;
  return {
    ...item,
    suggestedName: item.suggestedName || item.requestedName,
    rejectionReason: item.rejectionReason || item.rejectReason
  };
}

function normalizeList(items) {
  return Array.isArray(items) ? items.map(normalizeSuggestion) : items;
}

export const subjectSuggestionApi = {
  create: async (payload) => normalizeSuggestion(await apiRequest('/api/learning/subject-requests', {
    method: 'POST',
    body: JSON.stringify({
      requestedName: payload.suggestedName || payload.requestedName,
      categoryId: payload.categoryId,
      groupId: payload.groupId,
      requestedByUserId: payload.requestedByUserId,
      levels: payload.levels,
      note: payload.note
    })
  })),
  mine: async (userId) => normalizeList(await apiRequest(`/api/learning/subject-requests/me?userId=${encodeURIComponent(userId)}`)),
  adminPending: async () => normalizeList(await apiRequest('/api/learning/subject-requests/pending')),
  approveAsNew: (id, reviewedByUserId) => apiRequest(`/api/learning/subject-requests/${id}/approve${reviewedByUserId ? `?reviewedByUserId=${encodeURIComponent(reviewedByUserId)}` : ''}`, {
    method: 'PATCH'
  }),
  mapExisting: (id) => apiRequest(`/api/learning/subject-requests/${id}/approve`, {
    method: 'PATCH'
  }),
  reject: (id, reason, reviewedByUserId) => apiRequest(`/api/learning/subject-requests/${id}/reject`, {
    method: 'PATCH',
    body: JSON.stringify({ reason, reviewedByUserId })
  })
};
