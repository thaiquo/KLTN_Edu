export class PaginatedResponseError extends Error {
  constructor(endpoint, detail) {
    super(`Phản hồi phân trang không hợp lệ từ ${endpoint}: ${detail}`);
    this.name = "PaginatedResponseError";
    this.endpoint = endpoint;
  }
}

function nonNegativeNumber(value, field, endpoint) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new PaginatedResponseError(endpoint, `thiếu hoặc sai trường ${field}`);
  }
  return parsed;
}

/**
 * Validate and normalize the Spring Page contract used by Admin/Staff list APIs.
 * Invalid successful responses are surfaced as contract errors instead of being
 * silently converted into an empty list.
 */
export function parsePaginatedResponse(value, endpoint) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PaginatedResponseError(endpoint, "response phải là object");
  }
  if (!Array.isArray(value.content)) {
    throw new PaginatedResponseError(endpoint, "content phải là array");
  }

  const page = nonNegativeNumber(value.number ?? value.page, "number", endpoint);
  const size = nonNegativeNumber(value.size, "size", endpoint);
  const totalElements = nonNegativeNumber(value.totalElements, "totalElements", endpoint);
  const totalPages = nonNegativeNumber(value.totalPages, "totalPages", endpoint);

  return {
    ...value,
    content: value.content,
    number: page,
    page,
    size,
    totalElements,
    totalPages,
    hasNext: typeof value.last === "boolean" ? !value.last : page + 1 < totalPages
  };
}

export async function paginatedRequest(request, endpoint) {
  return parsePaginatedResponse(await request, endpoint);
}

export function paginateItems(items, page, size) {
  if (!Array.isArray(items)) {
    throw new TypeError("items phải là array");
  }
  const safePage = Math.max(0, Number(page) || 0);
  const safeSize = Math.max(1, Number(size) || 10);
  return items.slice(safePage * safeSize, (safePage + 1) * safeSize);
}
