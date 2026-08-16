import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Camera,
  CheckCircle2,
  Edit3,
  Mail,
  MapPin,
  Phone,
  UserRound
} from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { userApi } from '../../../api/user';
import { referenceApi } from '../../../api/reference';
import {
  ProfileEditForm,
  mapValidationErrors,
  normalizeOptional,
  toFormState,
  validateProfileForm
} from '../../profile/ProfileEditForm';
import { AvatarUploader, validateAvatarFile } from '../../profile/AvatarUploader';

export function BasicInfoStep({ readOnly, onBack, onNext }) {
  const { user, refreshUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [form, setForm] = useState(() => toFormState(user));
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [avatarError, setAvatarError] = useState('');
  const [validationError, setValidationError] = useState('');
  const [provinces, setProvinces] = useState([]);
  const [communes, setCommunes] = useState([]);
  const [addressLoading, setAddressLoading] = useState(false);

  const avatarUrl = getAvatarUrl(user);
  const initials = getInitials(user?.fullName || user?.email || 'U');

  // Keep form in sync with current user when not editing
  useEffect(() => {
    if (!editing) {
      setForm(toFormState(user));
    }
  }, [user, editing]);

  // Load provinces on mount
  useEffect(() => {
    let active = true;
    referenceApi.provinces()
      .then((res) => {
        if (active) setProvinces(Array.isArray(res) ? res : []);
      })
      .catch(() => {
        if (active) setProvinces([]);
      });
    return () => {
      active = false;
    };
  }, []);

  // Load communes when provinceCode changes
  useEffect(() => {
    let active = true;
    if (!form.provinceCode) {
      setCommunes([]);
      return () => {
        active = false;
      };
    }

    setAddressLoading(true);
    referenceApi.communes(form.provinceCode)
      .then((res) => {
        if (active) setCommunes(Array.isArray(res) ? res : []);
      })
      .catch(() => {
        if (active) setCommunes([]);
      })
      .finally(() => {
        if (active) setAddressLoading(false);
      });

    return () => {
      active = false;
    };
  }, [form.provinceCode]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value,
      ...(name === 'provinceCode' ? { communeCode: '' } : {})
    }));
    if (fieldErrors[name]) {
      setFieldErrors((current) => ({ ...current, [name]: '' }));
    }
    if (error) setError('');
    if (successMessage) setSuccessMessage('');
  }

  function handleStartEdit() {
    setForm(toFormState(user));
    setFieldErrors({});
    setError('');
    setSuccessMessage('');
    setValidationError('');
    setEditing(true);
  }

  function handleCancelEdit() {
    setForm(toFormState(user));
    setFieldErrors({});
    setError('');
    setEditing(false);
  }

  async function handleAvatarUpload(file) {
    const avatarErr = validateAvatarFile(file);
    if (avatarErr) {
      setAvatarError(avatarErr);
      return;
    }

    setUploadingAvatar(true);
    setAvatarError('');
    setSuccessMessage('');
    setError('');

    try {
      await userApi.uploadAvatar(file);
      await refreshUser();
      setSuccessMessage('Ảnh đại diện đã được cập nhật.');
      setValidationError('');
    } catch (err) {
      setAvatarError(err.message || 'Không thể cập nhật ảnh đại diện.');
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleFormSubmit(event) {
    event.preventDefault();
    if (saving) return;

    const errors = validateProfileForm(form);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError('Vui lòng kiểm tra lại các thông tin đã nhập.');
      return;
    }

    setSaving(true);
    setError('');
    setFieldErrors({});

    try {
      await userApi.updateMe({
        fullName: form.fullName.trim(),
        phone: normalizeOptional(form.phone),
        dateOfBirth: form.dateOfBirth || null,
        gender: normalizeOptional(form.gender),
        provinceCode: normalizeOptional(form.provinceCode),
        communeCode: normalizeOptional(form.communeCode),
        addressDetail: normalizeOptional(form.addressDetail),
        bio: normalizeOptional(form.bio)
      });

      await refreshUser();
      setEditing(false);
      setSuccessMessage('Thông tin cá nhân đã được cập nhật thành công.');
      setValidationError('');
    } catch (saveError) {
      const mapped = mapValidationErrors(saveError);
      if (Object.keys(mapped).length > 0) {
        setFieldErrors(mapped);
        setError('Vui lòng kiểm tra lại thông tin hồ sơ.');
      } else {
        setError(saveError.message || 'Không thể cập nhật thông tin. Vui lòng thử lại.');
      }
    } finally {
      setSaving(false);
    }
  }

  function handleNextStep() {
    setValidationError('');

    // Check required fields for Tutor Application
    const missing = [];
    if (!user?.fullName || !user.fullName.trim()) {
      missing.push('Họ và tên');
    }
    if (!user?.phone || !user.phone.trim()) {
      missing.push('Số điện thoại');
    }
    if (!user?.dateOfBirth) {
      missing.push('Ngày sinh');
    }
    const hasAddress = Boolean(user?.province && (user?.commune || user?.ward));
    if (!hasAddress) {
      missing.push('Địa chỉ (Tỉnh/Thành & Phường/Xã)');
    }
    if (!avatarUrl) {
      missing.push('Ảnh đại diện');
    }

    if (missing.length > 0) {
      setValidationError(
        `Vui lòng cập nhật đầy đủ các thông tin cá nhân bắt buộc trước khi chuyển sang Bước 2: ${missing.join(', ')}.`
      );
      return;
    }

    onNext();
  }

  return (
    <section>
      <StepHeader
        icon={<UserRound size={22} />}
        eyebrow="Bước 1"
        title="Thông tin cá nhân"
        description="Thông tin nhận diện tài khoản cá nhân. Bạn có thể cập nhật trực tiếp tại đây mà không cần rời khỏi quy trình đăng ký gia sư."
      />

      {successMessage && (
        <div className="mt-5 flex items-center gap-2 rounded-[8px] border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
          <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
          {successMessage}
        </div>
      )}

      {validationError && (
        <div className="mt-5 rounded-[8px] border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-600" />
            <div>
              <p className="font-extrabold text-sm">{validationError}</p>
              {!editing && (
                <button
                  type="button"
                  onClick={handleStartEdit}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-[6px] bg-amber-700 px-3 py-1.5 text-xs font-extrabold text-white hover:bg-amber-800"
                >
                  <Edit3 size={14} />
                  Cập nhật ngay tại đây
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {editing ? (
        <div className="mt-7 space-y-6">
          <div className="rounded-[8px] border border-slate-200 bg-slate-50 p-5">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-500 mb-4">
              Ảnh đại diện tài khoản
            </h3>
            <AvatarUploader
              avatarUrl={avatarUrl}
              initials={initials}
              name={user?.fullName}
              uploading={uploadingAvatar}
              onUpload={handleAvatarUpload}
              error={avatarError}
            />
          </div>

          {error && <div className="error text-sm font-bold text-red-600">{error}</div>}

          <ProfileEditForm
            form={form}
            fieldErrors={fieldErrors}
            saving={saving}
            provinces={provinces}
            communes={communes}
            addressLoading={addressLoading}
            onChange={handleChange}
            onCancel={handleCancelEdit}
            onSubmit={handleFormSubmit}
            compact
            showBio
            submitLabel="Lưu thông tin"
            cancelLabel="Hủy chỉnh sửa"
            readOnlyEmail={user?.email || ''}
          />
        </div>
      ) : (
        <div className="mt-7 rounded-[8px] border border-slate-200 bg-slate-50 p-5">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-[20px] border-4 border-white bg-slate-900 font-display text-2xl font-extrabold text-white shadow-sm">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={`Ảnh đại diện của ${user?.fullName || 'bạn'}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initials
                )}
              </div>
              <div>
                <h2 className="font-display text-2xl font-extrabold text-slate-950">
                  {user?.fullName || 'Chưa cập nhật họ tên'}
                </h2>
                <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-500">
                  Ảnh đại diện này sẽ hiển thị trên hồ sơ gia sư sau khi được xét duyệt.
                </p>
              </div>
            </div>

            {!readOnly && (
              <button
                type="button"
                onClick={handleStartEdit}
                className="inline-flex w-fit items-center justify-center gap-2 rounded-[8px] border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-slate-700 transition-colors hover:border-primary/40 hover:text-primary shadow-sm"
              >
                <Edit3 size={16} />
                Chỉnh sửa thông tin
              </button>
            )}
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <InfoRow icon={<Mail size={17} />} label="Email" value={user?.email || 'Chưa có email'} />
            <InfoRow
              icon={<Phone size={17} />}
              label="Số điện thoại"
              value={user?.phone || 'Chưa cập nhật số điện thoại'}
              isMissing={!user?.phone}
            />
            <InfoRow
              icon={<CalendarDays size={17} />}
              label="Ngày sinh"
              value={formatDate(user?.dateOfBirth)}
              isMissing={!user?.dateOfBirth}
            />
            <InfoRow
              icon={<MapPin size={17} />}
              label="Địa chỉ"
              value={formatAddress(user)}
              isMissing={!user?.province || (!user?.commune && !user?.ward)}
            />
            {/* ⚠️ ABSOLUTELY DO NOT REMOVE OR CHANGE THIS FIELD / LOGIC */}
            <InfoRow icon={<UserRound size={17} />} label="Vai trò hiện tại" value={formatRoles(user?.roles)} />
          </div>
        </div>
      )}

      {!editing && (
        <StepActions onBack={onBack} onNext={handleNextStep} backDisabled nextLabel="Tiếp tục" />
      )}
    </section>
  );
}

function StepHeader({ icon, eyebrow, title, description }) {
  return (
    <div className="flex items-start gap-4">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[16px] bg-blue-50 text-primary">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#ff695f]">{eyebrow}</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-slate-950">{title}</h1>
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-slate-500">{description}</p>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value, isMissing = false }) {
  return (
    <div className={`rounded-[8px] border p-4 ${isMissing ? 'border-amber-200 bg-amber-50/50' : 'border-slate-200 bg-white'}`}>
      <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.12em] text-slate-400">
        <span className="text-primary">{icon}</span>
        {label}
      </p>
      <p className={`mt-2 break-words text-sm font-extrabold ${isMissing ? 'text-amber-800' : 'text-slate-950'}`}>
        {value}
      </p>
    </div>
  );
}

function StepActions({ onBack, onNext, backDisabled, nextLabel }) {
  return (
    <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
      <button
        type="button"
        onClick={onBack}
        disabled={backDisabled}
        className="inline-flex items-center justify-center gap-2 rounded-[8px] border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-slate-700 transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-45"
      >
        <ArrowLeft size={16} />
        Quay lại
      </button>
      <button
        type="button"
        onClick={onNext}
        className="inline-flex items-center justify-center gap-2 rounded-[8px] bg-slate-900 px-5 py-3 text-sm font-extrabold text-white transition-colors hover:bg-[#147b77]"
      >
        {nextLabel}
        <ArrowRight size={16} />
      </button>
    </div>
  );
}

function formatDate(value) {
  if (!value) return 'Chưa cập nhật ngày sinh';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('vi-VN').format(date);
}

function formatRoles(roles = []) {
  if (!Array.isArray(roles) || roles.length === 0) return 'Học viên';
  return roles.map((role) => (role === 'TUTOR' ? 'Gia sư' : role === 'STUDENT' ? 'Học viên' : role)).join(', ');
}

function formatAddress(user) {
  const administrativeLine = [user?.commune || user?.ward, user?.province].filter(Boolean).join(', ');
  return [user?.addressDetail, administrativeLine].filter(Boolean).join(' - ') || 'Chưa cập nhật địa chỉ';
}

function getAvatarUrl(user) {
  return user?.avatarUrl || user?.avatar || user?.publicAvatarUrl || '';
}

function getInitials(value) {
  return (value || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'U';
}
