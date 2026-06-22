import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { FormField } from '../components/FormField';
import { useAuth } from '../hooks/useAuth';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function change(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    if (error) setError('');
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    if (form.password !== form.confirm) {
      setError('Mật khẩu xác nhận chưa khớp.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      await register({
        fullName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password
      });
      navigate('/', { replace: true });
    } catch (registerError) {
      setError(registerError.message === 'Email is already registered'
        ? 'Email này đã được đăng ký.'
        : registerError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout title="Tạo tài khoản" description="Tài khoản mới sẽ có vai trò học viên.">
      <div className="student"><span aria-hidden="true">✓</span><span><b>Tài khoản Học viên</b><small>Tìm lớp và kết nối với gia sư.</small></span></div>
      <form onSubmit={submit}>
        <FormField label="Họ và tên" name="fullName" value={form.fullName} onChange={change} placeholder="Nguyễn Minh Anh" autoComplete="name" minLength="2" maxLength="80" required />
        <FormField label="Email" type="email" name="email" value={form.email} onChange={change} placeholder="ban@email.com" autoComplete="email" required />
        <FormField label="Mật khẩu" type="password" name="password" value={form.password} onChange={change} placeholder="Tối thiểu 8 ký tự" autoComplete="new-password" minLength="8" maxLength="128" required />
        <FormField label="Xác nhận mật khẩu" type="password" name="confirm" value={form.confirm} onChange={change} placeholder="Nhập lại mật khẩu" autoComplete="new-password" minLength="8" maxLength="128" required />
        {error && <div className="error" role="alert">{error}</div>}
        <button className="primary" disabled={busy}>{busy ? 'Đang tạo...' : 'Tạo tài khoản'}</button>
      </form>
      <p className="switch">Đã có tài khoản? <Link to="/login">Đăng nhập</Link></p>
    </AuthLayout>
  );
}
