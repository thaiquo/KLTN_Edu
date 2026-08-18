import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  Camera,
  CheckCircle2,
  Edit3,
  KeyRound,
  Mail,
  MapPin,
  Phone,
  Save,
  ShieldCheck,
  Sparkles,
  Upload,
  UserRound,
  X
} from 'lucide-react';
import { userApi } from '../api/user';
import { referenceApi } from '../api/reference';
import { HomeHeader } from '../components/home/HomeHeader';
import { useAuth } from '../hooks/useAuth';
import {
  ProfileEditForm,
  mapValidationErrors,
  normalizeOptional,
  toFormState,
  validateProfileForm
} from '../components/profile/ProfileEditForm';
import { validateAvatarFile } from '../components/profile/AvatarUploader';

const ROLE_LABELS = {
  STUDENT: 'Học viên',
  TUTOR: 'Gia sư',
  STAFF: 'Nhân viên',
  ADMIN: 'Quản trị viên'
};

const STATUS_LABELS = {
  ACTIVE: 'Đang hoạt động',
  LOCKED: 'Đã khóa',
  DISABLED: 'Đã vô hiệu hóa',
  DELETED: 'Đã xóa'
};

const GENDER_OPTIONS = [
  { value: '', label: 'Chưa chọn' },
  { value: 'FEMALE', label: 'Nữ' },
  { value: 'MALE', label: 'Nam' },
  { value: 'OTHER', label: 'Khác' },
  { value: 'PREFER_NOT_TO_SAY', label: 'Không muốn chia sẻ' }
];

export function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(user);
  const [form, setForm] = useState(toFormState(user));
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [avatarError, setAvatarError] = useState('');
  const [provinces, setProvinces] = useState([]);
  const [communes, setCommunes] = useState([]);
  const [addressLoading, setAddressLoading] = useState(false);

  const roles = useMemo(
    () => (Array.isArray(profile?.roles) ? profile.roles : []),
    [profile?.roles]
  );
  const displayName = profile?.fullName || profile?.email || 'Người dùng Kết Nối Học';
  const primaryRole = roles.includes('STUDENT') ? 'Học viên' : roles.map(roleLabel).join(' · ') || 'Tài khoản';
  const avatarUrl = getAvatarUrl(profile);
  const initials = getInitials(displayName);
  const completion = getCompletion(profile);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      setLoading(true);
      setError('');

      try {
        const currentUser = await refreshUser();
        if (!active) return;

        if (!currentUser) {
          navigate('/login', { replace: true });
          return;
        }

        setProfile(currentUser);
        setForm(toFormState(currentUser));
      } catch (loadError) {
        if (active) {
          setError(loadError.message || 'Không thể tải hồ sơ tài khoản.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, [navigate, refreshUser]);

  useEffect(() => {
    let active = true;
    referenceApi.provinces()
      .then((response) => {
        if (active) setProvinces(Array.isArray(response) ? response : []);
      })
      .catch(() => {
        if (active) setProvinces([]);
      });
    return () => {
      active = false;
    };
  }, []);

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
      .then((response) => {
        if (active) setCommunes(Array.isArray(response) ? response : []);
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

  function change(event) {
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
    if (message) setMessage('');
  }

  function startEdit() {
    setForm(toFormState(profile));
    setFieldErrors({});
    setError('');
    setMessage('');
    setEditing(true);
  }

  function cancelEdit() {
    setForm(toFormState(profile));
    setFieldErrors({});
    setError('');
    setEditing(false);
  }

  async function submit(event) {
    event.preventDefault();
    if (saving) return;

    const errors = validateProfileForm(form);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError('Vui lòng kiểm tra lại thông tin hồ sơ.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');
    setFieldErrors({});

    try {
      const savedProfile = await userApi.updateMe({
        fullName: form.fullName.trim(),
        phone: normalizeOptional(form.phone),
        dateOfBirth: form.dateOfBirth || null,
        gender: normalizeOptional(form.gender),
        provinceCode: normalizeOptional(form.provinceCode),
        communeCode: normalizeOptional(form.communeCode),
        addressDetail: normalizeOptional(form.addressDetail),
        bio: normalizeOptional(form.bio)
      });

      const syncedProfile = await refreshUser();
      setProfile(syncedProfile || savedProfile);
      setForm(toFormState(syncedProfile || savedProfile));
      setEditing(false);
      setMessage('Hồ sơ cá nhân đã được cập nhật.');
    } catch (saveError) {
      if (saveError.status === 401) {
        await refreshUser().catch(() => null);
        navigate('/login', { replace: true });
        return;
      }

      applyApiErrors(saveError);
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar(file) {
    const avatarValidationError = validateAvatarFile(file);
    if (avatarValidationError) {
      setAvatarError(avatarValidationError);
      return;
    }

    setUploadingAvatar(true);
    setAvatarError('');
    setMessage('');
    setError('');

    try {
      const uploadedProfile = await userApi.uploadAvatar(file);
      const syncedProfile = await refreshUser();
      const nextProfile = syncedProfile || uploadedProfile;
      setProfile(nextProfile);
      setForm(toFormState(nextProfile));
      setMessage('Ảnh đại diện đã được cập nhật.');
    } catch (uploadError) {
      if (uploadError.status === 401) {
        await refreshUser().catch(() => null);
        navigate('/login', { replace: true });
        return;
      }

      setAvatarError(uploadError.message || 'Không thể cập nhật ảnh đại diện.');
    } finally {
      setUploadingAvatar(false);
    }
  }

  function applyApiErrors(saveError) {
    const errors = mapValidationErrors(saveError);

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError('Vui lòng kiểm tra lại thông tin hồ sơ.');
      return;
    }

    setError(saveError.message || 'Không thể cập nhật hồ sơ. Vui lòng thử lại.');
  }

  return (
    <div
      className="min-h-screen bg-slate-50 text-slate-900 font-sans"
      style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}
    >
      <HomeHeader />

      <main className="container-app pt-28 pb-16">
        {loading ? (
          <ProfileSkeleton />
        ) : (
          <>
            <section className="overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-[0_22px_60px_rgba(15,23,42,.07)]">
              <div className="h-32 bg-slate-900 sm:h-36" />
              <div className="px-6 pb-7 sm:px-8">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start">
                    <div className="-mt-16 shrink-0">
                      <AvatarBlock
                        avatarUrl={avatarUrl}
                        initials={initials}
                        name={displayName}
                        uploading={uploadingAvatar}
                        onUpload={uploadAvatar}
                      />
                    </div>
                    <div className="min-w-0 pt-1 sm:pt-6">
                      <div className="flex flex-wrap items-center gap-2">
                        <h1 className="max-w-full break-words font-display text-3xl font-extrabold leading-tight tracking-tight text-slate-950 sm:text-4xl">
                          {displayName}
                        </h1>
                        <span className="shrink-0 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-extrabold text-primary">
                          {primaryRole}
                        </span>
                      </div>
                      <p className="mt-2 flex min-w-0 items-center gap-2 text-sm font-bold text-slate-500">
                        <Mail size={16} className="shrink-0" />
                        <span className="min-w-0 break-all">{profile?.email || 'Chưa có email'}</span>
                      </p>
                      {avatarError && <p className="mt-2 text-sm font-bold text-red-600">{avatarError}</p>}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 sm:ml-4 sm:pt-5">
                    <AvatarUploadButton uploading={uploadingAvatar} onUpload={uploadAvatar} />
                    {!editing && (
                      <button
                        type="button"
                        onClick={startEdit}
                        className="inline-flex items-center gap-2 rounded-[8px] bg-slate-900 px-4 py-3 text-sm font-extrabold text-white hover:bg-[#ff695f] transition-colors"
                      >
                        <Edit3 size={16} />
                        Chỉnh sửa hồ sơ
                      </button>
                    )}
                  </div>
                </div>

                <p className="mt-6 max-w-3xl text-sm font-semibold leading-6 text-slate-500">
                  Đây là hồ sơ tài khoản cá nhân của bạn trên Kết Nối Học. Thông tin mục tiêu học tập,
                  ngân sách và lịch rảnh sẽ thuộc Hồ sơ học tập riêng.
                </p>
              </div>
            </section>

            {message && <div className="success mt-6" role="status">{message}</div>}
            {error && <div className="error mt-6" role="alert">{error}</div>}

            {editing ? (
              <ProfileEditForm
                form={form}
                fieldErrors={fieldErrors}
                saving={saving}
                provinces={provinces}
                communes={communes}
                addressLoading={addressLoading}
                onChange={change}
                onCancel={cancelEdit}
                onSubmit={submit}
              />
            ) : (
              <section className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
                <div className="grid gap-6">
                  <PersonalInfoSection profile={profile} />
                  <AddressSection profile={profile} />
                  <AboutSection profile={profile} />
                </div>

                <aside className="grid content-start gap-6">
                  <AccountInfoCard profile={profile} roles={roles} />
                  {!roles.includes('TUTOR') && <BecomeTutorCard />}
                  <CompletionCard completion={completion} />
                  <SecurityCard />
                </aside>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function AvatarBlock({ avatarUrl, initials, name, uploading, onUpload }) {
  const inputRef = useRef(null);

  return (
    <div className="relative h-28 w-28 shrink-0 rounded-[24px] border-4 border-white bg-slate-900 shadow-[0_18px_38px_rgba(15,23,42,.18)]">
      {avatarUrl ? (
        <img src={avatarUrl} alt={`Ảnh đại diện của ${name}`} className="h-full w-full rounded-[20px] object-cover" />
      ) : (
        <span className="grid h-full w-full place-items-center rounded-[20px] text-3xl font-extrabold text-white">
          {initials}
        </span>
      )}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="absolute -bottom-2 -right-2 grid h-10 w-10 place-items-center rounded-[14px] border-4 border-white bg-primary text-white transition-colors hover:bg-[#ff695f] disabled:opacity-60"
        aria-label="Đổi ảnh đại diện"
      >
        <Camera size={17} />
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) onUpload(file);
        }}
      />
    </div>
  );
}

function AvatarUploadButton({ uploading, onUpload }) {
  const inputRef = useRef(null);

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="inline-flex items-center gap-2 rounded-[8px] border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-slate-700 hover:border-primary/40 hover:text-primary transition-colors disabled:opacity-60"
      >
        <Upload size={16} />
        {uploading ? 'Đang tải ảnh...' : 'Đổi ảnh'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) onUpload(file);
        }}
      />
    </>
  );
}



function PersonalInfoSection({ profile }) {
  return (
    <section className="rounded-[8px] border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,.06)]">
      <SectionTitle eyebrow="Personal profile" title="Thông tin cá nhân" />
      <div className="mt-6 divide-y divide-slate-100">
        <ProfileRow icon={<UserRound size={18} />} label="Họ và tên" value={profile?.fullName} empty="Chưa cập nhật họ và tên" />
        <ProfileRow icon={<Phone size={18} />} label="Số điện thoại" value={profile?.phone} empty="Chưa cập nhật số điện thoại" />
        <ProfileRow icon={<CalendarDays size={18} />} label="Ngày sinh" value={formatDate(profile?.dateOfBirth)} empty="Chưa cập nhật ngày sinh" />
        <ProfileRow icon={<UserRound size={18} />} label="Giới tính" value={genderLabel(profile?.gender)} empty="Chưa cập nhật giới tính" />
      </div>
    </section>
  );
}

function AddressSection({ profile }) {
  const addressLines = [
    [profile?.commune || profile?.ward, profile?.province].filter(Boolean).join(', '),
    profile?.addressDetail
  ].filter(Boolean);

  return (
    <section className="rounded-[8px] border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,.06)]">
      <SectionTitle eyebrow="Address" title="Địa chỉ" />
      {addressLines.length > 0 ? (
        <div className="mt-5 flex items-start gap-3 rounded-[8px] border border-slate-200 bg-slate-50 p-5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-blue-50 text-primary">
            <MapPin size={20} />
          </span>
          <div className="grid gap-1">
            {addressLines.map((line) => (
              <p key={line} className="text-sm font-extrabold text-slate-800">{line}</p>
            ))}
          </div>
        </div>
      ) : (
        <EmptyPanel icon={<MapPin size={20} />} title="Chưa cập nhật địa chỉ" description="Thêm tỉnh/thành phố và xã/phường để hồ sơ cá nhân đầy đủ hơn." />
      )}
    </section>
  );
}

function AboutSection({ profile }) {
  return (
    <section className="rounded-[8px] border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,.06)]">
      <SectionTitle eyebrow="About me" title="Giới thiệu ngắn" />
      {profile?.bio ? (
        <p className="mt-5 rounded-[8px] border border-slate-200 bg-slate-50 p-5 text-sm font-semibold leading-7 text-slate-700">
          {profile.bio}
        </p>
      ) : (
        <EmptyPanel icon={<Sparkles size={20} />} title="Thêm một đoạn giới thiệu ngắn về bạn" description="Một vài dòng về bản thân giúp hồ sơ tài khoản trông thân thiện hơn." />
      )}
    </section>
  );
}

function AccountInfoCard({ profile, roles }) {
  return (
    <section className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,.06)]">
      <SectionTitle eyebrow="Account" title="Tài khoản" compact />
      <div className="mt-5 grid gap-4">
        <StatusLine
          icon={<CheckCircle2 size={18} />}
          label="Xác minh email"
          value={profile?.emailVerified ? 'Email đã xác minh' : 'Email chưa xác minh'}
          tone={profile?.emailVerified ? 'success' : 'warning'}
        />
        <StatusLine
          icon={<ShieldCheck size={18} />}
          label="Trạng thái"
          value={STATUS_LABELS[profile?.accountStatus] || profile?.accountStatus || 'Chưa rõ'}
          tone={profile?.accountStatus === 'ACTIVE' ? 'success' : 'warning'}
        />
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-400">Vai trò</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {roles.length > 0 ? roles.map((role) => (
              <RoleBadge key={role} role={role} />
            )) : (
              <span className="text-sm font-bold text-slate-500">Chưa có vai trò</span>
            )}
          </div>
        </div>
        <StatusLine
          icon={<CalendarDays size={18} />}
          label="Ngày tham gia"
          value={profile?.createdAt ? formatJoinedDate(profile.createdAt) : 'Chưa có dữ liệu'}
          tone="neutral"
        />
      </div>
    </section>
  );
}

function BecomeTutorCard() {
  return (
    <section className="rounded-[8px] border border-blue-100 bg-blue-50 p-5 shadow-[0_18px_45px_rgba(15,23,42,.06)]">
      <SectionTitle eyebrow="Tutor profile" title="Hoàn thiện hồ sơ gia sư" compact />
      <p className="mt-3 text-sm font-semibold leading-6 text-blue-900/75">
        Hoàn thiện thông tin, CCCD và minh chứng một lần để Admin xét duyệt hồ sơ. Sau đó bạn có thể đăng ký thêm nhiều môn mà không cần nộp lại CCCD.
      </p>
      <Link
        to="/tutor/teaching-registrations"
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-[8px] bg-[#147b77] px-4 py-3 text-sm font-extrabold text-white transition-colors hover:bg-slate-900"
      >
        <Sparkles size={16} />
        Hoàn thiện hồ sơ
      </Link>
    </section>
  );
}

function CompletionCard({ completion }) {
  return (
    <section className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,.06)]">
      <SectionTitle eyebrow="Profile strength" title={`Hoàn thiện ${completion.percent}%`} compact />
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-primary" style={{ width: `${completion.percent}%` }} />
      </div>
      <div className="mt-4 grid gap-2">
        {completion.items.map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-sm font-bold text-slate-600">
            <CheckCircle2 size={16} className={item.done ? 'text-primary' : 'text-slate-300'} />
            {item.label}
          </div>
        ))}
      </div>
    </section>
  );
}

function SecurityCard() {
  return (
    <section className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,.06)]">
      <SectionTitle eyebrow="Security" title="Bảo mật" compact />
      <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
        Mật khẩu và các thao tác bảo mật được tách khỏi thông tin cá nhân.
      </p>
      <Link
        to="/profile/password"
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-[8px] border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-slate-800 hover:border-primary/40 hover:text-primary transition-colors"
      >
        <KeyRound size={16} />
        Đổi mật khẩu
      </Link>
      <Link
        to="/"
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-[8px] bg-slate-900 px-4 py-3 text-sm font-extrabold text-white hover:bg-primary transition-colors"
      >
        <ArrowLeft size={16} />
        Về trang chủ
      </Link>
    </section>
  );
}

function EmptyPanel({ icon, title, description }) {
  return (
    <div className="mt-5 rounded-[8px] border border-dashed border-slate-300 bg-slate-50 p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-blue-50 text-primary">
          {icon}
        </span>
        <div>
          <h3 className="font-display text-lg font-extrabold text-slate-950">{title}</h3>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{description}</p>
        </div>
      </div>
    </div>
  );
}

function ProfileRow({ icon, label, value, empty }) {
  const hasValue = value && value !== '-';
  return (
    <div className="grid gap-3 py-4 sm:grid-cols-[220px_minmax(0,1fr)] sm:items-start">
      <div className="flex items-center gap-2 text-sm font-extrabold text-slate-500">
        <span className="text-primary">{icon}</span>
        {label}
      </div>
      <p className={`text-base font-extrabold ${hasValue ? 'text-slate-950' : 'text-slate-400'}`}>
        {hasValue ? value : empty}
      </p>
    </div>
  );
}

function StatusLine({ icon, label, value, tone }) {
  const toneClass = tone === 'success'
    ? 'bg-emerald-50 text-emerald-700'
    : tone === 'warning'
      ? 'bg-amber-50 text-amber-700'
      : 'bg-slate-100 text-slate-600';

  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-400">{label}</p>
        <p className="mt-1 text-sm font-extrabold text-slate-900">{value}</p>
      </div>
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-[12px] ${toneClass}`}>
        {icon}
      </span>
    </div>
  );
}

function SectionTitle({ eyebrow, title, compact = false }) {
  return (
    <div>
      <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#ff695f]">{eyebrow}</p>
      <h2 className={`mt-1 font-display font-extrabold tracking-tight text-slate-950 ${compact ? 'text-xl' : 'text-2xl'}`}>
        {title}
      </h2>
    </div>
  );
}

function RoleBadge({ role }) {
  return (
    <span className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-extrabold text-white">
      {roleLabel(role)}
    </span>
  );
}

function TextAreaField({ label, name, value, onChange, placeholder, maxLength, rows, error, hint }) {
  return (
    <label className="field">
      <span>{label}</span>
      <div>
        <textarea
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          maxLength={maxLength}
          rows={rows}
          className="min-h-[120px] resize-y"
        />
      </div>
      {hint && <small>{hint}</small>}
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}

function ProfileSkeleton() {
  return (
    <div className="grid gap-8">
      <div className="rounded-[8px] border border-slate-200 bg-white p-8 shadow-[0_22px_60px_rgba(15,23,42,.07)]">
        <div className="flex items-center gap-5">
          <span className="h-28 w-28 animate-pulse rounded-[24px] bg-slate-200" />
          <div className="grid flex-1 gap-3">
            <span className="h-8 w-64 animate-pulse rounded bg-slate-200" />
            <span className="h-4 w-80 animate-pulse rounded bg-slate-100" />
            <span className="h-4 w-52 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      </div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <span className="h-80 animate-pulse rounded-[8px] bg-white" />
        <span className="h-80 animate-pulse rounded-[8px] bg-white" />
      </div>
    </div>
  );
}

function formatDate(value) {
  if (!value) return '';

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(new Date(value));
}

function formatJoinedDate(value) {
  return new Intl.DateTimeFormat('vi-VN', {
    month: 'long',
    year: 'numeric'
  }).format(new Date(value));
}

function getInitials(value) {
  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'U';
}

function roleLabel(role) {
  return ROLE_LABELS[role] || role;
}

function genderLabel(value) {
  return GENDER_OPTIONS.find((option) => option.value === value)?.label || value;
}

function getAvatarUrl(profile) {
  return profile?.avatarUrl || profile?.avatar || profile?.publicAvatarUrl || '';
}

function getCompletion(profile) {
  const items = [
    { label: 'Họ và tên', done: Boolean(profile?.fullName) },
    { label: 'Email', done: Boolean(profile?.email) },
    { label: 'Số điện thoại', done: Boolean(profile?.phone) },
    { label: 'Ngày sinh', done: Boolean(profile?.dateOfBirth) },
    { label: 'Ảnh đại diện', done: Boolean(getAvatarUrl(profile)) },
    { label: 'Địa chỉ', done: Boolean(profile?.province && (profile?.commune || profile?.ward)) }
  ];
  const done = items.filter((item) => item.done).length;
  return {
    items,
    percent: Math.round((done / items.length) * 100)
  };
}

