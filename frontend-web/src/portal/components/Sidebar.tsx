import React, { useEffect, useState } from "react";
import {
  BarChart3,
  BookOpen,
  Calendar,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  Globe,
  GraduationCap,
  HelpCircle,
  LayoutDashboard,
  Lock,
  LogOut,
  MessageSquare,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Users,
  WalletCards,
  Layers3,
  Newspaper,
  Database
} from "lucide-react";
import { UserRole } from "../types";
import { canAccessPortalPage } from "../portalAccess";
import {
  ADMIN_OVERVIEW_ITEM,
  ADMIN_SIDEBAR_GROUPS,
  getAdminSidebarGroupId,
} from "./adminSidebarConfig";
import {
  TUTOR_SIDEBAR_ENTRIES,
  getTutorSidebarGroupId,
} from "./tutorSidebarConfig";

interface SidebarProps {
  activeRole: UserRole;
  currentPage: string;
  onNavigate: (page: string) => void;
  onStartSession: () => void;
  onLogout: () => void;
  restrictedTutor?: boolean;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

const ADMIN_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  users: Users,
  approval: CheckCircle2,
  classes: BookOpen,
  subjects: Layers3,
  finance: WalletCards,
  contracts: ShieldCheck,
  moderation: ShieldAlert,
  community: Globe,
  escalations: ShieldAlert,
  complaints: ShieldAlert,
  operations: Calendar,
  duty: Calendar,
  reports: BarChart3,
  ai: Database,
  knowledge: Database,
  settings: Settings,
};

const TUTOR_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  community: Newspaper,
  teaching: GraduationCap,
  classes: GraduationCap,
  sessions: Calendar,
  homework: CheckSquare,
  subjects: BookOpen,
  schedule: Calendar,
  requests: CheckCircle2,
  messages: MessageSquare,
  payments: WalletCards,
  contracts: ShieldCheck,
  wallet: WalletCards,
  complaints: ShieldAlert,
};

export function Sidebar({
  activeRole,
  currentPage,
  onNavigate,
  onLogout,
  restrictedTutor = false,
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const isStaff = activeRole === "staff";
  const [openAdminGroupId, setOpenAdminGroupId] = useState<string | null>(() =>
    activeRole === "admin" ? getAdminSidebarGroupId(currentPage) : null
  );
  const [openTutorGroupId, setOpenTutorGroupId] = useState<string | null>(() =>
    activeRole === "tutor" ? getTutorSidebarGroupId(currentPage) : null
  );

  useEffect(() => {
    if (activeRole === "admin") {
      setOpenAdminGroupId(getAdminSidebarGroupId(currentPage));
    }
  }, [activeRole, currentPage]);

  useEffect(() => {
    if (activeRole === "tutor") {
      setOpenTutorGroupId(getTutorSidebarGroupId(currentPage));
    }
  }, [activeRole, currentPage]);

  const getNavItems = () => {
    switch (activeRole) {
      case "tutor":
        return [];
      case "student":
        return [
          { id: "community", label: "Bảng tin", icon: Newspaper },
          { id: "my-classes", label: "Lớp học của tôi", icon: GraduationCap },
          { id: "homework", label: "Quản lý bài tập", icon: CheckSquare },
          { id: "contracts", label: "Hợp đồng của tôi", icon: ShieldCheck },
          { id: "messages", label: "Tin nhắn", icon: MessageSquare },
          { id: "complaints", label: "Khiếu nại", icon: ShieldAlert },
        ];
      case "admin":
        return [];
      case "staff":
        return [
          { id: "dashboard", label: "Tổng quan", icon: LayoutDashboard },
          { id: "tutor-approval", label: "Duyệt hồ sơ gia sư", icon: CheckCircle2 },
          { id: "class-management", label: "Lớp / nội dung", icon: BookOpen },
          { id: "contracts", label: "Hợp đồng & Theo dõi", icon: ShieldCheck },
          { id: "complaints", label: "Quản lý khiếu nại", icon: ShieldAlert },
          { id: "escalations", label: "Chuyển cấp Admin", icon: ShieldAlert },
          { id: "community-moderation", label: "Kiểm duyệt Community", icon: Globe },
          { id: "duty-roster", label: "Lịch trực của tôi", icon: Calendar },
        ];
      default:
        return [];
    }
  };

  const navItems = getNavItems().filter((item) => canAccessPortalPage(activeRole, item.id));
  const lockedTutorItems = new Set(["subjects", "my-classes", "homework", "contracts", "wallet", "requests", "messages", "schedule", "complaints"]);

  const navigate = (page: string) => {
    onNavigate(page);
    onMobileClose?.();
  };

  const renderTutorLink = (item: { id: string; label: string; icon: string }, child = false) => {
    const Icon = TUTOR_ICONS[item.icon];
    const isActive = currentPage === item.id;
    const disabled = restrictedTutor && lockedTutorItems.has(item.id);
    const activeClass = disabled
      ? "border-transparent text-brand-text-variant/40 opacity-70 cursor-not-allowed"
      : isActive
        ? "border-brand-secondary bg-brand-secondary text-white shadow-lg shadow-brand-secondary/10"
        : "border-transparent text-brand-text-variant/85 hover:bg-brand-secondary/10 hover:text-brand-secondary";

    return (
      <a
        key={item.id}
        data-tutor-item={item.id}
        href={disabled ? undefined : `?tab=${item.id}`}
        onClick={(event) => {
          event.preventDefault();
          if (!disabled) navigate(item.id);
        }}
        aria-current={isActive ? "page" : undefined}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : undefined}
        title={disabled ? "Hồ sơ gia sư cần được duyệt trước khi sử dụng chức năng này." : undefined}
        className={`group relative flex w-full items-center border-l-4 text-left font-display transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary focus-visible:ring-offset-2 ${
          child ? "gap-2.5 rounded-lg px-3 py-2" : "gap-3 rounded-xl px-3 py-2.5"
        } ${activeClass}`}
      >
        <Icon className={`${child ? "h-3.5 w-3.5" : "h-4 w-4"} shrink-0 transition-transform duration-300 ${!isActive && !disabled ? "group-hover:scale-110" : ""}`} />
        <span className={`min-w-0 flex-1 whitespace-normal tracking-wide ${child ? "text-xs font-bold leading-5" : "text-sm font-black leading-5"}`}>
          {item.label}
        </span>
        {disabled && <Lock className="h-3.5 w-3.5 shrink-0" />}
        {isActive && !disabled && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white" />}
      </a>
    );
  };

  return (<>
    {mobileOpen && <button type="button" aria-label="Đóng menu" onClick={onMobileClose} className="fixed inset-0 top-16 z-30 bg-slate-950/40 lg:hidden" />}
    <aside className={`fixed left-0 top-16 bottom-0 z-40 flex min-h-0 w-72 select-none flex-col border-r pt-3 font-sans transition-transform duration-200 lg:z-20 lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"} ${
      isStaff ? "border-[#0d466f] bg-[#073554] text-white" : "border-brand-border/30 bg-white lg:bg-brand-low/40"
    }`}>
      <nav aria-label="Điều hướng Portal" className="custom-scrollbar min-h-0 flex-1 space-y-1 overflow-x-hidden overflow-y-auto px-3 pb-3">
        {activeRole === "admin" ? (
          <>
            {(() => {
              const OverviewIcon = ADMIN_ICONS[ADMIN_OVERVIEW_ITEM.icon];
              const isActive = currentPage === ADMIN_OVERVIEW_ITEM.id;
              return (
                <a
                  href={`?tab=${ADMIN_OVERVIEW_ITEM.id}`}
                  onClick={(event) => {
                    event.preventDefault();
                    navigate(ADMIN_OVERVIEW_ITEM.id);
                  }}
                  aria-current={isActive ? "page" : undefined}
                  className={`group relative flex w-full items-center gap-3 rounded-xl border-l-4 border-transparent px-3 py-2.5 text-left font-display text-base font-black tracking-wide transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 ${
                    isActive
                      ? "bg-brand-text text-white shadow-lg shadow-brand-text/10"
                      : "text-brand-text-variant/80 hover:bg-brand-container/50 hover:text-brand-text"
                  }`}
                >
                  <OverviewIcon className={`h-4 w-4 shrink-0 transition-transform duration-300 ${!isActive ? "group-hover:scale-110" : ""}`} />
                  <span className="min-w-0 flex-1 whitespace-normal leading-5">{ADMIN_OVERVIEW_ITEM.label}</span>
                  {isActive && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white" />}
                </a>
              );
            })()}

            <div className="space-y-1 pt-1">
              {ADMIN_SIDEBAR_GROUPS.map((group) => {
                const GroupIcon = ADMIN_ICONS[group.icon];
                const isOpen = openAdminGroupId === group.id;
                const containsActivePage = group.items.some((item) => item.id === currentPage);
                const panelId = `admin-sidebar-group-${group.id}`;

                return (
                  <section key={group.id} data-contains-active={containsActivePage ? "true" : "false"}>
                    <button
                      type="button"
                      data-admin-group={group.id}
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      onClick={() => setOpenAdminGroupId((openId) => openId === group.id ? null : group.id)}
                      className={`group relative flex w-full items-center gap-3 rounded-xl border-l-4 px-3 py-2.5 text-left font-display text-xs font-black tracking-wide transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 ${
                        isOpen ? "bg-brand-container/60 shadow-sm" : "hover:bg-brand-container/40"
                      } ${
                        containsActivePage
                          ? "border-brand-primary text-brand-primary"
                          : "border-transparent text-brand-text-variant/85 hover:text-brand-text"
                      }`}
                    >
                      <GroupIcon className="h-4 w-4 shrink-0" />
                      <span className="min-w-0 flex-1 whitespace-normal leading-5">{group.label}</span>
                      {containsActivePage && !isOpen && (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-primary" aria-label="Chứa trang hiện tại" />
                      )}
                      <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                    </button>

                    {isOpen && (
                      <div id={panelId} className="ml-5 mt-1 space-y-1 border-l border-brand-border/50 pl-2">
                        {group.items.map((item) => {
                          const ItemIcon = ADMIN_ICONS[item.icon];
                          const isActive = currentPage === item.id;
                          return (
                            <a
                              key={item.id}
                              href={`?tab=${item.id}`}
                              onClick={(event) => {
                                event.preventDefault();
                                navigate(item.id);
                              }}
                              aria-current={isActive ? "page" : undefined}
                              className={`group flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left font-display text-xs font-bold tracking-wide transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-1 ${
                                isActive
                                  ? "bg-brand-text text-white shadow-sm"
                                  : "text-brand-text-variant/80 hover:bg-white hover:text-brand-text"
                              }`}
                            >
                              <ItemIcon className={`h-3.5 w-3.5 shrink-0 ${!isActive ? "transition-transform group-hover:scale-110" : ""}`} />
                              <span className="min-w-0 flex-1 whitespace-normal leading-5">{item.label}</span>
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          </>
        ) : activeRole === "tutor" ? (
          <div className="space-y-1" data-testid="tutor-sidebar-menu">
            {TUTOR_SIDEBAR_ENTRIES.map((entry) => {
              if (entry.type === "item") {
                return renderTutorLink(entry);
              }

              const GroupIcon = TUTOR_ICONS[entry.icon];
              const isOpen = openTutorGroupId === entry.id;
              const containsActivePage = entry.items.some((item) => item.id === currentPage);
              const panelId = `tutor-sidebar-group-${entry.id}`;

              return (
                <section key={entry.id} data-contains-active={containsActivePage ? "true" : "false"}>
                  <button
                    type="button"
                    data-tutor-group={entry.id}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpenTutorGroupId((openId) => openId === entry.id ? null : entry.id)}
                    className={`group relative flex w-full items-center gap-3 rounded-xl border-l-4 px-3 py-2.5 text-left font-display transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary focus-visible:ring-offset-2 ${
                      isOpen ? "bg-brand-secondary/10 shadow-sm" : "hover:bg-brand-secondary/10"
                    } ${
                      containsActivePage
                        ? "border-brand-secondary text-brand-secondary"
                        : "border-transparent text-brand-text-variant/85 hover:text-brand-secondary"
                    }`}
                  >
                    <GroupIcon className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1 whitespace-normal text-sm font-black leading-5 tracking-wide">{entry.label}</span>
                    {containsActivePage && !isOpen && (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-secondary" aria-label="Chứa trang hiện tại" />
                    )}
                    <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                  </button>

                  {isOpen && (
                    <div id={panelId} className="ml-5 mt-1 space-y-1 border-l border-brand-secondary/25 pl-2">
                      {entry.items.map((item) => renderTutorLink(item, true))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        ) : navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          const disabled = restrictedTutor && lockedTutorItems.has(item.id);
          let activeClass = "";

          if (isActive) {
            if (activeRole === "staff") {
              activeClass = "bg-white/10 text-white border-l-4 border-[#ff695f]";
            } else {
              activeClass = "bg-brand-text text-white shadow-lg shadow-brand-text/10";
            }
          } else {
            activeClass = isStaff
              ? "text-white/70 hover:bg-white/8 hover:text-white"
              : "text-brand-text-variant/80 hover:bg-brand-container/50 hover:text-brand-text";
          }

          if (disabled) {
            activeClass = "text-brand-text-variant/40 cursor-not-allowed opacity-70";
          }

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (disabled) return;
                navigate(item.id);
              }}
              disabled={disabled}
              aria-disabled={disabled}
              aria-current={isActive ? "page" : undefined}
              title={disabled ? "Hồ sơ gia sư cần được duyệt trước khi sử dụng chức năng này." : undefined}
              className={`group relative flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left font-display text-xs font-bold tracking-wider transition-all ${activeClass}`}
            >
              <Icon className={`h-4 w-4 transition-transform duration-300 ${!isActive && !disabled && "group-hover:scale-110"}`} />
              <span>{item.label}</span>
              {disabled && <Lock className="ml-auto h-3.5 w-3.5" />}
              {isActive && !isStaff && (
                <span className="absolute right-3 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-white" />
              )}
            </button>
          );
        })}
      </nav>

      <div className={`space-y-1 border-t px-3 pb-6 pt-4 select-none ${isStaff ? "border-white/10" : "border-brand-border/20"}`}>
        {activeRole !== "tutor" && (
          <button
            type="button"
            onClick={() => window.location.href = "/"}
            className={`flex w-full items-center gap-3 rounded-xl px-4 py-2 text-left font-display text-xs font-bold tracking-wider transition-all mb-1 ${
              isStaff ? "text-white/80 hover:bg-white/10" : "text-brand-primary hover:bg-brand-primary/10 font-black"
            }`}
          >
            <Globe className="h-4 w-4" />
            <span>Trang chủ tra cứu</span>
          </button>
        )}
        {(activeRole === "tutor" || activeRole === "staff") && (
          <button
            type="button"
            onClick={() => navigate("settings")}
            className={`flex w-full items-center gap-3 rounded-xl px-4 py-2 text-left font-display text-xs font-bold tracking-wider transition-all ${
              isStaff ? "text-white/70 hover:bg-white/8 hover:text-white" : "text-brand-text-variant/80 hover:bg-brand-container/30 hover:text-brand-text"
            }`}
          >
            <Settings className="h-4 w-4" />
            <span>Tài khoản</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => navigate("help")}
          className={`flex w-full items-center gap-3 rounded-xl px-4 py-2 text-left font-display text-xs font-bold tracking-wider transition-all ${
            isStaff ? "text-white/60 hover:bg-white/8 hover:text-white" : "text-brand-text-variant/80 hover:bg-brand-container/30 hover:text-brand-text"
          }`}
        >
          <HelpCircle className="h-4 w-4" />
          <span>Trợ giúp</span>
        </button>
        <button
          type="button"
          onClick={onLogout}
          className={`flex w-full items-center gap-3 rounded-xl px-4 py-2 text-left font-display text-xs font-bold tracking-wider transition-all ${
            isStaff ? "text-white/60 hover:bg-[#ff695f]/15 hover:text-white" : "text-brand-error/80 hover:bg-brand-error/5 hover:text-brand-error"
          }`}
        >
          <LogOut className="h-4 w-4" />
          <span>Đăng xuất</span>
        </button>
      </div>
    </aside>
  </>
  );
}
