import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { FormField } from '../components/FormField';
import { useAuth } from '../hooks/useAuth';

export function ResetPasswordPage() {
  const { resetPassword } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: location.state?.email || '',
    otp: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  function change(event) {
    const value = event.target.name === 'otp'
      ? event.target.value.replace(/\D/g, '').slice(0, 6)
      : event.target.value;

    setForm((current) => ({ ...current, [event.target.name]: value }));
    if (fieldErrors[event.target.name]) {
      setFieldErrors((current) => ({ ...current, [event.target.name]: '' }));
    }
    if (error) setError('');
    if (message) setMessage('');
  }

  function validate() {
    const errors = {};

    if (!form.email.trim()) {
      errors.email = 'Vui lòng nhập email.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errors.email = 'Email không hợp lệ.';
    }

    if (!form.otp.trim()) {
      errors.otp = 'Vui lòng nhập mã OTP.';
    } else if (!/^\d{6}$/.test(form.otp.trim())) {
      errors.otp = 'Mã OTP phải gồm đúng 6 chữ số.';
    }

    if (!form.newPassword) {
      errors.newPassword = 'Vui lòng nhập mật khẩu mới.';
    } else if (form.newPassword.length < 8) {
      errors.newPassword = 'Mật khẩu phải có ít nhất 8 ký tự.';
    }

    if (!form.confirmPassword) {
      errors.confirmPassword = 'Vui lòng xác nhận mật khẩu mới.';
    } else if (form.newPassword !== form.confirmPassword) {
      errors.confirmPassword = 'Mật khẩu xác nhận chưa khớp.';
    }

    return errors;
  }

  function applyApiErrors(resetError) {
    const errors = mapValidationErrors(resetError);

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError('Vui lòng kiểm tra lại thông tin đặt lại mật khẩu.');
      return;
    }

    if (resetError.status === 429) {
      setError(resetError.message || 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.');
      return;
    }

    setError(resetError.message || 'Không thể đặt lại mật khẩu. Vui lòng kiểm tra OTP và thử lại.');
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;

    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError('Vui lòng kiểm tra lại thông tin đặt lại mật khẩu.');
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');
    setFieldErrors({});

    try {
      const email = form.email.trim().toLowerCase();
      await resetPassword({
        email,
        otp: form.otp.trim(),
        newPassword: form.newPassword,
        confirmPassword: form.confirmPassword
      });

      setMessage('Mật khẩu đã được đặt lại thành công. Đang chuyển đến trang đăng nhập...');
      window.setTimeout(() => {
        navigate('/login', {
          replace: true,
          state: {
            email,
            message: 'Mật khẩu đã được đặt lại. Vui lòng đăng nhập.'
          }
        });
      }, 600);
    } catch (resetError) {
      applyApiErrors(resetError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title="Đặt lại mật khẩu"
      description="Nhập mã OTP từ email và tạo mật khẩu mới cho tài khoản."
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
          label="Mã OTP"
          name="otp"
          value={form.otp}
          onChange={change}
          placeholder="483921"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength="6"
          autoComplete="one-time-code"
          aria-label="Mã OTP gồm 6 chữ số"
          hint="Dùng mã đặt lại mật khẩu, không dùng mã xác minh email."
          error={fieldErrors.otp}
          required
        />

        <FormField
          label="Mật khẩu mới"
          type="password"
          name="newPassword"
          value={form.newPassword}
          onChange={change}
          placeholder="Tối thiểu 8 ký tự"
          autoComplete="new-password"
          minLength="8"
          maxLength="100"
          error={fieldErrors.newPassword}
          required
        />

        <FormField
          label="Xác nhận mật khẩu mới"
          type="password"
          name="confirmPassword"
          value={form.confirmPassword}
          onChange={change}
          placeholder="Nhập lại mật khẩu mới"
          autoComplete="new-password"
          minLength="8"
          maxLength="100"
          error={fieldErrors.confirmPassword}
          required
        />

        {message && <div className="success" role="status">{message}</div>}
        {error && <div className="error" role="alert">{error}</div>}
        <button className="primary" disabled={busy}>
          {busy ? 'Đang đặt lại...' : 'Đặt lại mật khẩu'}
        </button>
      </form>

      <p className="switch">
        Đã nhớ mật khẩu? <Link to="/login">Quay lại đăng nhập</Link>
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
