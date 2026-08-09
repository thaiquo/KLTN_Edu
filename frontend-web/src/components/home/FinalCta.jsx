import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-primary text-white" aria-labelledby="final-cta-title">
      {/* Decorative rings */}
      <div
        className="absolute inset-0 opacity-20"
        style={{ background: 'repeating-radial-gradient(ellipse at 50% 50%, transparent 0 70px, rgba(255,255,255,.45) 71px 72px, transparent 73px 112px)' }}
        aria-hidden="true"
      />

      {/* Content */}
      <div className="container-app relative z-10 grid justify-items-center py-[clamp(90px,10vw,136px)] text-center">
        <span className="text-blue-200 text-[11px] font-extrabold tracking-[.22em] uppercase">Bắt đầu hôm nay</span>
        <h2
          id="final-cta-title"
          className="font-display font-extrabold text-[clamp(46px,7vw,80px)] leading-[.97] tracking-tight mt-4"
        >
          Tìm gia sư<br />đúng nhu cầu?
        </h2>

        <div className="flex flex-wrap justify-center gap-3.5 mt-9">
          {/* Primary white button — dễ đọc trên nền xanh */}
          <Link
            className="inline-flex items-center gap-2 min-h-[54px] px-8 rounded-2xl font-extrabold text-primary bg-white shadow-[0_14px_28px_rgba(0,0,0,.15)] hover:bg-blue-50 hover:-translate-y-0.5 transition-all"
            to="/login"
          >
            Tìm Gia Sư Ngay <ArrowUpRight size={18} />
          </Link>

          {/* Secondary outlined button — bg trắng trong suốt, viền rõ */}
          <Link
            className="inline-flex items-center gap-2 min-h-[54px] px-8 rounded-2xl font-extrabold text-white border-2 border-white/50 bg-white/10 hover:bg-white/20 hover:-translate-y-0.5 transition-all"
            to="/register"
          >
            Trở thành Gia sư <ArrowUpRight size={18} />
          </Link>
        </div>
      </div>
    </section>
  );
}
