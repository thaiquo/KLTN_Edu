import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { FormField } from '../components/FormField';
import { useAuth } from '../hooks/useAuth';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '', confirm: '' });
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

    if (!/^0\d{9}$/.test(form.phone.trim())) {
      setError('S\u1ed1 \u0111i\u1ec7n tho\u1ea1i ph\u1ea3i g\u1ed3m 10 ch\u1eef s\u1ed1 v\u00e0 b\u1eaft \u0111\u1ea7u b\u1eb1ng s\u1ed1 0.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      await register({
        fullName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
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
        <FormField label={'S\u1ed1 \u0111i\u1ec7n tho\u1ea1i'} type={'tel'} name={'phone'} value={form.phone} onChange={change} placeholder={'0387705790'} autoComplete={'tel'} inputMode={'numeric'} pattern={'0[0-9]{9}'} maxLength={'10'} required />
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
