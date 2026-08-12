const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
let csrfToken = null;
let csrfHeader = 'X-XSRF-TOKEN';
let csrfPromise = null;
let refreshPromise = null;

async function readJson(response) {
  return response.json().catch(() => ({}));
}

async function ensureCsrf() {
  if (csrfToken) return;
  if (!csrfPromise) csrfPromise = (async () => {
    const response = await fetch(`${API_URL}/auth/csrf`, { credentials: 'include' });
    const envelope = await readJson(response);
    if (!response.ok || !envelope?.data?.token) throw new Error(envelope.message || 'Không thể khởi tạo bảo mật yêu cầu.');
    csrfToken = envelope.data.token;
    csrfHeader = envelope.data.headerName || csrfHeader;
  })().finally(() => { csrfPromise = null; });
  return csrfPromise;
}

async function refreshSession() {
  if (!refreshPromise) refreshPromise = fetch(`${API_URL}/auth/refresh`, {
    method: 'POST', credentials: 'include'
  }).then(response => {
    if (!response.ok) throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    return response;
  }).finally(() => { refreshPromise = null; });
  return refreshPromise;
}

function isMutation(method) {
  return !['GET', 'HEAD', 'OPTIONS'].includes(method);
}

function errorMessage(data, response) {
  if (typeof data?.message === 'string') return data.message;
  if (data?.data && typeof data.data === 'object') return Object.values(data.data)[0];
  return response ? `Yêu cầu thất bại (mã ${response.status}). Vui lòng thử lại.` : 'Yêu cầu thất bại. Vui lòng thử lại.';
}

export async function apiRequest(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const isFormData = options.body instanceof FormData;
  if (isMutation(method) && !['/auth/register', '/auth/login', '/auth/refresh'].includes(path)) await ensureCsrf();

  let response;
  try {
    const requestOptions = () => ({
      ...options,
      method,
      credentials: 'include',
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(isMutation(method) && csrfToken ? { [csrfHeader]: csrfToken } : {}),
        ...options.headers
      }
    });
    response = await fetch(`${API_URL}${path}`, requestOptions());
    if ([401, 403].includes(response.status) && !path.startsWith('/auth/')) {
      await refreshSession();
      if (isMutation(method)) {
        csrfToken = null;
        await ensureCsrf();
      }
      response = await fetch(`${API_URL}${path}`, requestOptions());
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('Phiên đăng nhập')) {
      throw err;
    }
    throw new Error('Không thể kết nối máy chủ. Vui lòng thử lại.');
  }

  const envelope = await readJson(response);
  if (!response.ok || envelope.success === false) throw new Error(errorMessage(envelope, response));
  return Object.prototype.hasOwnProperty.call(envelope, 'data') ? envelope.data : envelope;
}

export async function apiDownload(path) {
  const response = await fetch(`${API_URL}${path}`, { credentials: 'include' });
  if (!response.ok) {
    const data = await readJson(response);
    throw new Error(errorMessage(data, response));
  }
  return URL.createObjectURL(await response.blob());
}

export function clearCsrf() {
  csrfToken = null;
  csrfPromise = null;
}
