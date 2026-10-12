import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  FileText,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Users,
  WalletCards
} from "lucide-react";
import { adminUsersApi } from "../../api/adminUsers";
import { staffTutorsApi } from "../../api/staffTutors";
import { teachingRegistrationApi } from "../../api/teachingRegistrations";
import { classApi } from "../../api/classes";
import { contractsApi } from "../../api/contractsApi";
import { terminationsApi, TerminationView } from "../../api/terminationsApi";

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
const byNewest = (a: AuditItem, b: AuditItem) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime();

function terminationAudit(cases: TerminationView[]): AuditItem[] {
  return cases.flatMap((item) => {
    let entries: any[] = [];
    try {
      entries = JSON.parse(item.request.auditJson || "[]");
    } catch {
      entries = [];
    }
    return entries
      .filter((entry) => ["STAFF", "ADMIN"].includes(String(entry.role || "").toUpperCase()))
      .map((entry, index) => ({
        id: `termination-${item.request.id}-${index}`,
        at: entry.at,
        actor: entry.actor,
        type: "Thẩm định hợp đồng / thanh lý",
        target: `Lớp #${item.request.classroomId}${item.request.wholeClass ? " (cả lớp)" : ""}`,
        status: entry.action || item.request.status,
        note: entry.reason
      }));
  });
}

export function AdminOperationsDashboard({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [finance, setFinance] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [terminations, setTerminations] = useState<TerminationView[]>([]);
  const [tutorHistory, setTutorHistory] = useState<any[]>([]);
  const [teachingHistory, setTeachingHistory] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedAudit, setSelectedAudit] = useState<AuditItem | null>(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [userRows, financialOverview, txPage, settlementPage, disputePage, terminationRows, tutorRows, teachingRows, classRows] = await Promise.all([
        adminUsersApi.list().catch(() => []),
        contractsApi.getAdminFinancialOverview().catch(() => null),
        contractsApi.listAllTransactions({ page: 0, size: 50 }).catch(() => ({ content: [] })),
        contractsApi.listAdminSettlements({ page: 0, size: 100 }).catch(() => ({ content: [] })),
        contractsApi.listDisputes({ page: 0, size: 100 }).catch(() => ({ content: [] })),
        terminationsApi.list().catch(() => []),
        staffTutorsApi.history().catch(() => []),
        teachingRegistrationApi.adminHistory().catch(() => []),
        classApi.adminGetAllClasses().catch(() => [])
      ]);
      const classList = Array.isArray(classRows) ? classRows : [];
      const disputeList = pageItems(disputePage);
      const terminationList = Array.isArray(terminationRows) ? terminationRows : [];

      setUsers(Array.isArray(userRows) ? userRows : []);
      setFinance(financialOverview);
      setTransactions(pageItems(txPage));
      setSettlements(pageItems(settlementPage));
      setDisputes(disputeList);
      setTerminations(terminationList);
      setTutorHistory(Array.isArray(tutorRows) ? tutorRows : []);
      setTeachingHistory(Array.isArray(teachingRows) ? teachingRows : []);
      setClasses(classList);
    } catch (err: any) {
      setError(err?.message || "Không thể tải bảng điều hành Admin.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const userNameByEmail = useMemo(() => {
    return new Map(
      users
        .filter((user) => user?.email)
        .map((user) => [String(user.email).toLowerCase(), user.fullName || user.name || null])
    );
  }, [users]);

  const actorName = (email?: string | null) => email ? userNameByEmail.get(String(email).toLowerCase()) || null : null;

  const audit = useMemo<AuditItem[]>(() => {
    const tutor = tutorHistory.map((item) => ({
      id: `tutor-${item.id}`,
      at: item.reviewedAt,
      actor: item.reviewedByEmail,
      actorName: actorName(item.reviewedByEmail),
      type: "Duyệt hồ sơ gia sư",
      target: item.fullName || item.email || `Tutor #${item.userId}`,
      status: item.status,
      note: item.rejectionReason || item.reviewNote
    }));
    const teaching = teachingHistory.map((item) => ({
      id: `teaching-${item.id}`,
      at: item.reviewedAt,
      actor: item.reviewedByEmail,
      actorName: actorName(item.reviewedByEmail),
      type: "Duyệt quyền dạy",
      target: item.proposedSubjectName || item.subject?.name || `Đăng ký #${item.id}`,
      status: item.status,
      note: item.reviewNote || item.rejectReason
    }));
    const classRows = classes
      .filter((item) => item.reviewedAt || item.reviewedByEmail)
      .map((item) => ({
        id: `class-${item.id}`,
        at: item.reviewedAt,
        actor: item.reviewedByEmail,
        actorName: actorName(item.reviewedByEmail),
        type: "Duyệt lớp học",
        target: item.name || item.className || `Lớp #${item.id}`,
        status: item.status,
        note: item.rejectReason
      }));
    const disputeRows = disputes
      .filter((item) => item.resolvedByEmail)
      .map((item) => ({
        id: `dispute-${item.id}`,
        at: item.resolvedAt || item.updatedAt || item.createdAt,
        actor: item.resolvedByEmail,
        actorName: actorName(item.resolvedByEmail),
        type: "Phân xử khiếu nại",
        target: `${item.className || `Lớp #${item.classroomId || "--"}`} / Buổi #${item.sessionId}`,
        status: item.status,
        note: item.resolutionReason
      }));
    return [...tutor, ...teaching, ...classRows, ...disputeRows, ...terminationAudit(terminations).map((item) => ({
      ...item,
      actorName: actorName(item.actor)
    }))]
      .sort(byNewest);
  }, [classes, disputes, teachingHistory, terminations, tutorHistory, users]);

  const stats = useMemo(() => {
    const staffCount = users.filter((u) => u.roles?.includes("STAFF")).length;
    const activeStaff = users.filter((u) => u.roles?.includes("STAFF") && u.accountStatus === "ACTIVE").length;
    const openDisputes = disputes.filter((d) => ["OPENING", "OPEN", "UNDER_REVIEW", "RESOLUTION_PENDING", "FAILED_RETRYABLE"].includes(d.status)).length;
    const pendingTerminations = terminations.filter((t) => !["COMPLETED", "REJECTED"].includes(t.request.status)).length;
    const failedTx = transactions.filter((tx) => ["FAILED", "FAILED_RETRYABLE"].includes(tx.status)).length;
    const pendingSettlements = settlements.filter((s) => !["SETTLED", "REFUNDED"].includes(s.status)).length;
    return { staffCount, activeStaff, openDisputes, pendingTerminations, failedTx, pendingSettlements };
  }, [disputes, settlements, terminations, transactions, users]);

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
            Admin có thể thao tác toàn quyền như Staff khi cần, đồng thời theo dõi toàn bộ lịch sử xử lý và các điểm cần can thiệp.
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
        <Metric icon={Users} label="Staff hoạt động" value={loading ? "..." : `${stats.activeStaff}/${stats.staffCount}`} />
        <Metric icon={WalletCards} label="Escrow đang khóa" value={loading ? "..." : `$${Number(finance?.totalEscrowLockedUsdc || 0).toFixed(2)}`} tone="indigo" />
        <Metric icon={ShieldAlert} label="Khiếu nại mở" value={loading ? "..." : stats.openDisputes} tone="amber" />
        <Metric icon={ShieldCheck} label="Thanh lý chờ" value={loading ? "..." : stats.pendingTerminations} tone="rose" />
        <Metric icon={Activity} label="Tx lỗi" value={loading ? "..." : stats.failedTx} tone="rose" />
        <Metric icon={CheckCircle2} label="Settlement chờ" value={loading ? "..." : stats.pendingSettlements} tone="emerald" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-lg font-black">Bảng giám sát Staff</h2>
              <p className="mt-1 text-xs font-semibold text-slate-500">Tổng hợp ai đã duyệt, phân xử, đề xuất thanh lý.</p>
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
            <p className="mt-1 text-xs font-semibold text-slate-500">Admin giám sát Staff/Admin đã duyệt hồ sơ, duyệt lớp, xử lý khiếu nại và thẩm định hợp đồng/thanh lý nào.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-600">{audit.length} dòng</span>
        </div>
        {loading ? (
          <div className="h-36 animate-pulse bg-slate-100" />
        ) : (
          <AuditTable rows={audit.slice(0, 100)} onSelect={setSelectedAudit} />
        )}
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
