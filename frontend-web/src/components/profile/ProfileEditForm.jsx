import { FormField } from '../FormField';
import { Save, X } from 'lucide-react';

export const GENDER_OPTIONS = [
  { value: '', label: 'Chưa chọn' },
  { value: 'FEMALE', label: 'Nữ' },
  { value: 'MALE', label: 'Nam' },
  { value: 'OTHER', label: 'Khác' },
  { value: 'PREFER_NOT_TO_SAY', label: 'Không muốn chia sẻ' }
];

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function toDateInputValue(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

export function toFormState(profile) {
  return {
    fullName: profile?.fullName || '',
    phone: profile?.phone || '',
    dateOfBirth: toDateInputValue(profile?.dateOfBirth),
    gender: profile?.gender || '',
    provinceCode: profile?.provinceCode || '',
    province: profile?.province || '',
    communeCode: profile?.communeCode || '',
    commune: profile?.commune || '',
    district: profile?.district || '',
    ward: profile?.ward || '',
    addressDetail: profile?.addressDetail || '',
    bio: profile?.bio || ''
  };
}

export function validateProfileForm(form) {
  const errors = {};

  if (!form.fullName || !form.fullName.trim()) {
    errors.fullName = 'Vui lòng nhập họ và tên.';
  }

  const phone = form.phone ? form.phone.trim() : '';
  if (phone && !/^\+?[0-9]{8,15}$/.test(phone)) {
    errors.phone = 'Số điện thoại phải gồm 8-15 chữ số và có thể bắt đầu bằng +.';
  }

  if (form.dateOfBirth && form.dateOfBirth > todayIso()) {
    errors.dateOfBirth = 'Ngày sinh không được ở tương lai.';
  }

  if (form.bio && form.bio.trim().length > 300) {
    errors.bio = 'Giới thiệu ngắn không được vượt quá 300 ký tự.';
  }

  return errors;
}

export function normalizeOptional(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

export function mapValidationErrors(error) {
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

export function ProfileEditForm({
  form,
  fieldErrors = {},
  saving = false,
  provinces = [],
  communes = [],
  addressLoading = false,
  onChange,
  onCancel,
  onSubmit,
  compact = false,
  showBio = true,
  submitLabel = 'Lưu thay đổi',
  cancelLabel = 'Hủy',
  readOnlyEmail = ''
}) {
  return (
    <form onSubmit={onSubmit} className="grid gap-6">
      <div className="rounded-[8px] border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,.06)]">
        <SectionHeader eyebrow="Thông tin cá nhân" title="Cập nhật hồ sơ" compact={compact} />

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <FormField
            label="Họ và tên"
            name="fullName"
            value={form.fullName}
            onChange={onChange}
            placeholder="Nguyễn Văn A"
            autoComplete="name"
            maxLength="100"
            error={fieldErrors.fullName}
            required
          />

          {readOnlyEmail ? (
            <label className="field">
              <span>Email</span>
              <div>
                <input
                  type="email"
                  value={readOnlyEmail}
                  readOnly
                  disabled
                  className="cursor-not-allowed bg-slate-100 font-medium text-slate-500"
                />
              </div>
              <small className="text-slate-400">Email đã được xác minh, không thể thay đổi.</small>
            </label>
          ) : null}

          <FormField
            label="Số điện thoại"
            name="phone"
            value={form.phone}
            onChange={onChange}
            placeholder="0901234567"
            inputMode="tel"
            autoComplete="tel"
            maxLength="16"
            hint="Có thể để trống trên Profile, nhưng cần thiết cho Hồ sơ Gia sư (8-15 chữ số)."
            error={fieldErrors.phone}
          />

          <FormField
            label="Ngày sinh"
            type="date"
            name="dateOfBirth"
            value={form.dateOfBirth}
            onChange={onChange}
            max={todayIso()}
            error={fieldErrors.dateOfBirth}
          />

          <label className="field">
            <span>Giới tính</span>
            <div>
              <select name="gender" value={form.gender} onChange={onChange}>
                {GENDER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            {fieldErrors.gender && <small className="field-error">{fieldErrors.gender}</small>}
          </label>
        </div>

        <div className="mt-8">
          <SectionHeader eyebrow="Địa chỉ" title="Khu vực sinh sống" compact />
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <label className="field">
              <span>Tỉnh / Thành phố</span>
              <div>
                <select name="provinceCode" value={form.provinceCode} onChange={onChange}>
                  <option value="">Chọn tỉnh / thành phố</option>
                  {provinces.map((province) => (
                    <option key={province.code} value={province.code}>{province.name}</option>
                  ))}
                </select>
              </div>
              {fieldErrors.provinceCode && <small className="field-error">{fieldErrors.provinceCode}</small>}
            </label>

            <label className="field">
              <span>Xã / Phường / Đặc khu</span>
              <div>
                <select
                  name="communeCode"
                  value={form.communeCode}
                  onChange={onChange}
                  disabled={!form.provinceCode || addressLoading}
                >
                  <option value="">{form.provinceCode ? 'Chọn xã / phường' : 'Chọn tỉnh trước'}</option>
                  {communes.map((commune) => (
                    <option key={commune.code} value={commune.code}>{commune.name}</option>
                  ))}
                </select>
              </div>
              {fieldErrors.communeCode && <small className="field-error">{fieldErrors.communeCode}</small>}
            </label>

            <div className="sm:col-span-2">
              <FormField
                label="Địa chỉ chi tiết"
                name="addressDetail"
                value={form.addressDetail}
                onChange={onChange}
                placeholder="Tên đường, số nhà..."
                maxLength="255"
                error={fieldErrors.addressDetail}
              />
            </div>
          </div>
        </div>

        {showBio && (
          <div className="mt-8">
            <label className="field">
              <span>Giới thiệu ngắn</span>
              <div>
                <textarea
                  name="bio"
                  value={form.bio}
                  onChange={onChange}
                  placeholder="Viết một vài dòng ngắn về bản thân..."
                  maxLength={300}
                  rows={4}
                  className="min-h-[120px] resize-y"
                />
              </div>
              <small className="text-slate-400">{(form.bio || '').length}/300 ký tự</small>
              {fieldErrors.bio && <small className="field-error">{fieldErrors.bio}</small>}
            </label>
          </div>
        )}

        <div className="mt-8 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-end">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-[8px] border border-slate-200 bg-white px-5 py-3 text-sm font-extrabold text-slate-700 transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-60"
            >
              <X size={16} />
              {cancelLabel}
            </button>
          )}

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-[8px] bg-slate-900 px-6 py-3 text-sm font-extrabold text-white transition-colors hover:bg-primary disabled:opacity-60"
          >
            <Save size={16} />
            {saving ? 'Đang lưu...' : submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}

function SectionHeader({ eyebrow, title, compact = false }) {
  return (
    <div>
      <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#ff695f]">{eyebrow}</p>
      <h2 className={`mt-1 font-display font-extrabold tracking-tight text-slate-950 ${compact ? 'text-xl' : 'text-2xl'}`}>
        {title}
      </h2>
    </div>
  );
}
