import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { FormField } from '../components/FormField';
import { useAuth } from '../hooks/useAuth';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({
    email: location.state?.email || '',
    password: ''
  });
  const [message] = useState(location.state?.message || '');
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [showVerifyAction, setShowVerifyAction] = useState(false);
  const [busy, setBusy] = useState(false);

  function change(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
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

    setBusy(true);
    setError('');
    setShowVerifyAction(false);
    setFieldErrors({});

    try {
      const currentUser = await login({
        email: form.email.trim().toLowerCase(),
        password: form.password
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
      description="Nhập email và mật khẩu đã xác minh OTP để vào hệ thống."
    >
      <form onSubmit={submit}>
        <FormField
          label="Email"
          type="email"
          name="email"
          value={form.email}
          onChange={change}
          placeholder="student@gmail.com"
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

        <div className="auth-inline-actions">
          <Link to="/forgot-password">Quên mật khẩu?</Link>
        </div>

        {message && <div className="success" role="status">{message}</div>}
        {error && (
          <div className="error" role="alert">
            <span>{error}</span>
            {showVerifyAction && (
              <button type="button" onClick={goVerifyEmail}>
                Xác minh email
              </button>
            )}
          </div>
        )}
        <button className="primary" disabled={busy}>
          {busy ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>
      </form>

      <p className="switch">
        Chưa có tài khoản? <Link to="/register">Đăng ký miễn phí</Link>
      </p>
    </AuthLayout>
  );
}

function defaultRouteFor(user) {
  if (user?.roles?.includes('STAFF') || user?.roles?.includes('ADMIN')) {
    return '/staff/tutors';
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
