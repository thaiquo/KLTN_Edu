import { GraduationCap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { footerGroups } from './homeData';

export function HomeFooter() {
  return (
    <footer className="pt-20 pb-7 border-t border-slate-200 bg-bg">
      <div className="container-app">

        {/* Grid */}
        <div className="grid grid-cols-[1.7fr_repeat(3,1fr)] gap-10 max-[760px]:grid-cols-2 max-[760px]:gap-9 max-[520px]:grid-cols-[1fr_1fr]">

          {/* Brand col */}
          <div className="max-[760px]:col-span-2">
            <Link
              className="inline-flex items-center gap-2.5 font-display font-extrabold text-[19px] tracking-tight text-slate-900"
              to="/"
              aria-label="Kết Nối Học - Trang chủ"
            >
              <span className="w-9 h-9 grid place-items-center rounded-xl bg-primary text-white shadow-[0_8px_18px_rgba(37,99,235,.22)]" aria-hidden="true">
                <GraduationCap size={20} strokeWidth={2.4} />
              </span>
              <span>Kết Nối Học</span>
            </Link>
            <p className="max-w-[280px] mt-5 text-slate-500 text-[14px] leading-[1.65]">
              Nền tảng kết nối học viên và gia sư với hợp đồng điện tử minh bạch tại Việt Nam.
            </p>
          </div>

          {/* Link groups */}
          {footerGroups.map((group) => (
            <div key={group.title}>
              <h3 className="mb-4 text-slate-900 text-[11px] font-extrabold tracking-[.2em] uppercase">{group.title}</h3>
              <ul className="space-y-3">
                {group.links.map((link) => (
                  <li key={link}>
                    <a href="#trust" className="text-slate-500 text-[14px] hover:text-primary transition-colors">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="flex justify-between gap-5 pt-6 mt-16 border-t border-slate-200 text-slate-400 text-[11px] max-[760px]:flex-col max-[760px]:gap-2 max-[760px]:mt-12">
          <p>© 2025 Kết Nối Học. Mọi quyền được bảo lưu.</p>
          <p>Thiết kế cho hành trình học tập minh bạch.</p>
        </div>
      </div>
    </footer>
  );
}
