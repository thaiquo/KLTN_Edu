import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarCheck2,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Pencil,
  PlayCircle,
  RotateCcw,
  Save,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  DutySlot,
  DutyStatus,
  ShiftCode,
  ShiftStatus,
  WeeklyRoster,
  staffDutyApi,
} from "../../../api/staffDutyApi";

const shifts: Array<{ code: ShiftCode; label: string; time: string; icon: string }> = [
  { code: "MORNING", label: "Ca ngày", time: "08:00–15:00", icon: "☀️" },
  { code: "EVENING", label: "Ca chiều–tối", time: "15:00–22:00", icon: "🌙" },
];

const statusMeta: Record<ShiftStatus, { label: string; className: string }> = {
  DRAFT: { label: "Bản nháp", className: "border-slate-200 bg-slate-100 text-slate-600" },
  ASSIGNED: { label: "Đã phân công", className: "border-blue-200 bg-blue-50 text-blue-700" },
  CHECKED_IN: { label: "Đang trực", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  COMPLETED: { label: "Hoàn thành", className: "border-slate-200 bg-slate-50 text-slate-600" },
  ABSENT: { label: "Vắng mặt", className: "border-rose-200 bg-rose-50 text-rose-700" },
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

function shiftWeek(value: string, amount: number) {
  return addDays(value, amount * 7);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })
    .format(new Date(`${value}T12:00:00`));
}

function slotKey(date: string, code: ShiftCode) {
  return `${date}:${code}`;
}

function isSundayInDutyZone(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "Asia/Bangkok",
  }).format(date) === "Sun";
}

export function StaffMyDutyRosterView() {
  const currentWeek = monday();
  const nextWeek = monday(1);
  const today = localIso(new Date());
  const [view, setView] = useState<"ROSTER" | "AVAILABILITY">("ROSTER");
  const [week, setWeek] = useState(currentWeek);
  const [roster, setRoster] = useState<WeeklyRoster>();
  const [dutyStatus, setDutyStatus] = useState<DutyStatus>();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [savedSelection, setSavedSelection] = useState<Set<string>>(new Set());
  const [editingAvailability, setEditingAvailability] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string }>();

  const load = async (value = week) => {
    setLoading(true);
    setMessage(undefined);
    try {
      const [data, status] = await Promise.all([
        staffDutyApi.myRoster(value),
        staffDutyApi.status().catch(() => undefined),
      ]);
      const availability = new Set(data.availability.map(slot => slotKey(slot.workDate, slot.shiftCode)));
      setRoster(data);
      setSelected(availability);
      setSavedSelection(new Set(availability));
      setDutyStatus(status);
      const editable = data.availabilityEditable ?? (!data.published && !isSundayInDutyZone());
      setEditingAvailability(editable && availability.size === 0);
    } catch (error: any) {
      setMessage({ tone: "error", text: error?.message || "Không thể tải lịch trực." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [week]);

  const days = useMemo(() => Array.from({ length: 6 }, (_, index) => addDays(week, index)), [week]);
  const assignments = roster?.assignments || [];
  const assignmentAt = (date: string, code: ShiftCode) =>
    assignments.find(item => item.workDate === date && item.shiftCode === code);
  const isAvailabilityView = view === "AVAILABILITY";
  const availabilityClosed = isSundayInDutyZone() || roster?.availabilityEditable === false;
  const selectionChanged = useMemo(() => {
    if (selected.size !== savedSelection.size) return true;
    return Array.from(selected).some(key => !savedSelection.has(key));
  }, [savedSelection, selected]);

  const openRoster = () => {
    setView("ROSTER");
    setWeek(currentWeek);
  };

  const openAvailability = () => {
    setView("AVAILABILITY");
    setWeek(nextWeek);
  };

  const toggle = (date: string, code: ShiftCode) => {
    if (!editingAvailability || roster?.published || availabilityClosed) return;
    const key = slotKey(date, code);
    setSelected(previous => {
      const next = new Set(previous);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const cancelEditing = () => {
    setSelected(new Set(savedSelection));
    setEditingAvailability(false);
  };

  const save = async () => {
    const slots: DutySlot[] = Array.from(selected).map(key => {
      const [workDate, shiftCode] = key.split(":");
      return { workDate, shiftCode: shiftCode as ShiftCode };
    });
    setLoading(true);
    try {
      const data = await staffDutyApi.submitAvailability(nextWeek, slots);
      const availability = new Set(data.availability.map(slot => slotKey(slot.workDate, slot.shiftCode)));
      setRoster(data);
      setSelected(availability);
      setSavedSelection(new Set(availability));
      setEditingAvailability(false);
      setMessage({ tone: "success", text: "Đã lưu ca rảnh tuần tới. Admin sẽ dùng dữ liệu này để tham khảo khi xếp lịch." });
    } catch (error: any) {
      setMessage({ tone: "error", text: error?.message || "Không thể lưu ca rảnh." });
    } finally {
      setLoading(false);
    }
  };

  const start = async () => {
    setLoading(true);
    try {
      await staffDutyApi.startShift();
      await load(currentWeek);
      setMessage({ tone: "success", text: "Đã bắt đầu ca trực. Quyền thao tác nghiệp vụ đã được cập nhật." });
    } catch (error: any) {
      setMessage({ tone: "error", text: error?.message || "Chưa thể bắt đầu ca trực." });
    } finally {
      setLoading(false);
    }
  };

  const completedCount = assignments.filter(item => item.status === "COMPLETED").length;
  const upcomingCount = assignments.filter(item => ["ASSIGNED", "CHECKED_IN"].includes(item.status)).length;

  return (
    <div className="space-y-5 p-5 sm:p-7">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-600">Staff Duty Roster</p>
          <h1 className="mt-1 text-2xl font-black text-slate-950">Lịch trực của tôi</h1>
          <p className="mt-1 max-w-3xl text-sm font-semibold text-slate-500">
            Theo dõi ca được phân công và khai báo ca rảnh tuần tới. Ngoài ca bạn vẫn xem được dữ liệu nhưng không thể thực hiện nghiệp vụ Staff.
          </p>
        </div>
        <button type="button" disabled={loading} onClick={() => load()}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 shadow-xs hover:border-indigo-300 disabled:opacity-50">
          <RotateCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Làm mới
        </button>
      </header>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        <button type="button" onClick={openRoster}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black ${view === "ROSTER" ? "bg-slate-900 text-white shadow-xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
          <CalendarDays className="h-4 w-4" /> Lịch trực theo tuần
        </button>
        <button type="button" onClick={openAvailability}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black ${view === "AVAILABILITY" ? "bg-indigo-600 text-white shadow-xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
          <CalendarCheck2 className="h-4 w-4" /> Đăng ký ca rảnh
        </button>
      </div>

      {message && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-bold ${message.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
          {message.text}
        </div>
      )}

      {!isAvailabilityView && (
        <section className="grid gap-3 sm:grid-cols-3">
          <SummaryCard icon={<CalendarDays className="h-5 w-5" />} label="Ca trong tuần" value={`${assignments.length} ca`} tone="blue" />
          <SummaryCard icon={<Clock3 className="h-5 w-5" />} label="Đang chờ / đang trực" value={`${upcomingCount} ca`} tone="amber" />
          <SummaryCard icon={<ShieldCheck className="h-5 w-5" />} label="Đã hoàn thành" value={`${completedCount} ca`} tone="emerald" />
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-sm font-black text-slate-900">
              {isAvailabilityView ? "Ca rảnh tuần tới" : `Tuần ${formatDate(week)} – ${formatDate(addDays(week, 5))}`}
            </h2>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              {isAvailabilityView
                ? roster?.published
                  ? "Lịch tuần này đã được công bố nên không thể sửa ca rảnh."
                  : availabilityClosed
                    ? `Đã đóng đăng ký: ${selected.size} ca rảnh đã lưu. Admin sẽ phân công lịch tuần tới.`
                    : `${editingAvailability ? "Đang chọn" : "Đã lưu"}: ${selected.size} ca rảnh`
                : "Nhấp vào từng tuần để xem lịch sử hoặc ca sắp tới."}
            </p>
          </div>
          {!isAvailabilityView && (
            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-0.5 shadow-2xs">
              <button type="button" title="Tuần trước" onClick={() => setWeek(value => shiftWeek(value, -1))} className="grid h-8 w-8 place-items-center rounded-lg text-slate-600 hover:bg-slate-100"><ChevronLeft className="h-4 w-4" /></button>
              <button type="button" onClick={() => setWeek(currentWeek)} className="rounded-lg px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100">Tuần hiện tại</button>
              <button type="button" title="Tuần sau" onClick={() => setWeek(value => shiftWeek(value, 1))} className="grid h-8 w-8 place-items-center rounded-lg text-slate-600 hover:bg-slate-100"><ChevronRight className="h-4 w-4" /></button>
            </div>
          )}
          {isAvailabilityView && !roster?.published && !availabilityClosed && !editingAvailability && (
            <button type="button" onClick={() => setEditingAvailability(true)} className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 px-3 py-2 text-xs font-black text-indigo-700 hover:bg-indigo-50">
              <Pencil className="h-4 w-4" /> Chỉnh sửa lựa chọn
            </button>
          )}
        </div>

        {isAvailabilityView && availabilityClosed && !roster?.published && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800">
            Hạn đăng ký và chỉnh sửa ca rảnh là 23:59 Thứ Bảy (giờ Việt Nam). Chủ nhật chỉ xem dữ liệu đã gửi; Admin sẽ dùng dữ liệu này hoặc tự phân công ca cho tuần tới.
          </div>
        )}

        <div className="mt-4 overflow-x-auto pb-1">
          <div className="grid min-w-[760px] grid-cols-6 gap-3">
            {days.map((date, index) => {
              const isToday = date === today;
              return (
                <article key={date} className={`flex flex-col rounded-2xl border p-3 transition-all ${isToday ? "border-indigo-400 bg-indigo-50/40 shadow-xs" : "border-slate-200 bg-white"}`}>
                  <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2">
                    <div>
                      <p className={`text-xs font-black ${isToday ? "text-indigo-700" : "text-slate-900"}`}>Thứ {index + 2}</p>
                      <p className="text-[11px] font-semibold text-slate-400">{formatDate(date)}</p>
                    </div>
                    {isToday && <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[9px] font-black text-white">Hôm nay</span>}
                  </div>
                  <div className="flex-1 space-y-2">
                    {shifts.map(shift => {
                      const assignment = assignmentAt(date, shift.code);
                      const key = slotKey(date, shift.code);
                      const isSelected = selected.has(key);
                      const meta = assignment ? statusMeta[assignment.status] : null;
                      const selectable = isAvailabilityView && editingAvailability && !roster?.published && !availabilityClosed;
                      return (
                        <button key={shift.code} type="button" disabled={!selectable} onClick={() => toggle(date, shift.code)}
                          aria-pressed={isSelected}
                          className={`min-h-[96px] w-full rounded-xl border p-2.5 text-left transition-all ${isAvailabilityView && isSelected ? "border-indigo-600 bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-300/50" : assignment ? "border-blue-200 bg-blue-50/50" : "border-slate-200 bg-slate-50/50"} ${selectable ? "cursor-pointer hover:border-indigo-400" : "cursor-default"}`}>
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-[11px] font-black"><span className="mr-1">{shift.icon}</span>{shift.label}</span>
                            {isAvailabilityView && isSelected && <span className="grid h-4 w-4 place-items-center rounded-full bg-white text-indigo-600"><Check className="h-3 w-3" /></span>}
                          </div>
                          <span className={`mt-1 block text-[10px] font-semibold ${isAvailabilityView && isSelected ? "text-indigo-100" : "text-slate-500"}`}>{shift.time}</span>
                          {assignment && meta && (
                            <span className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black ${meta.className}`}>{meta.label}</span>
                          )}
                          {!assignment && !isAvailabilityView && <span className="mt-3 block text-[10px] font-semibold text-slate-400">Không có ca trực</span>}
                        </button>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-slate-500">
            {isAvailabilityView ? <span>Ca rảnh chỉ là nguyện vọng; Admin là người quyết định và công bố lịch cuối cùng.</span> : <StatusLegend />}
          </div>
          <div className="flex items-center gap-2">
            {isAvailabilityView && editingAvailability && !roster?.published && !availabilityClosed && savedSelection.size > 0 && (
              <button type="button" disabled={loading} onClick={cancelEditing} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-50 disabled:opacity-50"><X className="h-4 w-4" /> Hủy</button>
            )}
            {isAvailabilityView && editingAvailability && !roster?.published && !availabilityClosed && (
              <button type="button" disabled={loading || !selectionChanged} onClick={save} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-black text-white shadow-xs hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"><Save className="h-4 w-4" /> {loading ? "Đang lưu..." : "Lưu ca rảnh"}</button>
            )}
            {!isAvailabilityView && week === currentWeek && dutyStatus?.canStart && (
              <button type="button" disabled={loading} onClick={start} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50"><PlayCircle className="h-4 w-4" /> Bắt đầu ca trực</button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function SummaryCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: "blue" | "amber" | "emerald" }) {
  const toneClass = tone === "emerald" ? "bg-emerald-50 text-emerald-700" : tone === "amber" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700";
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
      <div className="flex items-center justify-between"><span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</span><span className={`grid h-9 w-9 place-items-center rounded-xl ${toneClass}`}>{icon}</span></div>
      <p className="mt-2 text-xl font-black text-slate-900">{value}</p>
    </div>
  );
}

function StatusLegend() {
  return (
    <>
      <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Đã phân công</span>
      <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Đang trực</span>
      <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-slate-400" /> Hoàn thành</span>
      <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Vắng mặt</span>
    </>
  );
}
