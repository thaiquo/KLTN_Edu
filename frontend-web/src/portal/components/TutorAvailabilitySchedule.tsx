import React, { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock3, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { tutorAvailabilityApi } from "../../api/tutorAvailability";

type Slot = { id?: string; dayOfWeek: string; startTime: string; endTime: string; status: "AVAILABLE" };

const DAYS = [
  ["MONDAY", "Thứ 2"], ["TUESDAY", "Thứ 3"], ["WEDNESDAY", "Thứ 4"], ["THURSDAY", "Thứ 5"],
  ["FRIDAY", "Thứ 6"], ["SATURDAY", "Thứ 7"], ["SUNDAY", "Chủ nhật"],
] as const;
const MINUTES_MIN = 90;
const TIME_OPTIONS = [
  ...Array.from({ length: 48 }, (_, index) => `${String(Math.floor(index / 2)).padStart(2, "0")}:${index % 2 ? "30" : "00"}`),
  "23:59",
];

const minutes = (time: string) => {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
};
const timeLabel = (time: string) => time.slice(0, 5);
const newSlot = (): Slot => ({ dayOfWeek: "MONDAY", startTime: "07:00", endTime: "09:00", status: "AVAILABLE" });
const presetSlot = (startTime: string, endTime: string): Slot => ({ dayOfWeek: "MONDAY", startTime, endTime, status: "AVAILABLE" });

export function TutorAvailabilitySchedule({ userId }: { userId?: string }) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!userId) { setLoading(false); setError("Không xác định được tài khoản giảng viên."); return; }
    tutorAvailabilityApi.getMine(userId)
      .then((data: Slot[]) => {
        setSlots(data.map(slot => ({ ...slot, startTime: timeLabel(slot.startTime), endTime: timeLabel(slot.endTime), status: "AVAILABLE" })));
        setEditing(data.length === 0);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Không thể tải lịch trống."))
      .finally(() => setLoading(false));
  }, [userId]);

  const update = (index: number, patch: Partial<Slot>) => {
    setError("");
    setMessage("");
    setSlots(old => old.map((slot, i) => i === index ? { ...slot, ...patch } : slot));
  };
  const issues = useMemo(() => {
    const validation: string[] = [];
    if (slots.length < 3) validation.push("Cần ít nhất 3 buổi trống trong tuần.");
    slots.forEach((slot, index) => {
      const duration = minutes(slot.endTime) - minutes(slot.startTime);
      if (duration < MINUTES_MIN) validation.push(`Buổi ${index + 1} phải dài ít nhất 90 phút.`);
    });
    for (const [day] of DAYS) {
      const daily = slots.filter(slot => slot.dayOfWeek === day).sort((a, b) => a.startTime.localeCompare(b.startTime));
      if (daily.some((slot, index) => index > 0 && slot.startTime < daily[index - 1].endTime)) validation.push(`${DAYS.find(item => item[0] === day)?.[1]} có các buổi bị chồng giờ.`);
    }
    return validation;
  }, [slots]);

  const overlaps = (index: number) => slots.some((slot, otherIndex) => otherIndex !== index
    && slot.dayOfWeek === slots[index].dayOfWeek
    && slots[index].startTime < slot.endTime
    && slot.startTime < slots[index].endTime);

  const save = async () => {
    setMessage(""); setError("");
    if (issues.length) { setError(issues[0]); return; }
    if (!userId) return;
    setSaving(true);
    try {
      const saved = await tutorAvailabilityApi.replaceMine(userId, slots.map(slot => ({ ...slot, startTime: `${timeLabel(slot.startTime)}:00`, endTime: `${timeLabel(slot.endTime)}:00` })));
      setSlots((saved as Slot[]).map(slot => ({ ...slot, startTime: timeLabel(slot.startTime), endTime: timeLabel(slot.endTime), status: "AVAILABLE" })));
      setMessage("Đã lưu lịch trống hằng tuần.");
      setEditing(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể lưu lịch trống."); }
    finally { setSaving(false); }
  };

  return <div className="space-y-6 max-w-6xl mx-auto pb-10">
    <header className="bg-white p-6 rounded-2xl border border-brand-border/30 flex flex-col md:flex-row gap-4 justify-between md:items-center">
      <div className="flex gap-3"><span className="p-3 h-fit rounded-xl bg-brand-secondary/10 text-brand-secondary"><CalendarDays className="w-6 h-6" /></span><div><h2 className="font-display font-black text-xl text-brand-text">Lịch trống giảng dạy</h2><p className="text-xs text-brand-text-variant mt-1">Thiết lập các buổi lặp lại hằng tuần để học viên có thể đặt lớp.</p></div></div>
      {editing ? <button type="button" onClick={save} disabled={saving || loading} className="inline-flex justify-center items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-secondary text-white text-xs font-black disabled:opacity-40"><Save className="w-4 h-4" />{saving ? "Đang lưu..." : "Lưu lịch trống"}</button> : <button type="button" onClick={() => { setEditing(true); setMessage(""); }} disabled={loading} className="inline-flex justify-center items-center gap-2 px-4 py-2.5 rounded-xl border border-brand-secondary/35 text-brand-secondary text-xs font-black disabled:opacity-40"><Pencil className="w-4 h-4" />Chỉnh sửa</button>}
    </header>
    <div className="grid md:grid-cols-3 gap-3"><div className="md:col-span-2 p-4 rounded-xl bg-brand-primary/5 border border-brand-primary/15 text-xs text-brand-text"><b>Quy định:</b> tối thiểu 3 buổi/tuần; mỗi buổi tối thiểu 1 giờ 30 phút (có thể dài hơn); không được trùng giờ trong cùng ngày.</div><div className="p-4 rounded-xl bg-white border text-xs text-brand-text-variant"><b className="text-brand-text">Đã tạo:</b> {slots.length}/3 buổi tối thiểu</div></div>
    <section className="bg-white rounded-2xl border border-brand-border/30 p-5 overflow-x-auto"><div className="grid grid-cols-7 min-w-[700px] gap-2">{DAYS.map(([day, label]) => <div key={day} className="min-h-40 rounded-xl border border-brand-border/30 bg-brand-low/30 p-2"><p className="text-[10px] font-black uppercase text-brand-text-variant mb-2">{label}</p>{slots.filter(slot => slot.dayOfWeek === day).map((slot, index) => <div key={slot.id || `${slot.dayOfWeek}-${slot.startTime}-${slot.endTime}-${index}`} className="mb-2 p-2 rounded-lg bg-brand-secondary/10 border border-brand-secondary/20 text-[11px] font-bold text-brand-secondary"><Clock3 className="inline w-3 h-3 mr-1" />{timeLabel(slot.startTime)} – {timeLabel(slot.endTime)}</div>)}</div>)}</div></section>
    <section className="bg-white rounded-2xl border border-brand-border/30 p-6 space-y-3"><div className="flex flex-wrap justify-between items-center gap-3"><h3 className="font-display font-black text-sm">Các buổi trống</h3>{editing && <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setSlots(old => [...old, presetSlot("00:00", "23:59")])} className="px-3 py-2 rounded-lg border text-xs font-bold text-brand-text-variant hover:bg-brand-low">+ Cả ngày</button><button type="button" onClick={() => setSlots(old => [...old, newSlot()])} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-brand-secondary/30 text-brand-secondary text-xs font-bold"><Plus className="w-4 h-4" />Thêm buổi</button></div>}</div>{loading ? <p className="text-xs text-brand-text-variant">Đang tải lịch...</p> : editing ? slots.map((slot, index) => <div key={slot.id || index} className={`grid grid-cols-1 sm:grid-cols-[1.2fr_1fr_1fr_auto] gap-3 items-end p-3 rounded-xl border ${overlaps(index) ? "bg-red-50 border-red-300" : "bg-brand-low/30 border-transparent"}`}><label className="field-label">Ngày<select value={slot.dayOfWeek} onChange={event => update(index, { dayOfWeek: event.target.value })} className="field-control mt-1">{DAYS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="field-label">Bắt đầu<select value={timeLabel(slot.startTime)} onChange={event => update(index, { startTime: event.target.value })} className="field-control mt-1">{TIME_OPTIONS.map(time => <option key={time} value={time}>{time}</option>)}</select></label><label className="field-label">Kết thúc<select value={timeLabel(slot.endTime)} onChange={event => update(index, { endTime: event.target.value })} className="field-control mt-1">{TIME_OPTIONS.map(time => <option key={time} value={time}>{time}</option>)}</select></label><button type="button" onClick={() => setSlots(old => old.filter((_, i) => i !== index))} className="p-2.5 text-brand-error hover:bg-brand-error/5 rounded-lg" aria-label="Xóa buổi"><Trash2 className="w-4 h-4" /></button>{overlaps(index) && <p className="sm:col-span-4 text-xs font-semibold text-red-700">Khung giờ này bị trùng với một buổi trống khác trong cùng ngày.</p>}</div>) : <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{slots.map((slot, index) => <div key={slot.id || index} className="p-3 rounded-xl bg-brand-low/30 border border-brand-border/30 text-xs"><b>{DAYS.find(([value]) => value === slot.dayOfWeek)?.[1]}</b><p className="mt-1 text-brand-secondary font-black"><Clock3 className="inline w-3 h-3 mr-1" />{timeLabel(slot.startTime)} – {timeLabel(slot.endTime)}</p></div>)}</div>}{!loading && !slots.length && <p className="text-xs text-brand-text-variant">Chưa có buổi trống. Hãy thêm ít nhất 3 buổi trước khi lưu.</p>}</section>
    {error && <p className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-700">{error}</p>}{message && <p className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700">{message}</p>}
  </div>;
}
