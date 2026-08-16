import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { FormField } from '../components/FormField';
import { useAuth } from '../hooks/useAuth';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState('STUDENT');
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

    if (registerError.status === 0) {
      setError(registerError.message || 'Không thể kết nối máy chủ. Vui lòng thử lại.');
      return;
    }

    if (registerError.status === 400) {
      setError(registerError.message || 'Dữ liệu đăng ký không hợp lệ.');
      return;
    }

    if (registerError.status === 409) {
      const message = registerError.message || 'Yêu cầu đăng ký bị xung đột với dữ liệu hiện có.';
      setFieldErrors({ email: message });
      setError(message);
      return;
    }

    if (registerError.status === 429) {
      setError(registerError.message || 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.');
      return;
    }

    if (registerError.status >= 500) {
      setError(registerError.message || 'Máy chủ gặp lỗi. Vui lòng thử lại sau.');
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
        confirmPassword: form.confirmPassword,
        role: selectedRole
      };

      const response = await register(payload);
      const verificationEmail = response?.email || payload.email;

      navigate('/verify-email', {
        replace: true,
        state: { email: verificationEmail, role: selectedRole }
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
      description="Chọn vai trò và đăng ký để bắt đầu trải nghiệm hệ thống."
    >
      <div className="mb-6 flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
        <button
          type="button"
          onClick={() => { setSelectedRole('STUDENT'); setError(''); }}
          className={`flex-1 rounded-md py-2 text-sm font-semibold transition-all ${
            selectedRole === 'STUDENT'
              ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-indigo-400'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          Tôi là Học viên
        </button>
        <button
          type="button"
          onClick={() => { setSelectedRole('TUTOR'); setError(''); }}
          className={`flex-1 rounded-md py-2 text-sm font-semibold transition-all ${
            selectedRole === 'TUTOR'
              ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-indigo-400'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          Tôi là Gia sư
        </button>
      </div>

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
          placeholder="email@example.com"
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

        {error && <div className="error mb-4" role="alert">{error}</div>}
        <button className="primary" disabled={busy}>
          {busy ? 'Đang tạo...' : `Đăng ký (${selectedRole === 'STUDENT' ? 'Học viên' : 'Gia sư'})`}
        </button>
      </form>

      <p className="switch mt-4">
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
