import { apiRequest } from "./client";

export type ShiftCode = "MORNING" | "EVENING";
export type ShiftStatus = "DRAFT" | "ASSIGNED" | "CHECKED_IN" | "COMPLETED" | "ABSENT";

export interface DutySlot {
  workDate: string;
  shiftCode: ShiftCode;
}

export interface DutyAssignment {
  id: number;
  workDate: string;
  shiftCode: ShiftCode;
  staffId?: number | null;
  staffName?: string | null;
  staffEmail?: string | null;
  status: ShiftStatus;
  publishedAt?: string | null;
  checkInAt?: string | null;
  completedAt?: string | null;
  version: number;
}

export interface WeeklyRoster {
  weekStartDate: string;
  weekEndDate: string;
  published: boolean;
  availability: DutySlot[];
  assignments: DutyAssignment[];
  activeStaff: Array<{ id: number; fullName: string; email: string }>;
  staffAvailability: Array<{ staffId: number; workDate: string; shiftCode: ShiftCode }>;
}

export interface DutyStatus {
  status: "ON_DUTY" | "UPCOMING_SHIFT" | "OFF_DUTY";
  enforcementEnabled: boolean;
  writeAllowed: boolean;
  canStart: boolean;
  assignment?: DutyAssignment | null;
}

const query = (date: string) => `weekStartDate=${encodeURIComponent(date)}`;

export const staffDutyApi = {
  myRoster: (weekStartDate: string): Promise<WeeklyRoster> =>
    apiRequest(`/api/account/staff/duty/my-roster?${query(weekStartDate)}`),
  submitAvailability: (weekStartDate: string, slots: DutySlot[]): Promise<WeeklyRoster> =>
    apiRequest("/api/account/staff/duty/availability", {
      method: "POST",
      body: JSON.stringify({ weekStartDate, slots }),
    }),
  startShift: (): Promise<DutyAssignment> =>
    apiRequest("/api/account/staff/duty/start-shift", { method: "POST" }),
  status: (): Promise<DutyStatus> =>
    apiRequest("/api/account/staff/duty/status"),

  adminRoster: (weekStartDate: string): Promise<WeeklyRoster> =>
    apiRequest(`/api/admin/staff-duty/roster?${query(weekStartDate)}`),
  createDraft: (weekStartDate: string): Promise<WeeklyRoster> =>
    apiRequest(`/api/admin/staff-duty/draft?${query(weekStartDate)}`, { method: "POST" }),
  autoAssign: (weekStartDate: string): Promise<WeeklyRoster> =>
    apiRequest(`/api/admin/staff-duty/auto-assign?${query(weekStartDate)}`, { method: "POST" }),
  manualAssign: (assignmentId: number, staffId: number): Promise<DutyAssignment> =>
    apiRequest(`/api/admin/staff-duty/assignments/${assignmentId}`, {
      method: "PUT",
      body: JSON.stringify({ staffId }),
    }),
  publish: (weekStartDate: string): Promise<WeeklyRoster> =>
    apiRequest(`/api/admin/staff-duty/publish?${query(weekStartDate)}`, { method: "POST" }),
  replace: (assignmentId: number, newStaffId: number, reason: string): Promise<DutyAssignment> =>
    apiRequest(`/api/admin/staff-duty/assignments/${assignmentId}/replace`, {
      method: "POST",
      body: JSON.stringify({ newStaffId, reason }),
    }),
  audits: (page = 0, size = 30) =>
    apiRequest(`/api/admin/staff-duty/audits?page=${page}&size=${size}`),
};
