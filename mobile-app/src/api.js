const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:8080').replace(/\/$/, '');

export async function authRequest(path, payload) {
  let response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      method: payload ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      ...(payload ? { body: JSON.stringify(payload) } : {})
    });
  } catch {
    throw new Error('Không thể kết nối máy chủ. Vui lòng thử lại.');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = Array.isArray(data.message) ? data.message[0] : data.message;
    throw new Error(message || 'Yêu cầu không thành công.');
  }

  return data;
}
