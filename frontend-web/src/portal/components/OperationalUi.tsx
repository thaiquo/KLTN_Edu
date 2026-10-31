import React from "react";
import { AlertCircle, ChevronLeft, ChevronRight, Inbox, RefreshCw } from "lucide-react";

export function OperationsHeader({ eyebrow, title, description, onRefresh, refreshing = false }: {
  eyebrow: string; title: string; description: string; onRefresh: () => void; refreshing?: boolean;
}) {
  return <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
    <div className="min-w-0">
      <p className="text-[11px] font-black uppercase text-brand-primary">{eyebrow}</p>
      <h1 className="mt-1 font-display text-2xl font-black text-brand-text">{title}</h1>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-brand-text-variant">{description}</p>
    </div>
    <button type="button" onClick={onRefresh} disabled={refreshing}
      className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 shadow-sm transition hover:border-brand-primary/40 hover:text-brand-primary disabled:cursor-wait disabled:opacity-60">
      <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Tải lại
    </button>
  </header>;
}

export function MetricStrip({ metrics }: { metrics: Array<{ label: string; value: number | string; tone?: string; icon: React.ElementType }> }) {
  return <section aria-label="Tổng quan" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
    {metrics.map(({ label, value, tone = "bg-brand-low text-brand-primary", icon: Icon }) =>
      <div key={label} className="min-w-0 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <div className={`mb-3 grid h-9 w-9 place-items-center rounded-md ${tone}`}><Icon className="h-4 w-4" /></div>
        <p className="text-2xl font-black text-brand-text">{value}</p>
        <p className="mt-1 text-xs font-semibold text-slate-500">{label}</p>
      </div>)}
  </section>;
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return <div className="space-y-3 p-4" aria-label="Đang tải dữ liệu">
    {Array.from({ length: rows }).map((_, index) => <div key={index} className="h-14 animate-pulse rounded-md bg-slate-100" />)}
  </div>;
}

export function EmptyState({ title, description, filtered = false }: { title: string; description: string; filtered?: boolean }) {
  return <div className="flex min-h-52 flex-col items-center justify-center px-6 py-10 text-center">
    <div className="grid h-12 w-12 place-items-center rounded-md bg-brand-low text-brand-primary"><Inbox className="h-5 w-5" /></div>
    <h2 className="mt-4 text-sm font-black text-brand-text">{title}</h2>
    <p className="mt-1 max-w-md text-xs leading-5 text-slate-500">{filtered ? "Không có dữ liệu khớp bộ lọc hiện tại. " : ""}{description}</p>
  </div>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div role="alert" className="flex items-start justify-between gap-4 border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
    <div className="flex items-start gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{message}</span></div>
    <button type="button" onClick={onRetry} className="shrink-0 text-xs font-black underline underline-offset-2">Thử lại</button>
  </div>;
}

export function Pager({ page, pages, onChange, total, size = 10, onSizeChange }: {
  page: number; pages: number; onChange: (page: number) => void; total?: number; size?: number; onSizeChange?: (size: number) => void;
}) {
  const start = total && total > 0 ? page * size + 1 : 0;
  const end = total == null ? null : Math.min((page + 1) * size, total);
  return <nav aria-label="Phân trang" className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex items-center gap-3 text-xs font-semibold text-slate-500">
      {total != null && <span>{start}–{end} / {total.toLocaleString("vi-VN")}</span>}
      {onSizeChange && <label className="flex items-center gap-2">Mỗi trang<select aria-label="Số dòng mỗi trang" value={size} onChange={event => onSizeChange(Number(event.target.value))} className="h-8 rounded-md border border-slate-200 bg-white px-2 font-bold text-slate-700"><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select></label>}
    </div>
    <div className="flex items-center justify-between gap-3 sm:justify-end">
      <button aria-label="Trang trước" disabled={page === 0} onClick={() => onChange(page - 1)} className="grid h-9 w-9 place-items-center rounded-md border border-slate-200 text-slate-600 hover:border-brand-primary/40 disabled:opacity-35"><ChevronLeft size={16} /></button>
      <span className="min-w-20 text-center text-xs font-bold text-slate-500">Trang {page + 1}/{pages}</span>
      <button aria-label="Trang sau" disabled={page + 1 >= pages} onClick={() => onChange(page + 1)} className="grid h-9 w-9 place-items-center rounded-md border border-slate-200 text-slate-600 hover:border-brand-primary/40 disabled:opacity-35"><ChevronRight size={16} /></button>
    </div>
  </nav>;
}

export function StatusBadge({ label, tone = "slate" }: { label: string; tone?: "slate" | "amber" | "blue" | "green" | "red" }) {
  const classes = { slate: "bg-slate-100 text-slate-700", amber: "bg-amber-50 text-amber-800", blue: "bg-blue-50 text-blue-700", green: "bg-emerald-50 text-emerald-700", red: "bg-rose-50 text-rose-700" };
  return <span className={`inline-flex rounded px-2 py-1 text-[11px] font-black ${classes[tone]}`}>{label}</span>;
}
