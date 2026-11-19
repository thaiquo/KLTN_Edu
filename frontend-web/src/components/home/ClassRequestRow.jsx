import { Link } from 'react-router-dom';
import { ArrowUpRight, BookOpen, CalendarDays, MapPin, Monitor, Users } from 'lucide-react';

export function ClassRequestRow({ item }) {
  const subjectName = item.registration?.subjectName || 'Lớp học';
  const schedule = summarizeSchedule(item.schedules);
  const modeLabel = item.learningMode === 'ONLINE' ? 'Online' : item.learningMode === 'OFFLINE' ? 'Trực tiếp' : 'Linh hoạt';

  return (
    <article className="flex items-center justify-between gap-7 rounded-[22px] border border-slate-200 bg-white px-6 py-6 shadow-[0_12px_28px_rgba(15,23,42,.03)] transition-[transform,border-color] duration-200 hover:translate-x-1.5 hover:border-blue-200 max-[760px]:flex-col max-[760px]:items-start max-[760px]:gap-5">
      <div className="flex min-w-0 items-start gap-4">
        <span className="grid h-12 w-12 flex-none place-items-center rounded-2xl bg-blue-50 text-primary"><BookOpen size={24} /></span>
        <div className="min-w-0">
          <span className="block text-[10px] font-extrabold uppercase tracking-[.12em] text-primary">{subjectName}{item.level?.name ? ` · ${item.level.name}` : ''}</span>
          <h3 className="mt-1 overflow-hidden text-ellipsis whitespace-nowrap font-display text-[16px] font-extrabold text-slate-900 max-[760px]:whitespace-normal">{item.name}</h3>
          <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-slate-500">{item.description || `Lớp do ${item.tutorFullName || 'gia sư EduConnect'} phụ trách.`}</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[11px] font-bold text-slate-500">
            <span className="inline-flex items-center gap-1.5"><Monitor size={13} /> {modeLabel}</span>
            {schedule && <span className="inline-flex items-center gap-1.5"><CalendarDays size={13} /> {schedule}</span>}
            <span className="inline-flex items-center gap-1.5"><Users size={13} /> {formatSlots(item.availableSlots)}</span>
            {item.learningMode === 'OFFLINE' && item.address && <span className="inline-flex items-center gap-1.5"><MapPin size={13} /> {item.address}</span>}
          </div>
        </div>
      </div>

      <div className="flex flex-none items-center gap-4 max-[760px]:w-full max-[760px]:justify-between">
        <span><small className="block text-[10px] font-bold text-slate-400">Mỗi buổi</small><strong className="block font-display text-[17px] font-extrabold text-primary">{formatMoney(item.pricePerSession)}</strong></span>
        <Link to={`/classes?classId=${item.id}`} aria-label={`Xem lớp ${item.name}`} className="grid h-10 w-10 place-items-center rounded-[11px] bg-slate-900 text-white transition-colors hover:bg-primary"><ArrowUpRight size={17} /></Link>
      </div>
    </article>
  );
}

function summarizeSchedule(schedules = []) {
  if (!schedules.length) return '';
  const first = schedules[0];
  const day = dayLabel(first.dayOfWeek);
  const time = [first.startTime, first.endTime].filter(Boolean).join('–');
  const suffix = schedules.length > 1 ? ` +${schedules.length - 1} lịch` : '';
  return `${day}${time ? ` ${time}` : ''}${suffix}`;
}

function dayLabel(value) {
  const labels = { 2: 'T2', 3: 'T3', 4: 'T4', 5: 'T5', 6: 'T6', 7: 'T7', 8: 'CN' };
  return labels[value] || 'Theo lịch';
}

function formatSlots(value) {
  const slots = Number(value || 0);
  return slots > 0 ? `Còn ${slots} chỗ` : 'Đã đủ học viên';
}

function formatMoney(value) {
  if (!value) return 'Liên hệ';
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Number(value))}đ`;
}
