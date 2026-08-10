import React from "react";
import { CalendarDays, FileText, GraduationCap, Mail, UserRoundCheck } from "lucide-react";
import { TutorApprovalItem } from "../../types";
import { TutorStatusBadge } from "./TutorStatusBadge";

function formatDate(value?: string) {
  if (!value) return "--";
  return new Date(value).toLocaleDateString("vi-VN");
}

export function TutorDetailPanel({
  tutor,
  busy,
  onApprove,
  onReject,
}: {
  tutor?: TutorApprovalItem;
  busy: boolean;
  onApprove: (tutor: TutorApprovalItem) => void;
  onReject: (tutor: TutorApprovalItem) => void;
}) {
  if (!tutor) {
    return (
      <aside className="border border-dashed border-[#d7dde6] bg-white p-8 text-center shadow-sm">
        <UserRoundCheck className="mx-auto h-10 w-10 text-slate-300" />
        <p className="mt-4 font-display text-sm font-black text-[#073554]">Chon mot ho so Tutor</p>
        <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">Thong tin chi tiet, mon dang ky va hanh dong duyet se hien thi tai day.</p>
      </aside>
    );
  }

  const initials = tutor.fullName
    .split(" ")
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <aside className="sticky top-24 border border-[#d7dde6] bg-white shadow-sm">
      <div className="border-b border-[#e4e8ee] p-6">
        <div className="flex items-start gap-4">
          <div className="grid h-20 w-20 flex-none place-items-center bg-[#073554] font-display text-2xl font-black text-white">
            {initials}
          </div>
          <div className="min-w-0">
            <h3 className="truncate font-display text-xl font-black text-[#073554]">{tutor.fullName}</h3>
            <p className="mt-1 flex items-center gap-2 text-xs font-semibold text-slate-500">
              <Mail className="h-3.5 w-3.5" />
              {tutor.email}
            </p>
            <div className="mt-3">
              <TutorStatusBadge status={tutor.status} />
            </div>
          </div>
        </div>
      </div>

      <div className="max-h-[calc(100vh-300px)] space-y-5 overflow-y-auto p-6 custom-scrollbar">
        <section>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Education</p>
          <p className="mt-2 flex gap-2 text-sm font-bold leading-6 text-[#073554]">
            <GraduationCap className="mt-0.5 h-4 w-4 flex-none text-[#ff695f]" />
            {tutor.education || "Chua cap nhat"}
          </p>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <div className="bg-[#f7f9fc] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Experience</p>
            <strong className="mt-2 block font-display text-xl font-black text-[#073554]">{tutor.experienceYears} years</strong>
          </div>
          <div className="bg-[#f7f9fc] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Submitted</p>
            <strong className="mt-2 flex items-center gap-2 text-xs font-black text-[#073554]">
              <CalendarDays className="h-4 w-4 text-[#ff695f]" />
              {formatDate(tutor.createdAt)}
            </strong>
          </div>
        </section>

        <section>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Teaching Subjects</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {tutor.subjects.map((subject) => (
              <span key={subject.id} className="border border-[#d7dde6] bg-[#eff4f8] px-3 py-1.5 text-xs font-black text-[#073554]">{subject.name}</span>
            ))}
          </div>
        </section>

        <section>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Bio</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{tutor.bio || "Tutor chua nhap bio."}</p>
        </section>

        <section>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Certificates / Documents</p>
          <div className="mt-3 space-y-2">
            {tutor.documents?.length ? tutor.documents.map((document) => (
              <a key={document.id} href={document.url || "#"} className="flex items-center gap-3 border border-[#d7dde6] p-3 text-xs font-bold text-[#073554] hover:border-[#ff695f]">
                <FileText className="h-4 w-4 text-[#ff695f]" />
                {document.name}
              </a>
            )) : (
              <p className="border border-dashed border-[#d7dde6] p-3 text-xs font-semibold text-slate-500">Chua co tai lieu dinh kem.</p>
            )}
          </div>
        </section>
      </div>

      <footer className="grid grid-cols-2 gap-3 border-t border-[#e4e8ee] p-5">
        <button
          type="button"
          disabled={busy}
          onClick={() => onReject(tutor)}
          className="border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-rose-700 hover:bg-rose-100 disabled:opacity-50"
        >
          Reject
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onApprove(tutor)}
          className="bg-[#ff695f] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-white hover:bg-[#ef5c52] disabled:opacity-50"
        >
          Approve
        </button>
      </footer>
    </aside>
  );
}
