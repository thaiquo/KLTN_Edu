/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Search,
  HelpCircle,
  BookOpen,
  ShieldCheck,
  WalletCards,
  GraduationCap,
  MessageSquare,
  LayoutDashboard,
  Settings
} from "lucide-react";
import { UserRole } from "../types";
import { NotificationDropdown } from "../../components/notification/NotificationDropdown";

interface HeaderProps {
  activeRole: UserRole;
  user: {
    fullName: string;
    email: string;
  };
  searchValue: string;
  onSearchChange: (value: string) => void;
  currentPage?: string;
  onNavigate?: (page: string) => void;
}

export function Header({
  activeRole,
  user,
  searchValue,
  onSearchChange,
  currentPage,
  onNavigate,
}: HeaderProps) {
  const navigate = useNavigate();

  // Avatars for different roles
  const avatarMap = {
    student:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBYfodNBlGcqTaAKMNzNGEaAOg2AUygYGk8XYUF-_NxGI0SZ75MJgFNJvnmJOrkWem-SdVi53mp7A_Wnz4MmsG2XPHrfEQDt4ZmgHzGQFPvWonX1v39Fb71Q5zdulTudkDaMij4Xw9Q4Y57T8jqjnkI-7mohDZBerRX-WeA0xJNdv_gXWnBJu5hwIMtOWgoxSaYkJWwoQhgaRZss0L-r-SwS2c2dlRlQPWBtoeTCIDIR_sv_jgEgBVf97PjoOk6KVZHKS6VAf0II9GY",
    tutor:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBhwW3n6U0eBWTDne_iulj_Auj40EVPpMpQb_Ty2AmFqUqnCNtOtcugJcmoz3Wqy5667xVuLljO9Q7wnie5Nlxc0xfVQ4EW-BkKrLtK7ulPXjCY2tNCUPRksiYJkTTOuRQi4l12qR7vruVIbGkokyxG2U5HamxYV8xTj2EAiBram-_YsKG4hlqzbt1VQGJIZcsEI-_LymkavkzmdrrbDSNe1lBDVhtMVZJxmhimVQREO5_faCg4la-rGcz9tzLq9zH_bWjSEgA-qwnm",
    admin:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDorJ4qyZIREwslmenco5ww4h0VRgSSNFoXCmlbkX5YQV4zfkBU9R8uwO3h_zUzV3dQnwAwKnelgvSLtMmAu-wVqElbpvZBkcCY8emLnlFN___0WClwM-gopuij--L9ufoma_ZEl84CiEeaAt-I7B98SBpZ-AXMqn1fLROFbb-TkRDfhhagZpFmnJHOmE2IdK0atd1ziPmgUGcPDq1y387vZI34s2955gCXwPjvxE1GBVFtAp7TKNst8Bl0UGsE3OzdAkYPf6Jm4Ir4",
    staff:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80",
  };

  const statusMap = {
    student: "Học viên",
    tutor: "Gia sư",
    staff: "Staff Operations",
    admin: "Quản trị viên",
  };

  const isStudent = activeRole === "student";

  const studentNavItems = [
    { id: "tutors", label: "Tìm gia sư", icon: Search, type: "link", href: "/tutors" },
    { id: "classes", label: "Tìm lớp", icon: BookOpen, type: "link", href: "/classes" },
    { id: "contracts", label: "Hợp đồng của tôi", icon: ShieldCheck, type: "nav" },
    { id: "wallet", label: "Ví của tôi", icon: WalletCards, type: "nav" },
    { id: "dashboard", label: "Lớp học của tôi", icon: LayoutDashboard, type: "nav" },
    { id: "messages", label: "Tin nhắn", icon: MessageSquare, type: "nav" },
  ];

  return (
    <header className="fixed top-0 right-0 left-0 h-16 bg-white border-b border-brand-border/40 z-30 flex items-center justify-between px-6 select-none font-sans">
      <div className="flex items-center gap-6">
        <Link to="/" className="flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-primary to-brand-secondary flex items-center justify-center text-white shadow-md shadow-brand-primary/10">
            <span className="font-display font-black text-xl tracking-tight">E</span>
          </div>
          <div>
            <span className="font-display text-2xl font-black text-brand-primary tracking-tight">
              {activeRole === "staff" ? "TutorConnect" : "EduConnect"}
            </span>
          </div>
        </Link>

        {/* Student Top Header Navigation Links */}
        {isStudent && (
          <nav className="hidden lg:flex items-center gap-1.5 ml-4">
            {studentNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              
              if (item.type === "link") {
                return (
                  <Link
                    key={item.id}
                    to={item.href!}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-brand-primary hover:bg-slate-50 transition-colors"
                  >
                    <Icon className="w-4 h-4 text-slate-400" />
                    <span>{item.label}</span>
                  </Link>
                );
              }

              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate && onNavigate(item.id)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all ${
                    isActive
                      ? "bg-brand-primary text-white shadow-md shadow-brand-primary/20"
                      : "text-slate-700 hover:text-brand-primary hover:bg-slate-50"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-white" : item.id === "contracts" ? "text-emerald-600" : item.id === "wallet" ? "text-indigo-600" : "text-slate-400"}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        )}

        {/* Search Bar for Non-Student or when needed */}
        {!isStudent && (
          <div className="hidden md:flex items-center bg-brand-low rounded-full px-4 py-1.5 gap-2 border border-brand-border/30 focus-within:border-brand-primary/60 transition-colors w-72 lg:w-96">
            <Search className="text-brand-primary w-4 h-4" />
            <input
              type="text"
              className="bg-transparent border-none focus:outline-none focus:ring-0 text-sm font-sans text-brand-text w-full placeholder:text-brand-text-variant/50 outline-none"
              placeholder={
                activeRole === "admin"
                  ? "Search platform logs..."
                  : activeRole === "staff"
                  ? "Tìm kiếm hồ sơ..."
                  : "Search courses, topics, tutors..."
              }
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden lg:flex items-center bg-brand-low px-3 py-1.5 rounded-xl border border-brand-border/20">
          <span className="text-[11px] font-display font-black tracking-widest text-brand-primary uppercase">
            {statusMap[activeRole]}
          </span>
        </div>

        {/* Notifications and Help Buttons */}
        <div className="flex items-center gap-1.5 border-r border-brand-border/30 pr-3">
          <NotificationDropdown userEmail={user.email} />
          <button
            title="Help Desk"
            onClick={() => onNavigate && onNavigate("help")}
            className="p-2 text-brand-text-variant hover:bg-brand-low rounded-full transition-colors"
          >
            <HelpCircle className="w-5 h-5" />
          </button>
        </div>

        {/* User profile block */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="font-bold text-brand-text text-sm leading-tight">
              {user.fullName}
            </p>
            <p className="text-[11px] text-brand-text-variant/60 font-semibold uppercase tracking-wider">
              {user.email}
            </p>
          </div>
          <div className="w-9 h-9 rounded-full ring-2 ring-brand-primary/20 overflow-hidden border border-brand-border/40 select-none bg-brand-low shrink-0 shadow-inner">
            <img
              className="w-full h-full object-cover"
              src={avatarMap[activeRole]}
              alt={user.fullName}
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </div>
    </header>
  );
}
