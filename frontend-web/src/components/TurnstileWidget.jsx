import { useEffect, useRef, useState } from 'react';

const SCRIPT_ID = 'cloudflare-turnstile-script';
const TEST_SITE_KEY = '1x00000000000000000000AA';
let scriptPromise;

export function TurnstileWidget({ onToken, onExpired, onError, resetKey = 0 }) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const callbacksRef = useRef({ onToken, onExpired, onError });
  callbacksRef.current = { onToken, onExpired, onError };
  const [loading, setLoading] = useState(true);
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim()
    || (import.meta.env.DEV ? TEST_SITE_KEY : '');

  useEffect(() => {
    let active = true;
    setLoading(true);
    if (!siteKey) {
      setLoading(false);
      callbacksRef.current.onError?.('Turnstile chưa được cấu hình cho môi trường này.');
      return undefined;
    }

    loadTurnstile()
      .then(() => {
        if (!active || !containerRef.current || !window.turnstile) return;
        if (widgetIdRef.current != null) window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action: 'login',
          theme: 'auto',
          size: 'flexible',
          callback: (token) => callbacksRef.current.onToken?.(token),
          'expired-callback': () => callbacksRef.current.onExpired?.(),
          'timeout-callback': () => callbacksRef.current.onExpired?.(),
          'error-callback': () => {
            callbacksRef.current.onError?.('Không thể tải bước xác minh. Vui lòng thử lại.');
            return true;
          }
        });
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setLoading(false);
        callbacksRef.current.onError?.('Không thể tải bước xác minh. Vui lòng kiểm tra kết nối.');
      });

    return () => {
      active = false;
      if (widgetIdRef.current != null && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [resetKey, siteKey]);

  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/60">
      <p className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Vui lòng xác minh để thử đăng nhập lại.</p>
      {loading && <p className="text-xs font-medium text-slate-500" role="status">Đang tải bước xác minh…</p>}
      <div
        ref={containerRef}
        className="min-h-[65px] w-full"
        aria-label="Xác minh Cloudflare Turnstile"
        data-testid="turnstile-container"
      />
    </div>
  );
}

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  }).catch((error) => {
    document.getElementById(SCRIPT_ID)?.remove();
    scriptPromise = null;
    throw error;
  });
  return scriptPromise;
}
