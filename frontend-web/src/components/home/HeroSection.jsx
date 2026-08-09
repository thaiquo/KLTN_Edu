import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ChevronRight, GraduationCap, Search, ShieldCheck } from 'lucide-react';

export function HeroSection({ onOpenChat }) {
  const [subject, setSubject] = useState('');
  const [level, setLevel] = useState('Cấp học');
  const [searchMessage, setSearchMessage] = useState('');

  function submitSearch(e) {
    e.preventDefault();
    if (!subject.trim() && level === 'Cấp học') {
      setSearchMessage('Hãy chọn môn học hoặc cấp học để bắt đầu.');
      return;
    }
    const focus = subject.trim() || 'nhu cầu của bạn';
    setSearchMessage(`Đang tìm gia sư cho ${focus}${level !== 'Cấp học' ? ` · ${level}` : ''}.`);
  }

  return (
    <section
      className="pt-[calc(80px+80px)] pb-28 bg-bg"
      aria-labelledby="home-hero-title"
    >
      <div className="container-app grid grid-cols-[1.15fr_minmax(360px,0.85fr)] items-center gap-[clamp(48px,7vw,94px)] max-[920px]:grid-cols-1">

        {/* ── Copy ── */}
        <div className="relative z-10 reveal">
          {/* Status badge */}
          <div className="inline-flex items-center gap-2.5 px-3.5 py-2 mb-7 border border-slate-200 rounded-full bg-white/85 shadow-sm text-[12px] font-bold text-slate-800">
            <span className="relative w-2 h-2 rounded-full bg-primary pulse-dot" aria-hidden="true" />
            Hơn 1.200 gia sư đã được xác minh trên nền tảng
          </div>

          <h1
            id="home-hero-title"
            className="font-display font-extrabold text-[clamp(46px,6.1vw,84px)] leading-[.98] tracking-[-0.045em] max-w-[720px]"
          >
            Tìm gia sư <br />
            <span className="text-primary">phù hợp</span> với bạn
          </h1>

          <p className="mt-7 max-w-[620px] text-slate-500 text-[clamp(16px,1.5vw,19px)] leading-[1.7]">
            Nền tảng kết nối học viên với gia sư đã được xác minh hồ sơ.
            Hợp đồng điện tử rõ ràng, lịch học linh hoạt và thanh toán minh bạch.
          </p>

          <div className="flex flex-wrap items-center gap-5 mt-8">
            <Link
              className="inline-flex items-center gap-2 min-h-[56px] px-7 rounded-2xl font-extrabold text-white bg-primary shadow-[0_14px_28px_rgba(37,99,235,.28)] hover:bg-primary-dark hover:-translate-y-0.5 transition-all"
              to="/login"
            >
              Tìm Gia Sư Ngay <ChevronRight size={19} />
            </Link>
            <Link
              className="inline-flex items-center min-h-[44px] border-b-2 border-slate-800 font-extrabold text-slate-800 hover:text-primary hover:border-primary transition-colors"
              to="/register"
            >
              Bạn là gia sư? Đăng ký tại đây
            </Link>
          </div>

          {/* Search bar */}
          <form
            className="relative flex items-center gap-2.5 max-w-[740px] p-2.5 mt-14 border border-slate-200/90 rounded-[26px] bg-white/90 shadow-[0_24px_56px_-14px_rgba(15,23,42,.08)] max-[760px]:flex-col max-[760px]:rounded-[22px] max-[760px]:mt-10"
            onSubmit={submitSearch}
            aria-label="Tìm gia sư nhanh"
          >
            {/* Subject field */}
            <label className="flex flex-[1.5] items-center gap-3 h-14 px-4 rounded-2xl text-primary bg-slate-50 min-w-0 max-[760px]:w-full">
              <Search size={20} aria-hidden="true" />
              <span className="sr-only">Môn học hoặc từ khóa</span>
              <input
                type="search"
                value={subject}
                onChange={(e) => { setSubject(e.target.value); setSearchMessage(''); }}
                placeholder="Bạn muốn học môn gì?"
                className="min-w-0 w-full border-0 outline-none bg-transparent text-slate-900 font-bold placeholder:text-slate-400"
              />
            </label>

            {/* Level field */}
            <label className="flex flex-1 items-center gap-3 h-14 px-4 rounded-2xl text-primary bg-slate-50 min-w-0 max-[760px]:w-full">
              <GraduationCap size={19} aria-hidden="true" />
              <span className="sr-only">Cấp học</span>
              <select
                value={level}
                onChange={(e) => { setLevel(e.target.value); setSearchMessage(''); }}
                className="min-w-0 w-full border-0 outline-none bg-transparent text-slate-900 font-bold appearance-none cursor-pointer"
              >
                <option>Cấp học</option>
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
        </div>

        {/* ── Visual card ── */}
        <div
          className="relative min-w-0 reveal reveal-delay max-[920px]:max-w-[560px] max-[920px]:w-full max-[920px]:mx-auto max-[920px]:mt-4"
          aria-label="Giao diện tìm gia sư"
        >
          <div className="relative max-w-[500px] mx-auto p-3.5 border border-white/85 rounded-[46px] bg-white/95 shadow-[0_56px_88px_-28px_rgba(15,23,42,.2)]">
            {/* Screen */}
            <div className="min-h-[490px] overflow-hidden px-7 pt-7 pb-8 rounded-[35px] bg-slate-900 text-white">
              {/* Header dots */}
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

              {/* Chat thread */}
              <div className="grid gap-7">
                {/* Student message */}
                <div className="flex items-start gap-3">
                  <div className="flex-none w-9 h-9 grid place-items-center rounded-[13px] bg-gradient-to-br from-slate-100 to-blue-200 text-slate-900 font-display font-extrabold text-[15px]" aria-hidden="true">A</div>
                  <p className="px-4 py-3.5 rounded-[20px_20px_20px_4px] bg-slate-700/55 text-slate-300 text-[13px] italic leading-[1.55]">
                    "Cần gia sư luyện IELTS, mục tiêu 7.0, lịch tối thứ 3 và 5."
                  </p>
                </div>

                {/* Result card */}
                <div className="p-5 rounded-[22px] bg-primary shadow-[0_16px_26px_rgba(37,99,235,.25)]">
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 grid place-items-center rounded-xl bg-white/20 text-white">
                      <CheckCircle2 size={18} />
                    </span>
                    <span className="grid gap-1">
                      <small className="text-blue-200 text-[9px] font-extrabold tracking-[.08em]">GIA SƯ PHÙ HỢP</small>
                      <strong className="text-[13px]">Gia sư Lê Hà — IELTS 8.0</strong>
                    </span>
                  </div>
                  <p className="mt-3.5 text-blue-100/85 text-[11px]">3 năm kinh nghiệm · Lịch tối thứ 3, 5 · TP.HCM</p>
                  <div className="flex gap-2 mt-3.5">
                    <b className="px-2 py-1.5 rounded-lg text-primary bg-white text-[9px] font-extrabold tracking-[.04em]">Đã xác minh</b>
                    <em className="px-2 py-1.5 rounded-lg bg-primary-dark/70 text-white text-[9px] font-extrabold tracking-[.04em] not-italic">Phù hợp lịch</em>
                  </div>
                </div>

                {/* CTA button */}
                <button
                  className="inline-flex items-center gap-2 justify-self-start px-3 py-2.5 border border-slate-500/25 rounded-xl text-slate-300 text-[11px] font-bold hover:text-white hover:border-blue-400/80 hover:bg-primary/18 transition-colors"
                  type="button"
                  onClick={onOpenChat}
                >
                  Xem thêm gia sư phù hợp
                </button>
              </div>
            </div>

            {/* Verification chip */}
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

          {/* Floating badges */}
          <div className="absolute top-[8%] -right-4 w-10 h-10 grid place-items-center border border-white/80 rounded-[13px] bg-primary text-white shadow-[0_16px_36px_rgba(15,23,42,.18)] [animation:float-y_5s_ease-in-out_infinite]" aria-hidden="true">
            <CheckCircle2 size={18} />
          </div>
        </div>

      </div>
    </section>
  );
}
