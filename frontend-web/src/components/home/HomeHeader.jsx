import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowUpRight,
  BookOpen,
  ChevronDown,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
  WalletCards,
  X
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { homeNavLinks, studentNavLinks } from './homeData';
import { NotificationDropdown } from '../notification/NotificationDropdown';

export function HomeHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef(null);
  const { user, logout, switchRole, activateStudentProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthenticated = Boolean(user);
  const navLinks = isAuthenticated ? navLinksFor(user) : homeNavLinks;
  const displayName = user?.fullName || user?.email || 'Tài khoản';
  const initials = getInitials(displayName);
  const avatarUrl = getAvatarUrl(user);
  const roleText = displayRole(user);

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        setAccountOpen(false);
      }
    }

    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, []);

  useEffect(() => {
    function closeOnClickOutside(event) {
      if (accountRef.current && !accountRef.current.contains(event.target)) {
        setAccountOpen(false);
      }
    }

    document.addEventListener('mousedown', closeOnClickOutside);
    return () => document.removeEventListener('mousedown', closeOnClickOutside);
  }, []);

  const closeMenu = () => setMenuOpen(false);

  async function handleLogout() {
    await logout();
    closeMenu();
    setAccountOpen(false);
    navigate('/');
  }

  async function handleSwitchRole(targetRole) {
    setAccountOpen(false);
    try {
      const updatedUser = await switchRole(targetRole);
      if (targetRole === 'TUTOR') {
        navigate('/dashboard');
      } else {
        navigate('/');
      }
    } catch (err) {
      console.error('Lỗi chuyển vai trò:', err);
    }
  }

  async function handleActivateStudent() {
    setAccountOpen(false);
    try {
      await activateStudentProfile();
      await switchRole('STUDENT');
      navigate('/');
    } catch (err) {
      console.error('Lỗi kích hoạt học viên:', err);
    }
  }

  const isLinkActive = (link) => {
    const href = link.href;
    const path = location.pathname;
    const search = location.search;

    if (href === '/tutors') return path === '/tutors';
    if (href === '/classes') return path === '/classes';
    if (href.includes('tab=')) {
      const targetTab = new URLSearchParams(href.split('?')[1] || '').get('tab');
      const currentTab = new URLSearchParams(search).get('tab') || 'dashboard';
      if (path === '/dashboard') {
        if (targetTab === 'courses' && (currentTab === 'dashboard' || currentTab === 'courses')) return true;
        return currentTab === targetTab;
      }
    }
    return path === href;
  };

  return (
    <header className="fixed inset-x-0 top-0 z-40 bg-white/95 border-b border-slate-200/80 backdrop-blur-lg">
      <div className="container-app flex items-center justify-between gap-6 min-h-[76px]">
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

        <nav className="hidden lg:flex items-center gap-2 ml-auto pr-2" aria-label="Điều hướng chính">
          {navLinks.map((link) => {
            const active = isLinkActive(link);
            return (
              <NavItem
                key={link.href + link.label}
                link={link}
                active={active}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-extrabold tracking-wide transition-all ${
                  active
                    ? 'bg-primary text-white shadow-sm shadow-primary/25'
                    : 'text-slate-600 hover:text-primary hover:bg-slate-100/80'
                }`}
              >
                {link.icon === 'search' && <Search size={14} className={active ? 'text-white' : 'text-slate-400'} />}
                {link.icon === 'book' && <BookOpen size={14} className={active ? 'text-white' : 'text-slate-400'} />}
                {link.icon === 'message' && <MessageCircle size={14} className={active ? 'text-white' : 'text-slate-400'} />}
                {link.icon === 'sparkles' && <Sparkles size={14} className={active ? 'text-white' : 'text-slate-400'} />}
                {link.icon === 'shield' && <ShieldCheck size={14} className={active ? 'text-white' : 'text-emerald-600'} />}
                {link.icon === 'wallet' && <WalletCards size={14} className={active ? 'text-white' : 'text-indigo-600'} />}
                {link.icon === 'dashboard' && <LayoutDashboard size={14} className={active ? 'text-white' : 'text-slate-400'} />}
                {link.label}
              </NavItem>
            );
          })}
        </nav>

        <div className="hidden md:flex items-center gap-3 shrink-0">
          {isAuthenticated ? (
            <>
              {/* Real-time Notification Hub Dropdown */}
              <NotificationDropdown userEmail={user?.email} />

              <div className="relative" ref={accountRef}>
                <button
                  type="button"
                  onClick={() => setAccountOpen((current) => !current)}
                  className="inline-flex min-w-0 items-center gap-2.5 min-h-[44px] rounded-2xl border border-slate-200 bg-white px-3 text-slate-900 hover:border-primary/40 hover:shadow-md transition-all"
                  aria-haspopup="menu"
                  aria-expanded={accountOpen}
                >
                  <span className="w-8 h-8 grid place-items-center overflow-hidden rounded-xl bg-slate-900 text-xs font-extrabold text-white">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={`Ảnh đại diện của ${displayName}`} className="h-full w-full object-cover" />
                    ) : initials}
                  </span>
                  <span className="min-w-0 text-left">
                    <span className="block truncate text-xs font-extrabold max-w-[120px] sm:max-w-[160px]">{displayName}</span>
                    <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      {roleText}
                    </span>
                  </span>
                  <ChevronDown size={14} className="shrink-0 text-slate-400" />
                </button>

                {accountOpen && (
                  <AccountMenu
                    user={user}
                    onSwitchRole={handleSwitchRole}
                    onActivateStudent={handleActivateStudent}
                    onLogout={handleLogout}
                    onClose={() => setAccountOpen(false)}
                  />
                )}
              </div>
            </>
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
          onClick={() => setMenuOpen((current) => !current)}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      <div
        id="home-mobile-menu"
        className={`overflow-hidden transition-[max-height] duration-300 ease-in-out bg-white/97 ${
          menuOpen ? 'max-h-[680px] border-t border-slate-200' : 'max-h-0'
        }`}
      >
        <nav className="container-app grid gap-1 py-4" aria-label="Điều hướng di động">
          {navLinks.map((link) => (
            <NavItem
              key={link.href + link.label}
              link={link}
              onClick={closeMenu}
              className="py-3 text-slate-600 text-sm font-bold hover:text-primary transition-colors flex items-center gap-2"
            >
              {link.icon === 'search' && <Search size={16} />}
              {link.icon === 'book' && <BookOpen size={16} />}
              {link.icon === 'message' && <MessageCircle size={16} />}
              {link.icon === 'sparkles' && <Sparkles size={16} />}
              {link.icon === 'shield' && <ShieldCheck size={16} className="text-emerald-600" />}
              {link.icon === 'wallet' && <WalletCards size={16} className="text-indigo-600" />}
              {link.icon === 'dashboard' && <LayoutDashboard size={16} />}
              {link.label}
            </NavItem>
          ))}

          {isAuthenticated ? (
            <div className="mt-2 grid gap-2">
              <Link
                to="/dashboard"
                onClick={closeMenu}
                className="flex items-center gap-3 rounded-[14px] border border-slate-200 bg-indigo-50/50 px-3 py-3 text-indigo-900 font-extrabold text-sm"
              >
                <LayoutDashboard size={17} className="text-indigo-600" />
                Dashboard Học viên
              </Link>
              <Link
                to="/dashboard?tab=contracts"
                onClick={closeMenu}
                className="flex items-center gap-3 rounded-[14px] border border-slate-200 bg-emerald-50/50 px-3 py-3 text-emerald-900 font-extrabold text-sm"
              >
                <ShieldCheck size={17} className="text-emerald-600" />
                Hợp đồng Escrow & Ký quỹ
              </Link>
              <Link
                to="/dashboard?tab=wallet"
                onClick={closeMenu}
                className="flex items-center gap-3 rounded-[14px] border border-slate-200 bg-sky-50/50 px-3 py-3 text-sky-900 font-extrabold text-sm"
              >
                <WalletCards size={17} className="text-sky-600" />
                Ví Web3 của tôi
              </Link>
              <Link
                to="/profile"
                onClick={closeMenu}
                className="flex items-center gap-3 rounded-[14px] border border-slate-200 bg-slate-50 px-3 py-3 text-slate-900"
              >
                <span className="w-9 h-9 grid place-items-center overflow-hidden rounded-[11px] bg-slate-900 text-xs font-extrabold text-white">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={`Ảnh đại diện của ${displayName}`} className="h-full w-full object-cover" />
                  ) : initials}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-extrabold">{displayName}</span>
                  <span className="block text-[11px] font-bold text-slate-400">Hồ sơ cá nhân ({roleText})</span>
                </span>
              </Link>

              <Link
                to="/profile/password"
                onClick={closeMenu}
                className="inline-flex items-center justify-center gap-2 min-h-[46px] rounded-[14px] border border-slate-200 bg-white text-slate-800 font-extrabold hover:border-primary/40 hover:text-primary transition-colors"
              >
                <KeyRound size={17} />
                Đổi mật khẩu
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center justify-center gap-2 min-h-[46px] rounded-[14px] bg-slate-900 text-white font-extrabold hover:bg-[#ff695f] transition-colors"
              >
                <LogOut size={17} />
                Đăng xuất
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

function NavItem({ link, className, onClick, children }) {
  if (link.href?.startsWith('/')) {
    return (
      <Link to={link.href} onClick={onClick} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <a href={link.href} onClick={onClick} className={className}>
      {children}
    </a>
  );
}

function AccountMenu({ user, onSwitchRole, onActivateStudent, onLogout, onClose }) {
  const isStaffOrAdmin = user?.roles?.includes('STAFF') || user?.roles?.includes('ADMIN');
  const isTutor = user?.roles?.includes('TUTOR') || user?.activeRole === 'TUTOR';

  return (
    <div
      className="absolute right-0 top-[calc(100%+12px)] z-50 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl"
      role="menu"
    >
      <MenuLink to="/dashboard" icon={<LayoutDashboard size={16} />} onClick={onClose}>
        Dashboard Học viên
      </MenuLink>

      <MenuLink to="/dashboard?tab=contracts" icon={<ShieldCheck size={16} />} onClick={onClose}>
        Hợp đồng Escrow & Ký quỹ
      </MenuLink>

      <MenuLink to="/dashboard?tab=wallet" icon={<WalletCards size={16} />} onClick={onClose}>
        Ví Web3 của tôi
      </MenuLink>

      <MenuLink to="/profile" icon={<UserRound size={16} />} onClick={onClose}>
        Hồ sơ cá nhân
      </MenuLink>

      <MenuLink to="/profile" icon={<Settings size={16} />} onClick={onClose}>
        Cài đặt tài khoản
      </MenuLink>

      <MenuLink to="/profile/password" icon={<KeyRound size={16} />} onClick={onClose}>
        Đổi mật khẩu
      </MenuLink>

      {isStaffOrAdmin && (
        <MenuLink to="/staff/tutors" icon={<Settings size={16} />} onClick={onClose}>
          Staff Dashboard
        </MenuLink>
      )}

      {isTutor && (
        <button
          type="button"
          onClick={() => {
            onClose();
            onSwitchRole('TUTOR');
          }}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-xs font-extrabold text-indigo-600 hover:bg-indigo-50"
          role="menuitem"
        >
          <RefreshCw size={16} />
          Chuyển sang Dashboard Gia sư
        </button>
      )}

      <button
        type="button"
        onClick={onLogout}
        className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-xs font-extrabold text-rose-600 hover:bg-rose-50"
        role="menuitem"
      >
        <LogOut size={16} />
        Đăng xuất
      </button>
    </div>
  );
}

function MenuLink({ to, icon, children, onClick }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-extrabold text-slate-800 hover:bg-slate-50 hover:text-primary transition-colors"
      role="menuitem"
    >
      {icon}
      {children}
    </Link>
  );
}

function navLinksFor(user) {
  const roles = user?.roles || [];
  if (roles.includes('STAFF') || roles.includes('ADMIN')) {
    return [
      { label: 'Duyệt hồ sơ gia sư', href: '/staff/tutors', icon: 'sparkles' },
      { label: 'Tìm gia sư', href: '/tutors', icon: 'search' }
    ];
  }
  if (user?.activeRole === 'TUTOR') {
    return [
      { label: 'Dashboard Gia sư', href: '/dashboard', icon: 'sparkles' },
      { label: 'Yêu cầu mở', href: '/class-requests', icon: 'search' }
    ];
  }
  return studentNavLinks;
}

function displayRole(user) {
  const roles = user?.roles || [];
  if (roles.includes('ADMIN')) return 'Quản trị viên';
  if (roles.includes('STAFF')) return 'Nhân viên';
  if (user?.activeRole === 'TUTOR') return 'Gia sư';
  if (user?.activeRole === 'STUDENT') return 'Học viên';
  return 'Học viên';
}

function getInitials(value) {
  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'U';
}

function getAvatarUrl(user) {
  return user?.avatarUrl || user?.avatar || user?.publicAvatarUrl || '';
}
