import React, { useEffect, useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";
import { AlertTriangle, BarChart3, CircleDollarSign, Users } from "lucide-react";

const SOURCE_LABELS: Record<string, string> = {
  TUTOR_APPLICATION: "Hồ sơ Tutor",
  TEACHING_REGISTRATION: "Đăng ký giảng dạy",
  CLASS_APPROVAL: "Duyệt lớp",
  COMMUNITY_MODERATION: "Kiểm duyệt cộng đồng",
  SUPPORT_TICKET: "Hỗ trợ",
  DISPUTE: "Khiếu nại",
  TERMINATION: "Thanh lý"
};
const SLA_COLORS = { NORMAL: "#10b981", DUE_SOON: "#f59e0b", OVERDUE: "#e11d48" };

export function AdminAnalyticsCharts({ dashboard, loading, rangeDays, onRangeChange }: {
  dashboard: any;
  loading: boolean;
  rangeDays: number;
  onRangeChange: (value: number) => void;
}) {
  const operational = dashboard?.operational?.data;
  const operationalUnavailable = dashboard?.operational?.status === "UNAVAILABLE";
  const financialUnavailable = dashboard?.financial?.status === "UNAVAILABLE";
  const financialSeries = Array.isArray(dashboard?.financial?.data?.series) ? dashboard.financial.data.series : [];
  const [currency, setCurrency] = useState("");

  useEffect(() => {
    if (!financialSeries.some((item: any) => item.currency === currency)) {
      setCurrency(financialSeries[0]?.currency || "");
    }
  }, [financialSeries, currency]);

  const sourceData = useMemo(() => (operational?.workItemsBySource || [])
    .filter((row: any) => row.openCount != null)
    .map((row: any) => ({ name: SOURCE_LABELS[row.source] || row.source, open: Number(row.openCount) })), [operational]);
  const unavailableSources = (operational?.workItemsBySource || []).filter((row: any) => row.openCount == null);
  const slaData = useMemo(() => {
    const sla = operational?.sla;
    if (!sla) return [];
    return [
      { name: "Bình thường", key: "NORMAL", value: Number(sla.normal || 0) },
      { name: "Sắp hạn", key: "DUE_SOON", value: Number(sla.dueSoon || 0) },
      { name: "Quá hạn", key: "OVERDUE", value: Number(sla.overdue || 0) }
    ].filter(item => item.value > 0);
  }, [operational]);
  const workload = useMemo(() => (operational?.staffWorkload || []).slice(0, 10).map((row: any) => ({
    name: String(row.assignee || "--").split("@")[0], fullName: row.assignee,
    normal: Number(row.normal || 0) + Number(row.notApplicable || 0),
    dueSoon: Number(row.dueSoon || 0), overdue: Number(row.overdue || 0)
  })), [operational]);
  const selectedSeries = financialSeries.find((item: any) => item.currency === currency) || financialSeries[0];
  const financialData = (selectedSeries?.points || []).map((row: any) => ({
    period: row.period, released: Number(row.releasedAmount || 0),
    pending: Number(row.pendingAmount || 0), refund: Number(row.refundAmount || 0),
    contractValue: Number(row.contractValue || 0)
  }));

  return (
    <section data-testid="admin-analytics-dashboard" className="mt-5 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600">Operational analytics</p>
          <h2 className="mt-1 text-xl font-black text-slate-950">Tổng quan vận hành và dòng tiền</h2>
          <p className="mt-1 text-xs font-semibold text-slate-500">Dữ liệu tổng hợp tại backend; nguồn lỗi không được thay bằng số 0.</p>
        </div>
        <label className="flex items-center gap-2 text-xs font-black text-slate-600">
          Xu hướng tài chính
          <select data-testid="financial-range" value={rangeDays} onChange={event => onRangeChange(Number(event.target.value))}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 outline-none focus:border-indigo-400">
            <option value={30}>30 ngày</option><option value={90}>90 ngày</option>
          </select>
        </label>
      </div>

      <div className="grid min-w-0 gap-5 xl:grid-cols-2">
        <ChartCard testId="chart-work-items" title="Công việc cần xử lý theo chức năng" icon={BarChart3}
          loading={loading} unavailable={operationalUnavailable} empty={!operationalUnavailable && (sourceData.length === 0 || sourceData.every((item: any) => item.open === 0))}
          note={unavailableSources.length ? `Thiếu nguồn: ${unavailableSources.map((row: any) => SOURCE_LABELS[row.source] || row.source).join(", ")}` : undefined}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0}><BarChart data={sourceData} margin={{ top: 8, right: 8, left: -20, bottom: 48 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" angle={-28} textAnchor="end" interval={0} height={70} tick={{ fontSize: 10 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="open" name="Đang mở" fill="#4f46e5" radius={[5, 5, 0, 0]} />
          </BarChart></ResponsiveContainer>
        </ChartCard>

        <ChartCard testId="chart-sla" title="Tình trạng xử lý công việc" icon={AlertTriangle}
          loading={loading} unavailable={operationalUnavailable} empty={!operationalUnavailable && slaData.length === 0}
          note={operational?.sla?.notApplicable ? `${operational.sla.notApplicable} việc không áp dụng SLA, không tính vào tỷ lệ.` : undefined}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0}><PieChart><Pie data={slaData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={3}>
            {slaData.map((item: any) => <Cell key={item.key} fill={SLA_COLORS[item.key as keyof typeof SLA_COLORS]} />)}
          </Pie><Tooltip /><Legend verticalAlign="bottom" /></PieChart></ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid min-w-0 gap-5 xl:grid-cols-2">
        <ChartCard testId="chart-staff-workload" title="Khối lượng công việc của nhân viên" icon={Users}
          loading={loading} unavailable={operationalUnavailable} empty={!operationalUnavailable && workload.length === 0}
          note={operational?.partial ? "Snapshot chưa đầy đủ vì một hoặc nhiều nguồn tác nghiệp không khả dụng." : "Số lượng assignment, không phải điểm đánh giá hiệu suất."}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0}><BarChart data={workload} layout="vertical" margin={{ left: 8, right: 12 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
            <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10 }} /><Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ""} />
            <Legend /><Bar stackId="work" dataKey="normal" name="Bình thường" fill="#10b981" /><Bar stackId="work" dataKey="dueSoon" name="Sắp hạn" fill="#f59e0b" />
            <Bar stackId="work" dataKey="overdue" name="Quá hạn" fill="#e11d48" radius={[0, 5, 5, 0]} />
          </BarChart></ResponsiveContainer>
        </ChartCard>

        <ChartCard testId="chart-financial" title="Tình hình tài chính theo thời gian" icon={CircleDollarSign}
          loading={loading} unavailable={financialUnavailable} empty={!financialUnavailable && financialData.length === 0}
          action={financialSeries.length > 1 ? <select value={currency} onChange={event => setCurrency(event.target.value)} className="rounded border border-slate-200 px-2 py-1 text-[10px] font-bold">{financialSeries.map((item: any) => <option key={item.currency}>{item.currency}</option>)}</select> : undefined}
          note={selectedSeries ? `Đơn vị: ${selectedSeries.currency}. Released không bao gồm refund; Contract Value là giá trị hợp đồng tạo trong kỳ.` : undefined}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0}><LineChart data={financialData} margin={{ top: 8, right: 10, left: -8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="period" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} />
            <Tooltip formatter={(value: any) => [`${Number(value).toLocaleString("vi-VN")} ${selectedSeries?.currency || ""}`]} /><Legend />
            <Line type="monotone" dataKey="released" name="Đã giải ngân" stroke="#10b981" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="pending" name="Đang xử lý" stroke="#f59e0b" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="refund" name="Hoàn tiền" stroke="#e11d48" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="contractValue" name="Contract Value" stroke="#4f46e5" strokeWidth={2} dot={false} />
          </LineChart></ResponsiveContainer>
        </ChartCard>
      </div>
    </section>
  );
}

function ChartCard({ testId, title, icon: Icon, loading, unavailable, empty, note, action, children }: any) {
  return <article data-testid={testId} className="min-w-0 overflow-hidden border border-slate-200 bg-white p-5 shadow-sm">
    <header className="flex items-start justify-between gap-3"><div className="flex items-center gap-2"><Icon className="h-5 w-5 text-indigo-600" /><h3 className="font-black text-slate-950">{title}</h3></div>{action}</header>
    {note && <p className="mt-2 text-[11px] font-semibold text-amber-700">{note}</p>}
    <div className="mt-4 h-72 min-w-0">
      {loading ? <div data-testid={`${testId}-loading`} className="h-full animate-pulse bg-slate-100" />
        : unavailable ? <State text="Nguồn dữ liệu tạm thời không khả dụng." tone="rose" />
        : empty ? <State text="Chưa có dữ liệu trong phạm vi hiện tại." tone="slate" /> : children}
    </div>
  </article>;
}

function State({ text, tone }: { text: string; tone: "rose" | "slate" }) {
  return <div className={`flex h-full items-center justify-center border border-dashed text-center text-sm font-bold ${tone === "rose" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-slate-200 bg-slate-50 text-slate-400"}`}>{text}</div>;
}
