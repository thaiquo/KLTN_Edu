import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3000').replace(/\/$/, '');
export const TOKEN_KEY = 'educonnect_token';

export async function authRequest(path, payload) {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  let response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      method: payload ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
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
