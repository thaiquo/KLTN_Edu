import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileText,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Users,
  WalletCards
} from "lucide-react";
import { adminUsersApi } from "../../api/adminUsers";
import { contractsApi } from "../../api/contractsApi";
import { terminationsApi } from "../../api/terminationsApi";
import { adminAnalyticsApi, operationalReportsApi, operationalWorkItemsApi } from "../../api/operationalReports";
import { useRealtimeRefresh } from "../../realtime/useRealtimeRefresh";
import { projectAdminSlaMetrics } from "./staff/actionCenterState";
import { AdminAnalyticsCharts } from "./AdminAnalyticsCharts";

type AuditItem = {
  id: string;
  at?: string | null;
  actor?: string | null;
  actorName?: string | null;
  type: string;
  target: string;
  status: string;
  note?: string | null;
};

const pageItems = (value: any) => Array.isArray(value) ? value : (Array.isArray(value?.content) ? value.content : []);
const fmt = (value?: string | null) => value ? new Date(value).toLocaleString("vi-VN") : "--";
const metric = (value: number | null) => value == null ? "Không khả dụng" : value;
export function AdminOperationsDashboard({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sourceErrors, setSourceErrors] = useState<string[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [finance, setFinance] = useState<any>(null);
  const [recentActivities, setRecentActivities] = useState<AuditItem[]>([]);
  const [reportSummary, setReportSummary] = useState<any>(null);
  const [slaSummary, setSlaSummary] = useState<any>(null);
  const [sourceHealth, setSourceHealth] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [financialRange, setFinancialRange] = useState(30);
  const [selectedAudit, setSelectedAudit] = useState<AuditItem | null>(null);
  const [summaryTotals, setSummaryTotals] = useState({
    staff: null as number | null,
    activeStaff: null as number | null,
    openDisputes: null as number | null,
    pendingTerminations: null as number | null,
    failedTransactions: null as number | null,
    pendingSettlements: null as number | null,
  });

  const load = async (opts?: boolean | unknown) => {
    const isSilent = opts === true;
    if (!isSilent) {
      setLoading(true);
    }
    setError("");
    setSourceErrors([]);
    try {
      const results = await Promise.allSettled([
        adminUsersApi.list({ page: 0, size: 50 }),
        contractsApi.getAdminFinancialOverview(),
        operationalReportsApi.activities({ page: 0, size: 10 }),
        operationalReportsApi.summary({}),
        operationalWorkItemsApi.summary(),
        adminUsersApi.list({ role: "STAFF", page: 0, size: 1 }),
        adminUsersApi.list({ role: "STAFF", status: "ACTIVE", page: 0, size: 1 }),
        contractsApi.listDisputes({ page: 0, size: 1, statusGroup: "PENDING" }),
        terminationsApi.page({ page: 0, size: 1, statusGroup: "PENDING" }),
        contractsApi.listAllTransactions({ page: 0, size: 1, statusGroup: "FAILED" }),
        contractsApi.listAdminSettlements({ page: 0, size: 1, statusGroup: "PENDING" }),
        operationalWorkItemsApi.health(),
        adminAnalyticsApi.dashboard({ rangeDays: financialRange })
      ]);
      const [usersResult, financeResult, recentResult, reportSummaryResult, slaSummaryResult, staffResult, activeStaffResult,
        disputesResult, terminationsResult, transactionsResult, settlementsResult, healthResult, analyticsResult] = results;
      const errors: string[] = [];
      const value = (result: PromiseSettledResult<any>, label: string) => {
        if (result.status === "fulfilled") return result.value;
        errors.push(label);
        return null;
      };
      const userRows = value(usersResult, "danh bạ người dùng");
      const financialOverview = value(financeResult, "tổng quan tài chính");
      const recentActivityPage = value(recentResult, "hoạt động gần đây");
      const allReportSummary = value(reportSummaryResult, "hiệu suất Staff");
      const operationalSla = value(slaSummaryResult, "SLA tác nghiệp");
      if (Array.isArray(allReportSummary?.sources)) {
        allReportSummary.sources
          .filter((source: any) => source.status !== "SUCCESS")
          .forEach((source: any) => errors.push(`báo cáo ${source.source}`));
      }
      const staffPage = value(staffResult, "tổng Staff");
      const activeStaffPage = value(activeStaffResult, "Staff hoạt động");
      const openDisputesPage = value(disputesResult, "khiếu nại");
      const pendingTerminationsPage = value(terminationsResult, "thanh lý");
      const failedTransactionsPage = value(transactionsResult, "giao dịch lỗi");
      const pendingSettlementsPage = value(settlementsResult, "settlement");
      const healthDiagnostics = value(healthResult, "chẩn đoán nguồn tác nghiệp");
      const dashboardAnalytics = value(analyticsResult, "analytics dashboard");
      setUsers(pageItems(userRows));
      setFinance(financialOverview);
      setRecentActivities(pageItems(recentActivityPage));
      if (Array.isArray(operationalSla?.sources)) {
        operationalSla.sources
          .filter((source: any) => source.status !== "SUCCESS")
          .forEach((source: any) => errors.push(`SLA ${source.source}`));
      }
      setReportSummary(allReportSummary);
      setSlaSummary(operationalSla);
      setSourceHealth(Array.isArray(healthDiagnostics?.operational?.sources) ? healthDiagnostics.operational.sources : []);
      setAnalytics(dashboardAnalytics);
      if (dashboardAnalytics?.operational?.status === "UNAVAILABLE") errors.push("analytics tác nghiệp");
      if (dashboardAnalytics?.financial?.status === "UNAVAILABLE") errors.push("xu hướng tài chính");
      setSummaryTotals({
        staff: staffPage ? Number(staffPage.totalElements ?? 0) : null,
        activeStaff: activeStaffPage ? Number(activeStaffPage.totalElements ?? 0) : null,
        openDisputes: openDisputesPage ? Number(openDisputesPage.totalElements ?? 0) : null,
        pendingTerminations: pendingTerminationsPage ? Number(pendingTerminationsPage.totalElements ?? 0) : null,
        failedTransactions: failedTransactionsPage ? Number(failedTransactionsPage.totalElements ?? 0) : null,
        pendingSettlements: pendingSettlementsPage ? Number(pendingSettlementsPage.totalElements ?? 0) : null,
      });
      setSourceErrors(errors);
      if (recentResult.status === "rejected") setError("Không thể tải nhật ký hoạt động gần đây.");
    } catch (err: any) {
      setRecentActivities([]);
      setError(err?.message || "Không thể tải bảng điều hành Admin.");
    } finally {
      if (!isSilent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    load(false);
  }, [financialRange]);

  useRealtimeRefresh(
    [
      "DISPUTE_OPENED",
      "DISPUTE_UPDATED",
      "DISPUTE_RESOLVED",
      "DISPUTE_MUTATED",
      "SESSION_SETTLED",
      "TERMINATION_REQUESTED",
      "TERMINATION_RECOMMENDED",
      "TERMINATION_APPROVED",
      "CLASS_MUTATED",
      "CLASS_REVIEWED",
      "TUTOR_APPLICATION_SUBMITTED",
      "TUTOR_APPLICATION_REVIEWED",
    ],
    () => load(true)
  );

  const userNameByEmail = useMemo(() => {
    return new Map(
      users
        .filter((user) => user?.email)
        .map((user) => [String(user.email).toLowerCase(), user.fullName || user.name || null])
    );
  }, [users]);

  const actorName = (email?: string | null) => email ? userNameByEmail.get(String(email).toLowerCase()) || null : null;

  const audit = useMemo<AuditItem[]>(() => recentActivities.map((item) => ({
    ...item,
    actorName: actorName(item.actor)
  })), [recentActivities, users]);

  const staffBoard = useMemo(() => (reportSummary?.staffPerformance || []).slice(0, 8).map((row: any) => ({
    email: row.email,
    total: row.total,
    approved: row.approved,
    rejected: row.rejected,
    disputes: row.disputeCount,
    terminations: row.terminationCount,
    last: row.lastActivityAt
  })), [reportSummary]);
  const slaMetrics = useMemo(() => projectAdminSlaMetrics(slaSummary), [slaSummary]);
  const workload = useMemo(() => {
    const rows = new Map<string, { assignee: string; open: number; dueSoon: number; overdue: number; escalated: number }>();
    (analytics?.operational?.data?.staffWorkload || []).forEach((item: any) => {
      rows.set(item.assignee, { assignee: item.assignee, open: item.assigned, dueSoon: item.dueSoon, overdue: item.overdue, escalated: item.normal + item.notApplicable });
    });
    return Array.from(rows.values());
  }, [analytics]);

  return (
    <div className="min-h-[calc(100vh-96px)] bg-[#f3f6f9] p-0 text-slate-900">
      <header className="mb-5 flex flex-col gap-4 border border-slate-200 bg-white px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Admin Command Center</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-[#0f172a]">Giám sát vận hành, Staff và dòng tiền</h1>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Admin có thể thao tác toàn quyền như Staff khi cần, đồng thời theo dõi các tín hiệu vận hành gần đây và điểm cần can thiệp.
          </p>
        </div>
        <button onClick={load} className="inline-flex w-fit items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 hover:border-indigo-300">
          <RefreshCw className="h-4 w-4" /> Làm mới
        </button>
      </header>

      {error && (
        <div className="mb-4 flex items-center gap-2 border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}
      {!error && sourceErrors.length > 0 && (
        <div className="mb-4 flex items-center justify-between gap-3 border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800">
          <span>Dữ liệu tải một phần. Chưa thể tải: {sourceErrors.join(", ")}.</span>
          <button type="button" onClick={load} className="shrink-0 underline underline-offset-2">Thử lại</button>
        </div>
      )}

      <div data-testid="admin-sla-summary" className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
        <Metric icon={AlertTriangle} label="SLA quá hạn" value={loading ? "..." : metric(slaMetrics.overdue)} tone="rose" />
        <Metric icon={Activity} label="SLA sắp hạn" value={loading ? "..." : metric(slaMetrics.dueSoon)} tone="amber" />
        <Metric icon={Users} label="Staff hoạt động" value={loading ? "..." : summaryTotals.activeStaff == null || summaryTotals.staff == null ? "Không khả dụng" : `${summaryTotals.activeStaff}/${summaryTotals.staff}`} />
        <Metric icon={WalletCards} label="Escrow đang khóa" value={loading ? "..." : finance == null ? "Không khả dụng" : `$${Number(finance.totalEscrowLockedUsdc ?? 0).toFixed(2)}`} tone="indigo" />
        <Metric icon={ShieldAlert} label="Khiếu nại mở" value={loading ? "..." : metric(summaryTotals.openDisputes)} tone="amber" />
        <Metric icon={ShieldCheck} label="Thanh lý chờ" value={loading ? "..." : metric(summaryTotals.pendingTerminations)} tone="rose" />
        <Metric icon={Activity} label="Tx lỗi" value={loading ? "..." : metric(summaryTotals.failedTransactions)} tone="rose" />
        <Metric icon={CheckCircle2} label="Settlement chờ" value={loading ? "..." : metric(summaryTotals.pendingSettlements)} tone="emerald" />
      </div>

      <AdminAnalyticsCharts dashboard={analytics} loading={loading} rangeDays={financialRange} onRangeChange={setFinancialRange} />

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-lg font-black">Bảng giám sát Staff</h2>
              <p className="mt-1 text-xs font-semibold text-slate-500">Tổng hợp toàn bộ thao tác Staff/Admin trong dữ liệu báo cáo hiện tại.</p>
            </div>
            <button type="button" onClick={() => onNavigate?.("user-management")} className="text-xs font-black text-indigo-600 hover:text-indigo-800">Quản lý Staff</button>
          </div>
          {loading ? (
            <div className="h-40 animate-pulse bg-slate-100" />
          ) : staffBoard.length === 0 ? (
            <div className="py-10 text-center text-sm font-bold text-slate-400">
              {reportSummary == null ? "Không thể tải dữ liệu hiệu suất Staff." : "Chưa có lịch sử thao tác Staff/Admin."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-semibold text-slate-600">
                <thead className="border-b border-slate-100 text-[10px] font-black uppercase text-slate-400">
                  <tr>
                    <th className="py-3 pr-3">Staff/Admin</th>
                    <th className="py-3 pr-3">Tổng</th>
                    <th className="py-3 pr-3">Duyệt/Đề xuất</th>
                    <th className="py-3 pr-3">Từ chối</th>
                    <th className="py-3 pr-3">Khiếu nại</th>
                    <th className="py-3 pr-3">Hợp đồng/Thanh lý</th>
                    <th className="py-3">Gần nhất</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {staffBoard.map((row) => (
                    <tr key={row.email} className="hover:bg-slate-50">
                      <td className="py-3 pr-3 font-bold text-slate-900 max-w-[200px]">
                        <p className="truncate font-bold text-slate-900">{actorName(row.email) || row.email}</p>
                        {actorName(row.email) && <p className="truncate text-[10px] font-semibold text-slate-400 font-mono">{row.email}</p>}
                      </td>
                      <td className="py-3 pr-3">{row.total}</td>
                      <td className="py-3 pr-3 text-emerald-700">{row.approved}</td>
                      <td className="py-3 pr-3 text-rose-700">{row.rejected}</td>
                      <td className="py-3 pr-3">{row.disputes}</td>
                      <td className="py-3 pr-3">{row.terminations}</td>
                      <td className="py-3">{fmt(row.last)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 border-b border-slate-100 pb-3 text-lg font-black">Lối tắt xử lý</h2>
          <div className="grid gap-3">
            <Shortcut icon={WalletCards} title="Tài chính & dòng tiền" subtitle="Theo dõi escrow, payout, refund, platform fee" onClick={() => onNavigate?.("admin-finance")} />
            <Shortcut icon={ShieldCheck} title="Hợp đồng Escrow" subtitle="Xem hợp đồng, thanh lý, audit blockchain" onClick={() => onNavigate?.("contracts")} />
            <Shortcut icon={ShieldAlert} title="Phân xử khiếu nại" subtitle="Admin xử lý toàn bộ, Staff xử lý lớp phụ trách" onClick={() => onNavigate?.("complaints")} />
            <Shortcut icon={FileText} title="Duyệt hồ sơ & lớp học" subtitle="Admin thao tác như Staff khi cần giảm tải" onClick={() => onNavigate?.("tutor-approval")} />
          </div>
        </section>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <section data-testid="admin-source-health" className="border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black">Sức khỏe nguồn tác nghiệp</h2>
          <p className="mt-1 text-xs font-semibold text-slate-500">Độ trễ, lần kiểm tra và lần thành công gần nhất; không hiển thị URL hoặc lỗi nội bộ nhạy cảm.</p>
          <div className="mt-4 space-y-2">{sourceHealth.length === 0 ? <p className="py-6 text-center text-sm font-bold text-slate-400">Chưa có dữ liệu chẩn đoán.</p> : sourceHealth.map((source: any) => <div key={source.source} className="grid gap-2 border border-slate-100 p-3 text-xs sm:grid-cols-[1fr_auto_auto]"><div><p className="font-black text-slate-900">{source.source}</p><p className="mt-1 text-slate-500">{source.errorSummary || `Lần thành công: ${fmt(source.lastSuccessfulRefresh)}`}</p></div><span className={`h-fit rounded-full px-2 py-1 text-[10px] font-black ${source.status === "SUCCESS" ? "bg-emerald-50 text-emerald-700" : source.status === "DEGRADED" ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"}`}>{source.status}</span><div className="text-right font-bold text-slate-500"><p>{source.latencyMs} ms</p><p>{source.itemCount == null ? "Không xác định" : `${source.itemCount} việc`}</p></div></div>)}</div>
        </section>
        <section data-testid="admin-workload" className="border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black">Khối lượng đang mở</h2>
          <p className="mt-1 text-xs font-semibold text-slate-500">Snapshot assignment bounded từ backend; không phải điểm xếp hạng Staff.</p>
          <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-xs"><thead className="border-b border-slate-100 text-[10px] font-black uppercase text-slate-400"><tr><th className="py-2">Phụ trách</th><th>Được giao</th><th>Sắp hạn</th><th>Quá hạn</th><th>Bình thường/N.A.</th></tr></thead><tbody className="divide-y divide-slate-100">{workload.map(row => <tr key={row.assignee}><td className="max-w-[220px] py-3 pr-2 font-bold text-slate-900"><span className="block truncate" title={row.assignee}>{row.assignee}</span></td><td>{row.open}</td><td className="text-amber-700">{row.dueSoon}</td><td className="text-rose-700">{row.overdue}</td><td>{row.escalated}</td></tr>)}</tbody></table>{workload.length === 0 && <p className="py-8 text-center text-sm font-bold text-slate-400">Không có assignment trong snapshot hiện tại.</p>}</div>
        </section>
      </div>

      <section className="mt-5 border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-lg font-black">Lịch sử Staff xử lý gần đây</h2>
            <p className="mt-1 text-xs font-semibold text-slate-500">10 thao tác mới nhất của Staff/Admin.</p>
          </div>
        </div>
        {loading ? (
          <div className="h-36 animate-pulse bg-slate-100" />
        ) : audit.length === 0 ? (
          <div className="py-10 text-center text-sm font-bold text-slate-400">Chưa có thao tác gần đây.</div>
        ) : (
          <AuditTable rows={audit} onSelect={setSelectedAudit} />
        )}
        <div className="mt-4 flex justify-end border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => onNavigate?.("reports")}
            className="inline-flex items-center gap-1.5 text-xs font-black text-indigo-600 hover:text-indigo-800"
          >
            Xem toàn bộ lịch sử <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      {selectedAudit && <AuditDetailModal item={selectedAudit} onClose={() => setSelectedAudit(null)} />}
    </div>
  );
}

function AuditTable({ rows, onSelect }: { rows: AuditItem[]; onSelect?: (item: AuditItem) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs font-semibold text-slate-600">
        <thead className="border-b border-slate-100 text-[10px] font-black uppercase text-slate-400">
          <tr>
            <th className="py-3 pr-3">Thời gian</th>
            <th className="py-3 pr-3">Người làm</th>
            <th className="py-3 pr-3">Nghiệp vụ</th>
            <th className="py-3 pr-3">Đối tượng</th>
            <th className="py-3 pr-3">Trạng thái</th>
            <th className="py-3">Ghi chú</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((item) => (
            <tr
              key={item.id}
              className="cursor-pointer hover:bg-indigo-50/50"
              onClick={() => onSelect?.(item)}
            >
              <td className="whitespace-nowrap py-3 pr-3">{fmt(item.at)}</td>
              <td className="max-w-[220px] py-3 pr-3" title={[item.actorName, item.actor].filter(Boolean).join(" - ")}>
                <p className="truncate font-bold text-slate-900">{item.actorName || item.actor || "--"}</p>
                {item.actorName && item.actor && <p className="truncate text-[10px] font-semibold text-slate-400">{item.actor}</p>}
              </td>
              <td className="py-3 pr-3">{item.type}</td>
              <td className="max-w-[260px] truncate py-3 pr-3" title={item.target}>{item.target}</td>
              <td className="py-3 pr-3"><Status value={item.status} /></td>
              <td className="max-w-[320px] truncate py-3 text-slate-500" title={item.note || ""}>{item.note || "--"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AuditDetailModal({ item, onClose }: { item: AuditItem; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" onClick={onClose}>
      <div className="w-full max-w-xl border border-slate-200 bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600">Chi tiết dấu vết xử lý</p>
            <h3 className="mt-1 text-lg font-black text-slate-950">{item.type}</h3>
            <p className="mt-1 text-xs font-semibold text-slate-500">{item.target}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50">
            Đóng
          </button>
        </div>

        <div className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
          <DetailBox label="Người xử lý" value={item.actorName ? `${item.actorName} (${item.actor || "--"})` : (item.actor || "--")} />
          <DetailBox label="Thời điểm" value={fmt(item.at)} />
          <DetailBox label="Nghiệp vụ" value={item.type} />
          <DetailBox label="Trạng thái" value={item.status || "--"} />
        </div>

        <div className="mt-4 border border-slate-200 bg-slate-50 p-4 text-xs">
          <p className="font-black uppercase tracking-wide text-slate-400">Ghi chú / lý do</p>
          <p className="mt-2 whitespace-pre-wrap font-semibold leading-6 text-slate-700">{item.note || "--"}</p>
        </div>
      </div>
    </div>
  );
}

function DetailBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-slate-200 bg-white p-3">
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 break-words font-black text-slate-900">{value}</p>
    </div>
  );
}

function Metric({ icon: Icon, label, value, tone = "slate" }: { icon: any; label: string; value: React.ReactNode; tone?: "slate" | "emerald" | "rose" | "amber" | "indigo" }) {
  const toneClass = {
    slate: "bg-white text-slate-900 border-slate-200",
    emerald: "bg-emerald-50 text-emerald-800 border-emerald-200",
    rose: "bg-rose-50 text-rose-800 border-rose-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    indigo: "bg-indigo-50 text-indigo-800 border-indigo-200"
  }[tone];
  return (
    <div className={`border p-4 shadow-sm ${toneClass}`}>
      <Icon className="mb-3 h-5 w-5" />
      <p className="text-[10px] font-black uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
}

function Shortcut({ icon: Icon, title, subtitle, onClick }: { icon: any; title: string; subtitle: string; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-left hover:border-indigo-200 hover:bg-indigo-50">
      <Icon className="h-5 w-5 text-indigo-600" />
      <span>
        <span className="block text-sm font-black text-slate-900">{title}</span>
        <span className="block text-xs font-semibold text-slate-500">{subtitle}</span>
      </span>
    </button>
  );
}

function Status({ value }: { value: string }) {
  const text = String(value || "--");
  const ok = ["APPROVED", "APPROVE", "FORCE_APPROVE", "RESOLVED"].includes(text);
  const bad = ["REJECTED", "REJECT", "FAILED", "FAILED_RETRYABLE"].includes(text);
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase ${
      ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" :
      bad ? "border-rose-200 bg-rose-50 text-rose-700" :
      "border-slate-200 bg-slate-50 text-slate-600"
    }`}>
      {text}
    </span>
  );
}
