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
import { operationalReportsApi } from "../../api/operationalReports";
import { useRealtimeRefresh } from "../../realtime/useRealtimeRefresh";

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
export function AdminOperationsDashboard({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [finance, setFinance] = useState<any>(null);
  const [recentActivities, setRecentActivities] = useState<AuditItem[]>([]);
  const [selectedAudit, setSelectedAudit] = useState<AuditItem | null>(null);
  const [summaryTotals, setSummaryTotals] = useState({
    staff: 0,
    activeStaff: 0,
    openDisputes: 0,
    pendingTerminations: 0,
    failedTransactions: 0,
    pendingSettlements: 0,
  });

  const load = async (opts?: boolean | unknown) => {
    const isSilent = opts === true;
    if (!isSilent) {
      setLoading(true);
    }
    setError("");
    try {
      const [userRows, financialOverview, recentActivityPage, staffPage, activeStaffPage, openDisputesPage, pendingTerminationsPage, failedTransactionsPage, pendingSettlementsPage] = await Promise.all([
        adminUsersApi.list({ page: 0, size: 50 }).catch(() => ({ content: [] })),
        contractsApi.getAdminFinancialOverview().catch(() => null),
        operationalReportsApi.activities({ page: 0, size: 10 }),
        adminUsersApi.list({ role: "STAFF", page: 0, size: 1 }).catch(() => ({ totalElements: 0 })),
        adminUsersApi.list({ role: "STAFF", status: "ACTIVE", page: 0, size: 1 }).catch(() => ({ totalElements: 0 })),
        contractsApi.listDisputes({ page: 0, size: 1, statusGroup: "PENDING" }).catch(() => ({ totalElements: 0 })),
        terminationsApi.page({ page: 0, size: 1, statusGroup: "PENDING" }).catch(() => ({ totalElements: 0 })),
        contractsApi.listAllTransactions({ page: 0, size: 1, statusGroup: "FAILED" }).catch(() => ({ totalElements: 0 })),
        contractsApi.listAdminSettlements({ page: 0, size: 1, statusGroup: "PENDING" }).catch(() => ({ totalElements: 0 }))
      ]);
      setUsers(pageItems(userRows));
      setFinance(financialOverview);
      setRecentActivities(pageItems(recentActivityPage));
      setSummaryTotals({
        staff: Number(staffPage?.totalElements || 0),
        activeStaff: Number(activeStaffPage?.totalElements || 0),
        openDisputes: Number(openDisputesPage?.totalElements || 0),
        pendingTerminations: Number(pendingTerminationsPage?.totalElements || 0),
        failedTransactions: Number(failedTransactionsPage?.totalElements || 0),
        pendingSettlements: Number(pendingSettlementsPage?.totalElements || 0),
      });
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
  }, []);

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

  const staffBoard = useMemo(() => {
    const map = new Map<string, { email: string; total: number; approved: number; rejected: number; disputes: number; terminations: number; last?: string | null }>();
    for (const item of audit) {
      if (!item.actor) continue;
      const key = item.actor.toLowerCase();
      const row = map.get(key) || { email: item.actor, total: 0, approved: 0, rejected: 0, disputes: 0, terminations: 0, last: item.at };
      row.total += 1;
      if (["APPROVED", "APPROVE", "FORCE_APPROVE", "RECOMMENDED"].includes(item.status)) row.approved += 1;
      if (["REJECTED", "REJECT"].includes(item.status)) row.rejected += 1;
      if (item.id.startsWith("dispute-")) row.disputes += 1;
      if (item.id.startsWith("termination-")) row.terminations += 1;
      if (new Date(item.at || 0).getTime() > new Date(row.last || 0).getTime()) row.last = item.at;
      map.set(key, row);
    }
    return [...map.values()].sort((a, b) => b.total - a.total).slice(0, 8);
  }, [audit]);

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

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Metric icon={Users} label="Staff hoạt động" value={loading ? "..." : `${summaryTotals.activeStaff}/${summaryTotals.staff}`} />
        <Metric icon={WalletCards} label="Escrow đang khóa" value={loading ? "..." : `$${Number(finance?.totalEscrowLockedUsdc || 0).toFixed(2)}`} tone="indigo" />
        <Metric icon={ShieldAlert} label="Khiếu nại mở" value={loading ? "..." : summaryTotals.openDisputes} tone="amber" />
        <Metric icon={ShieldCheck} label="Thanh lý chờ" value={loading ? "..." : summaryTotals.pendingTerminations} tone="rose" />
        <Metric icon={Activity} label="Tx lỗi" value={loading ? "..." : summaryTotals.failedTransactions} tone="rose" />
        <Metric icon={CheckCircle2} label="Settlement chờ" value={loading ? "..." : summaryTotals.pendingSettlements} tone="emerald" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-lg font-black">Bảng giám sát Staff</h2>
              <p className="mt-1 text-xs font-semibold text-slate-500">Tổng hợp từ 10 thao tác Staff/Admin mới nhất.</p>
            </div>
            <button type="button" onClick={() => onNavigate?.("user-management")} className="text-xs font-black text-indigo-600 hover:text-indigo-800">Quản lý Staff</button>
          </div>
          {loading ? (
            <div className="h-40 animate-pulse bg-slate-100" />
          ) : staffBoard.length === 0 ? (
            <div className="py-10 text-center text-sm font-bold text-slate-400">Chưa có lịch sử thao tác Staff/Admin.</div>
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
  const ok = ["APPROVED", "APPROVE", "FORCE_APPROVE", "RECOMMENDED", "RESOLVED"].includes(text);
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
