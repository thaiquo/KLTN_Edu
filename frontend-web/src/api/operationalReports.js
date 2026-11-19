import { apiBlobRequest, apiRequest } from "./client";
import { parsePaginatedResponse } from "./paginatedResponse";

export const operationalReportsApi = {
  async activities(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
    });
    const response = await apiRequest(`/api/operational-reports/activities?${query.toString()}`);
    const page = parsePaginatedResponse(response, "operational activities");
    return {
      ...page,
      sourceTotals: response?.sourceTotals || {},
      sources: Array.isArray(response?.sources) ? response.sources : []
    };
  },
  async summary(params = {}) {
    return apiRequest(`/api/operational-reports/summary?${toQuery(params)}`);
  },
  async exportCsv(params = {}) {
    return apiBlobRequest(`/api/operational-reports/export?${toQuery(params)}`);
  }
};

export const operationalWorkItemsApi = {
  async page({ page = 0, size = 50 } = {}) {
    const response = await apiRequest(`/api/operational-work-items/v1?page=${page}&size=${size}`);
    const parsed = parsePaginatedResponse(response, "operational work items");
    return {
      ...parsed,
      contractVersion: response?.contractVersion,
      sourceTotals: response?.sourceTotals || {},
      sources: Array.isArray(response?.sources) ? response.sources : []
    };
  },
  summary: () => apiRequest('/api/operational-work-items/v1/summary'),
  health: () => apiRequest('/api/operations/health/v1')
};

export const adminAnalyticsApi = {
  dashboard: ({ rangeDays = 30 } = {}) =>
    apiRequest(`/api/operations/dashboard/v1?rangeDays=${rangeDays}`)
};

function toQuery(params) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  });
  return query.toString();
}
