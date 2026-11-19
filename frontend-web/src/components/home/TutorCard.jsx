import { Link } from 'react-router-dom';
import { ArrowUpRight, MapPin, Star, Video } from 'lucide-react';

export function TutorCard({ tutor }) {
  const subjects = (tutor.subjects || []).slice(0, 3);
  const location = [tutor.location?.communeName, tutor.location?.provinceName].filter(Boolean).join(', ');
  const hasReviews = Number(tutor.reviewCount || 0) > 0;

  return (
    <article className="group h-full overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_16px_36px_rgba(15,23,42,.04)] transition-[transform,box-shadow] duration-200 hover:-translate-y-1.5 hover:shadow-[0_26px_50px_rgba(15,23,42,.11)]">
      <div className="relative m-3 grid aspect-[1.65] place-items-center overflow-hidden rounded-[20px] bg-gradient-to-br from-slate-900 via-slate-800 to-primary">
        {tutor.avatarUrl ? (
          <img src={tutor.avatarUrl} alt={`Ảnh đại diện ${tutor.fullName}`} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" decoding="async" />
        ) : (
          <span className="font-display text-4xl font-extrabold text-white">{getInitials(tutor.fullName)}</span>
        )}
        <span className={`absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-extrabold shadow-sm ${hasReviews ? 'bg-white/95 text-amber-700' : 'bg-slate-900/80 text-slate-200'}`}>
          <Star size={13} fill={hasReviews ? 'currentColor' : 'none'} />
          {hasReviews ? `${Number(tutor.averageRating || 0).toFixed(1)} · ${tutor.reviewCount} đánh giá` : 'Chưa có đánh giá'}
        </span>
      </div>

      <div className="px-6 pb-5 pt-1">
        <h3 className="font-display text-[19px] font-extrabold tracking-tight text-slate-900">{tutor.fullName}</h3>
        <div className="mt-2 flex min-h-10 flex-col gap-1 text-[12px] font-semibold text-slate-500">
          {location && <span className="flex items-center gap-1.5"><MapPin size={13} /> {location}</span>}
          <span className="flex items-center gap-1.5"><Video size={13} /> {formatTeachingModes(tutor.teachingModes)}</span>
        </div>

        <div className="mt-3.5 flex min-h-14 flex-wrap content-start gap-1.5">
          {subjects.length > 0 ? subjects.map((subject) => (
            <span key={subject.registrationId || subject.subjectId} className="rounded-lg bg-blue-50 px-2 py-1.5 text-[9px] font-extrabold uppercase tracking-[.02em] text-primary-dark">{subject.subjectName}</span>
          )) : <span className="text-xs font-bold text-slate-400">Chuyên môn đang cập nhật</span>}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <span className="text-primary"><small className="block text-[10px] font-bold text-slate-400">Học phí từ</small><strong className="font-display text-[17px] font-extrabold">{formatMoney(tutor.startingTuition)}</strong></span>
          <Link to={`/tutors/${tutor.tutorId}`} className="inline-flex items-center gap-1.5 rounded-[10px] bg-slate-900 px-3 py-2 text-[9px] font-extrabold text-white transition-colors hover:bg-primary">
            Xem hồ sơ <ArrowUpRight size={13} />
          </Link>
        </div>
      </div>
    </article>
  );
}

function getInitials(value) {
  return (value || 'Gia sư').trim().split(/\s+/).slice(-2).map((part) => part[0]).join('').toUpperCase();
}

function formatTeachingModes(modes = []) {
  const labels = [...modes].map((mode) => mode === 'ONLINE' ? 'Online' : mode === 'OFFLINE' ? 'Trực tiếp' : mode);
  return labels.length > 0 ? labels.join(' · ') : 'Hình thức linh hoạt';
}

function formatMoney(value) {
  if (!value) return 'Liên hệ';
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Number(value))}đ`;
}
