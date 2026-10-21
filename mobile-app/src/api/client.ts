import { gatewayUrl } from '../config/runtime';
import { secureSession } from '../storage/secureSession';
import type { MobileSession } from '../types/session';

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

type RequestOptions = RequestInit & { timeoutMs?: number; skipRefresh?: boolean; anonymous?: boolean };

class ApiClient {
  private accessToken: string | null = null;
  private refreshPromise: Promise<MobileSession> | null = null;
  onSessionLost: (() => void) | null = null;
  onTokenChanged: ((token: string | null) => void) | null = null;

  getToken() { return this.accessToken; }

  async setSession(session: MobileSession) {
    if (session.refreshToken) await secureSession.saveRefresh(session.refreshToken);
    this.accessToken = session.accessToken;
    this.onTokenChanged?.(this.accessToken);
  }

  async clearSession() {
    this.accessToken = null;
    this.onTokenChanged?.(null);
    await secureSession.clear();
  }

  private async send<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { timeoutMs = 15000, skipRefresh = false, anonymous = false, ...init } = options;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const registrationRequest = __DEV__ && init.method === 'POST' &&
      (path === '/api/tutor-applications/me/documents' || path === '/api/learning/tutor/subject-registrations/batch');
    let responseStatus: number | null = null;
    try {
      const headers = new Headers(init.headers);
      if (!anonymous && this.accessToken) headers.set('Authorization', `Bearer ${this.accessToken}`);
      if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
      if (registrationRequest) console.info('[Teaching registration] request', {
        url: `${gatewayUrl}${path}`, method: init.method || 'GET', bearerAttached: headers.has('Authorization'),
        contentType: headers.get('Content-Type') || (init.body instanceof FormData ? 'multipart/automatic' : 'none'),
      });
      const response = await fetch(`${gatewayUrl}${path}`, { ...init, headers, signal: controller.signal });
      responseStatus = response.status;
      if (registrationRequest) console.info('[Teaching registration] response', { path, status: response.status });
      if (response.status === 401 && !skipRefresh && this.accessToken) {
        await this.refresh();
        return this.send<T>(path, { ...options, skipRefresh: true });
      }
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const message = typeof body.message === 'string' ? body.message : typeof body.error === 'string' ? body.error : null;
        const fallback = response.status === 401 ? 'Phiên đăng nhập đã hết hạn.'
          : response.status === 403 ? 'Tài khoản không có quyền thực hiện thao tác này.'
          : response.status === 400 ? 'Dữ liệu gửi lên chưa hợp lệ.'
          : response.status === 409 ? 'Đăng ký bị trùng hoặc xung đột.'
          : response.status >= 500 ? 'Máy chủ gặp lỗi. Vui lòng thử lại sau.' : 'Yêu cầu chưa thành công.';
        throw new ApiError(response.status, message || fallback);
      }
      if (response.status === 204) return undefined as T;
      const raw = await response.text();
      if (!raw) return undefined as T;
      try { return JSON.parse(raw) as T; } catch { return raw as T; }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (registrationRequest) console.warn('[Teaching registration] failure', {
        path, responseStatus, errorName: error instanceof Error ? error.name : typeof error,
        errorMessage: error instanceof Error ? error.message : undefined,
      });
      if (responseStatus !== null) throw new ApiError(responseStatus, 'Không thể đọc phản hồi từ máy chủ.');
      if (controller.signal.aborted) throw new ApiError(0, 'Kết nối quá lâu. Vui lòng thử lại.');
      const transportFailure = error instanceof Error && (error.name === 'FetchError' ||
        /^(Network request failed|Failed to fetch|Load failed)$/i.test(error.message));
      throw new ApiError(transportFailure ? 0 : -1, transportFailure
        ? 'Không thể kết nối máy chủ.' : 'Không thể chuẩn bị yêu cầu. Vui lòng thử lại.');
    } finally {
      clearTimeout(timer);
    }
  }

  request<T>(path: string, options?: RequestOptions) { return this.send<T>(path, options); }

  async refresh(): Promise<MobileSession> {
    if (!this.refreshPromise) {
      this.refreshPromise = (async () => {
        const refreshToken = await secureSession.readRefresh();
        if (!refreshToken) throw new ApiError(401, 'Phiên đăng nhập đã hết hạn.');
        const session = await this.send<MobileSession>('/api/auth/mobile/refresh', {
          method: 'POST', body: JSON.stringify({ refreshToken }), skipRefresh: true, anonymous: true,
        });
        await this.setSession(session);
        return session;
      })().catch(async error => {
        if (error instanceof ApiError && error.status === 401) {
          await this.clearSession();
          this.onSessionLost?.();
        }
        throw error;
      }).finally(() => { this.refreshPromise = null; });
    }
    return this.refreshPromise;
  }
}

export const api = new ApiClient();
