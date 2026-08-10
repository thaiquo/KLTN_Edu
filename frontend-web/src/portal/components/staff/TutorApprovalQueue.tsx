import React from "react";
import { Eye, Search } from "lucide-react";
import { TutorApprovalItem } from "../../types";
import { TutorStatusBadge } from "./TutorStatusBadge";

function formatDate(value?: string) {
  if (!value) return "--";
  return new Date(value).toLocaleDateString("vi-VN");
}

export function TutorApprovalQueue({
  tutors,
  selectedTutorId,
  search,
  subjectFilter,
  sort,
  onSearchChange,
  onSubjectFilterChange,
  onSortChange,
  onSelectTutor,
}: {
  tutors: TutorApprovalItem[];
  selectedTutorId?: number;
  search: string;
  subjectFilter: string;
  sort: string;
  onSearchChange: (value: string) => void;
  onSubjectFilterChange: (value: string) => void;
  onSortChange: (value: string) => void;
  onSelectTutor: (tutor: TutorApprovalItem) => void;
}) {
  const subjectOptions = Array.from(
    new Set(tutors.flatMap((tutor) => tutor.subjects.map((subject) => subject.name)))
  ).sort((a, b) => a.localeCompare(b));

  return (
    <section className="border border-[#d7dde6] bg-white shadow-sm">
      <header className="border-b border-[#e4e8ee] p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ff695f]">Tutor Approval Queue</p>
            <h2 className="mt-1 font-display text-xl font-black text-[#073554]">Hang doi duyet ho so</h2>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_180px_150px]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Tim theo ten Tutor..."
                className="h-10 w-full border border-[#d7dde6] bg-[#f7f9fc] pl-9 pr-3 text-xs font-semibold outline-none focus:border-[#ff695f]"
              />
            </label>

            <select
              value={subjectFilter}
              onChange={(event) => onSubjectFilterChange(event.target.value)}
              className="h-10 border border-[#d7dde6] bg-[#f7f9fc] px-3 text-xs font-bold text-[#073554] outline-none focus:border-[#ff695f]"
            >
              <option value="">Tat ca mon</option>
              {subjectOptions.map((subject) => (
                <option key={subject} value={subject}>{subject}</option>
              ))}
            </select>

            <select
              value={sort}
              onChange={(event) => onSortChange(event.target.value)}
              className="h-10 border border-[#d7dde6] bg-[#f7f9fc] px-3 text-xs font-bold text-[#073554] outline-none focus:border-[#ff695f]"
            >
              <option value="newest">Moi nhat</option>
              <option value="oldest">Cho lau nhat</option>
            </select>
          </div>
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="min-w-[760px] w-full text-left">
          <thead className="bg-[#f7f9fc] text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
            <tr>
              <th className="px-5 py-4">Tutor</th>
              <th className="px-5 py-4">Subjects</th>
              <th className="px-5 py-4">Experience</th>
              <th className="px-5 py-4">Submitted Date</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#edf0f4]">
            {tutors.map((tutor) => {
              const selected = tutor.id === selectedTutorId;
              return (
                <tr key={tutor.id} className={selected ? "bg-[#fff1ef]" : "hover:bg-[#f9fbfd]"}>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 place-items-center bg-[#073554] font-display text-sm font-black text-white">
                        {tutor.fullName.split(" ").slice(-2).map((part) => part[0]).join("").toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-black text-[#073554]">{tutor.fullName}</p>
                        <p className="text-xs font-semibold text-slate-500">{tutor.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex max-w-[230px] flex-wrap gap-1.5">
                      {tutor.subjects.slice(0, 3).map((subject) => (
                        <span key={subject.id} className="bg-[#eff4f8] px-2 py-1 text-[10px] font-bold text-[#073554]">{subject.name}</span>
                      ))}
                      {tutor.subjects.length > 3 && <span className="px-2 py-1 text-[10px] font-bold text-slate-500">+{tutor.subjects.length - 3}</span>}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-xs font-bold text-slate-600">{tutor.experienceYears} years</td>
                  <td className="px-5 py-4 text-xs font-bold text-slate-600">{formatDate(tutor.createdAt)}</td>
                  <td className="px-5 py-4"><TutorStatusBadge status={tutor.status} /></td>
                  <td className="px-5 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => onSelectTutor(tutor)}
                      className="inline-flex items-center gap-2 bg-[#073554] px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-white hover:bg-[#0b456c]"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {tutors.length === 0 && (
        <div className="px-6 py-14 text-center">
          <p className="font-display text-sm font-black text-[#073554]">Khong co ho so gia su dang cho duyet.</p>
          <p className="mt-2 text-xs font-semibold text-slate-500">Khi Tutor gui ho so moi, danh sach se hien thi tai day.</p>
        </div>
      )}
    </section>
  );
}
