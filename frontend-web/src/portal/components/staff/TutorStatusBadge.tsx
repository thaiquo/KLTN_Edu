import React from "react";
import { TutorApprovalStatus } from "../../types";

const STATUS_LABEL: Record<TutorApprovalStatus, string> = {
  PENDING: "Pending Review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

const STATUS_CLASS: Record<TutorApprovalStatus, string> = {
  PENDING: "bg-[#fff4df] text-[#8a5a00] border-[#ffd98a]",
  APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  REJECTED: "bg-rose-50 text-rose-700 border-rose-200",
};

export function TutorStatusBadge({ status }: { status: TutorApprovalStatus }) {
  return (
    <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${STATUS_CLASS[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}
