import { useCallback, useEffect, useState } from "react";
import { DutyStatus, staffDutyApi } from "../api/staffDutyApi";

const DUTY_REFRESH_MS = 30_000;

export function useStaffDutyAccess(activeRole: string) {
  const isStaff = activeRole.trim().toUpperCase() === "STAFF";
  const [dutyStatus, setDutyStatus] = useState<DutyStatus | null>(null);
  const [dutyLoading, setDutyLoading] = useState(isStaff);

  const refreshDutyStatus = useCallback(async () => {
    if (!isStaff) {
      setDutyStatus(null);
      setDutyLoading(false);
      return;
    }
    setDutyLoading(true);
    try {
      setDutyStatus(await staffDutyApi.status());
    } catch {
      // Fail closed in the UI. The backend duty filter remains authoritative.
      setDutyStatus(null);
    } finally {
      setDutyLoading(false);
    }
  }, [isStaff]);

  useEffect(() => {
    void refreshDutyStatus();
    if (!isStaff) return;

    const handleDutyChange = () => void refreshDutyStatus();
    window.addEventListener("staff-duty:changed", handleDutyChange);
    const timer = window.setInterval(refreshDutyStatus, DUTY_REFRESH_MS);
    return () => {
      window.removeEventListener("staff-duty:changed", handleDutyChange);
      window.clearInterval(timer);
    };
  }, [isStaff, refreshDutyStatus]);

  return {
    dutyStatus,
    dutyLoading,
    refreshDutyStatus,
    writeAllowed: !isStaff || dutyStatus?.writeAllowed === true,
    staffReadOnly: isStaff && dutyStatus?.writeAllowed !== true,
  };
}
