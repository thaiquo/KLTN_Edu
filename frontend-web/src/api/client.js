const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8080').replace(/\/$/, '');

export class ApiError extends Error {
  constructor({ status, message, validationErrors, path, raw }) {
    super(message || 'Yêu cầu không thành công.');
    this.name = 'ApiError';
    this.status = status;
    this.validationErrors = validationErrors || [];
    this.path = path;
    this.raw = raw;
  }
}

function getCookie(name) {
  return document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
    ?.split('=')
    .slice(1)
    .join('=');
}

async function ensureCsrfToken() {
  if (getCookie('XSRF-TOKEN')) return;

  await fetch(buildUrl('/api/auth/csrf'), {
    method: 'GET',
    credentials: 'include'
  }).catch(() => {});
}

function buildUrl(path) {
  return `${API_URL}${path}`;
}

function isMutation(method) {
  return !['GET', 'HEAD', 'OPTIONS'].includes(method);
}

function buildHeaders(options, needsCsrf, isFormData) {
  const csrfToken = getCookie('XSRF-TOKEN');

  return {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...options.headers,
    ...(needsCsrf && csrfToken ? { 'X-XSRF-TOKEN': decodeURIComponent(csrfToken) } : {})
  };
}

async function parseResponseBody(response) {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return response.json().catch(() => ({}));
  }

  return response.text().catch(() => '');
}

function getErrorMessage(data) {
  if (typeof data === 'string') {
    return data;
  }

  if (Array.isArray(data?.message)) {
    return data.message[0];
  }

  return data?.message || data?.error || data?.detail || data?.title;
}

function getStatusFallbackMessage(status) {
  if (status === 400) return 'Dữ liệu gửi lên không hợp lệ.';
  if (status === 409) return 'Yêu cầu bị xung đột với dữ liệu hiện có.';
  if (status === 429) return 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.';
  if (status >= 500) return 'Máy chủ gặp lỗi. Vui lòng thử lại sau.';
  return 'Yêu cầu không thành công.';
}

function normalizeValidationErrors(data) {
  if (!Array.isArray(data?.validationErrors)) {
    return [];
  }

  return data.validationErrors;
}

export async function apiRequest(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const method = (options.method || 'GET').toUpperCase();
  const needsCsrf = isMutation(method);

  if (needsCsrf) {
    await ensureCsrfToken();
  }

  let response;

  try {
    response = await fetch(buildUrl(path), {
      ...options,
      credentials: 'include',
      headers: buildHeaders(options, needsCsrf, isFormData)
    });
  } catch {
    throw new ApiError({
      status: 0,
      message: 'Không thể kết nối máy chủ. Vui lòng thử lại.'
    });
  }

  const data = await parseResponseBody(response);

  if (!response.ok) {
    throw new ApiError({
      status: response.status,
      message: getErrorMessage(data) || getStatusFallbackMessage(response.status),
      validationErrors: normalizeValidationErrors(data),
      path: typeof data === 'object' ? data?.path : undefined,
      raw: data
    });
  }

  return data;
}

export function isUnauthorized(error) {
  return error?.status === 401;
}

export function isForbidden(error) {
  return error?.status === 403;
}

export function isConflict(error) {
  return error?.status === 409;
}

export function isRateLimited(error) {
  return error?.status === 429;
}
