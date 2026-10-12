import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Filter,
  FileText,
  GraduationCap,
  Layers,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  Users,
  XCircle
} from "lucide-react";
import { staffTutorsApi } from "../../../api/staffTutors";
import { teachingRegistrationApi } from "../../../api/teachingRegistrations";
import { classApi } from "../../../api/classes";
import { contractsApi } from "../../../api/contractsApi";
import { terminationsApi, TerminationView } from "../../../api/terminationsApi";
import { useAuth } from "../../../hooks/useAuth";
import { fetchUserDirectory, getUserDisplayName, UserSummary } from "../../../utils/userDisplay";

type ActivityItem = {
  id: string;
  at?: string | null;
  actor?: string | null;
  actorName?: string | null;
  domain: "TUTOR_PROFILES" | "TEACHING_REGISTRATION" | "CLASS_ROOMS" | "DISPUTES" | "TERMINATIONS";
  type: string;
  target: string;
  status: string;
  note?: string | null;
};

type DateFilterType = "ALL" | "TODAY" | "THIS_WEEK" | "THIS_MONTH" | "CUSTOM";
type DomainFilterType = "ALL" | "TUTOR_PROFILES" | "TEACHING_REGISTRATION" | "CLASS_ROOMS" | "DISPUTES" | "TERMINATIONS";
type OutcomeFilterType = "ALL" | "APPROVED" | "REJECTED" | "PENDING";

const pageItems = (value: any) => (Array.isArray(value) ? value : Array.isArray(value?.content) ? value.content : []);
const sameEmail = (a?: string | null, b?: string | null) => Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());
const fmt = (value?: string | null) => (value ? new Date(value).toLocaleString("vi-VN") : "--");

function parseTerminationAudit(cases: TerminationView[], staffEmail?: string | null): ActivityItem[] {
  return cases.flatMap((item) => {
    let entries: any[] = [];
    try {
      entries = JSON.parse(item.request.auditJson || "[]");
    } catch {
      entries = [];
    }
    return entries
      .filter((entry) => ["STAFF", "ADMIN"].includes(String(entry.role || "").toUpperCase()))
      .filter((entry) => !staffEmail || sameEmail(entry.actor, staffEmail))
      .map((entry, index) => ({
        id: `termination-${item.request.id}-${index}`,
        at: entry.at,
        actor: entry.actor,
        domain: "TERMINATIONS" as const,
        type: "Thanh lý / hủy hợp đồng",
        target: `Lớp #${item.request.classroomId}${item.request.wholeClass ? " (cả lớp)" : ""}`,
        status: entry.action || item.request.status,
        note: entry.reason
      }));
  });
}

export function StaffReportsPage() {
  const { user } = useAuth();
  const staffEmail = user?.email || null;
  const isAdmin = String(user?.activeRole || "").toUpperCase() === "ADMIN" || user?.roles?.includes("ADMIN");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [users, setUsers] = useState<UserSummary[]>([]);

  // Raw datasets
  const [tutorHistory, setTutorHistory] = useState<any[]>([]);
  const [teachingHistory, setTeachingHistory] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [terminations, setTerminations] = useState<TerminationView[]>([]);

  // Filters
  const [dateFilter, setDateFilter] = useState<DateFilterType>("ALL");
  const [domainFilter, setDomainFilter] = useState<DomainFilterType>("ALL");
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilterType>("ALL");
  const [selectedStaffEmail, setSelectedStaffEmail] = useState<string>("ALL");
  const [searchKeyword, setSearchKeyword] = useState<string>("");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [userList, tutors, teaching, classRows, disputePage, terminationRows] = await Promise.all([
        fetchUserDirectory(),
        staffTutorsApi.history().catch(() => []),
        teachingRegistrationApi.adminHistory().catch(() => []),
        classApi.adminGetAllClasses({ reviewedByMe: !isAdmin }).catch(() => []),
        contractsApi.listDisputes({ page: 0, size: 100 }).catch(() => ({ content: [] })),
        terminationsApi.list().catch(() => [])
      ]);

      setUsers(Array.isArray(userList) ? userList : []);
      setTutorHistory(Array.isArray(tutors) ? tutors : []);
      setTeachingHistory(Array.isArray(teaching) ? teaching : []);
      setClasses(Array.isArray(classRows) ? classRows : []);
      setDisputes(pageItems(disputePage));
      setTerminations(Array.isArray(terminationRows) ? terminationRows : []);
    } catch (err: any) {
      setError(err?.message || "Không thể tải báo cáo nghiệp vụ.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [isAdmin, staffEmail]);

  // Scoped datasets according to role
  const scopedDisputes = useMemo(() => {
    if (isAdmin) return disputes;
    return disputes.filter((item) => sameEmail(item.classroomReviewerEmail, staffEmail));
  }, [disputes, isAdmin, staffEmail]);

  const scopedTerminations = useMemo(() => {
    if (isAdmin) return terminations;
    return terminations.filter((item) => {
      const audit = parseTerminationAudit([item], staffEmail);
      return audit.length > 0 || classes.some((cls) => Number(cls.id) === Number(item.request.classroomId));
    });
  }, [classes, isAdmin, staffEmail, terminations]);

  // Build combined activities list with standardized names
  const allActivities = useMemo<ActivityItem[]>(() => {
    const actorDisplayName = (email?: string | null) => {
      if (!email) return null;
      const found = users.find((u) => u?.email && u.email.trim().toLowerCase() === email.trim().toLowerCase());
      return found?.fullName || found?.name || null;
    };

    const scopedTutorHistory = isAdmin ? tutorHistory : tutorHistory.filter((item) => sameEmail(item.reviewedByEmail, staffEmail));
    const scopedTeachingHistory = isAdmin ? teachingHistory : teachingHistory.filter((item) => sameEmail(item.reviewedByEmail, staffEmail));
    const scopedClassHistory = isAdmin ? classes : classes.filter((item) => sameEmail(item.reviewedByEmail, staffEmail));

    const tutorItems: ActivityItem[] = scopedTutorHistory.map((item) => ({
      id: `tutor-${item.id}`,
      at: item.reviewedAt,
      actor: item.reviewedByEmail,
      actorName: actorDisplayName(item.reviewedByEmail) || item.reviewedByName,
      domain: "TUTOR_PROFILES",
      type: "Duyệt hồ sơ & CCCD",
      target: item.applicantFullName || item.fullName || item.email || `Tutor #${item.userId || item.id}`,
      status: item.status,
      note: item.rejectionReason || item.reviewNote
    }));

    const teachingItems: ActivityItem[] = scopedTeachingHistory.map((item) => ({
      id: `teaching-${item.id}`,
      at: item.reviewedAt,
      actor: item.reviewedByEmail,
      actorName: actorDisplayName(item.reviewedByEmail),
      domain: "TEACHING_REGISTRATION",
      type: "Duyệt quyền dạy",
      target: item.proposedSubjectName ? `${item.proposedSubjectName} (Đề xuất)` : item.subject?.name || `Đăng ký #${item.id}`,
      status: item.status,
      note: item.reviewNote || item.rejectReason
    }));

    const classItems: ActivityItem[] = scopedClassHistory
      .filter((item) => item.reviewedAt || item.reviewedByEmail)
      .map((item) => ({
        id: `class-${item.id}`,
        at: item.reviewedAt,
        actor: item.reviewedByEmail,
        actorName: actorDisplayName(item.reviewedByEmail),
        domain: "CLASS_ROOMS",
        type: "Duyệt lớp học",
        target: item.name || item.className || `Lớp #${item.id}`,
        status: item.status,
        note: item.rejectReason
      }));

    const disputeItems: ActivityItem[] = scopedDisputes
      .filter((item) => item.resolvedByEmail || item.status !== "OPEN")
      .map((item) => ({
        id: `dispute-${item.id}`,
        at: item.resolvedAt || item.createdAt,
        actor: item.resolvedByEmail || item.classroomReviewerEmail,
        actorName: actorDisplayName(item.resolvedByEmail || item.classroomReviewerEmail),
        domain: "DISPUTES",
        type: "Xử lý khiếu nại",
        target: `${item.className || `Lớp #${item.classroomId || "--"}`} · Buổi #${item.sessionId}`,
        status: item.status,
        note: item.resolutionReason || item.reason
      }));

    const terminationItems = parseTerminationAudit(scopedTerminations, isAdmin ? null : staffEmail).map((t) => ({
      ...t,
      actorName: actorDisplayName(t.actor)
    }));

    return [...tutorItems, ...teachingItems, ...classItems, ...disputeItems, ...terminationItems].sort(
      (a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime()
    );
  }, [classes, isAdmin, scopedDisputes, scopedTerminations, staffEmail, teachingHistory, tutorHistory, users]);

  // Filter activities by date, domain, outcome, staff, and search query
  const filteredActivities = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekStart = todayStart - 6 * 24 * 3600 * 1000;
    const monthStart = todayStart - 29 * 24 * 3600 * 1000;

    return allActivities.filter((act) => {
      // 1. Date filter
      if (dateFilter !== "ALL" && act.at) {
        const itemTime = new Date(act.at).getTime();
        if (dateFilter === "TODAY" && itemTime < todayStart) return false;
        if (dateFilter === "THIS_WEEK" && itemTime < weekStart) return false;
        if (dateFilter === "THIS_MONTH" && itemTime < monthStart) return false;
        if (dateFilter === "CUSTOM") {
          if (customStartDate && itemTime < new Date(customStartDate).getTime()) return false;
          if (customEndDate && itemTime > new Date(customEndDate).getTime() + 24 * 3600 * 1000) return false;
        }
      }

      // 2. Domain filter
      if (domainFilter !== "ALL" && act.domain !== domainFilter) return false;

      // 3. Outcome filter
      if (outcomeFilter !== "ALL") {
        const s = String(act.status).toUpperCase();
        const isApproved = ["APPROVED", "APPROVE", "FORCE_APPROVE", "RECOMMENDED", "RESOLVED"].includes(s);
        const isRejected = ["REJECTED", "REJECT", "FAILED", "FAILED_RETRYABLE"].includes(s);
        if (outcomeFilter === "APPROVED" && !isApproved) return false;
        if (outcomeFilter === "REJECTED" && !isRejected) return false;
        if (outcomeFilter === "PENDING" && (isApproved || isRejected)) return false;
      }

      // 4. Staff filter
      if (selectedStaffEmail !== "ALL") {
        if (!sameEmail(act.actor, selectedStaffEmail)) return false;
      }

      // 5. Search keyword
      if (searchKeyword.trim()) {
        const q = searchKeyword.toLowerCase();
        const matchActor = (act.actor || "").toLowerCase().includes(q) || (act.actorName || "").toLowerCase().includes(q);
        const matchTarget = (act.target || "").toLowerCase().includes(q);
        const matchType = (act.type || "").toLowerCase().includes(q);
        const matchNote = (act.note || "").toLowerCase().includes(q);
        return matchActor || matchTarget || matchType || matchNote;
      }

      return true;
    });
  }, [allActivities, customEndDate, customStartDate, dateFilter, domainFilter, outcomeFilter, searchKeyword, selectedStaffEmail]);

  // Overall metric stats from filtered list
  const stats = useMemo(() => {
    const total = filteredActivities.length;
    const approved = filteredActivities.filter((a) =>
      ["APPROVED", "APPROVE", "FORCE_APPROVE", "RECOMMENDED", "RESOLVED"].includes(String(a.status).toUpperCase())
    ).length;
    const rejected = filteredActivities.filter((a) =>
      ["REJECTED", "REJECT", "FAILED", "FAILED_RETRYABLE"].includes(String(a.status).toUpperCase())
    ).length;
    const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0;
    const openDisputes = scopedDisputes.filter((d) =>
      ["OPENING", "OPEN", "UNDER_REVIEW", "RESOLUTION_PENDING", "FAILED_RETRYABLE"].includes(d.status)
    ).length;
    const pendingTerminations = scopedTerminations.filter((t) => !["COMPLETED", "REJECTED"].includes(t.request.status)).length;

    return { total, approved, rejected, approvalRate, openDisputes, pendingTerminations, classesCount: classes.length };
  }, [classes.length, filteredActivities, scopedDisputes, scopedTerminations]);

  // Staff Performance Breakdown Table (for Admin or Cross-evaluation)
  const staffEvaluationList = useMemo(() => {
    const map = new Map<
      string,
      {
        email: string;
        name: string;
        total: number;
        approved: number;
        rejected: number;
        tutorCount: number;
        classCount: number;
        disputeCount: number;
        terminationCount: number;
      }
    >();

    filteredActivities.forEach((act) => {
      if (!act.actor) return;
      const key = act.actor.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          email: act.actor,
          name: act.actorName || act.actor,
          total: 0,
          approved: 0,
          rejected: 0,
          tutorCount: 0,
          classCount: 0,
          disputeCount: 0,
          terminationCount: 0
        });
      }
      const entry = map.get(key)!;
      entry.total++;
      const s = String(act.status).toUpperCase();
      if (["APPROVED", "APPROVE", "FORCE_APPROVE", "RECOMMENDED", "RESOLVED"].includes(s)) entry.approved++;
      if (["REJECTED", "REJECT", "FAILED", "FAILED_RETRYABLE"].includes(s)) entry.rejected++;
      if (act.domain === "TUTOR_PROFILES" || act.domain === "TEACHING_REGISTRATION") entry.tutorCount++;
      if (act.domain === "CLASS_ROOMS") entry.classCount++;
      if (act.domain === "DISPUTES") entry.disputeCount++;
      if (act.domain === "TERMINATIONS") entry.terminationCount++;
    });

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filteredActivities]);

  // List of distinct staff emails for filter dropdown
  const distinctStaffOptions = useMemo(() => {
    const set = new Map<string, string>();
    allActivities.forEach((act) => {
      if (act.actor) {
        set.set(act.actor.toLowerCase(), act.actorName || act.actor);
      }
    });
    return Array.from(set.entries()).map(([email, name]) => ({ email, name }));
  }, [allActivities]);

  const handleExportCsv = () => {
    if (filteredActivities.length === 0) return;
    const headers = [
      "Thời gian",
      "Người thao tác",
      "Email người thao tác",
      "Nghiệp vụ",
      "Phân hệ",
      "Đối tượng",
      "Trạng thái",
      "Ghi chú & Căn cứ"
    ];

    const escapeCsv = (val?: string | null) => {
      if (!val) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const domainLabelMap: Record<string, string> = {
      TUTOR_PROFILES: "Hồ sơ gia sư",
      TEACHING_REGISTRATION: "Đăng ký dạy",
      CLASS_ROOMS: "Lớp học",
      DISPUTES: "Khiếu nại",
      TERMINATIONS: "Thanh lý hợp đồng"
    };

    const rows = filteredActivities.map((act) => [
      escapeCsv(fmt(act.at)),
      escapeCsv(act.actorName || act.actor || ""),
      escapeCsv(act.actor || ""),
      escapeCsv(act.type),
      escapeCsv(domainLabelMap[act.domain] || act.domain),
      escapeCsv(act.target),
      escapeCsv(act.status),
      escapeCsv(act.note || "")
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    link.setAttribute("download", `bao-cao-van-hanh-educonnect-${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-[calc(100vh-96px)] bg-[#f3f6f9] p-0 font-sans text-[#073554]">
      {/* Header Banner */}
      <header className="mb-5 flex flex-col gap-4 border border-[#d7dde6] bg-white px-6 py-5 shadow-sm xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 text-[10px] font-black uppercase text-indigo-800 tracking-wider">
              <BarChart3 className="h-3 w-3 text-indigo-600" />
              Báo cáo vận hành
            </span>
            <span className="text-xs font-semibold text-slate-400">· Operational Analytics</span>
          </div>
          <h1 className="mt-1.5 font-display text-2xl font-black uppercase tracking-tight text-[#073554]">
            Báo Cáo Nghiệp Vụ & Đánh Giá Năng Suất
          </h1>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {isAdmin
              ? "Admin giám sát toàn bộ hoạt động của Staff: khối lượng duyệt, tỷ lệ chấp thuận, khiếu nại và thanh lý."
              : "Staff theo dõi tổng quan các thao tác nghiệp vụ, số lượng hồ sơ đã duyệt/từ chối theo từng mốc thời gian."}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredActivities.length === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:border-[#073554] hover:text-[#073554] transition-all disabled:opacity-50 shadow-2xs"
            title="Xuất file CSV báo cáo cho kiểm toán/hội đồng"
          >
            <Download className="h-4 w-4 text-slate-500" />
            Xuất file CSV
          </button>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-[#d7dde6] bg-[#f7f9fc] px-4 py-2 text-xs font-bold text-slate-600 hover:border-[#073554] hover:text-[#073554] transition-all disabled:opacity-50 shadow-2xs"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Làm mới dữ liệu
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-5 flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700 shadow-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Primary KPI Metrics */}
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 mb-6">
        <Metric icon={BarChart3} label="Tổng thao tác" value={loading ? "..." : stats.total} />
        <Metric icon={CheckCircle2} label="Đã duyệt / Đề xuất" value={loading ? "..." : stats.approved} tone="emerald" />
        <Metric icon={XCircle} label="Từ chối / Bác bỏ" value={loading ? "..." : stats.rejected} tone="rose" />
        <Metric icon={TrendingUp} label="Tỷ lệ duyệt" value={loading ? "..." : `${stats.approvalRate}%`} tone="indigo" />
        <Metric icon={ShieldAlert} label="Khiếu nại đang mở" value={loading ? "..." : stats.openDisputes} tone="amber" />
        <Metric icon={ShieldCheck} label="Thanh lý chờ duyệt" value={loading ? "..." : stats.pendingTerminations} tone="purple" />
      </div>

      {/* Filter Toolbar */}
      <section className="mb-6 rounded-2xl border border-[#d7dde6] bg-white p-5 shadow-sm space-y-4">
        {/* Row 1: Domain Tabs */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-slate-500 mr-2 flex items-center gap-1">
              <Layers className="h-3.5 w-3.5" /> Nghiệp vụ:
            </span>
            <DomainTabButton
              label="Tất cả nghiệp vụ"
              active={domainFilter === "ALL"}
              onClick={() => setDomainFilter("ALL")}
            />
            <DomainTabButton
              label="Hồ sơ gia sư"
              active={domainFilter === "TUTOR_PROFILES"}
              onClick={() => setDomainFilter("TUTOR_PROFILES")}
            />
            <DomainTabButton
              label="Quyền dạy"
              active={domainFilter === "TEACHING_REGISTRATION"}
              onClick={() => setDomainFilter("TEACHING_REGISTRATION")}
            />
            <DomainTabButton
              label="Lớp học"
              active={domainFilter === "CLASS_ROOMS"}
              onClick={() => setDomainFilter("CLASS_ROOMS")}
            />
            <DomainTabButton
              label="Khiếu nại"
              active={domainFilter === "DISPUTES"}
              onClick={() => setDomainFilter("DISPUTES")}
            />
            <DomainTabButton
              label="Thanh lý hợp đồng"
              active={domainFilter === "TERMINATIONS"}
              onClick={() => setDomainFilter("TERMINATIONS")}
            />
          </div>

          <span className="text-xs font-black text-slate-400">
            {filteredActivities.length} kết quả phù hợp
          </span>
        </div>

        {/* Row 2: Date Filters & Outcome & Staff Selector & Search */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-center pt-1">
          {/* Date Range Selector */}
          <div>
            <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
              Khung thời gian
            </label>
            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50/70 p-1 text-xs">
              <DatePill label="Tất cả" active={dateFilter === "ALL"} onClick={() => setDateFilter("ALL")} />
              <DatePill label="Hôm nay" active={dateFilter === "TODAY"} onClick={() => setDateFilter("TODAY")} />
              <DatePill label="Tuần này" active={dateFilter === "THIS_WEEK"} onClick={() => setDateFilter("THIS_WEEK")} />
              <DatePill label="Tháng này" active={dateFilter === "THIS_MONTH"} onClick={() => setDateFilter("THIS_MONTH")} />
              <DatePill label="Tùy chọn" active={dateFilter === "CUSTOM"} onClick={() => setDateFilter("CUSTOM")} />
            </div>
          </div>

          {/* Outcome Filter */}
          <div>
            <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
              Kết quả xử lý
            </label>
            <select
              value={outcomeFilter}
              onChange={(e) => setOutcomeFilter(e.target.value as OutcomeFilterType)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#073554]"
            >
              <option value="ALL">Tất cả kết quả</option>
              <option value="APPROVED">Đã phê duyệt / Đề xuất</option>
              <option value="REJECTED">Từ chối / Bác bỏ</option>
              <option value="PENDING">Chờ xử lý / Đang mở</option>
            </select>
          </div>

          {/* Staff Filter (Especially for Admin) */}
          <div>
            <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
              Nhân viên phụ trách
            </label>
            <select
              value={selectedStaffEmail}
              onChange={(e) => setSelectedStaffEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#073554]"
            >
              <option value="ALL">Tất cả nhân viên ({distinctStaffOptions.length})</option>
              {distinctStaffOptions.map((opt) => (
                <option key={opt.email} value={opt.email}>
                  {opt.name} ({opt.email})
                </option>
              ))}
            </select>
          </div>

          {/* Keyword Search */}
          <div>
            <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
              Tìm kiếm từ khóa
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="Tên người duyệt, lớp, đối tượng..."
                className="w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#073554]"
              />
            </div>
          </div>
        </div>

        {/* Custom Date Pickers if CUSTOM selected */}
        {dateFilter === "CUSTOM" && (
          <div className="flex items-center gap-3 pt-2 border-t border-slate-100 flex-wrap text-xs font-semibold">
            <span className="text-slate-500">Từ ngày:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-700"
            />
            <span className="text-slate-500">Đến ngày:</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-700"
            />
          </div>
        )}
      </section>

      {/* Staff Evaluation Table (Shown for Admin or when Multiple Staff exist) */}
      {isAdmin && staffEvaluationList.length > 0 && (
        <section className="mb-6 rounded-2xl border border-[#d7dde6] bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-black text-[#073554] flex items-center gap-2">
                <Users className="h-4 w-4 text-indigo-600" />
                Bảng đánh giá năng suất từng nhân viên (Staff Performance)
              </h2>
              <p className="mt-0.5 text-xs font-semibold text-slate-500">
                Thống kê khối lượng công việc và chất lượng xử lý của từng Staff theo phạm vi bộ lọc hiện tại.
              </p>
            </div>
            <span className="rounded-full bg-indigo-50 border border-indigo-200 px-3 py-1 text-[11px] font-black text-indigo-800">
              {staffEvaluationList.length} nhân viên
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-semibold text-slate-600">
              <thead className="border-b border-slate-100 text-[10px] font-black uppercase text-slate-400">
                <tr>
                  <th className="py-3 px-3">Nhân sự phụ trách</th>
                  <th className="py-3 px-3 text-center">Tổng việc đã làm</th>
                  <th className="py-3 px-3 text-center">Đã duyệt</th>
                  <th className="py-3 px-3 text-center">Từ chối</th>
                  <th className="py-3 px-3 text-center">Tỷ lệ duyệt</th>
                  <th className="py-3 px-3 text-center">Hồ sơ / Môn</th>
                  <th className="py-3 px-3 text-center">Lớp học</th>
                  <th className="py-3 px-3 text-center">Khiếu nại</th>
                  <th className="py-3 px-3 text-center">Thanh lý</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staffEvaluationList.map((st) => {
                  const rate = st.total > 0 ? Math.round((st.approved / st.total) * 100) : 0;
                  return (
                    <tr key={st.email} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-3">
                        <p className="font-extrabold text-sm text-[#073554]">{st.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">{st.email}</p>
                      </td>
                      <td className="py-3.5 px-3 text-center font-black text-slate-900">{st.total}</td>
                      <td className="py-3.5 px-3 text-center font-black text-emerald-700">{st.approved}</td>
                      <td className="py-3.5 px-3 text-center font-black text-rose-700">{st.rejected}</td>
                      <td className="py-3.5 px-3 text-center">
                        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-black text-slate-800">
                          {rate}%
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-center font-bold text-slate-700">{st.tutorCount}</td>
                      <td className="py-3.5 px-3 text-center font-bold text-slate-700">{st.classCount}</td>
                      <td className="py-3.5 px-3 text-center font-bold text-slate-700">{st.disputeCount}</td>
                      <td className="py-3.5 px-3 text-center font-bold text-slate-700">{st.terminationCount}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Main Activity Log Table */}
      <section className="rounded-2xl border border-[#d7dde6] bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-black text-[#073554] flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#073554]" />
              Nhật ký thao tác chi tiết
            </h2>
            <p className="mt-0.5 text-xs font-semibold text-slate-500">
              Chi tiết từng lần duyệt hồ sơ, lớp học, phân xử khiếu nại và thẩm định hợp đồng có lưu dấu audit.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filteredActivities.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:border-[#073554] hover:text-[#073554] disabled:opacity-50 transition-colors"
              title="Xuất file CSV báo cáo"
            >
              <Download className="h-3.5 w-3.5" />
              Xuất CSV
            </button>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-600">
              Hiển thị {filteredActivities.length} thao tác
            </span>
          </div>
        </div>

        {loading ? (
          <div className="py-12 space-y-3">
            <div className="h-10 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-10 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-10 animate-pulse rounded-xl bg-slate-100" />
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="py-16 text-center text-xs font-bold text-slate-400">
            Không tìm thấy thao tác nghiệp vụ nào phù hợp với bộ lọc hiện tại.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-semibold text-slate-600">
              <thead className="border-b border-slate-100 text-[10px] font-black uppercase text-slate-400">
                <tr>
                  <th className="py-3 px-3">Thời gian</th>
                  <th className="py-3 px-3">Người thao tác</th>
                  <th className="py-3 px-3">Nghiệp vụ</th>
                  <th className="py-3 px-3">Đối tượng</th>
                  <th className="py-3 px-3">Kết quả</th>
                  <th className="py-3 px-3">Ghi chú & Căn cứ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredActivities.slice(0, 100).map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="whitespace-nowrap py-3.5 px-3 font-mono text-[11px] text-slate-500">
                      {fmt(item.at)}
                    </td>
                    <td className="py-3.5 px-3 max-w-[200px]">
                      <p className="font-extrabold text-[#073554] truncate" title={item.actorName || item.actor || ""}>
                        {item.actorName || item.actor || "--"}
                      </p>
                      {item.actor && item.actorName && (
                        <p className="text-[10px] text-slate-400 truncate font-mono" title={item.actor}>
                          {item.actor}
                        </p>
                      )}
                    </td>
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                        {item.type}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 max-w-[220px] truncate font-bold text-slate-800" title={item.target}>
                      {item.target}
                    </td>
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <StatusPill value={item.status} />
                    </td>
                    <td className="py-3.5 px-3 max-w-[320px] truncate text-slate-500" title={item.note || ""}>
                      {item.note || "--"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  tone = "slate"
}: {
  icon: any;
  label: string;
  value: React.ReactNode;
  tone?: "slate" | "emerald" | "rose" | "amber" | "indigo" | "purple";
}) {
  const toneClass = {
    slate: "bg-white text-[#073554] border-[#d7dde6]",
    emerald: "bg-emerald-50 text-emerald-800 border-emerald-200",
    rose: "bg-rose-50 text-rose-800 border-rose-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    indigo: "bg-indigo-50 text-indigo-800 border-indigo-200",
    purple: "bg-purple-50 text-purple-800 border-purple-200"
  }[tone];

  return (
    <div className={`border p-4 rounded-2xl shadow-sm ${toneClass}`}>
      <Icon className="mb-2.5 h-5 w-5" />
      <p className="text-[10px] font-black uppercase tracking-wide opacity-75">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
}

function DomainTabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
        active
          ? "bg-[#073554] text-white shadow-xs"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      }`}
    >
      {label}
    </button>
  );
}

function DatePill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-lg px-2 py-1 text-center font-bold transition-all ${
        active ? "bg-[#073554] text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
      }`}
    >
      {label}
    </button>
  );
}

function StatusPill({ value }: { value: string }) {
  const text = String(value || "--").toUpperCase();
  const ok = ["APPROVED", "APPROVE", "FORCE_APPROVE", "RECOMMENDED", "RESOLVED"].includes(text);
  const bad = ["REJECTED", "REJECT", "FAILED", "FAILED_RETRYABLE"].includes(text);
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
        ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : bad
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : "border-slate-200 bg-slate-50 text-slate-600"
      }`}
    >
      {text}
    </span>
  );
}
