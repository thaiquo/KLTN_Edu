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
  PlayCircle
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
  // Navigation elements conditional on user roles
  const getNavItems = () => {
    switch (activeRole) {
      case "tutor":
        return [
          { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
          { id: "my-classes", label: "My Classes", icon: GraduationCap },
          { id: "requests", label: "Student Requests", icon: CheckCircle2 },
          { id: "messages", label: "Messages", icon: MessageSquare },
          { id: "schedule", label: "Schedule", icon: Calendar },
          { id: "settings", label: "Settings", icon: Settings },
        ];
      case "admin":
        return [
          { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
          { id: "tutor-approval", label: "Tutor Approval", icon: CheckCircle2 },
          { id: "user-management", label: "User Management", icon: Users },
          { id: "class-management", label: "Class Management", icon: BookOpen },
          { id: "settings", label: "Settings", icon: Settings },
        ];
      case "student":
      default:
        return [
          { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
          { id: "courses", label: "Courses", icon: BookOpen },
          { id: "messages", label: "Messages", icon: MessageSquare },
          { id: "schedule", label: "Schedule", icon: Calendar },
          { id: "settings", label: "Settings", icon: Settings },
        ];
    }
  };

  const navItems = getNavItems();

  return (
    <aside className="fixed left-0 top-16 bottom-0 w-72 bg-brand-low/40 border-r border-brand-border/30 flex flex-col pt-6 z-20 select-none font-sans">
      {/* Brand Mini Header */}
      <div className="px-6 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-secondary flex items-center justify-center text-white shadow-md shadow-brand-secondary/15 shrink-0">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <p className="font-display text-title-sm text-brand-text font-black leading-tight">
              EduConnect
            </p>
            <p className="text-[10px] font-display-lg font-extrabold text-brand-text-variant/50 tracking-wider">
              {activeRole === "admin"
                ? "ADMIN PORTAL"
                : activeRole === "tutor"
                ? "TUTOR PORTAL"
                : "LEARNING PORTAL"}
            </p>
          </div>
        </div>
      </div>

      {/* Main Navigation Link Entries */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto custom-scrollbar">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          
          // Custom style based on active element
          let activeClass = "";
          if (isActive) {
            if (activeRole === "student") {
              activeClass = "bg-brand-primary text-white shadow-lg shadow-brand-primary/10";
            } else if (activeRole === "tutor") {
              activeClass = "bg-brand-secondary text-white shadow-lg shadow-brand-secondary/10";
            } else {
              activeClass = "bg-brand-text text-white shadow-lg shadow-brand-text/10";
            }
          } else {
            activeClass = "text-brand-text-variant/80 hover:bg-brand-container/50 hover:text-brand-text";
          }

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-display text-xs font-bold tracking-wider relative group ${activeClass}`}
            >
              <Icon className={`w-4 h-4 transition-transform duration-300 ${!isActive && "group-hover:scale-110"}`} />
              <span>{item.label}</span>
              {isActive && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-white rounded-full"></span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Interactive Quick Call Action Module */}
      <div className="px-4 mb-4 select-none">
        <button
          onClick={onStartSession}
          className="w-full py-3.5 bg-brand-primary text-white rounded-xl font-display font-black text-xs tracking-widest flex items-center justify-center gap-2 hover:bg-brand-primary/95 hover:shadow-lg hover:shadow-brand-primary/15 hover:-translate-y-0.5 active:translate-y-0 active:scale-98 transition-all cursor-pointer shadow-md"
        >
          <PlayCircle className="w-4 h-4 text-white" />
          START SESSION
        </button>
      </div>

      {/* Support Footer Panel */}
      <div className="border-t border-brand-border/20 pt-4 pb-6 px-3 space-y-1 select-none">
        <button
          onClick={() => onNavigate("help")}
          className="w-full flex items-center gap-3 px-4 py-2 hover:bg-brand-container/30 text-brand-text-variant/80 hover:text-brand-text rounded-xl transition-all font-display text-xs font-bold tracking-wider text-left"
        >
          <HelpCircle className="w-4 h-4" />
          <span>Help Center</span>
        </button>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-2 hover:bg-brand-error/5 text-brand-error/80 hover:text-brand-error rounded-xl transition-all font-display text-xs font-bold tracking-wider text-left"
        >
          <LogOut className="w-4 h-4" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
