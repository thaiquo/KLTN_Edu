import React, { useCallback, useEffect, useState } from "react";
import { Clock3 } from "lucide-react";
import { DutyStatus, staffDutyApi } from "../../../api/staffDutyApi";

export function StaffDutyBadge({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const [state, setState] = useState<DutyStatus>();
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    staffDutyApi.status().then(setState).catch(() => setState(undefined));
  }, []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const start = async () => {
    setBusy(true);
    try {
      await staffDutyApi.startShift();
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const tone = state && !state.enforcementEnabled
    ? "border-indigo-200 bg-indigo-50 text-indigo-700"
    : state?.status === "ON_DUTY"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : state?.status === "UPCOMING_SHIFT"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-slate-200 bg-slate-50 text-slate-600";
  const label = state && !state.enforcementEnabled
    ? "LỊCH TRỰC CHƯA ÁP DỤNG"
    : state?.status === "ON_DUTY"
    ? "ĐANG TRỰC"
    : state?.status === "UPCOMING_SHIFT"
      ? "SẮP ĐẾN CA"
      : "NGOÀI CA · CHỈ XEM";

  return (
    <div className={`hidden items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[10px] font-black lg:flex ${tone}`}>
      <button type="button" className="flex items-center gap-1.5" onClick={() => onNavigate?.("duty-roster")}>
        <Clock3 className="h-3.5 w-3.5" /> {label}
      </button>
      {state?.canStart && (
        <button type="button" disabled={busy} onClick={start}
          className="border-l border-current/20 pl-2 underline underline-offset-2 disabled:opacity-50">
          {busy ? "Đang nhận..." : "Bắt đầu ca"}
        </button>
      )}
    </div>
  );
}
