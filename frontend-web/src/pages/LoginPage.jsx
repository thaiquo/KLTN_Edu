import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { FormField } from '../components/FormField';
import { TurnstileWidget } from '../components/TurnstileWidget';
import { useAuth } from '../hooks/useAuth';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({
    email: location.state?.email || '',
    password: '',
    tutorMode: location.state?.role === 'TUTOR' || false
  });
  const [message] = useState(location.state?.message || '');
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [showVerifyAction, setShowVerifyAction] = useState(false);
  const [busy, setBusy] = useState(false);
  const [challengeRequired, setChallengeRequired] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [challengeError, setChallengeError] = useState('');
  const [retryAfter, setRetryAfter] = useState(0);

  useEffect(() => {
    if (retryAfter <= 0) return undefined;
    const timer = window.setInterval(() => {
      setRetryAfter((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [retryAfter]);

  function change(event) {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [event.target.name]: value }));
    if (fieldErrors[event.target.name]) {
      setFieldErrors((current) => ({ ...current, [event.target.name]: '' }));
    }
    if (error) setError('');
    if (showVerifyAction) setShowVerifyAction(false);
  }

  function validate() {
    const errors = {};

    if (!form.email.trim()) {
      errors.email = 'Vui lòng nhập email.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errors.email = 'Email không hợp lệ.';
    }

    if (!form.password) {
      errors.password = 'Vui lòng nhập mật khẩu.';
    }

    return errors;
  }

  function applyApiErrors(loginError) {
    const errors = mapValidationErrors(loginError);

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError('Vui lòng kiểm tra lại thông tin đăng nhập.');
      return;
    }

    if (loginError.code === 'LOGIN_CHALLENGE_REQUIRED') {
      setChallengeRequired(true);
      setTurnstileToken('');
      setChallengeError('');
      setTurnstileResetKey((current) => current + 1);
      setError('Vui lòng xác minh để thử đăng nhập lại.');
      return;
    }

    if (loginError.status === 429) {
      setRetryAfter(Math.max(1, Number(loginError.retryAfter || 1)));
    }

    const message = loginError.message || 'Đăng nhập không thành công.';
    setError(message);
    setShowVerifyAction(loginError.status === 403 && message.toLowerCase().includes('verify'));
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;

    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError('Vui lòng kiểm tra lại thông tin đăng nhập.');
      return;
    }

    if (challengeRequired && !turnstileToken) {
      setError('Vui lòng hoàn tất bước xác minh trước khi đăng nhập.');
      return;
    }

    if (retryAfter > 0) return;

    setBusy(true);
    setError('');
    setShowVerifyAction(false);
    setFieldErrors({});

    try {
      const currentUser = await login({
        email: form.email.trim().toLowerCase(),
        password: form.password,
        tutorMode: Boolean(form.tutorMode),
        turnstileToken: challengeRequired ? turnstileToken : undefined
      });

      const from = location.state?.from?.pathname;
      if (from && from !== '/login') {
        navigate(from, { replace: true });
        return;
      }

      navigate(defaultRouteFor(currentUser), { replace: true });
    } catch (loginError) {
      applyApiErrors(loginError);
    } finally {
      setBusy(false);
    }
  }

  function goVerifyEmail() {
    navigate('/verify-email', {
      state: { email: form.email.trim().toLowerCase() }
    });
  }

  return (
    <AuthLayout
      title="Đăng nhập"
      description="Nhập tài khoản và mật khẩu để tiếp tục."
    >
      <form onSubmit={submit}>
        <FormField
          label="Email"
          type="email"
          name="email"
          value={form.email}
          onChange={change}
          placeholder="email@example.com"
          autoComplete="email"
          error={fieldErrors.email}
          required
        />

        <FormField
          label="Mật khẩu"
          type="password"
          name="password"
          value={form.password}
          onChange={change}
          placeholder="Nhập mật khẩu"
          autoComplete="current-password"
          minLength="8"
          maxLength="100"
          error={fieldErrors.password}
          required
        />

        <div className="mb-4 flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              name="tutorMode"
              checked={form.tutorMode}
              onChange={change}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span>Đăng nhập với vai trò Gia sư</span>
          </label>

          <Link to="/forgot-password" className="text-sm font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
            Quên mật khẩu?
          </Link>
        </div>

        {message && <div className="success mb-4" role="status">{message}</div>}
        {error && (
          <div className="error mb-4" role="alert">
            <span>{error}</span>
            {showVerifyAction && (
              <button type="button" onClick={goVerifyEmail} className="ml-2 underline">
                Xác minh email
              </button>
            )}
          </div>
        )}

        {challengeRequired && (
          <>
            <TurnstileWidget
              resetKey={turnstileResetKey}
              onToken={(token) => {
                setTurnstileToken(token);
                setChallengeError('');
                setError('');
              }}
              onExpired={() => {
                setTurnstileToken('');
                setChallengeError('Phiên xác minh đã hết hạn. Vui lòng xác minh lại.');
              }}
              onError={(widgetError) => {
                setTurnstileToken('');
                setChallengeError(widgetError);
              }}
            />
            {challengeError && (
              <div className="error mb-4" role="alert">
                {challengeError}{' '}
                <button type="button" onClick={() => {
                  setChallengeError('');
                  setTurnstileResetKey((current) => current + 1);
                }}>Thử tải lại</button>
              </div>
            )}
          </>
        )}

        <button className="primary" disabled={busy || retryAfter > 0 || (challengeRequired && !turnstileToken)}>
          {busy ? 'Đang đăng nhập...' : retryAfter > 0 ? `Thử lại sau ${retryAfter} giây` : 'Đăng nhập'}
        </button>
      </form>

      <p className="switch mt-4">
        Chưa có tài khoản? <Link to="/register">Đăng ký ngay</Link>
      </p>
    </AuthLayout>
  );
}

function defaultRouteFor(user) {
  if (user?.roles?.includes('STAFF') || user?.roles?.includes('ADMIN')) {
    return '/staff/tutors';
  }
  if (user?.activeRole === 'TUTOR') {
    return '/dashboard';
  }
  return '/';
}

function mapValidationErrors(error) {
  if (!Array.isArray(error?.validationErrors)) {
    return {};
  }

  return error.validationErrors.reduce((result, item) => {
    if (item?.field) {
      result[item.field] = item.message || 'Thông tin không hợp lệ.';
    }
    return result;
  }, {});
}
