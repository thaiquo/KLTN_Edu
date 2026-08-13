import { useState } from 'react';

export function FormField({ label, type = 'text', error, hint, ...props }) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';

  return (
    <label className="field">
      <span>{label}</span>
      <div>
        <input type={isPassword && showPassword ? 'text' : type} {...props} />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          >
            {showPassword ? 'Ẩn' : 'Hiện'}
          </button>
        )}
      </div>
      {hint && !error && <small className="field-hint">{hint}</small>}
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}
