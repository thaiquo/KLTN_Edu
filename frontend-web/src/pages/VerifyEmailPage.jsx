import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { FormField } from '../components/FormField';
import { useAuth } from '../hooks/useAuth';

const RESEND_COOLDOWN_SECONDS = 60;

export function VerifyEmailPage() {
  const { verifyEmail, resendVerificationOtp } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: location.state?.email || '',
    otp: ''
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [message, setMessage] = useState(location.state?.email ? 'Mã xác minh đã được gửi đến email của bạn.' : '');
  const [busy, setBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(location.state?.email ? RESEND_COOLDOWN_SECONDS : 0);

  useEffect(() => {
    if (secondsLeft <= 0) return undefined;

    const timer = window.setTimeout(() => {
      setSecondsLeft((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [secondsLeft]);

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
      errors.email = 'Vui lòng nhập email cần xác minh.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errors.email = 'Email không hợp lệ.';
    }

    if (!form.otp.trim()) {
      errors.otp = 'Vui lòng nhập mã OTP.';
    } else if (!/^\d{6}$/.test(form.otp.trim())) {
      errors.otp = 'Mã OTP phải gồm đúng 6 chữ số.';
    }

    return errors;
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;

    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError('Vui lòng kiểm tra lại thông tin xác minh.');
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');
    setFieldErrors({});

    try {
      const email = form.email.trim().toLowerCase();

      await verifyEmail({
        email,
        otp: form.otp.trim()
      });

      const role = location.state?.role || 'STUDENT';
      setMessage('Xác minh email thành công. Đang chuyển tiếp...');
      window.setTimeout(() => {
        if (role === 'TUTOR') {
          navigate('/login', {
            replace: true,
            state: { email, message: 'Email đã được xác minh. Vui lòng hoàn tất hồ sơ gia sư.' }
          });
        } else {
          navigate('/login', {
            replace: true,
            state: {
              email,
              role: 'STUDENT',
              message: 'Email đã được xác minh. Vui lòng đăng nhập.'
            }
          });
        }
      }, 500);
    } catch (verifyError) {
      applyApiErrors(verifyError);
    } finally {
      setBusy(false);
    }
  }

  async function resendOtp() {
    if (resendBusy || secondsLeft > 0) return;

    const email = form.email.trim().toLowerCase();
    if (!email) {
      setFieldErrors({ email: 'Vui lòng nhập email trước khi gửi lại mã.' });
      setError('Vui lòng nhập email cần xác minh.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFieldErrors({ email: 'Email không hợp lệ.' });
      setError('Vui lòng kiểm tra lại email.');
      return;
    }

    setResendBusy(true);
    setError('');
    setMessage('');
    setFieldErrors({});

    try {
      await resendVerificationOtp({ email });
      setMessage('Nếu tài khoản đủ điều kiện, mã xác minh mới đã được gửi.');
      setSecondsLeft(RESEND_COOLDOWN_SECONDS);
      setForm((current) => ({ ...current, email }));
    } catch (resendError) {
      if (resendError.status === 429) {
        setSecondsLeft(RESEND_COOLDOWN_SECONDS);
        setError(resendError.message || 'Bạn vừa yêu cầu gửi mã. Vui lòng thử lại sau ít phút.');
      } else {
        setError(resendError.message || 'Không thể gửi lại mã xác minh. Vui lòng thử lại.');
      }
    } finally {
      setResendBusy(false);
    }
  }

  function applyApiErrors(verifyError) {
    const errors = mapValidationErrors(verifyError);

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError('Vui lòng kiểm tra lại thông tin xác minh.');
      return;
    }

    setError(verifyError.message || 'Xác minh OTP không thành công.');
  }

  return (
    <AuthLayout
      title="Xác minh email"
      description="Nhập mã OTP 6 chữ số đã được gửi đến email của bạn."
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
          hint="Mã gồm 6 chữ số và có thời hạn ngắn."
          error={fieldErrors.otp}
          required
        />

        {message && <div className="success" role="status">{message}</div>}
        {error && <div className="error" role="alert">{error}</div>}
        <button className="primary" disabled={busy}>
          {busy ? 'Đang xác minh...' : 'Xác minh email'}
        </button>
      </form>

      <div className="resend-row">
        <span>Chưa nhận được mã?</span>
        <button
          type="button"
          onClick={resendOtp}
          disabled={resendBusy || secondsLeft > 0}
        >
          {resendBusy
            ? 'Đang gửi...'
            : secondsLeft > 0
              ? `Gửi lại mã sau ${secondsLeft} giây`
              : 'Gửi lại mã'}
        </button>
      </div>

      <p className="switch">
        Cần đăng ký lại? <Link to="/register">Quay về đăng ký</Link>
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
