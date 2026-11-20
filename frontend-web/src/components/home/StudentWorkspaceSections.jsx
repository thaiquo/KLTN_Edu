import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowRight, BookOpen, CalendarDays, CheckCircle2, Clock3, GraduationCap } from 'lucide-react';

export function StudentWorkspaceSections({
  classes = [],
  schedule = { recurringSchedules: [], sessions: [] },
  loading = false,
  hasError = false
}) {
  const nextSession = useMemo(() => findNextSession(schedule.sessions), [schedule.sessions]);
  const activeClasses = classes.filter((item) => !['COMPLETED', 'CANCELLED', 'CLOSED'].includes(item.status));
  const upcomingSessions = schedule.sessions.filter((item) => isFutureSession(item));

  return (
    <section id="my-learning" className="bg-white py-14 scroll-mt-[96px]" aria-labelledby="my-learning-title">
      <div className="container-app">
        <div className="flex items-end justify-between gap-6 max-[760px]:flex-col max-[760px]:items-start">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-[.22em] text-primary">Không gian của bạn</span>
            <h2 id="my-learning-title" className="mt-3 font-display text-[clamp(30px,4vw,48px)] font-extrabold leading-[1.05] tracking-tight text-slate-950">Học tập trong tầm nhìn</h2>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-500">Tổng hợp trực tiếp từ lớp đã tham gia và lịch học hiện tại của bạn.</p>
          </div>
          <Link to="/my-classes" className="inline-flex items-center gap-2 text-sm font-extrabold text-primary hover:text-primary-dark">Quản lý lớp học <ArrowRight size={16} /></Link>
        </div>

        {hasError && (
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900" role="status">
            <AlertCircle size={18} className="mt-0.5 shrink-0" /> Một phần dữ liệu lớp hoặc lịch học chưa tải được. Các dữ liệu đã nhận thành công vẫn được hiển thị bên dưới.
          </div>
        )}

        {loading ? <WorkspaceSkeleton /> : (
          <>
            <div className="mt-8 grid grid-cols-3 gap-4 max-[760px]:grid-cols-1">
              <SummaryCard icon={<BookOpen size={19} />} value={activeClasses.length} label="Lớp đang theo học" tone="blue" />
              <SummaryCard icon={<CalendarDays size={19} />} value={upcomingSessions.length} label="Buổi học sắp tới" tone="emerald" />
              <SummaryCard icon={<GraduationCap size={19} />} value={classes.length} label="Tổng lớp đã tham gia" tone="violet" />
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
              <NextSessionCard session={nextSession} />
              <MyClassesCard classes={activeClasses.length ? activeClasses : classes} />
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function SummaryCard({ icon, value, label, tone }) {
  const toneClass = {
    blue: 'bg-blue-50 text-primary',
    emerald: 'bg-emerald-50 text-emerald-700',
    violet: 'bg-violet-50 text-violet-700'
  }[tone];
  return (
    <article className="flex items-center gap-4 rounded-[20px] border border-slate-200 bg-white p-5 shadow-[0_14px_30px_rgba(15,23,42,.04)]">
      <span className={`grid h-11 w-11 place-items-center rounded-2xl ${toneClass}`}>{icon}</span>
      <div><strong className="block font-display text-3xl font-extrabold text-slate-950">{value}</strong><span className="text-xs font-bold text-slate-500">{label}</span></div>
    </article>
  );
}

function NextSessionCard({ session }) {
  return (
    <article className="rounded-[24px] bg-slate-900 p-6 text-white shadow-[0_20px_50px_rgba(15,23,42,.12)]">
      <div className="flex items-center justify-between gap-4"><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-blue-200">Buổi học tiếp theo</p><span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10"><Clock3 size={19} /></span></div>
      {session ? (
        <>
          <h3 className="mt-5 font-display text-2xl font-extrabold">{session.className}</h3>
          <p className="mt-2 text-sm font-semibold text-slate-300">{session.topic || `Buổi ${session.sequenceNumber || ''}`}</p>
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-sm font-extrabold">{formatSessionDate(session)}</p><p className="mt-1 text-xs font-semibold text-slate-400">Gia sư: {session.tutorFullName || 'Đang cập nhật'}</p></div>
          <Link to="/my-schedule" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-extrabold text-slate-900 hover:bg-blue-50">Xem lịch chi tiết <ArrowRight size={16} /></Link>
        </>
      ) : (
        <>
          <h3 className="mt-5 font-display text-2xl font-extrabold">Chưa có buổi học sắp tới</h3>
          <p className="mt-3 text-sm font-semibold leading-6 text-slate-300">Khi lịch học được tạo, buổi gần nhất sẽ tự động xuất hiện tại đây.</p>
          <Link to="/classes" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-extrabold text-slate-900 hover:bg-blue-50">Khám phá lớp học <ArrowRight size={16} /></Link>
        </>
      )}
    </article>
  );
}

function MyClassesCard({ classes }) {
  return (
    <article className="rounded-[24px] border border-slate-200 bg-slate-50 p-6">
      <div className="flex items-center justify-between gap-4"><div><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-primary">Lớp học của tôi</p><h3 className="mt-2 font-display text-2xl font-extrabold text-slate-950">Tiếp tục hành trình học</h3></div><BookOpen size={23} className="text-primary" /></div>
      {classes.length > 0 ? (
        <div className="mt-5 grid gap-3">
          {classes.slice(0, 3).map((item) => (
            <Link key={item.id} to={`/my-classes?classId=${item.id}`} className="group flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 transition-colors hover:border-blue-300">
              <div className="min-w-0"><p className="truncate font-display text-sm font-extrabold text-slate-950">{item.name}</p><p className="mt-1 truncate text-xs font-bold text-slate-500">{item.registration?.subjectName || 'Môn học'}{item.level?.name ? ` · ${item.level.name}` : ''}</p></div>
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1.5 text-[10px] font-extrabold text-emerald-700"><CheckCircle2 size={13} /> {statusLabel(item.status)}</span>
            </Link>
          ))}
          <Link to="/my-classes" className="mt-1 inline-flex items-center gap-2 justify-self-start text-sm font-extrabold text-primary hover:text-primary-dark">Xem toàn bộ lớp <ArrowRight size={15} /></Link>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white p-5"><p className="text-sm font-bold text-slate-700">Bạn chưa tham gia lớp học nào.</p><p className="mt-2 text-xs font-semibold leading-5 text-slate-500">Khám phá các lớp đã được duyệt hoặc tìm gia sư phù hợp để bắt đầu.</p><Link to="/classes" className="mt-4 inline-flex items-center gap-2 text-sm font-extrabold text-primary">Tìm lớp học <ArrowRight size={15} /></Link></div>
      )}
    </article>
  );
}

function WorkspaceSkeleton() {
  return <div className="mt-8 grid animate-pulse gap-5"><div className="grid grid-cols-3 gap-4 max-[760px]:grid-cols-1">{[0, 1, 2].map((item) => <div key={item} className="h-24 rounded-[20px] bg-slate-100" />)}</div><div className="grid gap-5 lg:grid-cols-2"><div className="h-72 rounded-[24px] bg-slate-200" /><div className="h-72 rounded-[24px] bg-slate-100" /></div></div>;
}

function findNextSession(sessions = []) {
  return sessions.map((session) => ({ session, date: parseSessionDate(session) })).filter((item) => item.date && item.date >= new Date() && !['COMPLETED', 'CANCELLED'].includes(item.session.status)).sort((a, b) => a.date - b.date)[0]?.session || null;
}

function isFutureSession(session) {
  const date = parseSessionDate(session);
  return Boolean(date && date >= new Date() && !['COMPLETED', 'CANCELLED'].includes(session.status));
}

function parseSessionDate(session) {
  if (!session?.sessionDate) return null;
  const value = new Date(`${session.sessionDate}T${session.startTime || '00:00'}:00`);
  return Number.isNaN(value.getTime()) ? null : value;
}

function formatSessionDate(session) {
  const date = parseSessionDate(session);
  if (!date) return 'Thời gian đang cập nhật';
  return new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}

function statusLabel(status) {
  const labels = { ACTIVE: 'Đang học', PUBLISHED: 'Sắp bắt đầu', COMPLETED: 'Hoàn thành', LOCKED: 'Đang khóa' };
  return labels[status] || 'Đã tham gia';
}
