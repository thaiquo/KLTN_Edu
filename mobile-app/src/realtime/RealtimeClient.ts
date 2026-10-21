import { AppState, type AppStateStatus } from 'react-native';
import { websocketUrl } from '../config/runtime';

export type RealtimeChannel = 'learning' | 'notifications' | 'chat';
export type RealtimeEvent = { channel: RealtimeChannel; payload: unknown };

export class RealtimeClient {
  private sockets = new Map<RealtimeChannel, WebSocket>();
  private retries = new Map<RealtimeChannel, ReturnType<typeof setTimeout>>();
  private listeners = new Set<(event: RealtimeEvent) => void>();
  private recoveryListeners = new Set<() => void>();
  private token: string | null = null;
  private foreground = true;
  private generation = 0;
  private appSubscription = AppState.addEventListener('change', state => this.onAppState(state));

  setToken(token: string | null) {
    if (this.token === token) return;
    this.token = token;
    this.generation++;
    this.disconnect();
    if (token && this.foreground) this.connectAll();
  }

  subscribe(listener: (event: RealtimeEvent) => void) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  onRecovery(listener: () => void) {
    this.recoveryListeners.add(listener);
    return () => { this.recoveryListeners.delete(listener); };
  }

  private connectAll() {
    (['learning', 'notifications', 'chat'] as const).forEach(channel => this.connect(channel, 0));
  }

  private connect(channel: RealtimeChannel, attempt: number) {
    if (!this.token || !this.foreground) return;
    const generation = this.generation;
    // React Native supports headers in the native WebSocket constructor.
    const NativeWebSocket = WebSocket as unknown as new (
      url: string, protocols: string[], options: { headers: Record<string, string> }
    ) => WebSocket;
    const path = channel === 'learning' ? '/ws/learning/mobile' : `/ws/${channel}`;
    const socket = new NativeWebSocket(`${websocketUrl}${path}`, [], {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    this.sockets.set(channel, socket);
    socket.onopen = () => {
      if (generation !== this.generation) return;
      if (attempt > 0) this.recoveryListeners.forEach(listener => listener());
    };
    socket.onmessage = event => {
      if (generation !== this.generation) return;
      try {
        const payload = JSON.parse(String(event.data));
        this.listeners.forEach(listener => listener({ channel, payload }));
      } catch { /* Ignore unknown frames. */ }
    };
    socket.onclose = () => {
      if (generation !== this.generation || !this.token || !this.foreground) return;
      const delay = Math.min(30000, 1000 * 2 ** Math.min(attempt, 5));
      this.retries.set(channel, setTimeout(() => this.connect(channel, attempt + 1), delay));
    };
    socket.onerror = () => socket.close();
  }

  private onAppState(state: AppStateStatus) {
    const next = state === 'active';
    if (next === this.foreground) return;
    this.foreground = next;
    this.generation++;
    this.disconnect();
    if (next && this.token) {
      this.recoveryListeners.forEach(listener => listener());
      this.connectAll();
    }
  }

  disconnect() {
    this.retries.forEach(timer => clearTimeout(timer));
    this.retries.clear();
    this.sockets.forEach(socket => socket.close());
    this.sockets.clear();
  }

  dispose() {
    this.generation++;
    this.disconnect();
    this.appSubscription.remove();
    this.listeners.clear();
    this.recoveryListeners.clear();
  }
}
