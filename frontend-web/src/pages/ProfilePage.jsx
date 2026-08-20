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
  Send,
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

export function ProfilePage({ embedded = false, onTabChange = null }) {
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

  // Identity documents states for TUTOR role
  const [documents, setDocuments] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploadingDocType, setUploadingDocType] = useState(null); // 'IDENTITY_FRONT' | 'IDENTITY_BACK' | 'PASSPORT'
  const [identityMode, setIdentityMode] = useState('CCCD'); // 'CCCD' | 'PASSPORT'
  const [docError, setDocError] = useState('');
  const [tutorApp, setTutorApp] = useState(null);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [hasUnsubmittedChanges, setHasUnsubmittedChanges] = useState(false);

  const roles = useMemo(
    () => (Array.isArray(profile?.roles) ? profile.roles : []),
    [profile?.roles]
  );
  const displayName = profile?.fullName || profile?.email || 'Người dùng Kết Nối Học';
  const primaryRole = roles.includes('STUDENT') ? 'Học viên' : roles.map(roleLabel).join(' · ') || 'Tài khoản';
  const avatarUrl = getAvatarUrl(profile);
  const initials = getInitials(displayName);
  const completion = getCompletion(profile, roles.includes('TUTOR'), documents, tutorApp);

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

  // Load identity documents and tutor application for TUTORs
  useEffect(() => {
    if (!roles.includes('TUTOR')) return;
    let active = true;

    async function fetchDocs() {
      setLoadingDocs(true);
      try {
        const { tutorApplicationApi } = await import('../api/tutorApplications');
        const [docs, app] = await Promise.all([
          tutorApplicationApi.getMyApplicationDocuments().catch(() => []),
          tutorApplicationApi.getMyTutorApplication().catch(() => null)
        ]);
        if (active) {
          setDocuments(Array.isArray(docs) ? docs : []);
          if (app) setTutorApp(app);
          const hasPassport = docs.some(d => d.documentType === 'PASSPORT');
          if (hasPassport) setIdentityMode('PASSPORT');
        }
      } catch (err) {
        console.error('Failed to load identity documents', err);
      } finally {
        if (active) setLoadingDocs(false);
      }
    }

    fetchDocs();
    return () => {
      active = false;
    };
  }, [roles]);

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

  async function handleUploadIdentityDoc(documentType, file) {
    setUploadingDocType(documentType);
    setDocError('');
    setMessage('');
    setError('');
    try {
      const { tutorApplicationApi } = await import('../api/tutorApplications');
      const existing = documents.find(d => d.documentType === documentType);
      if (existing) {
        await tutorApplicationApi.deleteApplicationDocument(existing.id);
      }

      await tutorApplicationApi.uploadApplicationDocument({
        documentType,
        file
      });

      const freshDocs = await tutorApplicationApi.getMyApplicationDocuments();
      setDocuments(Array.isArray(freshDocs) ? freshDocs : []);
      const freshApp = await tutorApplicationApi.getMyTutorApplication().catch(() => null);
      if (freshApp) setTutorApp(freshApp);
      setHasUnsubmittedChanges(true);
      setMessage('Tải lên tài liệu xác minh danh tính thành công!');
    } catch (err) {
      console.error('Failed to upload identity document', err);
      setDocError(err.message || 'Không thể tải lên tài liệu xác minh.');
    } finally {
      setUploadingDocType(null);
    }
  }

  async function handleSubmitForReview() {
    setSubmittingReview(true);
    setError('');
    setMessage('');
    setDocError('');
    try {
      const { tutorApplicationApi } = await import('../api/tutorApplications');
      const updatedApp = await tutorApplicationApi.submitProfileForReview();
      setTutorApp(updatedApp);
      setHasUnsubmittedChanges(false);
      setMessage('Đã gửi hồ sơ và giấy tờ xác minh danh tính cho Ban quản trị phê duyệt thành công!');
    } catch (err) {
      setDocError(err.message || 'Không thể gửi duyệt hồ sơ. Vui lòng kiểm tra lại thông tin.');
    } finally {
      setSubmittingReview(false);
    }
  }

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
      setHasUnsubmittedChanges(true);
      
      // Reload tutor application status after profile update (may transition to PENDING)
      if (roles.includes('TUTOR')) {
        const { tutorApplicationApi } = await import('../api/tutorApplications');
        const app = await tutorApplicationApi.getMyTutorApplication().catch(() => null);
        if (app) setTutorApp(app);
      }

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
      className={embedded ? "" : "min-h-screen bg-slate-50 text-slate-900 font-sans"}
      style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}
    >
      {!embedded && <HomeHeader />}

      <main className={embedded ? "container-app pb-16" : "container-app pt-28 pb-16"}>
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
                  {roles.includes('TUTOR') && (
                    <TutorIdentityVerificationSection
                      documents={documents}
                      identityMode={identityMode}
                      setIdentityMode={setIdentityMode}
                      uploadingDocType={uploadingDocType}
                      onUpload={handleUploadIdentityDoc}
                      error={docError}
                      tutorApp={tutorApp}
                      submittingReview={submittingReview}
                      onSubmitForReview={handleSubmitForReview}
                      hasUnsubmittedChanges={hasUnsubmittedChanges}
                    />
                  )}
                </div>

                <aside className="grid content-start gap-6">
                  <AccountInfoCard profile={profile} roles={roles} />
                  {!embedded && (!roles.includes('TUTOR') ? (
                    <BecomeTutorCard />
                  ) : (
                    <TutorRegistrationCard tutorApp={tutorApp} />
                  ))}
                  <CompletionCard completion={completion} />
                  <SecurityCard embedded={embedded} onTabChange={onTabChange} />
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

function TutorIdentityVerificationSection({
  documents,
  identityMode,
  setIdentityMode,
  uploadingDocType,
  onUpload,
  error,
  tutorApp,
  submittingReview,
  onSubmitForReview,
  hasUnsubmittedChanges = false
}) {
  const types = identityMode === 'CCCD' ? ['IDENTITY_FRONT', 'IDENTITY_BACK'] : ['PASSPORT'];
  const labels = {
    IDENTITY_FRONT: 'CCCD / CMND mặt trước',
    IDENTITY_BACK: 'CCCD / CMND mặt sau',
    PASSPORT: 'Trang thông tin hộ chiếu'
  };

  const status = tutorApp?.status || 'DRAFT';

  return (
    <section className="rounded-[8px] border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,.06)] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionTitle eyebrow="Verification" title="Xác minh danh tính dùng chung" />
        {status === 'DRAFT' && (
          <span className="rounded-full bg-slate-100 px-3.5 py-1 text-xs font-black text-slate-700 border border-slate-300">
            📝 Chưa gửi duyệt (Bản nháp)
          </span>
        )}
        {status === 'APPROVED' && (
          <span className="rounded-full bg-emerald-50 px-3.5 py-1 text-xs font-black text-emerald-700 border border-emerald-200">
            ✓ Đã phê duyệt (Đủ điều kiện tạo lớp)
          </span>
        )}
        {status === 'PENDING' && (
          <span className="rounded-full bg-amber-50 px-3.5 py-1 text-xs font-black text-amber-700 border border-amber-200 animate-pulse">
            ⏳ Đang chờ Ban quản trị duyệt
          </span>
        )}
        {status === 'REJECTED' && (
          <span className="rounded-full bg-red-50 px-3.5 py-1 text-xs font-black text-red-700 border border-red-200">
            ✕ Bị từ chối phê duyệt
          </span>
        )}
      </div>

      <p className="text-sm font-semibold leading-6 text-slate-500">
        Yêu cầu tải lên CCCD/CMND hai mặt hoặc Hộ chiếu thông tin một lần. Bản ghi này sẽ được tái sử dụng để quản lý quyền dạy và đối soát hợp đồng.
      </p>

      {/* Review Status Guidance Banners */}
      {status === 'DRAFT' && (
        <div className="flex items-start gap-3 rounded-[8px] border border-blue-200 bg-blue-50/70 p-4 text-blue-900">
          <span className="text-lg">ℹ️</span>
          <div className="text-xs leading-5">
            <p className="font-extrabold text-sm text-blue-950">Hồ sơ danh tính đang ở dạng Bản nháp (Chưa gửi duyệt)</p>
            <p className="mt-1 font-semibold text-blue-800">
              Bạn cần tải lên đủ 2 mặt CCCD / CMND (hoặc Hộ chiếu) và bấm nút <strong>"Gửi duyệt hồ sơ cho Ban quản trị"</strong> bên dưới. Sau khi Ban quản trị phê duyệt, bạn mới có thể tạo lớp học mới và đăng ký dạy.
            </p>
          </div>
        </div>
      )}

      {status === 'PENDING' && (
        <div className="flex items-start gap-3 rounded-[8px] border border-amber-200 bg-amber-50/70 p-4 text-amber-900">
          <span className="text-lg">⏳</span>
          <div className="text-xs leading-5">
            <p className="font-extrabold text-sm text-amber-950">Hồ sơ đang chờ Ban quản trị (Admin/Staff) xét duyệt</p>
            <p className="mt-1 font-semibold text-amber-800">
              Trong thời gian chờ duyệt, bạn tạm thời chưa thể tạo lớp học mới hoặc đăng ký môn dạy mới. Các lớp học đã tạo trước đó vẫn hoạt động và giảng dạy bình thường.
            </p>
          </div>
        </div>
      )}

      {status === 'APPROVED' && (
        <div className="flex items-start gap-3 rounded-[8px] border border-emerald-200 bg-emerald-50/70 p-4 text-emerald-900">
          <span className="text-lg">✅</span>
          <div className="text-xs leading-5">
            <p className="font-extrabold text-sm text-emerald-950">Hồ sơ cá nhân và danh tính đã được phê duyệt</p>
            <p className="mt-1 font-semibold text-emerald-800">
              Bạn đã đủ điều kiện đăng ký môn dạy và tạo lớp học mới trên nền tảng. Khi bạn chỉnh sửa thông tin cá nhân hoặc tải ảnh CCCD mới, nút "Gửi duyệt lại" mới xuất hiện để gửi Ban quản trị duyệt lại.
            </p>
          </div>
        </div>
      )}

      {status === 'REJECTED' && (
        <div className="flex items-start gap-3 rounded-[8px] border border-red-200 bg-red-50/70 p-4 text-red-900">
          <span className="text-lg">❌</span>
          <div className="text-xs leading-5">
            <p className="font-extrabold text-sm text-red-950">Hồ sơ bị từ chối phê duyệt</p>
            <p className="mt-1 font-semibold text-red-800">
              {tutorApp.rejectionReason ? `Lý do: ${tutorApp.rejectionReason}` : 'Vui lòng cập nhật ảnh chụp CCCD/Hộ chiếu rõ nét hơn và bấm Gửi duyệt lại.'}
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-[8px] text-xs font-bold text-red-600">
          {error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setIdentityMode('CCCD')}
          className={`rounded-[8px] border p-4 text-left transition-all ${
            identityMode === 'CCCD'
              ? 'border-[#147b77] bg-emerald-50/50 shadow-2xs'
              : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
          }`}
        >
          <strong className="block text-sm text-slate-900 font-extrabold">CCCD / CMND</strong>
          <span className="mt-1 block text-xs font-semibold text-slate-500">Yêu cầu mặt trước và mặt sau.</span>
        </button>
        <button
          type="button"
          onClick={() => setIdentityMode('PASSPORT')}
          className={`rounded-[8px] border p-4 text-left transition-all ${
            identityMode === 'PASSPORT'
              ? 'border-[#147b77] bg-emerald-50/50 shadow-2xs'
              : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
          }`}
        >
          <strong className="block text-sm text-slate-900 font-extrabold">Hộ chiếu (Passport)</strong>
          <span className="mt-1 block text-xs font-semibold text-slate-500">Chỉ cần trang thông tin hộ chiếu.</span>
        </button>
      </div>

      <div className="grid gap-3 pt-2">
        {types.map((type) => {
          const saved = documents.find((item) => item.documentType === type);
          const uploading = uploadingDocType === type;
          return (
            <IdentityFileRow
              key={type}
              type={type}
              label={labels[type]}
              saved={saved}
              uploading={uploading}
              onStage={(file) => onUpload(type, file)}
            />
          );
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
        {status === 'APPROVED' && !hasUnsubmittedChanges ? (
          <div className="flex items-center gap-2 text-xs font-extrabold text-emerald-800 bg-emerald-50/80 px-4 py-2.5 rounded-xl border border-emerald-200 w-full sm:w-auto">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>Hồ sơ cá nhân & danh tính đã được phê duyệt hợp lệ. Nút "Gửi duyệt lại" chỉ xuất hiện khi bạn có thay đổi thông tin hoặc ảnh CCCD mới.</span>
          </div>
        ) : (
          <>
            <span className="text-xs font-bold text-slate-500">
              {status === 'PENDING'
                ? 'Hồ sơ đã gửi duyệt tới Ban quản trị'
                : status === 'APPROVED'
                  ? 'Bạn vừa có thay đổi thông tin/CCCD mới cần gửi duyệt lại'
                  : 'Điền đầy đủ thông tin cá nhân & tải ảnh để gửi duyệt'}
            </span>
            <button
              type="button"
              onClick={onSubmitForReview}
              disabled={submittingReview || status === 'PENDING'}
              className="inline-flex items-center gap-2 rounded-[8px] bg-[#147b77] px-5 py-2.5 text-xs font-black text-white hover:bg-slate-900 transition-all disabled:opacity-50"
            >
              <Send size={14} />
              <span>
                {submittingReview
                  ? 'Đang gửi duyệt...'
                  : status === 'PENDING'
                    ? 'Đang chờ Ban quản trị duyệt'
                    : status === 'APPROVED'
                      ? 'Gửi duyệt lại hồ sơ cho Ban quản trị'
                      : 'Gửi duyệt hồ sơ cho Ban quản trị'}
              </span>
            </button>
          </>
        )}
      </div>
    </section>
  );
}

function IdentityFileRow({ label, saved, uploading, onStage }) {
  const inputRef = useRef(null);
  return (
    <div className="flex flex-col gap-3 rounded-[8px] border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between transition-all hover:border-slate-300">
      <div className="space-y-1">
        <p className="text-sm font-extrabold text-slate-900">{label}</p>
        <p className={`text-xs font-bold ${saved ? 'text-emerald-700' : 'text-slate-500'}`}>
          {uploading ? 'Đang tải lên...' : saved ? `Đã xác minh · ${saved.originalFilename}` : 'Chưa tải lên minh chứng'}
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,application/pdf"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onStage(file);
          event.target.value = '';
        }}
      />
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-2 rounded-[8px] border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-700 hover:border-primary/40 hover:text-primary transition-all disabled:opacity-50"
      >
        <Upload size={14} />
        <span>{saved ? 'Thay file mới' : 'Chọn tệp & Tải lên'}</span>
      </button>
    </div>
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

function TutorRegistrationCard({ tutorApp }) {
  const isApproved = tutorApp?.status === 'APPROVED';

  if (!isApproved) {
    const statusText = !tutorApp || tutorApp.status === 'DRAFT'
      ? 'Chưa nộp gửi duyệt'
      : tutorApp.status === 'PENDING'
        ? 'Đang chờ Ban quản trị duyệt'
        : 'Bị từ chối';

    return (
      <section className="rounded-[8px] border border-amber-200 bg-amber-50 p-5 shadow-[0_18px_45px_rgba(15,23,42,.06)]">
        <SectionTitle eyebrow="Tutor profile" title="Đăng ký môn dạy" compact />
        <p className="mt-3 text-xs font-bold leading-5 text-amber-900">
          🔒 Chưa thể Đăng ký môn dạy
        </p>
        <p className="mt-1 text-xs font-semibold leading-5 text-amber-800">
          Hồ sơ cá nhân & CCCD của bạn đang ở trạng thái: <strong>{statusText}</strong>. Bạn cần được BQT phê duyệt hồ sơ cá nhân trước.
        </p>
        <button
          disabled
          type="button"
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-[8px] bg-slate-300 px-4 py-3 text-xs font-extrabold text-slate-600 cursor-not-allowed"
        >
          <Lock size={15} />
          Chờ BQT duyệt Hồ sơ cá nhân
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-[8px] border border-blue-100 bg-blue-50 p-5 shadow-[0_18px_45px_rgba(15,23,42,.06)]">
      <SectionTitle eyebrow="Tutor profile" title="Đăng ký môn dạy" compact />
      <p className="mt-3 text-sm font-semibold leading-6 text-blue-900/75">
        Đăng ký thêm môn học mới hoặc quản lý danh sách các môn dạy đang chờ phê duyệt của bạn.
      </p>
      <Link
        to="/tutor/teaching-registrations"
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-[8px] bg-[#147b77] px-4 py-3 text-sm font-extrabold text-white transition-colors hover:bg-slate-900"
      >
        <Sparkles size={16} />
        Đăng ký môn dạy
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

function SecurityCard({ embedded = false, onTabChange = null }) {
  return (
    <section className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,.06)]">
      <SectionTitle eyebrow="Security" title="Bảo mật" compact />
      <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
        Mật khẩu và các thao tác bảo mật được tách khỏi thông tin cá nhân.
      </p>
      {embedded && onTabChange ? (
        <button
          type="button"
          onClick={() => onTabChange("password")}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-[8px] border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-slate-800 hover:border-primary/40 hover:text-primary transition-colors w-full"
        >
          <KeyRound size={16} />
          Đổi mật khẩu
        </button>
      ) : (
        <Link
          to="/profile/password"
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-[8px] border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-slate-800 hover:border-primary/40 hover:text-primary transition-colors"
        >
          <KeyRound size={16} />
          Đổi mật khẩu
        </Link>
      )}
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

function getCompletion(profile, isTutor = false, documents = [], tutorApp = null) {
  const items = [
    { label: 'Họ và tên', done: Boolean(profile?.fullName) },
    { label: 'Email', done: Boolean(profile?.email) },
    { label: 'Số điện thoại', done: Boolean(profile?.phone) },
    { label: 'Ngày sinh', done: Boolean(profile?.dateOfBirth) },
    { label: 'Ảnh đại diện', done: Boolean(getAvatarUrl(profile)) },
    { label: 'Địa chỉ', done: Boolean(profile?.province && (profile?.commune || profile?.ward)) }
  ];

  if (isTutor) {
    const hasFront = documents.some((d) => d.documentType === 'IDENTITY_FRONT');
    const hasBack = documents.some((d) => d.documentType === 'IDENTITY_BACK');
    const hasPassport = documents.some((d) => d.documentType === 'PASSPORT');
    const hasIdentityDocs = hasPassport || (hasFront && hasBack);
    const isSubmitted = Boolean(tutorApp?.status && tutorApp.status !== 'DRAFT');
    const isApproved = tutorApp?.status === 'APPROVED';

    items.push({ label: 'Tải lên 2 mặt CCCD / Hộ chiếu', done: hasIdentityDocs });
    items.push({ label: 'Gửi nộp hồ sơ cá nhân', done: isSubmitted });
    items.push({ label: 'Ban quản trị phê duyệt hồ sơ', done: isApproved });
  }

  const done = items.filter((item) => item.done).length;
  return {
    items,
    percent: Math.round((done / items.length) * 100)
  };
}
