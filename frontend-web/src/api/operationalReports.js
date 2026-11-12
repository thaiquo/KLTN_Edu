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
    return { ...page, sourceTotals: response?.sourceTotals || {} };
  },
  async summary(params = {}) {
    return apiRequest(`/api/operational-reports/summary?${toQuery(params)}`);
  },
  async exportCsv(params = {}) {
    return apiBlobRequest(`/api/operational-reports/export?${toQuery(params)}`);
  }
};

function toQuery(params) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  });
  return query.toString();
}
