/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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
  HelpCircle
} from "lucide-react";
import { StudentRequest, ScheduleItem } from "../types";

interface TutorDashboardProps {
  requests: StudentRequest[];
  onAcceptRequest: (id: string) => void;
  onRejectRequest: (id: string) => void;
  schedule: ScheduleItem[];
  onNavigate: (page: string) => void;
}

export function TutorDashboard({
  requests,
  onAcceptRequest,
  onRejectRequest,
  schedule,
  onNavigate,
}: TutorDashboardProps) {
  const pendingRequests = requests.filter((r) => r.status === "pending");
  const [showNotification, setShowNotification] = useState<string | null>(null);

  const handleAction = (id: string, action: "approve" | "reject", name: string) => {
    if (action === "approve") {
      onAcceptRequest(id);
      setShowNotification(`Approved request from ${name}!`);
    } else {
      onRejectRequest(id);
      setShowNotification(`Rejected request from ${name}.`);
    }
    setTimeout(() => {
      setShowNotification(null);
    }, 3000);
  };

  return (
    <div className="space-y-8 select-none font-sans max-w-7xl mx-auto pb-10">
      {/* Toast Alert popups for interactive states */}
      {showNotification && (
        <div className="fixed top-20 right-4 z-50 bg-brand-text text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-white/10 animate-slide-in">
          <Sparkles className="w-5 h-5 text-yellow-400 animate-bounce" />
          <p className="text-xs font-semibold">{showNotification}</p>
        </div>
      )}

      {/* Welcome Header */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="font-display font-black text-2xl md:text-3xl lg:text-4xl text-brand-text tracking-tight">
            Welcome back, Prof. Miller!
          </h2>
          <p className="text-brand-text-variant/80 text-sm mt-1">
            You have{" "}
            <span className="text-brand-secondary font-bold">
              {pendingRequests.length}
            </span>{" "}
            pending student requests to review today.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => alert("Downloading CSV of weekly analytics summary...")}
            className="px-4 py-2 bg-white border border-brand-border/45 hover:bg-brand-low rounded-xl text-brand-text font-bold text-xs flex items-center gap-2 hover:-translate-y-0.5 active:translate-y-0 transition-all shadow-sm"
          >
            <Download className="w-4 h-4 text-brand-text-variant" />
            Export Report
          </button>
          <button
            onClick={() => onNavigate("schedule")}
            className="px-4 py-2 bg-brand-secondary text-white hover:bg-brand-secondary-hover rounded-xl font-bold text-xs flex items-center gap-2 hover:shadow-lg hover:shadow-brand-secondary/15 hover:-translate-y-0.5 active:translate-y-0 transition-all shadow-md"
          >
            <Calendar className="w-4 h-4" />
            Manage Schedule
          </button>
        </div>
      </section>

      {/* Stats Cards Section */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Stat Card 1: Total Students */}
        <div className="glass-card p-6 rounded-2xl flex flex-col justify-between shadow-sm relative group hover:border-brand-primary/50 transition-colors duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-brand-primary/10 flex items-center justify-center text-brand-primary">
              <Users className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              +12%
            </span>
          </div>
          <div>
            <p className="text-4xl font-display font-black text-brand-text">24</p>
            <p className="text-[11px] font-bold uppercase tracking-wider text-brand-text-variant/50 mt-1">
              Total Students
            </p>
          </div>
        </div>

        {/* Stat Card 2: Active Classes */}
        <div className="glass-card p-6 rounded-2xl flex flex-col justify-between shadow-sm relative hover:border-brand-secondary/50 transition-colors duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-brand-secondary/10 flex items-center justify-center text-brand-secondary">
              <BookOpen className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-bold text-brand-primary bg-brand-primary/5 px-2.5 py-1 rounded-full">
              Steady
            </span>
          </div>
          <div>
            <p className="text-4xl font-display font-black text-brand-text">5</p>
            <p className="text-[11px] font-bold uppercase tracking-wider text-brand-text-variant/50 mt-1">
              Active Classes
            </p>
          </div>
        </div>

        {/* Stat Card 3: Pending Requests with blink notification style */}
        <div className="glass-card p-6 rounded-2xl border-brand-secondary/30 ring-4 ring-brand-secondary/5 ring-inset flex flex-col justify-between shadow-sm relative hover:border-brand-secondary/60 transition-colors duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-brand-error/10 flex items-center justify-center text-brand-error">
              <AlertCircle className="w-6 h-6" />
            </div>
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-error opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand-error"></span>
            </span>
          </div>
          <div>
            <p className="text-4xl font-display font-black text-brand-text">
              {pendingRequests.length}
            </p>
            <p className="text-[11px] font-bold uppercase tracking-wider text-brand-text-variant/50 mt-1">
              Pending Requests
            </p>
          </div>
        </div>

        {/* Stat Card 4: Total Earnings */}
        <div className="glass-card p-6 rounded-2xl flex flex-col justify-between shadow-sm relative hover:border-brand-tertiary/50 transition-colors duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600 font-bold text-xl">
              $
            </div>
            <span className="text-[10px] font-bold text-brand-primary bg-brand-primary/5 px-2.5 py-1 rounded-full">
              +$450 this week
            </span>
          </div>
          <div>
            <p className="text-4xl font-display font-black text-brand-text">$1,200</p>
            <p className="text-[11px] font-bold uppercase tracking-wider text-brand-text-variant/50 mt-1">
              Total Earnings
            </p>
          </div>
        </div>
      </section>

      {/* Bento Layout content columns */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Recent Student Requests Table Panel */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-brand-border/30 overflow-hidden flex flex-col shadow-sm">
          <div className="p-6 border-b border-brand-border/20 flex items-center justify-between">
            <h3 className="font-display font-black text-base text-brand-text">
              Recent Student Requests
            </h3>
            <button
              onClick={() => onNavigate("requests")}
              className="text-brand-primary hover:text-brand-primary/80 text-xs font-bold font-display"
            >
              View All
            </button>
          </div>

          <div className="overflow-x-auto">
            {pendingRequests.length === 0 ? (
              <div className="p-12 text-center text-brand-text-variant/60 flex flex-col items-center justify-center gap-2">
                <Sparkles className="w-8 h-8 text-yellow-400" />
                <p className="text-sm font-bold">All student requests processed!</p>
                <p className="text-xs">Take a well-deserved breaks or check schedule updates.</p>
              </div>
            ) : (
              <table className="w-full text-left">
                <thead className="bg-brand-low text-brand-text-variant/60 font-display text-[10px] font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Student Name</th>
                    <th className="px-6 py-4">Subject</th>
                    <th className="px-6 py-4">Requested Date</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border/10 font-sans">
                  {pendingRequests.map((request) => (
                    <tr
                      key={request.id}
                      className="hover:bg-brand-low/40 transition-colors animate-fade-in"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-full ${request.avatarColor} flex items-center justify-center text-xs font-bold font-display text-white shadow-sm shrink-0`}
                          >
                            {request.avatarChar}
                          </div>
                          <span className="font-semibold text-brand-text text-sm">
                            {request.studentName}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-brand-text-variant">
                        {request.subject}
                      </td>
                      <td className="px-6 py-4 text-sm text-brand-text-variant/80">
                        {request.requestedDate}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2.5">
                          <button
                            onClick={() =>
                              handleAction(request.id, "reject", request.studentName)
                            }
                            className="p-1.5 text-brand-error hover:bg-brand-error/10 rounded-xl transition-colors shrink-0"
                            title="Reject"
                          >
                            <X className="w-4 h-4 shrink-0" />
                          </button>
                          <button
                            onClick={() =>
                              handleAction(request.id, "approve", request.studentName)
                            }
                            className="p-1.5 text-brand-primary hover:bg-brand-primary/10 rounded-xl transition-colors shrink-0"
                            title="Approve"
                          >
                            <Check className="w-4 h-4 shrink-0 font-black" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right Column: Today's Schedule Card */}
        <div className="bg-white rounded-3xl border border-brand-border/30 overflow-hidden flex flex-col shadow-sm">
          <div className="p-6 border-b border-brand-border/20 flex items-center justify-between">
            <h3 className="font-display font-black text-base text-brand-text">
              Today's Schedule
            </h3>
            <span className="text-[11px] font-black font-display tracking-widest text-brand-text-variant/60 uppercase">
              Oct 23
            </span>
          </div>

          <div className="p-4 space-y-4 flex-1 overflow-y-auto">
            {schedule.map((item) => {
              const isActive = item.status === "active";
              const isVirtual = item.detailType === "virtual";

              let cardBg = "bg-brand-low border-l-4 border-brand-text-variant/50 opacity-60";
              let timeColor = "text-brand-text-variant/60";
              
              if (isActive) {
                if (isVirtual) {
                  cardBg = "bg-brand-secondary/5 border-l-4 border-brand-secondary shadow-sm shadow-brand-secondary/5";
                  timeColor = "text-brand-secondary";
                } else {
                  cardBg = "bg-brand-primary/5 border-l-4 border-brand-primary shadow-sm shadow-brand-primary/5";
                  timeColor = "text-brand-primary";
                }
              }

              return (
                <div
                  key={item.id}
                  className={`flex gap-4 p-4 rounded-2xl transition-all duration-300 hover:scale-[1.01] ${cardBg}`}
                >
                  <div className="text-center min-w-[50px] border-r border-brand-border/10 pr-2">
                    <p className={`font-display text-sm font-black ${timeColor}`}>
                      {item.time}
                    </p>
                    <p className="text-[9px] font-black text-brand-text-variant/60 uppercase select-none font-display">
                      {item.period}
                    </p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-brand-text text-sm truncate">
                      {item.title}
                    </p>
                    <p className="text-xs text-brand-text-variant/75 flex items-center gap-1 mt-1 font-semibold truncate">
                      {item.detailType === "students" && (
                        <User className="w-3.5 h-3.5 text-brand-text-variant/60" />
                      )}
                      {item.detailType === "virtual" && (
                        <Video className="w-3.5 h-3.5 text-brand-text-variant/60" />
                      )}
                      {item.detailType === "location" && (
                        <MapPin className="w-3.5 h-3.5 text-brand-text-variant/60" />
                      )}
                      {item.detailValue}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-4 bg-brand-low border-t border-brand-border/20 rounded-b-3xl">
            <button
              onClick={() => onNavigate("schedule")}
              className="w-full py-2.5 bg-white border border-brand-border/40 hover:bg-brand-primary/5 text-brand-primary font-bold text-xs tracking-wider rounded-xl transition-all active:scale-98 relative shadow-sm"
            >
              OPEN FULL CALENDAR
            </button>
          </div>
        </div>
      </section>

      {/* Hero Quick Ad Action Blocks */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Grow Student base banner */}
        <div className="bg-brand-low/50 p-8 rounded-3xl border border-brand-border/20 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="z-10 flex-1">
            <h4 className="text-lg font-display font-black text-brand-text mb-2">
              Grow your student base
            </h4>
            <p className="text-brand-text-variant text-sm mb-4">
              Complete your advanced profile to show up in the top 5% of searches. Set up flexible hourly rates.
            </p>
            <button
              onClick={() => onNavigate("settings")}
              className="px-6 py-2 bg-brand-text text-white text-xs font-bold rounded-xl hover:bg-brand-text/95 transition-all cursor-pointer shadow-md"
            >
              Update Profile
            </button>
          </div>
          <div className="absolute right-4 bottom-4 w-32 h-32 bg-brand-primary/10 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-700"></div>
          <Sparkles className="w-20 h-20 absolute -right-3 text-brand-primary/5 rotate-12 group-hover:rotate-0 transition-transform duration-500 shrink-0 pointer-events-none" />
        </div>

        {/* Assistance Help center block */}
        <div className="p-8 rounded-3xl bg-brand-secondary text-white relative overflow-hidden group hover:shadow-lg hover:shadow-brand-secondary/15 transition-all">
          <div className="relative z-10 flex flex-col h-full justify-between">
            <div>
              <h4 className="text-lg font-display font-black mb-2 flex items-center gap-2">
                Need assistance?
              </h4>
              <p className="opacity-80 text-sm mb-6">
                Our tutor support team is available 24/7 to help with platform navigation, scheduling details, or student billing issues.
              </p>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => alert("Connecting to live chat agent...")}
                className="px-5 py-2.5 bg-white text-brand-secondary rounded-xl text-xs font-bold hover:bg-opacity-95 active:scale-95 transition-all shadow-md cursor-pointer"
              >
                Live Chat
              </button>
              <button
                onClick={() => alert("Opening developer and tutor guides...")}
                className="px-5 py-2.5 border border-white/40 text-white rounded-xl text-xs font-bold hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
              >
                Documentation
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
