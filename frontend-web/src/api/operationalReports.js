import { apiRequest } from "./client";
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
  }
};
