import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, KeyRound, Save, ShieldCheck } from 'lucide-react';
import { userApi } from '../api/user';
import { HomeHeader } from '../components/home/HomeHeader';
import { FormField } from '../components/FormField';
import { useAuth } from '../hooks/useAuth';

const INITIAL_FORM = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
};

export function ChangePasswordPage() {
  const { refreshUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(INITIAL_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  function change(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    if (fieldErrors[event.target.name]) {
      setFieldErrors((current) => ({ ...current, [event.target.name]: '' }));
    }
    if (error) setError('');
    if (message) setMessage('');
  }

  async function submit(event) {
    event.preventDefault();
    if (saving) return;

    const errors = validate(form);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError('Vui lòng kiểm tra lại thông tin đổi mật khẩu.');
      return;
    }

    setSaving(true);
    setFieldErrors({});
    setError('');
    setMessage('');

    try {
      await userApi.changePassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
        confirmPassword: form.confirmPassword
      });

      setForm(INITIAL_FORM);
      setMessage('Mật khẩu đã được cập nhật thành công.');
    } catch (changeError) {
      if (changeError.status === 401) {
        await refreshUser().catch(() => null);
        navigate('/login', { replace: true, state: { from: { pathname: '/profile/password' } } });
        return;
      }

      applyApiErrors(changeError);
    } finally {
      setSaving(false);
    }
  }

  function applyApiErrors(changeError) {
    const errors = mapValidationErrors(changeError);

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError('Vui lòng kiểm tra lại thông tin đổi mật khẩu.');
      return;
    }

    if (changeError.status === 403) {
      setError(changeError.message || 'Bạn không có quyền thực hiện thao tác này.');
      return;
    }

    setError(changeError.message || 'Không thể đổi mật khẩu. Vui lòng thử lại.');
  }

  return (
    <div
      className="min-h-screen bg-slate-50 text-slate-900 font-sans"
      style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}
    >
      <HomeHeader />

      <main className="container-app pt-28 pb-16">
        <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-[8px] border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,.06)]">
            <div className="flex flex-wrap items-start justify-between gap-5 border-b border-slate-200 pb-6">
              <div className="flex items-center gap-4">
                <span className="w-16 h-16 grid place-items-center rounded-[8px] bg-slate-900 text-white">
                  <KeyRound size={28} />
                </span>
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#ff695f]">
                    Bảo mật tài khoản
                  </p>
                  <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-950">
                    Đổi mật khẩu
                  </h1>
                  <p className="mt-1 max-w-2xl text-sm font-semibold text-slate-500">
                    Nhập mật khẩu hiện tại rồi tạo mật khẩu mới cho tài khoản đang đăng nhập.
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={submit} className="mt-6 grid gap-5">
              <FormField
                label="Mật khẩu hiện tại"
                type="password"
                name="currentPassword"
                value={form.currentPassword}
                onChange={change}
                placeholder="Nhập mật khẩu hiện tại"
                autoComplete="current-password"
                error={fieldErrors.currentPassword}
                required
              />

              <div className="grid gap-5 sm:grid-cols-2">
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
              </div>

              <div className="rounded-[8px] border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600">
                Mật khẩu chỉ được gửi trong request đổi mật khẩu, không lưu vào trình duyệt và không dùng OTP đặt lại mật khẩu.
              </div>

              {message && <div className="success" role="status">{message}</div>}
              {error && <div className="error" role="alert">{error}</div>}

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-[8px] bg-slate-900 px-4 py-3 text-sm font-extrabold text-white hover:bg-[#ff695f] transition-colors disabled:opacity-60"
                >
                  <Save size={16} />
                  {saving ? 'Đang lưu...' : 'Lưu mật khẩu mới'}
                </button>

                <Link
                  to="/profile"
                  className="inline-flex items-center justify-center gap-2 rounded-[8px] border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-slate-700 hover:border-primary/40 hover:text-primary transition-colors"
                >
                  <ArrowLeft size={16} />
                  Quay lại hồ sơ
                </Link>
              </div>
            </form>
          </div>

          <aside className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,.06)]">
            <h2 className="text-lg font-extrabold tracking-tight">Ghi chú bảo mật</h2>
            <div className="mt-4 rounded-[8px] border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start gap-3 text-sm font-semibold text-slate-600">
                <ShieldCheck size={18} className="mt-0.5 shrink-0 text-[#147b77]" />
                <p>
                  Sau khi đổi mật khẩu thành công, bạn vẫn tiếp tục đăng nhập trên phiên hiện tại.
                  Hãy đăng xuất khỏi thiết bị công cộng sau khi sử dụng.
                </p>
              </div>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}

function validate(form) {
  const errors = {};

  if (!form.currentPassword) {
    errors.currentPassword = 'Vui lòng nhập mật khẩu hiện tại.';
  }

  if (!form.newPassword) {
    errors.newPassword = 'Vui lòng nhập mật khẩu mới.';
  } else if (form.newPassword.length < 8) {
    errors.newPassword = 'Mật khẩu mới phải có ít nhất 8 ký tự.';
  }

  if (!form.confirmPassword) {
    errors.confirmPassword = 'Vui lòng xác nhận mật khẩu mới.';
  } else if (form.newPassword !== form.confirmPassword) {
    errors.confirmPassword = 'Mật khẩu xác nhận chưa khớp.';
  }

  return errors;
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
