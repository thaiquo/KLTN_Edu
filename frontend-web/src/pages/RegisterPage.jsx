import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { FormField } from '../components/FormField';
import { useAuth } from '../hooks/useAuth';

const ROLE_OPTIONS = [
  { value: 'STUDENT', label: 'Học viên' },
  { value: 'TUTOR', label: 'Gia sư' }
];

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'STUDENT'
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function change(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    if (error) setError('');
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;

    if (form.password !== form.confirmPassword) {
      setError('Mật khẩu xác nhận chưa khớp !.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      const payload = {
        fullName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        confirmPassword: form.confirmPassword,
        role: form.role
      };

      await register(payload);

      navigate('/verify-email', {
        replace: true,
        state: {
          email: payload.email,
          role: payload.role
        }
      });
    } catch (registerError) {
      setError(registerError.message || 'Đăng ký không thành công.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title="Tạo tài khoản"
      description="Đăng ký tài khoản học viên và gia sư."
    >
      <form onSubmit={submit}>
        <FormField
          label="Họ và tên"
          name="fullName"
          value={form.fullName}
          onChange={change}
          placeholder="Nguyen Van A"
          autoComplete="name"
          maxLength="100"
          required
        />

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

        <label className="field">
          <span>Vai tro</span>
          <div>
            <select name="role" value={form.role} onChange={change} required>
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </label>

        <FormField
          label="Mật khẩu"
          type="password"
          name="password"
          value={form.password}
          onChange={change}
          placeholder="Tối thiểu 8 ký tự"
          autoComplete="new-password"
          minLength="8"
          maxLength="128"
          required
        />

        <FormField
          label="Xác nhận mật khẩu"
          type="password"
          name="confirmPassword"
          value={form.confirmPassword}
          onChange={change}
          placeholder="Nhập lại mật khẩu"
          autoComplete="new-password"
          minLength="8"
          maxLength="128"
          required
        />

        {error && <div className="error" role="alert">{error}</div>}
        <button className="primary" disabled={busy}>
          {busy ? 'Đang tạo...' : 'Tạo tài khoản'}
        </button>
      </form>

      <p className="switch">
        Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
      </p>
    </AuthLayout>
  );
}
