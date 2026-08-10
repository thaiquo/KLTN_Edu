const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8080').replace(/\/$/, '');

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

  await fetch(`${API_URL}/api/auth/csrf`, {
    method: 'GET',
    credentials: 'include'
  }).catch(() => {});
}

export async function apiRequest(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const method = (options.method || 'GET').toUpperCase();
  const needsCsrf = !['GET', 'HEAD', 'OPTIONS'].includes(method);

  if (needsCsrf) {
    await ensureCsrfToken();
  }

  let response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...options.headers,
        ...(needsCsrf && getCookie('XSRF-TOKEN')
          ? { 'X-XSRF-TOKEN': decodeURIComponent(getCookie('XSRF-TOKEN')) }
          : {})
      }
    });
  } catch {
    throw new Error('Khong the ket noi may chu. Vui long thu lai.');
  }

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await response.json().catch(() => ({}))
    : await response.text().catch(() => '');

  if (!response.ok) {
    const message = typeof data === 'string'
      ? data
      : Array.isArray(data.message)
        ? data.message[0]
        : data.message || data.error || data.detail || data.title;

    throw new Error(message || 'Yeu cau khong thanh cong.');
  }

  return data;
}
