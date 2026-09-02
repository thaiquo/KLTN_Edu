const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
const API_URL = (configuredApiUrl || (import.meta.env.DEV ? '' : 'http://localhost:8080')).replace(/\/$/, '');

export class ApiError extends Error {
  constructor({ status, message, code, validationErrors, path, raw }) {
    super(message || 'Yêu cầu không thành công.');
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
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

function parseErrorPayload(data, status) {
  let rawMessage = '';
  let code = undefined;

  if (typeof data === 'string') {
    rawMessage = data;
  } else if (data && typeof data === 'object') {
    code = data.code;
    if (Array.isArray(data.message)) {
      rawMessage = data.message[0] || '';
    } else {
      rawMessage = data.message || data.error || data.detail || data.title || '';
    }
  }

  if (typeof rawMessage === 'string' && rawMessage.includes(':')) {
    const parts = rawMessage.split(':');
    const potentialCode = parts[0].trim();
    if (/^[A-Z0-9_]+$/.test(potentialCode)) {
      if (!code) code = potentialCode;
      rawMessage = parts.slice(1).join(':').trim();
    }
  }

  let userMessage = rawMessage;

  if (code === 'INVALID_CREDENTIALS' || rawMessage === 'Invalid email or password' || rawMessage === 'Bad credentials') {
    userMessage = 'Email hoặc mật khẩu không chính xác.';
  } else if (code === 'STUDENT_PROFILE_NOT_FOUND') {
    userMessage = 'Tài khoản chưa đăng ký làm học viên.';
  } else if (code === 'TUTOR_PROFILE_NOT_FOUND') {
    userMessage = 'Tài khoản chưa đăng ký làm gia sư.';
  } else if (code === 'TUTOR_PENDING') {
    userMessage = 'Hồ sơ gia sư đang chờ xét duyệt.';
  } else if (code === 'TUTOR_REJECTED') {
    userMessage = 'Hồ sơ gia sư chưa được phê duyệt.';
  } else if (code === 'FILE_ALREADY_EXISTS') {
    userMessage = 'Tệp này đã được tải lên trước đó.';
  } else if (!userMessage) {
    userMessage = getStatusFallbackMessage(status);
  }

  return { code, message: userMessage };
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
    const { code, message } = parseErrorPayload(data, response.status);
    if (response.status === 401 && !path.startsWith('/api/auth/')) {
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }
    throw new ApiError({
      status: response.status,
      code,
      message,
      validationErrors: normalizeValidationErrors(data),
      path: typeof data === 'object' ? data?.path : undefined,
      raw: data
    });
  }

  return data;
}

export async function apiBlobRequest(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  if (isMutation(method)) await ensureCsrfToken();
  let response;
  try {
    response = await fetch(buildUrl(path), {
      ...options,
      credentials: 'include',
      headers: buildHeaders(options, isMutation(method), options.body instanceof FormData)
    });
  } catch {
    throw new ApiError({ status: 0, message: 'Không thể kết nối máy chủ. Vui lòng thử lại.' });
  }
  if (!response.ok) {
    const data = await parseResponseBody(response);
    const { code, message } = parseErrorPayload(data, response.status);
    throw new ApiError({ status: response.status, code, message, raw: data });
  }
  return response.blob();
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
