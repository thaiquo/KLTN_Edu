import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { FormField } from '../components/FormField';
import { useAuth } from '../hooks/useAuth';

export function VerifyEmailPage() {
  const { verifyEmail } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: location.state?.email || '',
    otp: ''
  });
  const [role] = useState(location.state?.role || 'STUDENT');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function change(event) {
    const value = event.target.name === 'otp'
      ? event.target.value.replace(/\D/g, '').slice(0, 6)
      : event.target.value;

    setForm((current) => ({ ...current, [event.target.name]: value }));
    if (error) setError('');
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError('');

    try {
      await verifyEmail({
        email: form.email.trim().toLowerCase(),
        otp: form.otp
      });

      if (role === 'TUTOR') {
        navigate('/tutor-next-step', {
          replace: true,
          state: { email: form.email.trim().toLowerCase() }
        });
        return;
      }

      navigate('/login', {
        replace: true,
        state: { email: form.email.trim().toLowerCase() }
      });
    } catch (verifyError) {
      setError(verifyError.message || 'Xac minh OTP khong thanh cong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title="Xac minh OTP"
      description="Nhap ma OTP 6 so duoc gui den email cua ban."
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
          label="Ma OTP"
          name="otp"
          value={form.otp}
          onChange={change}
          placeholder="483921"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength="6"
          required
        />

        {error && <div className="error" role="alert">{error}</div>}
        <button className="primary" disabled={busy}>
          {busy ? 'Dang xac minh...' : 'Xac minh email'}
        </button>
      </form>

      <p className="switch">
        Can dang ky lai? <Link to="/register">Quay ve dang ky</Link>
      </p>
    </AuthLayout>
  );
}
