/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import {
  LayoutDashboard,
  GraduationCap,
  MessageSquare,
  Calendar,
  Settings,
  Users,
  CheckCircle2,
  BookOpen,
  HelpCircle,
  LogOut,
  PlayCircle,
  BarChart3,
  ShieldAlert,
  ShieldCheck,
  Globe,
  Layers3
} from "lucide-react";
import { UserRole } from "../types";

interface SidebarProps {
  activeRole: UserRole;
  currentPage: string;
  onNavigate: (page: string) => void;
  onStartSession: () => void;
  onLogout: () => void;
}

export function Sidebar({
  activeRole,
  currentPage,
  onNavigate,
  onStartSession,
  onLogout,
}: SidebarProps) {
  const isStaff = activeRole === "staff";

  const getNavItems = () => {
    switch (activeRole) {
      case "tutor":
        return [
          { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
          { id: "my-classes", label: "My Classes", icon: GraduationCap },
          { id: "contracts", label: "Hợp đồng & Ký quỹ", icon: ShieldCheck },
          { id: "requests", label: "Student Requests", icon: CheckCircle2 },
          { id: "messages", label: "Messages", icon: MessageSquare },
          { id: "schedule", label: "Schedule", icon: Calendar },
          { id: "settings", label: "Settings", icon: Settings },
        ];
      case "admin":
        return [
          { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
          { id: "tutor-approval", label: "Tutor Approval", icon: CheckCircle2 },
          { id: "contracts", label: "Hợp đồng Escrow", icon: ShieldCheck },
          { id: "complaints", label: "Phân xử Khiếu nại", icon: ShieldAlert },
          { id: "user-management", label: "User Management", icon: Users },
          { id: "class-management", label: "Class Management", icon: BookOpen },
          { id: "subject-catalog", label: "Quản lý môn học", icon: Layers3 },
          { id: "settings", label: "Settings", icon: Settings },
        ];
      case "staff":
        return [
          { id: "dashboard", label: "Tong quan", icon: LayoutDashboard },
          { id: "tutor-approval", label: "Duyet ho so gia su", icon: CheckCircle2 },
          { id: "complaints", label: "Quan ly khieu nai", icon: ShieldAlert },
          { id: "class-management", label: "Lop / noi dung", icon: BookOpen },
          { id: "reports", label: "Bao cao nghiep vu", icon: BarChart3 },
        ];
      case "student":
      default:
        return [
          { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
          { id: "courses", label: "Courses", icon: BookOpen },
          { id: "contracts", label: "Hợp đồng & Ký quỹ", icon: ShieldCheck },
          { id: "messages", label: "Messages", icon: MessageSquare },
          { id: "schedule", label: "Schedule", icon: Calendar },
          { id: "settings", label: "Settings", icon: Settings },
        ];
    }
  };

  const navItems = getNavItems();

  return (
    <aside className={`fixed left-0 top-16 bottom-0 z-20 flex w-72 select-none flex-col border-r pt-6 font-sans ${
      isStaff ? "border-[#0d466f] bg-[#073554] text-white" : "border-brand-border/30 bg-brand-low/40"
    }`}>
      <div className="mb-6 px-6">
        <div className="flex items-center gap-3">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-md ${
            isStaff ? "bg-[#ff695f] shadow-[#ff695f]/15" : "bg-brand-secondary shadow-brand-secondary/15"
          }`}>
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <p className={`font-display text-title-sm font-black leading-tight ${isStaff ? "text-white" : "text-brand-text"}`}>
              {isStaff ? "TutorConnect" : "EduConnect"}
            </p>
            <p className={`font-display-lg text-[10px] font-extrabold tracking-wider ${isStaff ? "text-white/55" : "text-brand-text-variant/50"}`}>
              {activeRole === "admin"
                ? "ADMIN PORTAL"
                : activeRole === "staff"
                ? "STAFF OPERATIONS"
                : activeRole === "tutor"
                ? "TUTOR PORTAL"
                : "LEARNING PORTAL"}
            </p>
          </div>
        </div>
      </div>

      <nav className="custom-scrollbar flex-1 space-y-1 overflow-y-auto px-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          let activeClass = "";

          if (isActive) {
            if (activeRole === "student") {
              activeClass = "bg-brand-primary text-white shadow-lg shadow-brand-primary/10";
            } else if (activeRole === "tutor") {
              activeClass = "bg-brand-secondary text-white shadow-lg shadow-brand-secondary/10";
            } else if (activeRole === "staff") {
              activeClass = "bg-white/10 text-white border-l-4 border-[#ff695f]";
            } else {
              activeClass = "bg-brand-text text-white shadow-lg shadow-brand-text/10";
            }
          } else {
            activeClass = isStaff
              ? "text-white/70 hover:bg-white/8 hover:text-white"
              : "text-brand-text-variant/80 hover:bg-brand-container/50 hover:text-brand-text";
          }

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`group relative flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left font-display text-xs font-bold tracking-wider transition-all ${activeClass}`}
            >
              <Icon className={`h-4 w-4 transition-transform duration-300 ${!isActive && "group-hover:scale-110"}`} />
              <span>{item.label}</span>
              {isActive && !isStaff && (
                <span className="absolute right-3 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-white" />
              )}
            </button>
          );
        })}
      </nav>

      {!isStaff && (
        <div className="mb-4 px-4 select-none">
          <button
            onClick={onStartSession}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-primary py-3.5 font-display text-xs font-black tracking-widest text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-brand-primary/95 hover:shadow-lg hover:shadow-brand-primary/15 active:translate-y-0 active:scale-98"
          >
            <PlayCircle className="h-4 w-4 text-white" />
            START SESSION
          </button>
        </div>
      )}

      <div className={`space-y-1 border-t px-3 pb-6 pt-4 select-none ${isStaff ? "border-white/10" : "border-brand-border/20"}`}>
        <button
          onClick={() => window.location.href = "/"}
          className={`flex w-full items-center gap-3 rounded-xl px-4 py-2 text-left font-display text-xs font-bold tracking-wider transition-all mb-1 ${
            isStaff ? "text-white/80 hover:bg-white/10" : "text-brand-primary hover:bg-brand-primary/10 font-black"
          }`}
        >
          <Globe className="h-4 w-4" />
          <span>Trang chủ Tra cứu</span>
        </button>
        <button
          onClick={() => onNavigate("help")}
          className={`flex w-full items-center gap-3 rounded-xl px-4 py-2 text-left font-display text-xs font-bold tracking-wider transition-all ${
            isStaff ? "text-white/60 hover:bg-white/8 hover:text-white" : "text-brand-text-variant/80 hover:bg-brand-container/30 hover:text-brand-text"
          }`}
        >
          <HelpCircle className="h-4 w-4" />
          <span>Help Center</span>
        </button>
        <button
          onClick={onLogout}
          className={`flex w-full items-center gap-3 rounded-xl px-4 py-2 text-left font-display text-xs font-bold tracking-wider transition-all ${
            isStaff ? "text-white/60 hover:bg-[#ff695f]/15 hover:text-white" : "text-brand-error/80 hover:bg-brand-error/5 hover:text-brand-error"
          }`}
        >
          <LogOut className="h-4 w-4" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
