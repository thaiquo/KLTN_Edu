import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { FormField } from '../components/FormField';
import { useAuth } from '../hooks/useAuth';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function change(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    if (fieldErrors[event.target.name]) {
      setFieldErrors((current) => ({ ...current, [event.target.name]: '' }));
    }
    if (error) setError('');
  }

  function validate() {
    const errors = {};

    if (!form.fullName.trim()) {
      errors.fullName = 'Vui lòng nhập họ và tên.';
    }

    if (!form.email.trim()) {
      errors.email = 'Vui lòng nhập email.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errors.email = 'Email không hợp lệ.';
    }

    if (!form.password) {
      errors.password = 'Vui lòng nhập mật khẩu.';
    } else if (form.password.length < 8) {
      errors.password = 'Mật khẩu phải có ít nhất 8 ký tự.';
    }

    if (!form.confirmPassword) {
      errors.confirmPassword = 'Vui lòng xác nhận mật khẩu.';
    } else if (form.password !== form.confirmPassword) {
      errors.confirmPassword = 'Mật khẩu xác nhận chưa khớp.';
    }

    return errors;
  }

  function applyApiErrors(registerError) {
    const errors = mapValidationErrors(registerError);

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError('Vui lòng kiểm tra lại thông tin đăng ký.');
      return;
    }

    if (registerError.status === 409) {
      const message = registerError.message || 'Email đã được sử dụng.';
      setFieldErrors({ email: message });
      setError(message);
      return;
    }

    if (registerError.status === 429) {
      setError(registerError.message || 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.');
      return;
    }

    setError(registerError.message || 'Đăng ký không thành công.');
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;

    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError('Vui lòng kiểm tra lại thông tin đăng ký.');
      return;
    }

    setBusy(true);
    setError('');
    setFieldErrors({});

    try {
      const payload = {
        fullName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        confirmPassword: form.confirmPassword
      };

      const response = await register(payload);
      const verificationEmail = response?.email || payload.email;

      navigate('/verify-email', {
        replace: true,
        state: { email: verificationEmail }
      });
    } catch (registerError) {
      applyApiErrors(registerError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title="Tạo tài khoản"
      description="Đăng ký tài khoản học tập và xác minh email để bắt đầu sử dụng EduConnect."
    >
      <form onSubmit={submit}>
        <FormField
          label="Họ và tên"
          name="fullName"
          value={form.fullName}
          onChange={change}
          placeholder="Nguyễn Văn A"
          autoComplete="name"
          maxLength="100"
          error={fieldErrors.fullName}
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
          error={fieldErrors.email}
          required
        />

        <FormField
          label="Mật khẩu"
          type="password"
          name="password"
          value={form.password}
          onChange={change}
          placeholder="Tối thiểu 8 ký tự"
          autoComplete="new-password"
          minLength="8"
          maxLength="100"
          error={fieldErrors.password}
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
          maxLength="100"
          error={fieldErrors.confirmPassword}
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
