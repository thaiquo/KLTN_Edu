import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CalendarDays, Camera, Mail, MapPin, Phone, UserRound } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';

export function BasicInfoStep({ readOnly, onBack, onNext }) {
  const { user } = useAuth();
  const avatarUrl = user?.avatarUrl || user?.avatar || user?.publicAvatarUrl || '';
  const initials = getInitials(user?.fullName || user?.email || 'U');

  return (
    <section>
      <StepHeader
        icon={<UserRound size={22} />}
        eyebrow="Bước 1"
        title="Thông tin cá nhân"
        description="Thông tin nhận diện được lấy từ hồ sơ tài khoản hiện tại. Hồ sơ gia sư không lưu trùng họ tên, email hoặc số điện thoại."
      />

      <div className="mt-7 rounded-[8px] border border-slate-200 bg-slate-50 p-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-[20px] border-4 border-white bg-slate-900 font-display text-2xl font-extrabold text-white shadow-sm">
              {avatarUrl ? <img src={avatarUrl} alt={`Ảnh đại diện của ${user?.fullName || 'bạn'}`} className="h-full w-full object-cover" /> : initials}
            </div>
            <div>
              <h2 className="font-display text-2xl font-extrabold text-slate-950">
                {user?.fullName || 'Chưa cập nhật họ tên'}
              </h2>
              <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-500">
                Ảnh này sẽ xuất hiện trên hồ sơ gia sư sau khi hồ sơ được phê duyệt. Student bình thường có thể để trống, nhưng hồ sơ gia sư cần có ảnh đại diện trước khi gửi duyệt.
              </p>
            </div>
          </div>
          {!readOnly && (
            <Link
              to="/profile"
              className="inline-flex w-fit items-center justify-center gap-2 rounded-[8px] border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-slate-700 hover:border-primary/40 hover:text-primary"
            >
              <Camera size={16} />
              Thay đổi ảnh / hồ sơ
            </Link>
          )}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <InfoRow icon={<Mail size={17} />} label="Email" value={user?.email || 'Chưa có email'} />
          <InfoRow icon={<Phone size={17} />} label="Số điện thoại" value={user?.phone || 'Chưa cập nhật số điện thoại'} />
          <InfoRow icon={<CalendarDays size={17} />} label="Ngày sinh" value={formatDate(user?.dateOfBirth)} />
          <InfoRow icon={<MapPin size={17} />} label="Địa chỉ" value={formatAddress(user)} />
          <InfoRow icon={<UserRound size={17} />} label="Vai trò hiện tại" value={formatRoles(user?.roles)} />
        </div>
      </div>

      <StepActions onBack={onBack} onNext={onNext} backDisabled nextLabel="Tiếp tục" />
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

function InfoRow({ icon, label, value }) {
  return (
    <div className="rounded-[8px] border border-slate-200 bg-white p-4">
      <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.12em] text-slate-400">
        <span className="text-primary">{icon}</span>
        {label}
      </p>
      <p className="mt-2 break-words text-sm font-extrabold text-slate-950">{value}</p>
    </div>
  );
}

function StepActions({ onBack, onNext, backDisabled, nextLabel }) {
  return (
    <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
      <button type="button" onClick={onBack} disabled={backDisabled} className="inline-flex items-center justify-center gap-2 rounded-[8px] border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-slate-700 transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-45">
        <ArrowLeft size={16} />
        Quay lại
      </button>
      <button type="button" onClick={onNext} className="inline-flex items-center justify-center gap-2 rounded-[8px] bg-slate-900 px-5 py-3 text-sm font-extrabold text-white transition-colors hover:bg-[#147b77]">
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

function getInitials(value) {
  return value.split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]).join('').toUpperCase();
}
