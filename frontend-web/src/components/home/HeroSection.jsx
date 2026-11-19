import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  ChevronRight,
  GraduationCap,
  Search,
  ShieldCheck,
  Sparkles,
  Star
} from 'lucide-react';

export function HeroSection({
  onOpenChat,
  user,
  subjects = [],
  tutorTotal = 0,
  featuredTutor,
  studentClasses = [],
  studentSchedule = { sessions: [] },
  loading = false
}) {
  const navigate = useNavigate();
  const [subjectId, setSubjectId] = useState('');
  const [levelId, setLevelId] = useState('');
  const isAuthenticated = Boolean(user);
  const firstName = getFirstName(user?.fullName || user?.email);
  const selectedSubject = subjects.find((subject) => String(subject.id) === String(subjectId));
  const levels = selectedSubject?.levels || [];

  function submitSearch(event) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (subjectId) params.set('subjectId', subjectId);
    if (levelId) params.set('levelId', levelId);
    navigate(`/tutors${params.toString() ? `?${params.toString()}` : ''}`);
  }

  return (
    <section
      id="find-tutor"
      className="relative overflow-hidden bg-bg pb-20 pt-[calc(80px+70px)] scroll-mt-[90px]"
      aria-labelledby="home-hero-title"
    >
      <div className="pointer-events-none absolute -right-32 top-24 h-96 w-96 rounded-full bg-blue-100/70 blur-3xl" />
      <div className="pointer-events-none absolute -left-40 bottom-0 h-80 w-80 rounded-full bg-emerald-100/50 blur-3xl" />
      <div className="relative mx-auto grid w-full max-w-[1228px] grid-cols-1 items-center gap-[clamp(42px,6vw,86px)] px-6 min-[921px]:grid-cols-[1.15fr_minmax(360px,0.85fr)]">
        <div className="relative z-10 min-w-0 reveal">
          <div className="inline-flex items-center gap-2.5 rounded-full border border-slate-200 bg-white/85 px-3.5 py-2 text-[12px] font-bold text-slate-800 shadow-sm">
            <span className="relative h-2 w-2 rounded-full bg-primary pulse-dot" aria-hidden="true" />
            {isAuthenticated
              ? 'Dữ liệu học tập của bạn được cập nhật trực tiếp'
              : tutorTotal > 0
                ? `${formatNumber(tutorTotal)} gia sư đang sẵn sàng kết nối`
                : loading
                  ? 'Đang cập nhật cộng đồng gia sư'
                  : 'Hồ sơ gia sư được xét duyệt trước khi hiển thị'}
          </div>

          <h1 id="home-hero-title" className="mt-7 max-w-[720px] break-words font-display text-[clamp(42px,5.7vw,78px)] font-extrabold leading-[1] tracking-[-0.04em] max-[560px]:text-[38px]">
            {isAuthenticated ? (
              <>Chào {firstName},<br />sẵn sàng cho <span className="text-primary">buổi học mới?</span></>
            ) : (
              <>Học đúng người,<br />tiến bộ <span className="text-primary">đúng hướng</span></>
            )}
          </h1>

          <p className="mt-7 max-w-[620px] text-[clamp(16px,1.5vw,19px)] leading-[1.7] text-slate-500">
            {isAuthenticated
              ? 'Theo dõi lớp, lịch học và tiếp tục khám phá những gia sư phù hợp từ dữ liệu đang có trên EduConnect.'
              : 'Tìm gia sư theo môn học và cấp độ thực tế. Hồ sơ, lớp học, lịch học và chi phí đều được trình bày rõ ràng trước khi bạn kết nối.'}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-5 max-[560px]:gap-4">
            <Link className="inline-flex min-h-[56px] items-center gap-2 rounded-2xl bg-primary px-7 font-extrabold text-white shadow-[0_14px_28px_rgba(37,99,235,.28)] transition-all hover:-translate-y-0.5 hover:bg-primary-dark" to="/tutors">
              Khám phá gia sư <ChevronRight size={19} />
            </Link>
            <Link className="inline-flex min-h-[44px] items-center border-b-2 border-slate-800 font-extrabold text-slate-800 transition-colors hover:border-primary hover:text-primary" to={isAuthenticated ? '/my-classes' : '/classes'}>
              {isAuthenticated ? 'Xem lớp học của tôi' : 'Xem lớp đang mở'}
            </Link>
          </div>

          <SearchForm
            subjects={subjects}
            levels={levels}
            subjectId={subjectId}
            levelId={levelId}
            loading={loading}
            onSubjectChange={(value) => {
              setSubjectId(value);
              setLevelId('');
            }}
            onLevelChange={setLevelId}
            onSubmit={submitSearch}
          />
        </div>

        {isAuthenticated ? (
          <StudentHeroPanel classes={studentClasses} schedule={studentSchedule} onOpenChat={onOpenChat} />
        ) : (
          <GuestHeroPanel tutor={featuredTutor} loading={loading} onOpenChat={onOpenChat} />
        )}
      </div>
    </section>
  );
}

function SearchForm({ subjects, levels, subjectId, levelId, loading, onSubjectChange, onLevelChange, onSubmit }) {
  return (
    <form id="find-tutor-search" className="relative mt-14 flex w-full max-w-[740px] items-center gap-2.5 rounded-[26px] border border-slate-200/90 bg-white/90 p-2.5 shadow-[0_24px_56px_-14px_rgba(15,23,42,.08)] max-[760px]:mt-10 max-[760px]:flex-col max-[760px]:rounded-[22px]" onSubmit={onSubmit} aria-label="Tìm gia sư theo danh mục">
      <label className="flex h-14 min-w-0 flex-[1.4] items-center gap-3 rounded-2xl bg-slate-50 px-4 text-primary max-[760px]:w-full">
        <Search size={20} aria-hidden="true" />
        <span className="sr-only">Môn học</span>
        <select value={subjectId} onChange={(event) => onSubjectChange(event.target.value)} className="min-w-0 w-full cursor-pointer appearance-none border-0 bg-transparent font-bold text-slate-900 outline-none" disabled={loading}>
          <option value="">{loading ? 'Đang tải môn học...' : 'Tất cả môn học'}</option>
          {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
        </select>
      </label>

      <label className="flex h-14 min-w-0 flex-1 items-center gap-3 rounded-2xl bg-slate-50 px-4 text-primary max-[760px]:w-full">
        <GraduationCap size={19} aria-hidden="true" />
        <span className="sr-only">Cấp độ</span>
        <select value={levelId} onChange={(event) => onLevelChange(event.target.value)} className="min-w-0 w-full cursor-pointer appearance-none border-0 bg-transparent font-bold text-slate-900 outline-none disabled:cursor-not-allowed disabled:text-slate-400" disabled={!subjectId || levels.length === 0}>
          <option value="">{subjectId ? 'Tất cả cấp độ' : 'Chọn môn trước'}</option>
          {levels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}
        </select>
      </label>

      <button className="min-h-14 rounded-2xl bg-slate-900 px-6 font-extrabold text-white transition-colors hover:bg-primary max-[760px]:w-full" type="submit">Tìm kiếm</button>
    </form>
  );
}

function StudentHeroPanel({ classes, schedule, onOpenChat }) {
  const nextSession = useMemo(() => findNextSession(schedule?.sessions), [schedule?.sessions]);
  const activeClassCount = classes.filter((item) => !['COMPLETED', 'CANCELLED', 'CLOSED'].includes(item.status)).length;

  return (
    <div className="relative min-w-0 reveal reveal-delay max-[920px]:mx-auto max-[920px]:mt-4 max-[920px]:w-full max-[920px]:max-w-[560px]" aria-label="Tổng quan học tập">
      <div className="relative mx-auto max-w-[500px] rounded-[36px] border border-white/85 bg-white/95 p-3.5 shadow-[0_44px_80px_-34px_rgba(15,23,42,.24)]">
        <div className="overflow-hidden rounded-[28px] bg-slate-900 p-6 text-white">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-blue-200">Tổng quan hôm nay</p><h2 className="mt-2 font-display text-2xl font-extrabold tracking-tight">Không gian học tập</h2></div>
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary"><BookOpen size={20} /></span>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/8 p-4"><strong className="font-display text-3xl font-extrabold">{activeClassCount}</strong><p className="mt-1 text-xs font-bold text-slate-300">Lớp đang theo học</p></div>
            <div className="rounded-2xl border border-white/10 bg-white/8 p-4"><strong className="font-display text-3xl font-extrabold">{schedule?.sessions?.length || 0}</strong><p className="mt-1 text-xs font-bold text-slate-300">Buổi học trong lịch</p></div>
          </div>

          <div className="mt-4 rounded-[22px] bg-white p-4 text-slate-900">
            <p className="text-[10px] font-extrabold uppercase tracking-[.12em] text-primary">Buổi học tiếp theo</p>
            {nextSession ? (
              <><h3 className="mt-2 font-display text-lg font-extrabold">{nextSession.className}</h3><p className="mt-1 flex items-center gap-2 text-xs font-bold text-slate-500"><CalendarDays size={14} /> {formatSessionTime(nextSession)}</p></>
            ) : <p className="mt-2 text-sm font-bold text-slate-500">Chưa có buổi học sắp tới.</p>}
            <Link to="/my-schedule" className="mt-4 inline-flex items-center gap-2 text-xs font-extrabold text-primary hover:text-primary-dark">Xem lịch học <ArrowRight size={14} /></Link>
          </div>

          <button className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-xs font-extrabold text-slate-200 hover:border-blue-300 hover:text-white" type="button" onClick={onOpenChat}><Sparkles size={15} /> Mở trợ lý EduConnect</button>
        </div>
      </div>
    </div>
  );
}

function GuestHeroPanel({ tutor, loading, onOpenChat }) {
  const tutorSubjects = tutor?.subjects?.slice(0, 2).map((item) => item.subjectName).filter(Boolean) || [];
  const location = [tutor?.location?.communeName, tutor?.location?.provinceName].filter(Boolean).join(', ');

  return (
    <div className="relative min-w-0 reveal reveal-delay max-[920px]:mx-auto max-[920px]:mt-4 max-[920px]:w-full max-[920px]:max-w-[560px]" aria-label="Hồ sơ gia sư nổi bật">
      <div className="relative mx-auto max-w-[500px] rounded-[46px] border border-white/85 bg-white/95 p-3.5 shadow-[0_56px_88px_-28px_rgba(15,23,42,.2)]">
        <div className="min-h-[490px] overflow-hidden rounded-[35px] bg-slate-900 px-7 pb-8 pt-7 text-white">
          <div className="flex items-center justify-between"><span className="text-[10px] font-extrabold uppercase tracking-[.16em] text-blue-200">Hồ sơ từ dữ liệu thực tế</span><span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-2 py-1.5 text-[9px] font-extrabold text-slate-300"><span className="h-1.5 w-1.5 rounded-full bg-success" /> ĐÃ XÉT DUYỆT</span></div>

          {tutor ? (
            <div className="mt-10">
              <div className="flex items-center gap-4"><Avatar tutor={tutor} /><div className="min-w-0"><p className="truncate font-display text-2xl font-extrabold">{tutor.fullName}</p><p className="mt-1 text-xs font-semibold text-slate-400">{location || 'Dạy học linh hoạt theo nhu cầu'}</p></div></div>
              <div className="mt-7 rounded-[22px] bg-primary p-5 shadow-[0_16px_26px_rgba(37,99,235,.25)]">
                <div className="flex items-center justify-between gap-3"><span className="text-xs font-extrabold text-blue-100">Chuyên môn nổi bật</span><span className="inline-flex items-center gap-1 text-xs font-extrabold"><Star size={14} fill="currentColor" className="text-amber-300" />{Number(tutor.averageRating || 0).toFixed(1)}</span></div>
                <div className="mt-4 flex flex-wrap gap-2">{(tutorSubjects.length ? tutorSubjects : ['Đang cập nhật môn dạy']).map((subject) => <span key={subject} className="rounded-lg bg-white/15 px-2.5 py-1.5 text-[10px] font-extrabold">{subject}</span>)}</div>
                <p className="mt-4 line-clamp-3 text-sm font-semibold leading-6 text-blue-50/90">{tutor.bio || 'Xem hồ sơ chi tiết để biết kinh nghiệm, mức học phí và lịch có thể nhận dạy.'}</p>
              </div>
              <Link to={`/tutors/${tutor.tutorId}`} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-extrabold text-slate-900 hover:bg-blue-50">Xem hồ sơ gia sư <ArrowRight size={15} /></Link>
            </div>
          ) : (
            <div className="mt-16 rounded-[22px] border border-white/10 bg-white/5 p-6"><Sparkles className="text-blue-300" size={28} /><h2 className="mt-4 font-display text-2xl font-extrabold">{loading ? 'Đang tải hồ sơ gia sư' : 'Khám phá theo nhu cầu của bạn'}</h2><p className="mt-3 text-sm font-semibold leading-6 text-slate-300">Dùng bộ lọc môn học, cấp độ, học phí và hình thức học để tìm lựa chọn phù hợp.</p></div>
          )}

          <button className="mt-6 inline-flex items-center gap-2 rounded-xl border border-slate-500/25 px-3 py-2.5 text-[11px] font-bold text-slate-300 transition-colors hover:border-blue-400/80 hover:bg-primary/20 hover:text-white" type="button" onClick={onOpenChat}>Hỏi trợ lý EduConnect</button>
        </div>

        <div className="absolute -bottom-4 -left-8 flex w-max items-center gap-3 rounded-[23px] border border-slate-200 bg-white px-4 py-3.5 shadow-[0_20px_52px_rgba(15,23,42,.15)] max-[560px]:left-4"><span className="grid h-10 w-10 place-items-center rounded-[13px] bg-success text-white"><ShieldCheck size={21} /></span><span className="grid gap-1"><strong className="text-[12px] font-extrabold text-slate-900">Kết nối minh bạch</strong><small className="text-[10px] text-slate-400">Hồ sơ và lớp học có nguồn rõ ràng</small></span></div>
      </div>
    </div>
  );
}

function Avatar({ tutor }) {
  if (tutor.avatarUrl) return <img src={tutor.avatarUrl} alt={`Ảnh đại diện ${tutor.fullName}`} className="h-16 w-16 rounded-2xl object-cover" />;
  return <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-blue-100 to-blue-300 font-display text-xl font-extrabold text-slate-900">{getInitials(tutor.fullName)}</span>;
}

function findNextSession(sessions = []) {
  const now = new Date();
  return sessions.map((session) => ({ session, date: parseSessionDate(session) })).filter((item) => item.date && item.date >= now && !['COMPLETED', 'CANCELLED'].includes(item.session.status)).sort((a, b) => a.date - b.date)[0]?.session || null;
}

function parseSessionDate(session) {
  if (!session?.sessionDate) return null;
  const value = new Date(`${session.sessionDate}T${session.startTime || '00:00'}:00`);
  return Number.isNaN(value.getTime()) ? null : value;
}

function formatSessionTime(session) {
  const date = parseSessionDate(session);
  if (!date) return 'Thời gian đang cập nhật';
  return new Intl.DateTimeFormat('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date);
}

function formatNumber(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value || 0));
}

function getInitials(value) {
  return (value || 'Gia sư').trim().split(/\s+/).slice(-2).map((part) => part[0]).join('').toUpperCase();
}

function getFirstName(value) {
  if (!value) return 'bạn';
  return value.trim().split(/\s+/).slice(-1)[0] || 'bạn';
}
