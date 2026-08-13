import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { FormField } from '../components/FormField';
import { useAuth } from '../hooks/useAuth';

const NEUTRAL_SUCCESS_MESSAGE = 'Mã đặt lại mật khẩu đã được gửi.';

export function ForgotPasswordPage() {
  const { forgotPassword } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  function change(event) {
    setEmail(event.target.value);
    if (fieldErrors.email) setFieldErrors({});
    if (error) setError('');
    if (message) setMessage('');
  }

  function validate() {
    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      return { email: 'Vui lòng nhập email.' };
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return { email: 'Email không hợp lệ.' };
    }

    return {};
  }

  function applyApiErrors(apiError) {
    const errors = mapValidationErrors(apiError);

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError('Vui lòng kiểm tra lại email.');
      return;
    }

    if (apiError.status === 429) {
      setMessage(NEUTRAL_SUCCESS_MESSAGE);
      return;
    }

    setError(apiError.message || 'Không thể gửi yêu cầu đặt lại mật khẩu. Vui lòng thử lại.');
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;

    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError('Vui lòng kiểm tra lại email.');
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');
    setFieldErrors({});

    try {
      const normalizedEmail = email.trim().toLowerCase();
      await forgotPassword({ email: normalizedEmail });
      setEmail(normalizedEmail);
      setMessage(NEUTRAL_SUCCESS_MESSAGE);
    } catch (forgotError) {
      applyApiErrors(forgotError);
    } finally {
      setBusy(false);
    }
  }

  function goResetPassword() {
    navigate('/reset-password', {
      state: { email: email.trim().toLowerCase() }
    });
  }

  return (
    <AuthLayout
      title="Quên mật khẩu"
      description="Nhập email tài khoản để nhận mã OTP đặt lại mật khẩu."
    >
      <form onSubmit={submit}>
        <FormField
          label="Email"
          type="email"
          name="email"
          value={email}
          onChange={change}
          placeholder="student@gmail.com"
          autoComplete="email"
          error={fieldErrors.email}
          required
        />

        {message && (
          <div className="success" role="status">
            <span>{message}</span>
            <button type="button" onClick={goResetPassword}>
              Nhập mã OTP
            </button>
          </div>
        )}
        {error && <div className="error" role="alert">{error}</div>}
        <button className="primary" disabled={busy}>
          {busy ? 'Đang gửi...' : 'Gửi mã đặt lại mật khẩu'}
        </button>
      </form>

      <p className="switch">
        Nhớ mật khẩu? <Link to="/login">Quay lại đăng nhập</Link>
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
