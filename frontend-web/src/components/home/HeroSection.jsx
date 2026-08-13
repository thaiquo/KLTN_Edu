import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  GraduationCap,
  Search,
  ShieldCheck,
  Sparkles
} from 'lucide-react';

const DEFAULT_LEVEL = 'Cấp học';

export function HeroSection({ onOpenChat, user }) {
  const navigate = useNavigate();
  const [subject, setSubject] = useState('');
  const [level, setLevel] = useState(DEFAULT_LEVEL);
  const [searchMessage, setSearchMessage] = useState('');
  const isAuthenticated = Boolean(user);
  const firstName = getFirstName(user?.fullName || user?.email);

  function submitSearch(event) {
    event.preventDefault();
    if (!subject.trim() && level === DEFAULT_LEVEL) {
      setSearchMessage('Hãy chọn môn học hoặc cấp học để bắt đầu.');
      return;
    }

    const params = new URLSearchParams();
    if (subject.trim()) params.set('keyword', subject.trim());
    navigate(`/tutors${params.toString() ? `?${params.toString()}` : ''}`);
  }

  return (
    <section
      id="find-tutor"
      className="pt-[calc(80px+70px)] pb-20 bg-bg scroll-mt-[90px]"
      aria-labelledby="home-hero-title"
    >
      <div className="container-app grid grid-cols-[1.15fr_minmax(360px,0.85fr)] items-center gap-[clamp(42px,6vw,86px)] max-[920px]:grid-cols-1">
        <div className="relative z-10 reveal">
          <div className="inline-flex items-center gap-2.5 px-3.5 py-2 mb-7 border border-slate-200 rounded-full bg-white/85 shadow-sm text-[12px] font-bold text-slate-800">
            <span className="relative w-2 h-2 rounded-full bg-primary pulse-dot" aria-hidden="true" />
            {isAuthenticated
              ? 'Không gian học tập cá nhân của bạn'
              : 'Hơn 1.200 gia sư đã được xác minh trên nền tảng'}
          </div>

          <h1
            id="home-hero-title"
            className="font-display font-extrabold text-[clamp(42px,5.7vw,78px)] leading-[1] tracking-[-0.04em] max-w-[720px]"
          >
            {isAuthenticated ? (
              <>
                Chào {firstName},<br />
                hôm nay bạn muốn <span className="text-primary">học gì?</span>
              </>
            ) : (
              <>
                Tìm gia sư <br />
                <span className="text-primary">phù hợp</span> với bạn
              </>
            )}
          </h1>

          <p className="mt-7 max-w-[620px] text-slate-500 text-[clamp(16px,1.5vw,19px)] leading-[1.7]">
            {isAuthenticated
              ? 'Tìm gia sư nhanh, hoàn thiện hồ sơ học tập và chuẩn bị nhận gợi ý phù hợp hơn khi Learning Profile được kết nối.'
              : 'Nền tảng kết nối học viên với gia sư đã được xác minh hồ sơ. Hợp đồng điện tử rõ ràng, lịch học linh hoạt và thanh toán minh bạch.'}
          </p>

          <div className="flex flex-wrap items-center gap-5 mt-8">
            {isAuthenticated ? (
              <>
                <a
                  className="inline-flex items-center gap-2 min-h-[56px] px-7 rounded-2xl font-extrabold text-white bg-primary shadow-[0_14px_28px_rgba(37,99,235,.28)] hover:bg-primary-dark hover:-translate-y-0.5 transition-all"
                  href="#find-tutor-search"
                >
                  Tìm gia sư ngay <ChevronRight size={19} />
                </a>
                <a
                  className="inline-flex items-center min-h-[44px] border-b-2 border-slate-800 font-extrabold text-slate-800 hover:text-primary hover:border-primary transition-colors"
                  href="#learning-profile"
                >
                  Hoàn thiện hồ sơ học tập
                </a>
              </>
            ) : (
              <>
                <Link
                  className="inline-flex items-center gap-2 min-h-[56px] px-7 rounded-2xl font-extrabold text-white bg-primary shadow-[0_14px_28px_rgba(37,99,235,.28)] hover:bg-primary-dark hover:-translate-y-0.5 transition-all"
                  to="/login"
                >
                  Tìm gia sư ngay <ChevronRight size={19} />
                </Link>
                <Link
                  className="inline-flex items-center min-h-[44px] border-b-2 border-slate-800 font-extrabold text-slate-800 hover:text-primary hover:border-primary transition-colors"
                  to="/register"
                >
                  Bắt đầu miễn phí
                </Link>
              </>
            )}
          </div>

          <SearchForm
            subject={subject}
            level={level}
            searchMessage={searchMessage}
            onSubjectChange={setSubject}
            onLevelChange={setLevel}
            onSubmit={submitSearch}
          />
        </div>

        {isAuthenticated ? (
          <StudentHeroPanel onOpenChat={onOpenChat} />
        ) : (
          <GuestHeroPanel onOpenChat={onOpenChat} />
        )}
      </div>
    </section>
  );
}

function SearchForm({ subject, level, searchMessage, onSubjectChange, onLevelChange, onSubmit }) {
  return (
    <form
      id="find-tutor-search"
      className="relative flex items-center gap-2.5 max-w-[740px] p-2.5 mt-14 border border-slate-200/90 rounded-[26px] bg-white/90 shadow-[0_24px_56px_-14px_rgba(15,23,42,.08)] max-[760px]:flex-col max-[760px]:rounded-[22px] max-[760px]:mt-10"
      onSubmit={onSubmit}
      aria-label="Tìm gia sư nhanh"
    >
      <label className="flex flex-[1.5] items-center gap-3 h-14 px-4 rounded-2xl text-primary bg-slate-50 min-w-0 max-[760px]:w-full">
        <Search size={20} aria-hidden="true" />
        <span className="sr-only">Môn học hoặc từ khóa</span>
        <input
          type="search"
          value={subject}
          onChange={(event) => {
            onSubjectChange(event.target.value);
          }}
          placeholder="Bạn muốn học môn gì?"
          className="min-w-0 w-full border-0 outline-none bg-transparent text-slate-900 font-bold placeholder:text-slate-400"
        />
      </label>

      <label className="flex flex-1 items-center gap-3 h-14 px-4 rounded-2xl text-primary bg-slate-50 min-w-0 max-[760px]:w-full">
        <GraduationCap size={19} aria-hidden="true" />
        <span className="sr-only">Cấp học</span>
        <select
          value={level}
          onChange={(event) => {
            onLevelChange(event.target.value);
          }}
          className="min-w-0 w-full border-0 outline-none bg-transparent text-slate-900 font-bold appearance-none cursor-pointer"
        >
          <option>{DEFAULT_LEVEL}</option>
          <option>Cấp 1 - 2</option>
          <option>Cấp 3</option>
          <option>Đại học</option>
        </select>
      </label>

      <button
        className="min-h-14 px-6 rounded-2xl font-extrabold text-white bg-slate-900 hover:bg-primary transition-colors max-[760px]:w-full"
        type="submit"
      >
        Tìm kiếm
      </button>

      {searchMessage && (
        <p className="absolute left-5 -bottom-7 text-[12px] font-bold text-primary-dark" role="status">
          {searchMessage}
        </p>
      )}
    </form>
  );
}

function StudentHeroPanel({ onOpenChat }) {
  return (
    <div
      className="relative min-w-0 reveal reveal-delay max-[920px]:max-w-[560px] max-[920px]:w-full max-[920px]:mx-auto max-[920px]:mt-4"
      aria-label="Tổng quan học tập"
    >
      <div className="relative max-w-[500px] mx-auto p-3.5 border border-white/85 rounded-[36px] bg-white/95 shadow-[0_44px_80px_-34px_rgba(15,23,42,.24)]">
        <div className="overflow-hidden rounded-[28px] bg-slate-900 p-6 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-blue-200">
                Sẵn sàng cá nhân hóa
              </p>
              <h2 className="mt-2 font-display text-2xl font-extrabold tracking-tight">
                Hồ sơ học tập của bạn
              </h2>
            </div>
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary">
              <Sparkles size={20} />
            </span>
          </div>

          <div className="mt-6 rounded-[22px] border border-white/10 bg-white/8 p-4">
            <p className="text-sm font-bold text-white">
              Hoàn thiện môn học, mục tiêu, lịch rảnh và ngân sách để nhận gợi ý gia sư tốt hơn.
            </p>
            <a
              href="#learning-profile"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-extrabold text-slate-900 hover:bg-blue-50"
            >
              Hoàn thiện hồ sơ <ArrowRight size={15} />
            </a>
          </div>

          <div className="mt-5 grid gap-3">
            {[
              'Gợi ý gia sư dựa trên hồ sơ học tập',
              'Theo dõi lớp và lịch học khi learning-service sẵn sàng',
              'Nhắn tin và thông báo theo ngữ cảnh học tập'
            ].map((item) => (
              <div key={item} className="flex items-start gap-2.5 text-sm font-semibold text-slate-300">
                <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-success" />
                <span>{item}</span>
              </div>
            ))}
          </div>

          <button
            className="mt-6 inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-xs font-extrabold text-slate-200 hover:border-blue-300 hover:text-white"
            type="button"
            onClick={onOpenChat}
          >
            <Sparkles size={15} />
            Mở trợ lý tìm gia sư
          </button>
        </div>
      </div>
    </div>
  );
}

function GuestHeroPanel({ onOpenChat }) {
  return (
    <div
      className="relative min-w-0 reveal reveal-delay max-[920px]:max-w-[560px] max-[920px]:w-full max-[920px]:mx-auto max-[920px]:mt-4"
      aria-label="Giao diện tìm gia sư"
    >
      <div className="relative max-w-[500px] mx-auto p-3.5 border border-white/85 rounded-[46px] bg-white/95 shadow-[0_56px_88px_-28px_rgba(15,23,42,.2)]">
        <div className="min-h-[490px] overflow-hidden px-7 pt-7 pb-8 rounded-[35px] bg-slate-900 text-white">
          <div className="flex items-center justify-between mb-14">
            <div className="flex gap-1.5" aria-hidden="true">
              <i className="block w-2.5 h-2.5 rounded-full bg-slate-700 not-italic" />
              <i className="block w-2.5 h-2.5 rounded-full bg-slate-700 not-italic" />
              <i className="block w-2.5 h-2.5 rounded-full bg-slate-700 not-italic" />
            </div>
            <span className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-800 text-slate-400 text-[9px] font-extrabold tracking-[.08em]">
              <span className="w-1.5 h-1.5 rounded-full bg-success shadow-[0_0_0_4px_rgba(34,197,94,.12)]" />
              ĐANG HOẠT ĐỘNG
            </span>
          </div>

          <div className="grid gap-7">
            <div className="flex items-start gap-3">
              <div className="flex-none w-9 h-9 grid place-items-center rounded-[13px] bg-gradient-to-br from-slate-100 to-blue-200 text-slate-900 font-display font-extrabold text-[15px]" aria-hidden="true">A</div>
              <p className="px-4 py-3.5 rounded-[20px_20px_20px_4px] bg-slate-700/55 text-slate-300 text-[13px] italic leading-[1.55]">
                "Cần gia sư luyện IELTS, mục tiêu 7.0, lịch tối thứ 3 và 5."
              </p>
            </div>

            <div className="p-5 rounded-[22px] bg-primary shadow-[0_16px_26px_rgba(37,99,235,.25)]">
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 grid place-items-center rounded-xl bg-white/20 text-white">
                  <CheckCircle2 size={18} />
                </span>
                <span className="grid gap-1">
                  <small className="text-blue-200 text-[9px] font-extrabold tracking-[.08em]">GIA SƯ PHÙ HỢP</small>
                  <strong className="text-[13px]">Gia sư Lê Hà - IELTS 8.0</strong>
                </span>
              </div>
              <p className="mt-3.5 text-blue-100/85 text-[11px]">3 năm kinh nghiệm · Lịch tối thứ 3, 5 · TP.HCM</p>
              <div className="flex gap-2 mt-3.5">
                <b className="px-2 py-1.5 rounded-lg text-primary bg-white text-[9px] font-extrabold tracking-[.04em]">Đã xác minh</b>
                <em className="px-2 py-1.5 rounded-lg bg-primary-dark/70 text-white text-[9px] font-extrabold tracking-[.04em] not-italic">Phù hợp lịch</em>
              </div>
            </div>

            <button
              className="inline-flex items-center gap-2 justify-self-start px-3 py-2.5 border border-slate-500/25 rounded-xl text-slate-300 text-[11px] font-bold hover:text-white hover:border-blue-400/80 hover:bg-primary/18 transition-colors"
              type="button"
              onClick={onOpenChat}
            >
              Xem thêm gia sư phù hợp
            </button>
          </div>
        </div>

        <div className="absolute -left-14 bottom-1 flex items-center gap-3 w-max px-4 py-3.5 border border-slate-200 rounded-[23px] bg-white shadow-[0_20px_52px_rgba(15,23,42,.15)]">
          <span className="w-10 h-10 grid place-items-center rounded-[13px] bg-success text-white shadow-[0_7px_16px_rgba(34,197,94,.2)]">
            <ShieldCheck size={21} />
          </span>
          <span className="grid gap-1">
            <strong className="text-slate-900 text-[12px] font-extrabold">Hợp đồng điện tử</strong>
            <small className="text-slate-400 text-[10px]">Cam kết rõ ràng</small>
          </span>
        </div>
      </div>
    </div>
  );
}

function getFirstName(value) {
  if (!value) return 'bạn';
  return value.trim().split(/\s+/).slice(-1)[0] || 'bạn';
}
