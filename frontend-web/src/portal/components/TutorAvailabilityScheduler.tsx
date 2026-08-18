import React, { useState, useEffect } from "react";
import { Calendar, Edit3, Save, Trash2, Plus, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { classApi } from "../../api/classes";

export interface AvailabilitySlot {
  id: string;
  dayOfWeek: number; // 2 -> Thứ 2, 3 -> Thứ 3, ..., 8 -> Chủ nhật
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
}

const VIETNAMESE_DAYS = [
  { value: 2, label: "Thứ 2" },
  { value: 3, label: "Thứ 3" },
  { value: 4, label: "Thứ 4" },
  { value: 5, label: "Thứ 5" },
  { value: 6, label: "Thứ 6" },
  { value: 7, label: "Thứ 7" },
  { value: 8, label: "Chủ nhật" }
];

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = ["00", "15", "30", "45"];

function TimeInput24h({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  const [h, m] = (value || "00:00").split(":");
  return (
    <div className={`flex items-center gap-1 ${className || ""}`}>
      <select
        value={h}
        onChange={(e) => onChange(`${e.target.value}:${m}`)}
        className="px-2 py-2.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-brand-primary appearance-none text-center w-[58px]"
      >
        {HOURS.map((hr) => <option key={hr} value={hr}>{hr}</option>)}
      </select>
      <span className="text-sm font-black text-slate-400">:</span>
      <select
        value={MINUTES.includes(m) ? m : "00"}
        onChange={(e) => onChange(`${h}:${e.target.value}`)}
        className="px-2 py-2.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-brand-primary appearance-none text-center w-[58px]"
      >
        {MINUTES.map((min) => <option key={min} value={min}>{min}</option>)}
      </select>
    </div>
  );
}

export function TutorAvailabilityScheduler() {
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load from API / DB on mount
  useEffect(() => {
    async function loadAvailability() {
      setLoading(true);
      setLoadError("");
      try {
        const dbSlots = await classApi.getAvailability();
        if (Array.isArray(dbSlots)) {
          setSlots(dbSlots.map((s: any) => ({
            id: String(s.id || Math.random()),
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime
          })));
        }
      } catch (err: any) {
        console.error("Load availability error", err);
        setSlots([]);
        setLoadError(err?.message || "Không thể tải lịch rảnh từ hệ thống.");
      } finally {
        setLoading(false);
      }
    }
    loadAvailability();
  }, []);

  // Helper: check duration is at least 90 minutes
  const getDurationInMinutes = (start: string, end: string): number => {
    if (!start || !end) return 0;
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    return (eh * 60 + em) - (sh * 60 + sm);
  };

  // Live validation
  const validateSlots = (currentSlots: AvailabilitySlot[]): string[] => {
    const currentErrors: string[] = [];

    // 1. Time range check & overlap check within the same day
    const dayGroups: Record<number, AvailabilitySlot[]> = {};
    currentSlots.forEach(slot => {
      if (!dayGroups[slot.dayOfWeek]) {
        dayGroups[slot.dayOfWeek] = [];
      }
      dayGroups[slot.dayOfWeek].push(slot);
    });

    let hasInvalidTimeRange = false;
    let hasOverlap = false;
    let hasLessThan90Mins = false;

    Object.keys(dayGroups).forEach(dayKey => {
      const daySlots = dayGroups[Number(dayKey)];
      
      // Check start < end and duration >= 90 mins
      daySlots.forEach(slot => {
        const duration = getDurationInMinutes(slot.startTime, slot.endTime);
        if (duration <= 0) {
          hasInvalidTimeRange = true;
        } else if (duration < 90) {
          hasLessThan90Mins = true;
        }
      });

      // Sort and check overlaps
      const sorted = [...daySlots].sort((a, b) => a.startTime.localeCompare(b.startTime));
      for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i].endTime.localeCompare(sorted[i + 1].startTime) > 0) {
          hasOverlap = true;
        }
      }
    });

    if (hasInvalidTimeRange) {
      currentErrors.push("Thời gian kết thúc phải sau thời gian bắt đầu");
    }
    if (hasOverlap) {
      currentErrors.push("Không được trùng giờ trong cùng ngày");
    }
    if (hasLessThan90Mins) {
      currentErrors.push("Mỗi buổi rảnh tối thiểu phải 1 giờ 30 phút (90 phút)");
    }

    // 2. Count distinct days
    const distinctDays = new Set(currentSlots.map(s => s.dayOfWeek));
    if (distinctDays.size < 3) {
      currentErrors.push("Lịch rảnh phải tối thiểu ở 3 thứ khác nhau trong tuần (ví dụ: Thứ 2, 4, 6)");
    }

    // 3. Count total sessions
    if (currentSlots.length < 3) {
      currentErrors.push("Tối thiểu phải có 3 buổi rảnh mỗi tuần");
    }

    return currentErrors;
  };

  // Add slot
  const handleAddSlot = () => {
    const newSlot: AvailabilitySlot = {
      id: `slot-${Date.now()}-${Math.random()}`,
      dayOfWeek: 2,
      startTime: "07:00",
      endTime: "09:00"
    };
    const updated = [...slots, newSlot];
    setSlots(updated);
    setErrors(validateSlots(updated));
    setSuccessMessage("");
  };

  // Add full day slot (24h)
  const handleAddFullDay = () => {
    const newSlot: AvailabilitySlot = {
      id: `slot-${Date.now()}-${Math.random()}`,
      dayOfWeek: 2,
      startTime: "00:00",
      endTime: "23:59"
    };
    const updated = [...slots, newSlot];
    setSlots(updated);
    setErrors(validateSlots(updated));
    setSuccessMessage("");
  };

  // Remove slot
  const handleRemoveSlot = (id: string) => {
    const updated = slots.filter(s => s.id !== id);
    setSlots(updated);
    setErrors(validateSlots(updated));
    setSuccessMessage("");
  };

  // Update slot
  const handleUpdateSlot = (id: string, patch: Partial<AvailabilitySlot>) => {
    const updated = slots.map(s => s.id === id ? { ...s, ...patch } : s);
    setSlots(updated);
    setErrors(validateSlots(updated));
    setSuccessMessage("");
  };

  // Save changes
  const handleSave = async () => {
    const currentErrors = validateSlots(slots);
    if (currentErrors.length > 0) {
      setErrors(currentErrors);
      return;
    }

    setSaving(true);
    setErrors([]);
    try {
      // Save to Database via API
      const savedSlots = await classApi.saveAvailability(slots.map(s => ({
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime
      })));

      if (Array.isArray(savedSlots)) {
        setSlots(savedSlots.map((slot: any) => ({
          id: String(slot.id),
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime
        })));
      }
      setIsEditing(false);
      setLoadError("");
      setSuccessMessage("Đã lưu lịch rảnh thành công vào hệ thống!");
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (err: any) {
      console.error("Save availability error", err);
      setErrors([err?.message || "Không thể lưu lịch rảnh vào hệ thống."]);
    } finally {
      setSaving(false);
    }
  };

  // Calculate stats
  const distinctDaysCount = new Set(slots.map(s => s.dayOfWeek)).size;
  const totalSessions = slots.length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      {loadError && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-xs text-red-700 font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{loadError}</span>
        </div>
      )}
      
      {/* Header Panel */}
      <div className="flex justify-between items-center bg-white p-6 border border-brand-border/30 rounded-3xl shadow-sm">
        <div className="flex items-center gap-3">
          <span className="p-3 rounded-2xl bg-brand-primary/10 text-brand-primary">
            <Calendar className="w-6 h-6" />
          </span>
          <div>
            <h3 className="font-display font-black text-lg text-brand-text">Lịch trống giảng dạy</h3>
            <p className="text-xs text-brand-text-variant mt-1">Thiết lập các buổi lặp lại hằng tuần để học viên có thể đặt lớp.</p>
          </div>
        </div>
        <div>
          {isEditing ? (
            <button
              onClick={handleSave}
              className="px-5 py-2.5 bg-brand-primary text-white hover:bg-brand-primary/95 text-xs font-display font-black tracking-widest rounded-xl transition-all cursor-pointer shadow-md flex items-center gap-2 font-bold"
            >
              <Save className="w-4 h-4" />
              LƯU LỊCH TRỐNG
            </button>
          ) : (
            <button
              onClick={() => {
                setIsEditing(true);
                setSuccessMessage("");
              }}
              className="px-5 py-2.5 bg-brand-secondary text-white hover:bg-brand-secondary-hover text-xs font-display font-black tracking-widest rounded-xl transition-all cursor-pointer shadow-md flex items-center gap-2 font-bold"
            >
              <Edit3 className="w-4 h-4" />
              CHỈNH SỬA
            </button>
          )}
        </div>
      </div>

      {/* Alert Rule Box */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 bg-[#f0f5ff] border border-blue-100 rounded-2xl p-4 flex items-center gap-3 text-blue-900 text-xs font-semibold leading-relaxed">
          <Clock className="w-5 h-5 text-blue-600 shrink-0" />
          <p>
            <span className="font-bold">Quy định:</span> tối thiểu 3 buổi/tuần (ở 3 thứ khác nhau); mỗi buổi tối thiểu 1 giờ 30 phút (có thể dài hơn); không được trùng giờ trong cùng ngày.
          </p>
        </div>
        <div className="bg-white border border-brand-border/30 rounded-2xl p-4 flex flex-col justify-center">
          <div className="flex justify-between items-center text-xs font-bold text-slate-700">
            <span>ĐÃ TẠO</span>
            <span className={distinctDaysCount >= 3 && totalSessions >= 3 ? "text-emerald-600 font-extrabold" : "text-amber-600 font-extrabold"}>
              {distinctDaysCount}/3 buổi tối thiểu (ở {distinctDaysCount} thứ)
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 mt-2">
            <div 
              className={`h-2 rounded-full transition-all ${distinctDaysCount >= 3 && totalSessions >= 3 ? "bg-emerald-500" : "bg-amber-500"}`} 
              style={{ width: `${Math.min(100, (distinctDaysCount / 3) * 100)}%` }} 
            />
          </div>
        </div>
      </div>

      {/* Weekday Grid */}
      <div className={`grid grid-cols-2 md:grid-cols-7 gap-3 ${loading ? "opacity-50 pointer-events-none" : ""}`}>
        {VIETNAMESE_DAYS.map(day => {
          const daySlots = slots.filter(s => s.dayOfWeek === day.value)
            .sort((a, b) => a.startTime.localeCompare(b.startTime));
          
          return (
            <div key={day.value} className="bg-white border border-brand-border/30 rounded-2xl p-4 min-h-[160px] flex flex-col gap-2">
              <h4 className="text-xs font-black text-slate-800 border-b border-slate-100 pb-2 text-center">{day.label}</h4>
              <div className="flex-1 flex flex-col gap-2 justify-start mt-2">
                {daySlots.length > 0 ? (
                  daySlots.map(slot => (
                    <div 
                      key={slot.id} 
                      className="px-2 py-2 bg-brand-primary/5 text-brand-primary rounded-xl border border-brand-primary/10 flex flex-col items-center justify-center gap-1 text-[11px] font-bold"
                    >
                      <Clock className="w-3.5 h-3.5 text-brand-primary" />
                      <span>{slot.startTime} - {slot.endTime}</span>
                    </div>
                  ))
                ) : (
                  <span className="text-[10px] text-slate-400 font-semibold text-center italic mt-4">Trống</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* List of Free Slots / Editor */}
      <div className="bg-white border border-brand-border/30 rounded-3xl p-6 shadow-sm space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="font-display font-black text-sm text-brand-text uppercase tracking-wider">
            {isEditing ? "Các buổi trống" : "Các buổi trống hằng tuần"}
          </h3>
          {isEditing && (
            <div className="flex gap-2">
              <button 
                onClick={handleAddFullDay}
                className="px-3.5 py-2 rounded-xl border border-brand-primary/30 text-brand-primary text-xs font-bold hover:bg-brand-primary/5 transition-all flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> + Cả ngày
              </button>
              <button 
                onClick={handleAddSlot}
                className="px-3.5 py-2 rounded-xl bg-brand-primary text-white text-xs font-bold hover:bg-brand-primary/95 transition-all flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" /> + Thêm buổi
              </button>
            </div>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-4">
            {slots.map((slot, index) => (
              <div 
                key={slot.id} 
                className="grid grid-cols-1 sm:grid-cols-[1.5fr_1fr_1fr_auto] gap-4 items-end p-4 bg-slate-50 border border-slate-200 rounded-2xl hover:border-brand-primary/20 transition-all"
              >
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">NGÀY</label>
                  <select 
                    value={slot.dayOfWeek} 
                    onChange={(e) => handleUpdateSlot(slot.id, { dayOfWeek: Number(e.target.value) })}
                    className="mt-1.5 w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-brand-primary"
                  >
                    {VIETNAMESE_DAYS.map(day => <option key={day.value} value={day.value}>{day.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">BẮT ĐẦU</label>
                  <div className="mt-1.5">
                    <TimeInput24h
                      value={slot.startTime}
                      onChange={(v) => handleUpdateSlot(slot.id, { startTime: v })}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">KẾT THÚC</label>
                  <div className="mt-1.5">
                    <TimeInput24h
                      value={slot.endTime}
                      onChange={(v) => handleUpdateSlot(slot.id, { endTime: v })}
                    />
                  </div>
                </div>
                <div>
                  <button 
                    onClick={() => handleRemoveSlot(slot.id)}
                    className="p-2.5 text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                    title="Xóa buổi"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            {slots.length === 0 && (
              <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-semibold">
                Chưa có buổi rảnh nào được tạo. Hãy click "Thêm buổi" để bắt đầu.
              </div>
            )}

            {/* Error alerts banner inside edit mode */}
            {errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex flex-col gap-1.5 text-xs text-red-700 font-semibold">
                <div className="flex items-center gap-2 font-bold">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Thời gian kết thúc phải sau thời gian bắt đầu và không được trùng lịch</span>
                </div>
                <ul className="list-disc pl-5 font-medium space-y-0.5">
                  {errors.map((error, idx) => <li key={idx}>{error}</li>)}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {slots.length > 0 ? (
              [...slots].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime))
                .map((slot) => {
                  const dayName = VIETNAMESE_DAYS.find(d => d.value === slot.dayOfWeek)?.label || "Thứ";
                  return (
                    <div key={slot.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between hover:border-brand-secondary/20 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="text-center font-display border-r border-slate-200 pr-4 min-w-[70px]">
                          <p className="font-black text-brand-secondary text-sm leading-none">{dayName}</p>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                          <Clock className="w-4 h-4 text-slate-400" />
                          <span>{slot.startTime} - {slot.endTime}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
            ) : (
              <div className="text-center py-10 text-slate-400 font-semibold italic">
                Chưa có lịch trống nào được thiết lập. Hãy bấm nút "Chỉnh sửa" để cài đặt.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Success banner */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex items-center gap-3 text-emerald-800 text-xs font-bold shadow-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <p>{successMessage}</p>
        </div>
      )}
    </div>
  );
}
