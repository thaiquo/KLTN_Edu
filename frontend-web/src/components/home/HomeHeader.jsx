import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  Bell,
  BookOpen,
  ChevronDown,
  FileText,
  GraduationCap,
  Home,
  KeyRound,
  LogOut,
  Menu,
  MessageCircle,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  UserRound,
  WalletCards,
  X
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useCreateTutorApplication, useTutorApplication } from '../../hooks/useTutorApplication';
import { homeNavLinks, studentNavLinks } from './homeData';

export function HomeHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [mobileNotificationOpen, setMobileNotificationOpen] = useState(false);
  const [roleActionLoading, setRoleActionLoading] = useState(false);
  const [roleActionError, setRoleActionError] = useState('');
  const accountRef = useRef(null);
  const notificationRef = useRef(null);
  const { user, logout, switchRole, refreshUser } = useAuth();
  const navigate = useNavigate();
  const isAuthenticated = Boolean(user);
  const navLinks = isAuthenticated ? navLinksFor(user) : homeNavLinks;
  const displayName = user?.fullName || user?.email || 'Tài khoản';
  const initials = getInitials(displayName);
  const avatarUrl = getAvatarUrl(user);
  const roleText = displayRole(user);
  const isStudentActive = user?.activeRole === 'STUDENT';
  const {
    data: tutorApplication,
    isLoading: tutorApplicationLoading,
    isFetching: tutorApplicationFetching,
    error: tutorApplicationError
  } = useTutorApplication({
    enabled: isAuthenticated && isStudentActive
  });
  const createTutorApplication = useCreateTutorApplication();
  const studentRoleAction = getStudentRoleAction({
    user,
    tutorApplication,
    loading: tutorApplicationLoading || tutorApplicationFetching || roleActionLoading
  });

  useEffect(() => {
    if (!isAuthenticated || !isStudentActive || !tutorApplicationError) {
      setRoleActionError('');
      return;
    }

    console.error('Không thể tải trạng thái hồ sơ gia sư:', tutorApplicationError);
    setRoleActionError('Không thể kiểm tra hồ sơ gia sư lúc này.');
  }, [isAuthenticated, isStudentActive, tutorApplicationError]);

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        setAccountOpen(false);
        setNotificationOpen(false);
        setMobileNotificationOpen(false);
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
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setNotificationOpen(false);
      }
    }

    document.addEventListener('mousedown', closeOnClickOutside);
    return () => document.removeEventListener('mousedown', closeOnClickOutside);
  }, []);

  const closeMenu = () => {
    setMenuOpen(false);
    setMobileNotificationOpen(false);
  };

  async function handleLogout() {
    await logout();
    closeMenu();
    setAccountOpen(false);
    navigate('/');
  }

  async function handleSwitchRole(targetRole) {
    setRoleActionLoading(true);
    setRoleActionError('');
    try {
      const updatedUser = await switchRole(targetRole);
      if (targetRole === 'TUTOR') {
        navigate('/dashboard');
      } else {
        navigate('/');
      }
      setAccountOpen(false);
      closeMenu();
      return updatedUser;
    } catch (err) {
      console.error('Lỗi chuyển vai trò:', err);
      setRoleActionError('Không thể chuyển vai trò lúc này. Vui lòng thử lại.');
      throw err;
    } finally {
      setRoleActionLoading(false);
    }
  }

  async function handleStudentTutorAction() {
    if (!studentRoleAction || studentRoleAction.disabled || roleActionLoading) return;

    setRoleActionLoading(true);
    setRoleActionError('');
    try {
      if (studentRoleAction.kind === 'switch') {
        await handleSwitchRole('TUTOR');
        return;
      }

      if (studentRoleAction.kind === 'create') {
        await createTutorApplication.mutateAsync();
        await refreshUser();
        setAccountOpen(false);
        closeMenu();
        navigate('/profile');
        return;
      }

      setAccountOpen(false);
      closeMenu();
      navigate(studentRoleAction.href || '/profile');
    } catch (err) {
      console.error('Không thể xử lý hồ sơ gia sư:', err);
      setRoleActionError(
        studentRoleAction.kind === 'create'
          ? 'Không thể khởi tạo hồ sơ gia sư.'
          : 'Không thể chuyển vai trò lúc này. Vui lòng thử lại.'
      );
    } finally {
      setRoleActionLoading(false);
    }
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

        <nav className="hidden lg:flex items-center gap-4 xl:gap-6 ml-auto" aria-label="Điều hướng chính">
          {navLinks.map((link) => (
            <NavItem
              key={link.href + link.label}
              link={link}
              className="inline-flex items-center gap-1.5 text-slate-500 text-[11px] font-bold tracking-[0.1em] uppercase hover:text-primary transition-colors"
            >
              {link.icon === 'search' && <Search size={14} />}
              {link.icon === 'book' && <BookOpen size={14} />}
              {link.icon === 'home' && <Home size={14} />}
              {link.icon === 'message' && <MessageCircle size={14} />}
              {link.icon === 'sparkles' && <Sparkles size={14} />}
              {link.label}
            </NavItem>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          {isAuthenticated ? (
            <>
              <div className="relative" ref={notificationRef}>
                <button
                  type="button"
                  onClick={() => {
                    setAccountOpen(false);
                    setNotificationOpen((current) => !current);
                  }}
                  className="relative w-11 h-11 grid place-items-center rounded-[14px] border border-slate-200 bg-white text-slate-700 hover:border-primary/40 hover:text-primary transition-colors"
                  aria-label="Thông báo"
                  aria-haspopup="dialog"
                  aria-expanded={notificationOpen}
                >
                  <Bell size={18} />
                </button>

                {notificationOpen && (
                  <div className="absolute right-0 top-[calc(100%+12px)] z-50 w-80 rounded-[14px] border border-slate-200 bg-white p-4 shadow-[0_24px_64px_rgba(15,23,42,.16)]">
                    <div className="flex items-start gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-blue-50 text-primary">
                        <Bell size={17} />
                      </span>
                      <div>
                        <p className="text-sm font-extrabold text-slate-950">Chưa có trung tâm thông báo</p>
                        <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                          Realtime toast hiện vẫn được giữ nguyên. Danh sách thông báo và unread count sẽ cần API thật trước khi hiển thị.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="relative" ref={accountRef}>
                <button
                  type="button"
                  onClick={() => {
                    setNotificationOpen(false);
                    setAccountOpen((current) => !current);
                  }}
                  className="inline-flex min-w-0 items-center gap-3 min-h-[46px] max-w-[250px] rounded-[14px] border border-slate-200 bg-white px-3.5 text-slate-900 hover:border-primary/40 hover:shadow-[0_12px_24px_rgba(15,23,42,.08)] transition-all"
                  aria-haspopup="menu"
                  aria-expanded={accountOpen}
                >
                  <span className="w-8 h-8 grid place-items-center overflow-hidden rounded-[11px] bg-slate-900 text-xs font-extrabold text-white">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={`Ảnh đại diện của ${displayName}`} className="h-full w-full object-cover" />
                    ) : initials}
                  </span>
                  <span className="min-w-0 text-left">
                    <span className="block truncate text-sm font-extrabold">{displayName}</span>
                    <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                      {roleText}
                    </span>
                  </span>
                  <ChevronDown size={15} className="shrink-0 text-slate-400" />
                </button>

                {accountOpen && (
                  <AccountMenu
                    user={user}
                    roleAction={studentRoleAction}
                    roleActionError={roleActionError}
                    onStudentTutorAction={handleStudentTutorAction}
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
          menuOpen ? 'max-h-[860px] border-t border-slate-200' : 'max-h-0'
        }`}
      >
        <nav className="container-app grid gap-1 py-4" aria-label="Điều hướng di động">
          {navLinks.map((link) => (
            <NavItem
              key={link.href + link.label}
              link={link}
              onClick={closeMenu}
              className="py-3 text-slate-500 text-sm font-bold hover:text-primary transition-colors"
            >
              {link.label}
            </NavItem>
          ))}

          {isAuthenticated ? (
            <div className="mt-2 grid gap-2">
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

              <button
                type="button"
                onClick={() => setMobileNotificationOpen((current) => !current)}
                className="inline-flex items-center justify-center gap-2 min-h-[46px] rounded-[14px] border border-slate-200 bg-white text-slate-800 font-extrabold hover:border-primary/40 hover:text-primary transition-colors"
                aria-expanded={mobileNotificationOpen}
              >
                <Bell size={17} />
                Thông báo
              </button>

              {mobileNotificationOpen && (
                <div className="rounded-[14px] border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold leading-6 text-slate-600">
                  Chưa có trung tâm thông báo thật. Realtime toast hiện vẫn được giữ nguyên.
                </div>
              )}

              {isStudentActive && (
                <>
                  <Link
                    to="/contracts"
                    onClick={closeMenu}
                    className="inline-flex items-center justify-center gap-2 min-h-[46px] rounded-[14px] border border-slate-200 bg-white text-slate-800 font-extrabold hover:border-primary/40 hover:text-primary transition-colors"
                  >
                    <FileText size={17} />
                    Hợp đồng của tôi
                  </Link>
                  <Link
                    to="/payments"
                    onClick={closeMenu}
                    className="inline-flex items-center justify-center gap-2 min-h-[46px] rounded-[14px] border border-slate-200 bg-white text-slate-800 font-extrabold hover:border-primary/40 hover:text-primary transition-colors"
                  >
                    <WalletCards size={17} />
                    Thanh toán & Ký quỹ
                  </Link>
                  {studentRoleAction && (
                    <button
                      type="button"
                      onClick={handleStudentTutorAction}
                      disabled={studentRoleAction.disabled}
                      className="inline-flex items-center justify-center gap-2 min-h-[46px] rounded-[14px] border border-emerald-200 bg-emerald-50 text-[#147b77] font-extrabold hover:border-[#147b77]/40 hover:bg-emerald-100 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {studentRoleAction.icon === 'switch' ? <RefreshCw size={17} /> : <GraduationCap size={17} />}
                      {studentRoleAction.label}
                    </button>
                  )}
                  {roleActionError && (
                    <p className="rounded-[12px] border border-red-100 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
                      {roleActionError}
                    </p>
                  )}
                  <Link
                    to="/profile"
                    onClick={closeMenu}
                    className="inline-flex items-center justify-center gap-2 min-h-[46px] rounded-[14px] border border-slate-200 bg-white text-slate-800 font-extrabold hover:border-primary/40 hover:text-primary transition-colors"
                  >
                    <Settings size={17} />
                    Cài đặt
                  </Link>
                </>
              )}

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

function AccountMenu({ user, roleAction, roleActionError, onStudentTutorAction, onLogout, onClose }) {
  const isStaffOrAdmin = user?.roles?.includes('STAFF') || user?.roles?.includes('ADMIN');
  const isStudentActive = user?.activeRole === 'STUDENT';

  return (
    <div
      className="absolute right-0 top-[calc(100%+12px)] z-50 w-72 overflow-hidden rounded-[14px] border border-slate-200 bg-white p-2 shadow-[0_24px_64px_rgba(15,23,42,.16)]"
      role="menu"
    >
      {isStudentActive ? (
        <>
          <MenuLink to="/profile" icon={<UserRound size={16} />} onClick={onClose}>
            Hồ sơ cá nhân
          </MenuLink>
          <MenuLink to="/contracts" icon={<FileText size={16} />} onClick={onClose}>
            Hợp đồng của tôi
          </MenuLink>
          <MenuLink to="/payments" icon={<WalletCards size={16} />} onClick={onClose}>
            Thanh toán & Ký quỹ
          </MenuLink>
          {roleAction && (
            <div className="my-2 border-t border-slate-100 pt-2">
              <button
                type="button"
                onClick={onStudentTutorAction}
                disabled={roleAction.disabled}
                className="flex w-full items-center gap-3 rounded-[10px] px-3 py-3 text-left text-sm font-extrabold text-[#147b77] hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                role="menuitem"
              >
                {roleAction.icon === 'switch' ? <RefreshCw size={16} /> : <GraduationCap size={16} />}
                <span>{roleAction.label}</span>
              </button>
              {roleActionError && (
                <p className="mt-1 rounded-[10px] border border-red-100 bg-red-50 px-3 py-2 text-xs font-bold leading-5 text-red-700">
                  {roleActionError}
                </p>
              )}
            </div>
          )}
          <MenuLink to="/profile" icon={<Settings size={16} />} onClick={onClose}>
            Cài đặt
          </MenuLink>
          <MenuLink to="/profile/password" icon={<KeyRound size={16} />} onClick={onClose}>
            Đổi mật khẩu
          </MenuLink>
        </>
      ) : (
        <>
          <MenuLink to="/profile" icon={<UserRound size={16} />} onClick={onClose}>
            Hồ sơ cá nhân
          </MenuLink>
          <MenuLink to="/profile" icon={<Settings size={16} />} onClick={onClose}>
            Cài đặt tài khoản
          </MenuLink>
          <MenuLink to="/profile/password" icon={<KeyRound size={16} />} onClick={onClose}>
            Đổi mật khẩu
          </MenuLink>
        </>
      )}

      {isStaffOrAdmin && (
        <MenuLink to="/staff/tutors" icon={<Settings size={16} />} onClick={onClose}>
          Staff Dashboard
        </MenuLink>
      )}

      <button
        type="button"
        onClick={onLogout}
        className="mt-2 flex w-full items-center gap-3 border-t border-slate-100 px-3 py-3 text-left text-sm font-extrabold text-[#b83333] hover:bg-red-50"
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
      className="flex items-center gap-3 rounded-[10px] px-3 py-3 text-sm font-extrabold text-slate-800 hover:bg-slate-50 hover:text-primary"
      role="menuitem"
    >
      {icon}
      {children}
    </Link>
  );
}

function getStudentRoleAction({ user, tutorApplication, loading }) {
  if (user?.activeRole !== 'STUDENT') return null;

  if (loading) {
    return {
      kind: 'loading',
      label: 'Đang kiểm tra hồ sơ gia sư...',
      disabled: true,
      icon: 'create'
    };
  }

  const status = tutorApplication?.status || user?.tutorStatus || null;
  if (status === 'APPROVED') {
    return {
      kind: 'switch',
      label: 'Chuyển sang Gia sư',
      disabled: false,
      icon: 'switch'
    };
  }
  if (status === 'DRAFT') {
    return {
      kind: 'profile',
      label: 'Hoàn thiện hồ sơ gia sư',
      href: '/profile',
      disabled: false,
      icon: 'create'
    };
  }
  if (status === 'PENDING') {
    return {
      kind: 'status',
      label: 'Hồ sơ gia sư đang chờ duyệt',
      href: '/tutor-next-step',
      disabled: false,
      icon: 'create'
    };
  }
  if (status === 'REJECTED') {
    return {
      kind: 'profile',
      label: 'Cập nhật hồ sơ gia sư',
      href: '/profile',
      disabled: false,
      icon: 'create'
    };
  }

  return {
    kind: 'create',
    label: 'Trở thành gia sư',
    disabled: false,
    icon: 'create'
  };
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
