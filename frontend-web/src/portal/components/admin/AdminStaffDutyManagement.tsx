import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FilePlus2,
  History,
  RefreshCw,
  Sparkles,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { useFeedback } from "../../../components/feedback/useFeedback";
import { DutyAssignment, ShiftCode, ShiftStatus, WeeklyRoster, staffDutyApi } from "../../../api/staffDutyApi";

const shifts: Array<{ code: ShiftCode; label: string; time: string; icon: string }> = [
  { code: "MORNING", label: "Ca sáng", time: "08:00–12:00", icon: "☀️" },
  { code: "EVENING", label: "Ca tối", time: "18:00–22:00", icon: "🌙" },
];

const statusMeta: Record<ShiftStatus, { label: string; className: string }> = {
  DRAFT: { label: "Bản nháp", className: "border-slate-200 bg-slate-100 text-slate-600" },
  ASSIGNED: { label: "Đã phân công", className: "border-blue-200 bg-blue-50 text-blue-700" },
  CHECKED_IN: { label: "Đang trực", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  COMPLETED: { label: "Hoàn thành", className: "border-slate-200 bg-slate-50 text-slate-600" },
  ABSENT: { label: "Vắng mặt", className: "border-rose-200 bg-rose-50 text-rose-700" },
};

const actionLabels: Record<string, string> = {
  CREATED: "Tạo ca trực",
  AUTO_ASSIGNED: "Thuật toán gợi ý",
  MANUAL_ASSIGNED: "Admin phân công",
  PUBLISHED: "Công bố lịch",
  REASSIGNED: "Thay người trực",
  CHECKED_IN: "Staff nhận ca",
  COMPLETED: "Hoàn thành ca",
  ABSENT: "Ghi nhận vắng",
};

function localIso(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monday(offsetWeeks = 0) {
  const date = new Date();
  const day = date.getDay() || 7;
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - day + 1 + offsetWeeks * 7);
  return localIso(date);
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return localIso(date);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })
    .format(new Date(`${value}T12:00:00`));
}

export function AdminStaffDutyManagement() {
  const feedback = useFeedback();
  const currentWeek = monday();
  const nextWeek = monday(1);
  const today = localIso(new Date());
  const [week, setWeek] = useState(nextWeek);
  const [roster, setRoster] = useState<WeeklyRoster>();
  const [audits, setAudits] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string }>();
  const [selectedAssignment, setSelectedAssignment] = useState<DutyAssignment>();
  const [selectedStaffId, setSelectedStaffId] = useState<number | "">("");
  const [replacementReason, setReplacementReason] = useState("");

  const days = useMemo(() => Array.from({ length: 6 }, (_, index) => addDays(week, index)), [week]);

  const load = async (silent = false) => {
    setBusy(true);
    if (!silent) setMessage(undefined);
    try {
      const [data, auditPage] = await Promise.all([
        staffDutyApi.adminRoster(week),
        staffDutyApi.audits(0, 30).catch(() => ({ content: [] })),
      ]);
      setRoster(data);
      setAudits(Array.isArray((auditPage as any)?.content) ? (auditPage as any).content : []);
    } catch (error: any) {
      setMessage({ tone: "error", text: error?.message || "Không thể tải lịch trực." });
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { load(); }, [week]);

  const assignments = roster?.assignments || [];
  const activeStaff = roster?.activeStaff || [];
  const staffAvailability = roster?.staffAvailability || [];
  const at = (date: string, code: ShiftCode) => assignments.find(item => item.workDate === date && item.shiftCode === code);
  const isAvailable = (staffId: number, date: string, code: ShiftCode) =>
    staffAvailability.some(item => item.staffId === staffId && item.workDate === date && item.shiftCode === code);
  const workload = useMemo(() => {
    const counts = new Map<number, number>();
    assignments.forEach(item => { if (item.staffId) counts.set(item.staffId, (counts.get(item.staffId) || 0) + 1); });
    return counts;
  }, [assignments]);

  const assignedCount = assignments.filter(item => item.staffId).length;
  const vacantCount = Math.max(0, 12 - assignedCount);
  const respondingStaffCount = new Set(staffAvailability.map(item => item.staffId)).size;
  const canPrepare = week > currentWeek && !roster?.published;

  const run = async (action: () => Promise<WeeklyRoster>, success: string) => {
    setBusy(true);
    setMessage(undefined);
    try {
      setRoster(await action());
      setMessage({ tone: "success", text: success });
      const page: any = await staffDutyApi.audits(0, 30).catch(() => ({ content: [] }));
      setAudits(Array.isArray(page?.content) ? page.content : []);
    } catch (error: any) {
      setMessage({ tone: "error", text: error?.message || "Thao tác không thành công." });
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    const confirmed = await feedback.confirm({
      title: "Công bố lịch trực?",
      message: "Sau khi công bố, Staff sẽ nhận thông báo và lịch rảnh không thể chỉnh sửa. Admin vẫn có thể thay người cho ca chưa bắt đầu.",
      confirmText: "Công bố lịch",
      variant: "default",
    });
    if (confirmed) await run(() => staffDutyApi.publish(week), "Đã công bố lịch trực và gửi thông báo cho Staff được phân công.");
  };

  const openAssignment = (assignment: DutyAssignment) => {
    if (!["DRAFT", "ASSIGNED"].includes(assignment.status)) return;
    setSelectedAssignment(assignment);
    setSelectedStaffId(assignment.staffId || "");
    setReplacementReason("");
  };

  const closeAssignment = () => {
    if (busy) return;
    setSelectedAssignment(undefined);
    setSelectedStaffId("");
    setReplacementReason("");
  };

  const saveAssignment = async () => {
    if (!selectedAssignment || !selectedStaffId) return;
    const replacing = selectedAssignment.status === "ASSIGNED";
    if (replacing && !replacementReason.trim()) return;
    setBusy(true);
    setMessage(undefined);
    try {
      if (replacing) {
        await staffDutyApi.replace(selectedAssignment.id, selectedStaffId, replacementReason.trim());
      } else {
        await staffDutyApi.manualAssign(selectedAssignment.id, selectedStaffId);
      }
      setSelectedAssignment(undefined);
      setSelectedStaffId("");
      setReplacementReason("");
      await load(true);
      setMessage({ tone: "success", text: replacing ? "Đã thay người trực và gửi thông báo cho Staff liên quan." : "Đã cập nhật phân công ca trực." });
    } catch (error: any) {
      setMessage({ tone: "error", text: error?.message || "Không thể cập nhật phân công." });
      setBusy(false);
    }
  };

  const sortedStaff = useMemo(() => {
    if (!selectedAssignment) return activeStaff;
    return [...activeStaff].sort((left, right) => {
      const availabilityDifference = Number(isAvailable(right.id, selectedAssignment.workDate, selectedAssignment.shiftCode))
        - Number(isAvailable(left.id, selectedAssignment.workDate, selectedAssignment.shiftCode));
      if (availabilityDifference !== 0) return availabilityDifference;
      const workloadDifference = (workload.get(left.id) || 0) - (workload.get(right.id) || 0);
      return workloadDifference !== 0 ? workloadDifference : left.fullName.localeCompare(right.fullName, "vi");
    });
  }, [activeStaff, selectedAssignment, staffAvailability, workload]);

  const hasOtherShiftSameDay = (staffId: number) => selectedAssignment
    ? assignments.some(item => item.id !== selectedAssignment.id
      && item.staffId === staffId
      && item.workDate === selectedAssignment.workDate
      && ["DRAFT", "ASSIGNED", "CHECKED_IN"].includes(item.status))
    : false;

  return (
    <div className="space-y-5 p-5 sm:p-7">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-600">Admin Operations</p>
          <h1 className="mt-1 text-2xl font-black text-slate-950">Điều phối lịch trực Staff</h1>
          <p className="mt-1 max-w-3xl text-sm font-semibold text-slate-500">
            Thuật toán chỉ tạo gợi ý từ ca rảnh và tải công việc. Admin kiểm tra, điều chỉnh và là người duy nhất công bố lịch.
          </p>
        </div>
        <button type="button" disabled={busy} onClick={() => load()} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 shadow-xs hover:border-indigo-300 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} /> Làm mới
        </button>
      </header>

      {message && <div className={`rounded-xl border px-4 py-3 text-sm font-bold ${message.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-700"}`}>{message.text}</div>}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={<CalendarDays className="h-5 w-5" />} label="Tổng ca trong tuần" value="12 ca" tone="blue" />
        <SummaryCard icon={<UserCheck className="h-5 w-5" />} label="Đã phân công" value={`${assignedCount}/12 ca`} tone="emerald" />
        <SummaryCard icon={<AlertTriangle className="h-5 w-5" />} label="Còn trống" value={`${vacantCount} ca`} tone={vacantCount ? "rose" : "slate"} />
        <SummaryCard icon={<Users className="h-5 w-5" />} label="Staff đã khai báo rảnh" value={`${respondingStaffCount}/${activeStaff.length} người`} tone="indigo" />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-black text-slate-900">Tuần {formatDate(week)} – {formatDate(addDays(week, 5))}</h2>
              <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${roster?.published ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                {roster?.published ? "Đã công bố" : "Bản nháp"}
              </span>
            </div>
            <p className="mt-1 text-xs font-semibold text-slate-500">Bấm vào ca để phân công hoặc thay người. Staff đã đăng ký rảnh luôn được xếp lên đầu.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-0.5 shadow-2xs">
              <button type="button" title="Tuần trước" onClick={() => setWeek(value => addDays(value, -7))} className="grid h-8 w-8 place-items-center rounded-lg text-slate-600 hover:bg-slate-100"><ChevronLeft className="h-4 w-4" /></button>
              <button type="button" onClick={() => setWeek(currentWeek)} className="rounded-lg px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100">Tuần này</button>
              <button type="button" onClick={() => setWeek(nextWeek)} className="rounded-lg px-2.5 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-50">Tuần tới</button>
              <button type="button" title="Tuần sau" onClick={() => setWeek(value => addDays(value, 7))} className="grid h-8 w-8 place-items-center rounded-lg text-slate-600 hover:bg-slate-100"><ChevronRight className="h-4 w-4" /></button>
            </div>
            <button type="button" disabled={busy || assignments.length > 0 || !canPrepare} onClick={() => run(() => staffDutyApi.createDraft(week), "Đã tạo 12 ca trống để Admin phân công.")} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"><FilePlus2 className="h-4 w-4" /> Tạo lịch trống</button>
            <button type="button" disabled={busy || roster?.published || assignments.length === 0 || !canPrepare} onClick={() => run(() => staffDutyApi.autoAssign(week), "Đã cập nhật gợi ý xếp lịch. Admin hãy kiểm tra trước khi công bố.")} className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-40"><Sparkles className="h-4 w-4" /> Gợi ý xếp lịch</button>
            <button type="button" disabled={busy || roster?.published || assignedCount !== 12 || !canPrepare} onClick={publish} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white shadow-xs hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"><CheckCircle2 className="h-4 w-4" /> Công bố</button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto pb-1">
          <div className="grid min-w-[820px] grid-cols-6 gap-3">
            {days.map((date, index) => {
              const isToday = date === today;
              return (
                <article key={date} className={`rounded-2xl border p-3 ${isToday ? "border-indigo-400 bg-indigo-50/40 shadow-xs" : "border-slate-200 bg-white"}`}>
                  <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2">
                    <div><p className={`text-xs font-black ${isToday ? "text-indigo-700" : "text-slate-900"}`}>Thứ {index + 2}</p><p className="text-[11px] font-semibold text-slate-400">{formatDate(date)}</p></div>
                    {isToday && <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[9px] font-black text-white">Hôm nay</span>}
                  </div>
                  <div className="space-y-2">
                    {shifts.map(shift => {
                      const assignment = at(date, shift.code);
                      const availableCount = activeStaff.filter(staff => isAvailable(staff.id, date, shift.code)).length;
                      const meta = assignment ? statusMeta[assignment.status] : null;
                      const editable = assignment && ["DRAFT", "ASSIGNED"].includes(assignment.status);
                      return (
                        <button key={shift.code} type="button" disabled={!editable} onClick={() => assignment && openAssignment(assignment)}
                          className={`min-h-[130px] w-full rounded-xl border p-2.5 text-left transition-all ${assignment?.staffId ? "border-blue-200 bg-blue-50/40" : assignment ? "border-amber-200 bg-amber-50/40" : "border-dashed border-slate-200 bg-slate-50"} ${editable ? "cursor-pointer hover:border-indigo-400 hover:shadow-xs" : "cursor-default"}`}>
                          <div className="flex items-center justify-between gap-1"><span className="text-[11px] font-black text-slate-900"><span className="mr-1">{shift.icon}</span>{shift.label}</span><span className="text-[9px] font-bold text-slate-400">{shift.time}</span></div>
                          {!assignment ? <p className="mt-4 text-[10px] font-bold text-slate-400">Chưa tạo ca</p> : (
                            <>
                              <p className={`mt-3 line-clamp-2 text-[11px] font-black ${assignment.staffName ? "text-slate-900" : "text-amber-700"}`}>{assignment.staffName || "Chưa phân công"}</p>
                              {meta && <span className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black ${meta.className}`}>{meta.label}</span>}
                              <div className="mt-2 border-t border-slate-100 pt-2 text-[9px] font-bold text-slate-500">{availableCount} Staff đăng ký rảnh</div>
                            </>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
        <div className="flex items-center gap-2"><History className="h-4 w-4 text-indigo-600" /><h2 className="text-sm font-black text-slate-900">Lịch sử điều phối gần đây</h2></div>
        {audits.length === 0 ? <p className="mt-4 text-xs font-semibold text-slate-400">Chưa có thay đổi lịch trực.</p> : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead><tr className="border-b text-[10px] uppercase tracking-wider text-slate-500"><th className="p-2">Thời gian</th><th className="p-2">Hành động</th><th className="p-2">Người cũ</th><th className="p-2">Người mới</th><th className="p-2">Người thực hiện</th><th className="p-2">Lý do</th></tr></thead>
              <tbody>{audits.map(item => <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50"><td className="p-2 text-slate-500">{item.createdAt ? new Date(item.createdAt).toLocaleString("vi-VN") : "--"}</td><td className="p-2 font-black text-slate-800">{actionLabels[item.action] || item.action}</td><td className="p-2">{item.previousStaffName || "--"}</td><td className="p-2">{item.newStaffName || "--"}</td><td className="p-2">{item.changedByName || "Hệ thống"}</td><td className="max-w-[240px] p-2 text-slate-600">{item.reason || "--"}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </section>

      {selectedAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs" onMouseDown={event => event.target === event.currentTarget && closeAssignment()}>
          <div role="dialog" aria-modal="true" aria-labelledby="assignment-title" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <header className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
              <div><p className="text-[10px] font-black uppercase tracking-wider text-indigo-600">{selectedAssignment.status === "DRAFT" ? "Phân công ca trực" : "Thay người khẩn cấp"}</p><h3 id="assignment-title" className="mt-1 text-lg font-black text-slate-950">{shifts.find(item => item.code === selectedAssignment.shiftCode)?.label} · {formatDate(selectedAssignment.workDate)}</h3><p className="mt-1 text-xs font-semibold text-slate-500">{shifts.find(item => item.code === selectedAssignment.shiftCode)?.time} · Hiện tại: {selectedAssignment.staffName || "chưa có người"}</p></div>
              <button type="button" title="Đóng" disabled={busy} onClick={closeAssignment} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 disabled:opacity-50"><X className="h-5 w-5" /></button>
            </header>
            <div className="space-y-4 p-5">
              <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-xs font-semibold text-indigo-900">Danh sách ưu tiên Staff đã đăng ký rảnh, sau đó cân bằng theo số ca đang được phân công trong tuần. Admin vẫn là người quyết định cuối cùng.</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {sortedStaff.map(staff => {
                  const available = isAvailable(staff.id, selectedAssignment.workDate, selectedAssignment.shiftCode);
                  const selected = selectedStaffId === staff.id;
                  const occupied = hasOtherShiftSameDay(staff.id);
                  return (
                    <button key={staff.id} type="button" disabled={occupied} onClick={() => setSelectedStaffId(staff.id)} className={`rounded-xl border p-3 text-left transition-all ${selected ? "border-indigo-600 bg-indigo-50 ring-2 ring-indigo-200" : occupied ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-55" : "border-slate-200 hover:border-indigo-300"}`}>
                      <div className="flex items-start justify-between gap-2"><div><p className="text-sm font-black text-slate-900">{staff.fullName}</p><p className="mt-0.5 text-[10px] font-semibold text-slate-500">{staff.email}</p></div>{selected && <span className="grid h-5 w-5 place-items-center rounded-full bg-indigo-600 text-white">✓</span>}</div>
                      <div className="mt-3 flex flex-wrap gap-2"><span className={`rounded-full px-2 py-1 text-[9px] font-black ${available ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{available ? "Đã đăng ký rảnh" : "Ngoài lịch rảnh"}</span><span className="rounded-full bg-blue-50 px-2 py-1 text-[9px] font-black text-blue-700">{workload.get(staff.id) || 0} ca/tuần</span>{occupied && <span className="rounded-full bg-rose-100 px-2 py-1 text-[9px] font-black text-rose-700">Đã có ca trong ngày</span>}</div>
                    </button>
                  );
                })}
              </div>
              {selectedAssignment.status === "ASSIGNED" && (
                <label className="block text-xs font-black text-slate-700">Lý do thay người <span className="text-rose-600">*</span><textarea value={replacementReason} onChange={event => setReplacementReason(event.target.value)} maxLength={1000} rows={3} placeholder="Ví dụ: Nhân viên báo nghỉ đột xuất, đã thống nhất người thay thế..." className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal outline-none focus:border-indigo-500" /></label>
              )}
            </div>
            <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-slate-50 p-4"><button type="button" disabled={busy} onClick={closeAssignment} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 disabled:opacity-50">Hủy</button><button type="button" disabled={busy || !selectedStaffId || (selectedAssignment.status === "ASSIGNED" && !replacementReason.trim()) || selectedStaffId === selectedAssignment.staffId} onClick={saveAssignment} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-black text-white shadow-xs hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300">{busy ? "Đang lưu..." : selectedAssignment.status === "DRAFT" ? "Xác nhận phân công" : "Xác nhận thay người"}</button></footer>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: "blue" | "emerald" | "rose" | "slate" | "indigo" }) {
  const toneClass = tone === "emerald" ? "bg-emerald-50 text-emerald-700" : tone === "rose" ? "bg-rose-50 text-rose-700" : tone === "indigo" ? "bg-indigo-50 text-indigo-700" : tone === "slate" ? "bg-slate-100 text-slate-600" : "bg-blue-50 text-blue-700";
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs"><div className="flex items-center justify-between"><span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</span><span className={`grid h-9 w-9 place-items-center rounded-xl ${toneClass}`}>{icon}</span></div><p className="mt-2 text-xl font-black text-slate-900">{value}</p></div>;
}
