import React, { useState } from "react";
import {
  Download,
  Calendar,
  Users,
  BookOpen,
  AlertCircle,
  TrendingUp,
  X,
  Check,
  User,
  Video,
  MapPin,
  Sparkles,
  HelpCircle,
  ChevronRight
} from "lucide-react";
import { StudentRequest, ScheduleItem } from "../types";

interface TutorDashboardProps {
  userName: string;
  requests: StudentRequest[];
  onAcceptRequest: (id: string) => void;
  onRejectRequest: (id: string) => void;
  schedule: ScheduleItem[];
  onNavigate: (page: string) => void;
}

export function TutorDashboard({
  userName,
  requests,
  onAcceptRequest,
  onRejectRequest,
  schedule,
  onNavigate,
}: TutorDashboardProps) {
  const [showNotification, setShowNotification] = useState<string | null>(null);

  const pendingRequests = requests.filter((r) => r.status === "pending");

  const handleAccept = (id: string) => {
    onAcceptRequest(id);
    setShowNotification("Đã chấp nhận yêu cầu học");
    setTimeout(() => {
      setShowNotification(null);
    }, 3000);
  };

  const handleReject = (id: string) => {
    onRejectRequest(id);
    setShowNotification("Đã từ chối yêu cầu học");
    setTimeout(() => {
      setShowNotification(null);
    }, 3000);
  };

  return (
    <div className="space-y-8 select-none font-sans max-w-7xl mx-auto pb-10">
      {/* Toast Alert popups for interactive states */}
      {showNotification && (
        <div className="fixed top-20 right-4 z-50 bg-[#0F172A] text-white px-5 py-3 rounded-lg shadow-xl flex items-center gap-3 border border-white/10 animate-slide-in">
          <Sparkles className="w-5 h-5 text-yellow-400" />
          <p className="text-sm font-semibold">{showNotification}</p>
        </div>
      )}

      {/* Welcome Header */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-[#0F172A] tracking-tight">
            Chào mừng trở lại, {userName}!
          </h2>
          <p className="text-slate-500 text-[15px] mt-1 font-medium">
            Bạn có{" "}
            <span className="text-blue-600 font-bold">
              {pendingRequests.length}
            </span>{" "}
            yêu cầu học mới và{" "}
            <span className="text-blue-600 font-bold">
              {schedule.length}
            </span>{" "}
            lịch dạy trong hôm nay.
          </p>
        </div>
        <button
          onClick={() => onNavigate("class-management")}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-[14px] font-bold hover:bg-blue-700 transition-colors shadow-sm shrink-0 inline-flex items-center gap-2"
        >
          Quản lý lớp học <ChevronRight size={16} />
        </button>
      </section>

      {/* KPI Stats */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          {
            title: "Lớp học đang dạy",
            value: "03",
            trend: "+1",
            icon: BookOpen,
            color: "text-blue-600",
            bg: "bg-blue-50",
          },
          {
            title: "Học viên",
            value: "14",
            trend: "+2",
            icon: Users,
            color: "text-emerald-600",
            bg: "bg-emerald-50",
          },
          {
            title: "Giờ dạy tuần này",
            value: "28.5",
            trend: "+5.0",
            icon: Calendar,
            color: "text-purple-600",
            bg: "bg-purple-50",
          },
          {
            title: "Thu nhập dự kiến",
            value: "15M",
            trend: "+12%",
            icon: TrendingUp,
            color: "text-amber-600",
            bg: "bg-amber-50",
          },
        ].map((stat, idx) => (
          <div
            key={idx}
            className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-colors cursor-default"
          >
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-lg \${stat.bg} \${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <span className="inline-flex items-center text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md text-[11px] font-bold">
                {stat.trend}
              </span>
            </div>
            <div>
              <p className="text-slate-500 text-sm font-medium">{stat.title}</p>
              <h3 className="text-2xl font-bold text-[#0F172A] mt-1">{stat.value}</h3>
            </div>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-8">
          {/* Pending Requests Section */}
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-[#0F172A] text-lg flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-blue-600" /> Yêu cầu học mới
              </h3>
              <button
                onClick={() => onNavigate("requests")}
                className="text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors"
              >
                Xem tất cả
              </button>
            </div>
            <div className="p-6">
              {pendingRequests.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="w-8 h-8 text-slate-400" />
                  </div>
                  <p className="text-slate-600 font-medium">Không có yêu cầu học nào đang chờ duyệt.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingRequests.map((req) => (
                    <div
                      key={req.id}
                      className="group flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-5 border border-slate-100 rounded-xl hover:border-blue-100 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-sm ${req.avatarColor}`}
                        >
                          {req.avatarChar}
                        </div>
                        <div>
                          <p className="font-bold text-[#0F172A] text-[15px]">
                            {req.studentName}
                          </p>
                          <p className="text-sm text-slate-500 font-medium mt-0.5">
                            {req.subject}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                          onClick={() => handleAccept(req.id)}
                          className="flex-1 sm:flex-none inline-flex justify-center items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition-colors"
                        >
                          <Check className="w-4 h-4" /> Chấp nhận
                        </button>
                        <button
                          onClick={() => handleReject(req.id)}
                          className="flex-1 sm:flex-none inline-flex justify-center items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-bold transition-colors"
                        >
                          <X className="w-4 h-4" /> Từ chối
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Sidebar Widgets */}
        <div className="space-y-8">
          {/* Today's Schedule */}
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-[#0F172A] text-[16px] flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" /> Lịch dạy hôm nay
              </h3>
            </div>
            <div className="p-5">
              {schedule.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-6 font-medium">
                  Bạn không có lịch dạy nào hôm nay.
                </p>
              ) : (
                <div className="space-y-3">
                  {schedule.map((item) => {
                    let cardBg = "bg-white border border-slate-100";
                    let timeColor = "text-[#0F172A]";
                    if (item.status === "past") {
                      cardBg = "bg-slate-50 border-transparent opacity-60 grayscale";
                      timeColor = "text-slate-400";
                    } else if (item.status === "active") {
                      cardBg = "bg-blue-50/50 border border-blue-100 shadow-sm";
                      timeColor = "text-blue-600";
                    }

                    return (
                      <div
                        key={item.id}
                        className={`flex gap-3 p-3.5 rounded-xl transition-all ${cardBg}`}
                      >
                        <div className="text-center min-w-[48px] border-r border-slate-200/60 pr-3 flex flex-col justify-center">
                          <p className={`text-sm font-bold ${timeColor}`}>
                            {item.time}
                          </p>
                          {item.period && (
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              {item.period}
                            </p>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 pl-1">
                          <p className="font-bold text-[#0F172A] text-[13px] truncate">
                            {item.title}
                          </p>
                          <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-1 font-medium truncate">
                            {item.detailType === "students" && (
                              <User className="w-3.5 h-3.5 text-slate-400" />
                            )}
                            {item.detailType === "virtual" && (
                              <Video className="w-3.5 h-3.5 text-blue-400" />
                            )}
                            {item.detailType === "location" && (
                              <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                            )}
                            {item.detailValue}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Helper Card */}
          <section className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-6 text-white shadow-md relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-blue-200" /> Cần trợ giúp?
              </h3>
              <p className="text-blue-100 text-sm mb-5 leading-relaxed font-medium">
                Tìm hiểu thêm về cách tối ưu hóa thu nhập và quản lý lớp học hiệu quả trên EduConnect.
              </p>
              <button
                onClick={() => onNavigate("help")}
                className="w-full py-2.5 bg-white text-blue-700 rounded-lg text-sm font-bold shadow-sm hover:bg-blue-50 transition-colors"
              >
                Xem hướng dẫn
              </button>
            </div>
            {/* Decoration */}
            <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
            <div className="absolute -left-6 -top-6 w-24 h-24 bg-blue-400/20 rounded-full blur-xl"></div>
          </section>
        </div>
      </div>
    </div>
  );
}
