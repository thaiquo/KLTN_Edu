import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { FormField } from '../components/FormField';
import { useAuth } from '../hooks/useAuth';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
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
      await login({ email: form.email.trim().toLowerCase(), password: form.password });
      navigate('/', { replace: true });
    } catch (loginError) {
      setError(loginError.message === 'Email or password is incorrect'
        ? 'Email hoặc mật khẩu chưa đúng.'
        : loginError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout title="Đăng nhập" description="Tiếp tục hành trình học tập của bạn.">
      <form onSubmit={submit}>
        <FormField label="Email" type="email" name="email" value={form.email} onChange={change} placeholder="ban@email.com" autoComplete="email" required />
        <FormField label="Mật khẩu" type="password" name="password" value={form.password} onChange={change} placeholder="Tối thiểu 8 ký tự" autoComplete="current-password" minLength="8" maxLength="128" required />
        {error && <div className="error" role="alert">{error}</div>}
        <button className="primary" disabled={busy}>{busy ? 'Đang đăng nhập...' : 'Đăng nhập'}</button>
      </form>
      <p className="switch">Chưa có tài khoản? <Link to="/register">Đăng ký miễn phí</Link></p>
    </AuthLayout>
  );
}
