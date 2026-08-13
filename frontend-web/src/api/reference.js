import { apiRequest } from './client';

export const referenceApi = {
  provinces: () => apiRequest('/api/reference/provinces'),
  communes: (provinceCode) => apiRequest(`/api/reference/provinces/${encodeURIComponent(provinceCode)}/communes`)
};
