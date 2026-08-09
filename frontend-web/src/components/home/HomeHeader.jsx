import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, GraduationCap, Menu, X } from 'lucide-react';
import { homeNavLinks } from './homeData';

export function HomeHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    function closeOnEscape(e) { if (e.key === 'Escape') setMenuOpen(false); }
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, []);

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="fixed inset-x-0 top-0 z-40 bg-white/80 border-b border-slate-200/80 backdrop-blur-lg">
      <div className="container-app flex items-center justify-between gap-7 min-h-[80px]">

        {/* Brand */}
        <Link
          className="inline-flex items-center gap-2.5 font-display font-extrabold text-[20px] tracking-tight text-slate-900 whitespace-nowrap"
          to="/"
          aria-label="Kết Nối Học - Trang chủ"
          onClick={closeMenu}
        >
          <span className="w-9 h-9 grid place-items-center rounded-xl bg-primary text-white shadow-[0_8px_18px_rgba(37,99,235,.24)]" aria-hidden="true">
            <GraduationCap size={20} strokeWidth={2.4} />
          </span>
          <span>Kết Nối Học</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-8 ml-auto" aria-label="Điều hướng chính">
          {homeNavLinks.map((link) => (
            <a
              key={link.href + link.label}
              href={link.href}
              className="text-slate-500 text-[11px] font-bold tracking-[0.1em] uppercase hover:text-primary transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Actions */}
        <div className="hidden md:flex items-center gap-5">
          <Link className="text-slate-800 text-sm font-bold hover:text-primary transition-colors" to="/login">
            Đăng nhập
          </Link>
          <Link
            className="inline-flex items-center gap-2 min-h-[42px] px-5 rounded-[14px] bg-slate-900 text-white text-[13px] font-extrabold hover:bg-primary transition-colors shadow-[0_10px_22px_rgba(15,23,42,.14)]"
            to="/register"
          >
            Bắt đầu miễn phí
          </Link>
        </div>

        {/* Hamburger */}
        <button
          className="lg:hidden w-10 h-10 grid place-items-center border border-slate-200 rounded-[13px] text-slate-800 bg-white"
          type="button"
          aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'}
          aria-expanded={menuOpen}
          aria-controls="home-mobile-menu"
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile menu */}
      <div
        id="home-mobile-menu"
        className={`overflow-hidden transition-[max-height] duration-300 ease-in-out bg-white/97 ${menuOpen ? 'max-h-[420px] border-t border-slate-200' : 'max-h-0'}`}
      >
        <nav className="container-app grid gap-1 py-4" aria-label="Điều hướng di động">
          {homeNavLinks.map((link) => (
            <a
              key={link.href + link.label}
              href={link.href}
              onClick={closeMenu}
              className="py-3 text-slate-500 text-sm font-bold hover:text-primary transition-colors"
            >
              {link.label}
            </a>
          ))}
          <Link to="/login" onClick={closeMenu} className="py-3 text-slate-800 text-sm font-bold">Đăng nhập</Link>
          <Link
            className="mt-2 inline-flex items-center justify-center gap-2 min-h-[50px] rounded-[14px] bg-slate-900 text-white font-extrabold hover:bg-primary transition-colors"
            to="/register"
            onClick={closeMenu}
          >
            Bắt đầu miễn phí <ArrowUpRight size={17} />
          </Link>
        </nav>
      </div>
    </header>
  );
}
