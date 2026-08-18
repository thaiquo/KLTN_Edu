import React from "react";
import { CheckCircle2, Clock3, TimerReset, XCircle } from "lucide-react";

interface StatItem {
  label: string;
  value: string;
  hint: string;
  accent: "coral" | "navy" | "green" | "rose";
  icon: React.ElementType;
}

const accentClass = {
  coral: "text-[#ff695f] bg-[#ff695f]/10",
  navy: "text-[#073554] bg-[#073554]/10",
  green: "text-emerald-700 bg-emerald-50",
  rose: "text-rose-700 bg-rose-50",
};

export function DashboardStats({
  pendingCount,
  approvedToday = 12,
  rejectedToday = 3,
  averageReviewTime = "2.4h",
}: {
  pendingCount: number;
  approvedToday?: number;
  rejectedToday?: number;
  averageReviewTime?: string;
}) {
  const stats: StatItem[] = [
    { label: "Đang chờ duyệt", value: String(pendingCount), hint: "Hồ sơ và đề xuất cần xử lý", accent: "coral", icon: Clock3 },
    { label: "Đã duyệt hôm nay", value: String(approvedToday), hint: "Yêu cầu đã được phê duyệt", accent: "green", icon: CheckCircle2 },
    { label: "Từ chối hôm nay", value: String(rejectedToday), hint: "Yêu cầu không được chấp thuận", accent: "rose", icon: XCircle },
    { label: "Thời gian xử lý TB", value: averageReviewTime, hint: "Tính từ lúc gia sư gửi duyệt", accent: "navy", icon: TimerReset },
  ];

  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <article key={stat.label} className="border border-[#d7dde6] bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{stat.label}</p>
                <strong className="mt-3 block font-display text-3xl font-black text-[#073554]">{stat.value}</strong>
              </div>
              <span className={`grid h-9 w-9 place-items-center ${accentClass[stat.accent]}`}>
                <Icon className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 text-xs font-semibold text-slate-500">{stat.hint}</p>
          </article>
        );
      })}
    </section>
  );
}
