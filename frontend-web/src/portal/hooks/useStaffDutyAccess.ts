import { useCallback, useEffect, useMemo, useState } from "react";
import { staffDutyApi, DutyStatus } from "../../api/staffDutyApi";
import { useAuth } from "../../hooks/useAuth";
import { canWriteForDuty } from "./staffDutyPolicy";

export function useStaffDutyAccess() {
  const { user } = useAuth();
  const role = String(user?.activeRole || "").toUpperCase();
  const isStaff = role === "STAFF";
  const isAdmin = role === "ADMIN";
  const [status, setStatus] = useState<DutyStatus | null>(null);
  const [loading, setLoading] = useState(isStaff);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!isStaff) {
      setStatus(null);
      setError("");
      setLoading(false);
      return;
    }
    try {
      const next = await staffDutyApi.status();
      setStatus(next);
      setError("");
    } catch (cause: any) {
      setStatus(null);
      setError(cause?.message || "Không thể xác minh ca trực.");
    } finally {
      setLoading(false);
    }
  }, [isStaff]);

  useEffect(() => {
    setLoading(isStaff);
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    const onVisibility = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("focus", refresh);
    window.addEventListener("staff-duty:changed", refresh);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("staff-duty:changed", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [isStaff, refresh]);

  return useMemo(() => ({
    status,
    loading,
    error,
    isStaff,
    isAdmin,
    writeAllowed: canWriteForDuty(role, status),
    refresh
  }), [error, isAdmin, isStaff, loading, refresh, role, status]);
}
