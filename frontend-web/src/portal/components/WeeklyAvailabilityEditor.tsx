import React from "react";
import { Clock3, Plus, Trash2 } from "lucide-react";
import { newClientId, TutorAvailability } from "../tutorApplication";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

interface Props {
  value: TutorAvailability[];
  onChange: (value: TutorAvailability[]) => void;
  disabled?: boolean;
  errors?: string[];
}

export function WeeklyAvailabilityEditor({ value, onChange, disabled, errors = [] }: Props) {
  const update = (index: number, patch: Partial<TutorAvailability>) =>
    onChange(value.map((slot, slotIndex) => slotIndex === index ? { ...slot, ...patch } : slot));

  return (
    <section className="bg-white rounded-2xl border border-brand-border/30 p-6 shadow-sm space-y-4">
      <div className="flex items-center gap-3">
        <span className="p-2 rounded-xl bg-brand-primary/10 text-brand-primary"><Clock3 className="w-5 h-5" /></span>
        <div>
          <h3 className="font-display font-black text-sm text-brand-text">Weekly Availability</h3>
          <p className="text-xs text-brand-text-variant/60">Add the recurring time slots when you can teach.</p>
        </div>
      </div>
      <div className="space-y-3">
        {value.map((slot, index) => (
          <div key={slot._id || slot.clientId || index} className="grid grid-cols-1 sm:grid-cols-[1.3fr_1fr_1fr_auto] gap-3 items-end p-3 bg-brand-low/35 rounded-xl">
            <label className="text-[10px] font-bold uppercase tracking-wider text-brand-text-variant/60">
              Day
              <select disabled={disabled} value={slot.dayOfWeek} onChange={(e) => update(index, { dayOfWeek: Number(e.target.value) })} className="mt-1 w-full px-3 py-2.5 bg-white border border-brand-border/40 rounded-lg text-xs">
                {DAYS.map((day, dayIndex) => <option key={day} value={dayIndex + 1}>{day}</option>)}
              </select>
            </label>
            <label className="text-[10px] font-bold uppercase tracking-wider text-brand-text-variant/60">
              Start time
              <input disabled={disabled} type="time" value={slot.startTime} onChange={(e) => update(index, { startTime: e.target.value })} className="mt-1 w-full px-3 py-2.5 bg-white border border-brand-border/40 rounded-lg text-xs" />
            </label>
            <label className="text-[10px] font-bold uppercase tracking-wider text-brand-text-variant/60">
              End time
              <input disabled={disabled} type="time" value={slot.endTime} onChange={(e) => update(index, { endTime: e.target.value })} className="mt-1 w-full px-3 py-2.5 bg-white border border-brand-border/40 rounded-lg text-xs" />
            </label>
            <button disabled={disabled} type="button" onClick={() => onChange(value.filter((_, slotIndex) => slotIndex !== index))} aria-label="Remove time slot" className="p-2.5 rounded-lg text-brand-error hover:bg-brand-error/5 disabled:opacity-40">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
      {errors.map((error) => <p key={error} className="text-xs font-semibold text-brand-error">{error}</p>)}
      <button disabled={disabled} type="button" onClick={() => onChange([...value, { clientId: newClientId(), dayOfWeek: 1, startTime: "18:00", endTime: "20:00" }])} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-brand-primary/30 text-brand-primary text-xs font-bold hover:bg-brand-primary/5 disabled:opacity-40">
        <Plus className="w-4 h-4" /> Add Time Slot
      </button>
    </section>
  );
}
