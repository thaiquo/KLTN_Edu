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
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function change(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    if (error) setError('');
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError('');

    try {
      const currentUser = await login({
        email: form.email.trim().toLowerCase(),
        password: form.password
      });

      if (currentUser.roles?.includes('STAFF') || currentUser.roles?.includes('ADMIN')) {
        navigate('/staff/tutors', { replace: true });
        return;
      }

      navigate('/', { replace: true });
    } catch (loginError) {
      setError(loginError.message || 'Đăng nhập không thành công.');
    } finally {
      setBusy(false);
    }
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
          required
        />

        <FormField
          label="Mật khẩu"
          type="password"
          name="password"
          value={form.password}
          onChange={change}
          placeholder="Tối thiểu 8 ký tự"
          autoComplete="current-password"
          minLength="8"
          maxLength="128"
          required
        />

        {message && <div className="success" role="status">{message}</div>}
        {error && <div className="error" role="alert">{error}</div>}
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
