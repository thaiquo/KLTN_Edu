import React from "react";
import { TutorTeachingSubject } from "../tutorApplication";

interface Props {
  value: TutorTeachingSubject;
  onChange: (patch: Partial<TutorTeachingSubject>) => void;
  disabled?: boolean;
}

export function PriceRangeInput({ value, onChange, disabled }: Props) {
  const showDuration = value.priceUnit === "per_30_days" || value.priceUnit === "per_course";
  const numberValue = (raw: string) => raw === "" ? 0 : Number(raw);
  return (
    <div className="space-y-3">
      <h4 className="text-[10px] font-black uppercase tracking-widest text-brand-text-variant/60">Proposed Tuition Range</h4>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="field-label">Minimum price (VND)
          <input disabled={disabled} min={1} type="number" value={value.minPrice || ""} onChange={(e) => onChange({ minPrice: numberValue(e.target.value) })} placeholder="1,500,000" className="field-control" />
        </label>
        <label className="field-label">Maximum price (VND)
          <input disabled={disabled} min={1} type="number" value={value.maxPrice || ""} onChange={(e) => onChange({ maxPrice: numberValue(e.target.value) })} placeholder="2,000,000" className="field-control" />
        </label>
        <label className="field-label">Price unit
          <select disabled={disabled} value={value.priceUnit} onChange={(e) => {
            const priceUnit = e.target.value as TutorTeachingSubject["priceUnit"];
            onChange({ priceUnit, durationDays: priceUnit === "per_30_days" ? 30 : priceUnit === "per_course" ? value.durationDays : null });
          }} className="field-control">
            <option value="per_hour">Per hour</option><option value="per_session">Per session</option>
            <option value="per_30_days">Per 30 days</option><option value="per_course">Per course</option>
          </select>
        </label>
      </div>
      <div className={`grid grid-cols-1 ${showDuration ? "sm:grid-cols-3" : "sm:grid-cols-2"} gap-3`}>
        {showDuration && <label className="field-label">Duration (days)
          <input disabled={disabled || value.priceUnit === "per_30_days"} min={1} type="number" value={value.durationDays || ""} onChange={(e) => onChange({ durationDays: numberValue(e.target.value) })} className="field-control" />
        </label>}
        <label className="field-label">Sessions per period
          <input disabled={disabled} min={1} type="number" value={value.sessionsPerPeriod || ""} onChange={(e) => onChange({ sessionsPerPeriod: numberValue(e.target.value) })} className="field-control" />
        </label>
        <label className="field-label">Minutes per session
          <input disabled={disabled} min={1} type="number" value={value.minutesPerSession || ""} onChange={(e) => onChange({ minutesPerSession: numberValue(e.target.value) })} className="field-control" />
        </label>
      </div>
      {value.minPrice > 0 && value.maxPrice >= value.minPrice && (
        <p className="text-xs font-bold text-brand-secondary">
          {value.minPrice.toLocaleString("vi-VN")}₫ - {value.maxPrice.toLocaleString("vi-VN")}₫ / {String(value.priceUnit).replace(/_/g, " ")}
          {" · "}{value.sessionsPerPeriod} sessions, {value.minutesPerSession} minutes/session
        </p>
      )}
    </div>
  );
}
