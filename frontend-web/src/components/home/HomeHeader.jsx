import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowUpRight, Bell, GraduationCap, LogOut, Menu, UserRound, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { homeNavLinks } from './homeData';

export function HomeHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    function closeOnEscape(e) {
      if (e.key === 'Escape') setMenuOpen(false);
    }

    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, []);

  const closeMenu = () => setMenuOpen(false);
  const displayName = user?.fullName || user?.email || 'Tài khoản';

  async function handleLogout() {
    await logout();
    closeMenu();
    navigate('/');
  }

  return (
    <header className="fixed inset-x-0 top-0 z-40 bg-white/80 border-b border-slate-200/80 backdrop-blur-lg">
      <div className="container-app flex items-center justify-between gap-7 min-h-[80px]">
        <Link
          className="inline-flex items-center gap-2.5 font-display font-extrabold text-[20px] tracking-tight text-slate-900 whitespace-nowrap"
          to="/"
          aria-label="Kết Nối Học - Trang chủ"
          onClick={closeMenu}
        >
          <span
            className="w-9 h-9 grid place-items-center rounded-xl bg-primary text-white shadow-[0_8px_18px_rgba(37,99,235,.24)]"
            aria-hidden="true"
          >
            <GraduationCap size={20} strokeWidth={2.4} />
          </span>
          <span>Kết Nối Học</span>
        </Link>

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

        <div className="hidden md:flex items-center gap-5">
          {user ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="relative w-11 h-11 grid place-items-center rounded-[14px] border border-slate-200 bg-white text-slate-700 hover:border-primary/40 hover:text-primary transition-colors"
                aria-label="Thông báo"
              >
                <Bell size={18} />
                <span className="absolute right-2.5 top-2.5 w-2 h-2 rounded-full bg-[#ff695f]" aria-hidden="true" />
              </button>

              <Link
                to="/profile"
                className="inline-flex min-w-0 items-center gap-3 min-h-[46px] max-w-[230px] rounded-[14px] border border-slate-200 bg-white px-3.5 text-slate-900 hover:border-primary/40 hover:shadow-[0_12px_24px_rgba(15,23,42,.08)] transition-all"
                aria-label="Xem thông tin cá nhân"
              >
                <span className="w-8 h-8 grid place-items-center rounded-[11px] bg-slate-900 text-white">
                  <UserRound size={16} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-extrabold">{displayName}</span>
                  <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                    Hồ sơ cá nhân
                  </span>
                </span>
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-2 min-h-[42px] px-4 rounded-[14px] bg-slate-900 text-white text-[13px] font-extrabold hover:bg-[#ff695f] transition-colors shadow-[0_10px_22px_rgba(15,23,42,.14)]"
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
          ) : (
            <>
              <Link className="text-slate-800 text-sm font-bold hover:text-primary transition-colors" to="/login">
                Đăng nhập
              </Link>
              <Link
                className="inline-flex items-center gap-2 min-h-[42px] px-5 rounded-[14px] bg-slate-900 text-white text-[13px] font-extrabold hover:bg-primary transition-colors shadow-[0_10px_22px_rgba(15,23,42,.14)]"
                to="/register"
              >
                Bắt đầu miễn phí
              </Link>
            </>
          )}
        </div>

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

      <div
        id="home-mobile-menu"
        className={`overflow-hidden transition-[max-height] duration-300 ease-in-out bg-white/97 ${
          menuOpen ? 'max-h-[520px] border-t border-slate-200' : 'max-h-0'
        }`}
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

          {user ? (
            <div className="mt-2 grid gap-2">
              <Link
                to="/profile"
                onClick={closeMenu}
                className="flex items-center gap-3 rounded-[14px] border border-slate-200 bg-slate-50 px-3 py-3 text-slate-900"
              >
                <span className="w-9 h-9 grid place-items-center rounded-[11px] bg-slate-900 text-white">
                  <UserRound size={16} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-extrabold">{displayName}</span>
                  <span className="block text-[11px] font-bold text-slate-400">Thông tin cá nhân</span>
                </span>
                <Bell size={17} className="ml-auto text-slate-500" />
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center justify-center gap-2 min-h-[46px] rounded-[14px] bg-slate-900 text-white font-extrabold hover:bg-[#ff695f] transition-colors"
              >
                <LogOut size={17} />
                Logout
              </button>
            </div>
          ) : (
            <>
              <Link to="/login" onClick={closeMenu} className="py-3 text-slate-800 text-sm font-bold">
                Đăng nhập
              </Link>
              <Link
                className="mt-2 inline-flex items-center justify-center gap-2 min-h-[50px] rounded-[14px] bg-slate-900 text-white font-extrabold hover:bg-primary transition-colors"
                to="/register"
                onClick={closeMenu}
              >
                Bắt đầu miễn phí <ArrowUpRight size={17} />
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
