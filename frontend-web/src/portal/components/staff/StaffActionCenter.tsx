import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  ExternalLink,
  GraduationCap,
  History,
  Layers,
  RefreshCw,
  Scale,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Users,
  XCircle,
  Zap
} from "lucide-react";
import { staffTutorApi } from "../../../api/staffTutors";
import { teachingRegistrationApi } from "../../../api/teachingRegistrations";
import { classApi } from "../../../api/classes";
import { contractsApi, DisputeDto } from "../../../api/contractsApi";
import { terminationsApi, TerminationView } from "../../../api/terminationsApi";
import { useAuth } from "../../../hooks/useAuth";
import { useRealtimeRefresh } from "../../../realtime/useRealtimeRefresh";
import { fetchUserDirectory, getUserDisplayName, UserSummary } from "../../../utils/userDisplay";

interface StaffActionCenterProps {
  onNavigate: (page: string, subtab?: string) => void;
}

interface UrgentItem {
  id: string;
  domain: "TUTOR_PROFILE" | "TEACHING_REGISTRATION" | "CLASS_ROOM" | "DISPUTE" | "TERMINATION";
  domainLabel: string;
  title: string;
  subtitle: string;
  requesterName?: string;
  requesterEmail?: string;
  createdAt?: string;
  urgency: "HIGH" | "MEDIUM" | "NORMAL";
  urgencyLabel: string;
  urgencyTone: "rose" | "amber" | "blue";
  targetPage: string;
  targetSubtab?: string;
}

const pageItems = (value: any) => Array.isArray(value?.content) ? value.content : Array.isArray(value) ? value : [];

export function StaffActionCenter({ onNavigate }: StaffActionCenterProps) {
  const { user } = useAuth();
  const staffEmail = user?.email || "";
  const isAdmin = String(user?.activeRole || "").toUpperCase() === "ADMIN" || user?.roles?.includes("ADMIN");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [users, setUsers] = useState<UserSummary[]>([]);

  // Raw pending lists
  const [pendingTutors, setPendingTutors] = useState<any[]>([]);
  const [pendingTeaching, setPendingTeaching] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<DisputeDto[]>([]);
  const [terminations, setTerminations] = useState<TerminationView[]>([]);

  const loadAll = async (opts?: boolean | unknown) => {
    const isSilent = opts === true;
    if (!isSilent) {
      setLoading(true);
    }
    setError("");
    try {
      const [
        userList,
        tutorPendingList,
        teachingPendingList,
        classList,
        disputePage,
        terminationPage
      ] = await Promise.all([
        fetchUserDirectory(),
        staffTutorApi.pending({ page: 0, size: 10 }).catch(() => ({ content: [] })),
        teachingRegistrationApi.adminPending({ page: 0, size: 10 }).catch(() => ({ content: [] })),
        classApi.adminGetAllClasses({ page: 0, size: 10, status: "PENDING_APPROVAL" }).catch(() => ({ content: [] })),
        contractsApi.listDisputes({ statusGroup: "PENDING", page: 0, size: 10 }).catch(() => ({ content: [] })),
        terminationsApi.page({ page: 0, size: 10 }).catch(() => ({ content: [] }))
      ]);

      setUsers(Array.isArray(userList) ? userList : []);
      setPendingTutors(pageItems(tutorPendingList));
      setPendingTeaching(pageItems(teachingPendingList));
      setClasses(pageItems(classList));
      setDisputes(Array.isArray(disputePage?.content) ? disputePage.content : Array.isArray(disputePage) ? disputePage : []);
      setTerminations(pageItems(terminationPage));
    } catch (err: any) {
      setError(err?.message || "Không thể tải dữ liệu Trung tâm tác nghiệp.");
    } finally {
      if (!isSilent) {
        setLoading(false);
      }
    }
  };

  useRealtimeRefresh(
    [
      "TUTOR_APPLICATION_SUBMITTED",
      "TUTOR_APPLICATION_REVIEWED",
      "CLASS_SUBMITTED",
      "CLASS_REVIEWED",
      "CLASS_MUTATED",
      "DISPUTE_OPENED",
      "DISPUTE_UPDATED",
      "DISPUTE_RESOLVED",
      "DISPUTE_MUTATED",
      "SESSION_SETTLED",
      "TERMINATION_REQUESTED",
      "TERMINATION_RECOMMENDED",
      "TERMINATION_APPROVED"
    ],
    () => loadAll(true)
  );

  useEffect(() => {
    loadAll(false);
  }, []);

  // Filter pending classes
  const pendingClasses = useMemo(() => {
    return classes.filter((c) => c.status === "PENDING_APPROVAL");
  }, [classes]);

  const sameEmail = (a?: string | null, b?: string | null) =>
    Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());

  // Filter active disputes. Backend already scopes Staff by classroomReviewerEmail,
  // this extra guard keeps the dashboard correct if a broader response is ever returned.
  const activeDisputes = useMemo(() => {
    return disputes.filter((d) =>
      ["OPEN", "OPENING", "RESOLUTION_PENDING", "FAILED_RETRYABLE"].includes(d.status)
      && (isAdmin || !d.classroomReviewerEmail || sameEmail(d.classroomReviewerEmail, staffEmail))
    );
  }, [disputes, isAdmin, staffEmail]);

  // Filter terminations needing staff review
  const pendingTerminations = useMemo(() => {
    return terminations.filter((t) => t.request.status === "REQUESTED" || t.request.status === "HOLD_PENDING");
  }, [terminations]);

  // Cross-service daily totals belong to the dedicated report, not capped queue pages.
  const myReviewedToday: number | null = null;

  // Build urgent prioritized queue
  const urgentQueue = useMemo<UrgentItem[]>(() => {
    const list: UrgentItem[] = [];
    const now = Date.now();

    // 1. Disputes
    activeDisputes.forEach((d) => {
      const deadlineMs = d.tutorResponseDeadline ? new Date(d.tutorResponseDeadline).getTime() : 0;
      const isUrgentDeadline = deadlineMs > 0 && deadlineMs - now < 24 * 3600 * 1000 && deadlineMs > now;
      const isExpiredResponse = deadlineMs > 0 && now >= deadlineMs;
      const isReady = d.readyForResolution || isExpiredResponse || Boolean(d.tutorResponse);

      let urgency: UrgentItem["urgency"] = "NORMAL";
      let urgencyLabel = "Khiếu nại đang mở";
      let urgencyTone: UrgentItem["urgencyTone"] = "blue";

      if (isReady) {
        urgency = "HIGH";
        urgencyLabel = "Sẵn sàng phân xử";
        urgencyTone = "rose";
      } else if (isUrgentDeadline) {
        urgency = "MEDIUM";
        urgencyLabel = "Hạn trả lời < 24h";
        urgencyTone = "amber";
      }

      const complainant = getUserDisplayName(d.studentEmail, users, d.studentName || "Học viên");

      list.push({
        id: `dispute-${d.id}`,
        domain: "DISPUTE",
        domainLabel: "Khiếu nại",
        title: d.className || `Lớp học #${d.classroomId || "--"} · Buổi #${d.sessionId}`,
        subtitle: `Lý do: "${d.reason}"`,
        requesterName: complainant.fullName,
        requesterEmail: complainant.email,
        createdAt: d.createdAt,
        urgency,
        urgencyLabel,
        urgencyTone,
        targetPage: "complaints"
      });
    });

    // 2. Terminations
    pendingTerminations.forEach((t) => {
      const requester = getUserDisplayName(t.request.requestedBy, users, t.request.requestedBy);
      list.push({
        id: `term-${t.request.id}`,
        domain: "TERMINATION",
        domainLabel: "Thanh lý hợp đồng",
        title: `Lớp #${t.request.classroomId}${t.request.wholeClass ? " (Toàn bộ lớp)" : ""}`,
        subtitle: `Lý do: "${t.request.reason || "Yêu cầu chấm dứt"}"`,
        requesterName: requester.fullName,
        requesterEmail: requester.email,
        createdAt: t.request.createdAt,
        urgency: "HIGH",
        urgencyLabel: "Cần thẩm định đề xuất",
        urgencyTone: "rose",
        targetPage: "contracts"
      });
    });

    // 3. Pending Classes
    pendingClasses.forEach((c) => {
      const tutor = getUserDisplayName(c.tutorEmail, users, c.tutorFullName || "Gia sư");
      list.push({
        id: `class-${c.id}`,
        domain: "CLASS_ROOM",
        domainLabel: "Duyệt lớp học",
        title: c.name || `Lớp học #${c.id}`,
        subtitle: `${c.registration?.subjectName || "Môn học"} · ${c.pricePerSession?.toLocaleString("vi-VN")} đ/buổi`,
        requesterName: tutor.fullName,
        requesterEmail: tutor.email,
        createdAt: c.createdAt,
        urgency: "MEDIUM",
        urgencyLabel: "Chờ duyệt mở lớp",
        urgencyTone: "amber",
        targetPage: "class-management"
      });
    });

    // 4. Pending Tutor Profiles
    pendingTutors.forEach((p) => {
      const name = p.applicantFullName || p.fullName || "Gia sư mới";
      const email = p.applicantEmail || p.email || "";
      list.push({
        id: `tutor-${p.applicationId || p.id}`,
        domain: "TUTOR_PROFILE",
        domainLabel: "Hồ sơ gia sư",
        title: `Gia sư: ${name}`,
        subtitle: "Đơn đăng ký mới & tệp xác minh CCCD/Hộ chiếu",
        requesterName: name,
        requesterEmail: email,
        createdAt: p.createdAt,
        urgency: "NORMAL",
        urgencyLabel: "Chờ duyệt CCCD",
        urgencyTone: "blue",
        targetPage: "tutor-approval",
        targetSubtab: "TUTOR_PROFILES"
      });
    });

    // 5. Pending Teaching Registrations
    pendingTeaching.forEach((tr) => {
      const tutor = getUserDisplayName(tr.tutorEmail, users, tr.tutorName || "Gia sư");
      const isProposal = Boolean(tr.proposedSubjectName);
      list.push({
        id: `teach-${tr.id}`,
        domain: "TEACHING_REGISTRATION",
        domainLabel: "Đăng ký môn",
        title: isProposal ? `${tr.proposedSubjectName} (Đề xuất môn mới)` : (tr.subject?.name || "Môn dạy"),
        subtitle: `Gia sư: ${tutor.fullName} · Kinh nghiệm: ${tr.experienceYears || 0} năm`,
        requesterName: tutor.fullName,
        requesterEmail: tutor.email,
        createdAt: tr.createdAt,
        urgency: "NORMAL",
        urgencyLabel: "Chờ duyệt quyền dạy",
        urgencyTone: "blue",
        targetPage: "tutor-approval",
        targetSubtab: "TEACHING_REGISTRATION"
      });
    });

    // Sort: HIGH first, then MEDIUM, then NORMAL; tie-breaker: newest first
    const urgencyWeight = { HIGH: 3, MEDIUM: 2, NORMAL: 1 };
    return list.sort((a, b) => {
      const weightDiff = urgencyWeight[b.urgency] - urgencyWeight[a.urgency];
      if (weightDiff !== 0) return weightDiff;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }, [activeDisputes, pendingClasses, pendingTeaching, pendingTerminations, pendingTutors, users]);

  const totalPendingWork = pendingTutors.length + pendingTeaching.length + pendingClasses.length + activeDisputes.length + pendingTerminations.length;

  return (
    <div className="min-h-[calc(100vh-96px)] bg-[#f3f6f9] p-0 font-sans text-[#073554]">
      {/* Header Banner */}
      <header className="mb-5 flex flex-col gap-4 border border-[#d7dde6] bg-white px-6 py-5 shadow-sm xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-black uppercase text-emerald-800 tracking-wider">
              <Zap className="h-3 w-3 text-emerald-600" />
              Trung tâm tác nghiệp
            </span>
            <span className="text-xs font-semibold text-slate-400">· Staff Action Center</span>
          </div>
          <h1 className="mt-1.5 font-display text-2xl font-black uppercase tracking-tight text-[#073554]">
            Bàn Tác Nghiệp & Phê Duyệt Vận Hành
          </h1>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Xin chào <strong className="text-[#073554]">{user?.fullName || staffEmail}</strong>. Bạn hiện có{" "}
            <strong className="text-rose-600">{loading ? "..." : totalPendingWork} việc</strong> đang chờ xử lý trên 5 nghiệp vụ.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadAll}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-[#d7dde6] bg-[#f7f9fc] px-4 py-2.5 text-xs font-bold text-slate-600 hover:border-[#073554] hover:text-[#073554] transition-all disabled:opacity-50 shadow-2xs"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Làm mới danh sách
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-5 flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700 shadow-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 5 Core Action Hub Cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* 1. Tutor Profiles */}
        <ActionHubCard
          icon={UserCheck}
          title="Hồ sơ gia sư"
          count={pendingTutors.length}
          countLabel="hồ sơ chờ duyệt"
          description="Kiểm tra CCCD, hộ chiếu và xác minh danh tính gia sư mới."
          badgeTone="amber"
          actionLabel="Duyệt hồ sơ"
          onClick={() => onNavigate("tutor-approval", "TUTOR_PROFILES")}
          loading={loading}
        />

        {/* 2. Teaching Registrations */}
        <ActionHubCard
          icon={BookOpen}
          title="Đăng ký môn dạy"
          count={pendingTeaching.length}
          countLabel="yêu cầu chờ duyệt"
          description="Bằng cấp chuyên môn, kinh nghiệm và đề xuất môn học mới."
          badgeTone="indigo"
          actionLabel="Duyệt quyền dạy"
          onClick={() => onNavigate("tutor-approval", "TEACHING_REGISTRATION")}
          loading={loading}
        />

        {/* 3. Class Rooms */}
        <ActionHubCard
          icon={GraduationCap}
          title="Lớp học mới"
          count={pendingClasses.length}
          countLabel="lớp chờ phê duyệt"
          description="Đối soát học phí, lộ trình giáo trình và lịch học trực tuyến/trực tiếp."
          badgeTone="emerald"
          actionLabel="Duyệt lớp học"
          onClick={() => onNavigate("class-management")}
          loading={loading}
        />

        {/* 4. Disputes */}
        <ActionHubCard
          icon={ShieldAlert}
          title="Quản lý khiếu nại"
          count={activeDisputes.length}
          countLabel="khiếu nại đang mở"
          description="Xử lý tranh chấp buổi học, xem giải trình gia sư và phán quyết Escrow."
          badgeTone="rose"
          actionLabel="Xử lý khiếu nại"
          onClick={() => onNavigate("complaints")}
          loading={loading}
        />

        {/* 5. Terminations */}
        <ActionHubCard
          icon={ShieldCheck}
          title="Hợp đồng & Thanh lý"
          count={pendingTerminations.length}
          countLabel="đơn cần thẩm định"
          description="Chấm dứt hợp đồng sớm, kiểm tra minh chứng và gửi đề xuất lên Admin."
          badgeTone="purple"
          actionLabel="Thẩm định thanh lý"
          onClick={() => onNavigate("contracts")}
          loading={loading}
        />
      </div>

      {/* Main Content Layout: Urgent Items (Left) + Performance & Shortcuts (Right) */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Urgent Action Queue */}
        <div className="lg:col-span-2 space-y-4">
          <section className="rounded-2xl border border-[#d7dde6] bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-black text-[#073554] flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  Hàng đợi việc cần xử lý ngay
                </h2>
                <p className="mt-0.5 text-xs font-semibold text-slate-500">
                  Tập trung các hồ sơ ưu tiên cao nhất được sắp xếp theo mức độ khẩn cấp.
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-700">
                {urgentQueue.length} mục
              </span>
            </div>

            {loading ? (
              <div className="py-12 space-y-3">
                <div className="h-14 animate-pulse rounded-xl bg-slate-100" />
                <div className="h-14 animate-pulse rounded-xl bg-slate-100" />
                <div className="h-14 animate-pulse rounded-xl bg-slate-100" />
              </div>
            ) : urgentQueue.length === 0 ? (
              <div className="py-16 text-center">
                <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500 opacity-80 mb-2" />
                <p className="text-sm font-black text-slate-700">Hàng đợi trống! Bạn đã xử lý xong toàn bộ công việc.</p>
                <p className="text-xs font-semibold text-slate-400 mt-1">
                  Khi có hồ sơ mới gửi lên từ học viên hoặc gia sư, hệ thống sẽ tự động cập nhật tại đây.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 mt-2">
                {urgentQueue.slice(0, 15).map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3.5 hover:bg-slate-50/80 rounded-xl px-2 transition-colors"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                          item.urgencyTone === "rose"
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : item.urgencyTone === "amber"
                            ? "bg-amber-50 text-amber-800 border border-amber-200"
                            : "bg-blue-50 text-blue-700 border border-blue-200"
                        }`}>
                          {item.urgencyLabel}
                        </span>
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                          {item.domainLabel}
                        </span>
                        {item.createdAt && (
                          <span className="text-[11px] text-slate-400 font-semibold flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(item.createdAt).toLocaleString("vi-VN")}
                          </span>
                        )}
                      </div>

                      <p className="font-extrabold text-sm text-[#073554] truncate" title={item.title}>
                        {item.title}
                      </p>

                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 truncate">
                        <span>{item.subtitle}</span>
                        {item.requesterName && (
                          <>
                            <span>·</span>
                            <span className="text-[#073554] font-bold truncate">
                              Người gửi: {item.requesterName}
                              {item.requesterEmail && ` (${item.requesterEmail})`}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onNavigate(item.targetPage, item.targetSubtab)}
                      className="inline-flex items-center gap-1.5 self-start sm:self-center shrink-0 rounded-xl bg-[#073554] hover:bg-[#0b4870] text-white px-3.5 py-2 text-xs font-black shadow-xs transition-all hover:gap-2"
                    >
                      <span>Xử lý ngay</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Performance Summary & Quick Operational Guide */}
        <div className="space-y-4">
          {/* Quick Metrics */}
          <section className="rounded-2xl border border-[#d7dde6] bg-white p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-[#073554] flex items-center gap-2">
              <History className="h-4 w-4 text-[#073554]" />
              Tiến độ vận hành hôm nay
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-center">
                <p className="text-[10px] font-black uppercase text-slate-400">Đã xử lý hôm nay</p>
                <p className="mt-1 text-2xl font-black text-[#073554]">{myReviewedToday ?? "—"}</p>
                <p className="text-[10px] text-slate-500 font-semibold mt-0.5">xem báo cáo chi tiết</p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-center">
                <p className="text-[10px] font-black uppercase text-slate-400">Tổng việc tồn</p>
                <p className="mt-1 text-2xl font-black text-rose-600">{totalPendingWork}</p>
                <p className="text-[10px] text-slate-500 font-semibold mt-0.5">cần giải quyết</p>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-2 text-xs font-semibold text-slate-600">
              <div className="flex items-center justify-between">
                <span>Hồ sơ CCCD chờ duyệt:</span>
                <strong className="text-slate-900">{pendingTutors.length}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span>Lớp học chờ duyệt:</span>
                <strong className="text-slate-900">{pendingClasses.length}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span>Khiếu nại đang mở:</span>
                <strong className="text-slate-900">{activeDisputes.length}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span>Thanh lý cần thẩm định:</span>
                <strong className="text-slate-900">{pendingTerminations.length}</strong>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigate("reports")}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 py-2.5 text-xs font-black text-[#073554] transition-all shadow-2xs"
            >
              <span>Xem báo cáo thao tác chi tiết</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </section>

          {/* Operational Policy Guidance */}
          <section className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/60 to-white p-5 shadow-sm space-y-3 text-xs">
            <h4 className="font-black text-indigo-950 flex items-center gap-2">
              <Scale className="h-4 w-4 text-indigo-600" />
              Quy chuẩn thẩm định cho Staff
            </h4>
            <ul className="space-y-2 text-indigo-900/80 font-medium leading-relaxed list-disc list-inside">
              <li>
                <strong>Duyệt CCCD:</strong> Đối chiếu họ tên, số CCCD và ảnh chụp 2 mặt rõ nét trước khi phê duyệt.
              </li>
              <li>
                <strong>Duyệt lớp học:</strong> Kiểm tra mức học phí phù hợp với cấp học và có tối thiểu 1 chương đề cương.
              </li>
              <li>
                <strong>Khiếu nại:</strong> Đợi gia sư giải trình trong 24 giờ. Sau 24h hoặc khi gia sư đã trả lời, Staff có quyền phân xử on-chain.
              </li>
              <li>
                <strong>Thanh lý hợp đồng:</strong> Staff thẩm định và gửi khuyến nghị; Admin sẽ là người phê duyệt quyết toán cuối cùng.
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

function ActionHubCard({
  icon: Icon,
  title,
  count,
  countLabel,
  description,
  badgeTone,
  actionLabel,
  onClick,
  loading
}: {
  icon: any;
  title: string;
  count: number;
  countLabel: string;
  description: string;
  badgeTone: "amber" | "indigo" | "emerald" | "rose" | "purple";
  actionLabel: string;
  onClick: () => void;
  loading: boolean;
}) {
  const toneClasses = {
    amber: "border-amber-200 bg-amber-50/30 text-amber-900 hover:border-amber-400",
    indigo: "border-indigo-200 bg-indigo-50/30 text-indigo-900 hover:border-indigo-400",
    emerald: "border-emerald-200 bg-emerald-50/30 text-emerald-900 hover:border-emerald-400",
    rose: "border-rose-200 bg-rose-50/30 text-rose-900 hover:border-rose-400",
    purple: "border-purple-200 bg-purple-50/30 text-purple-900 hover:border-purple-400"
  }[badgeTone];

  const badgeClasses = {
    amber: "bg-amber-100 text-amber-800",
    indigo: "bg-indigo-100 text-indigo-800",
    emerald: "bg-emerald-100 text-emerald-800",
    rose: "bg-rose-100 text-rose-800",
    purple: "bg-purple-100 text-purple-800"
  }[badgeTone];

  return (
    <div className={`flex flex-col justify-between rounded-2xl border bg-white p-4.5 shadow-sm transition-all hover:shadow-md ${toneClasses}`}>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="p-2.5 rounded-xl bg-white shadow-2xs border border-slate-100">
            <Icon className="h-5 w-5" />
          </div>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-black ${badgeClasses}`}>
            {loading ? "..." : count}
          </span>
        </div>

        <div>
          <h3 className="font-extrabold text-sm text-[#073554]">{title}</h3>
          <p className="text-[11px] font-bold text-slate-500 mt-0.5">{loading ? "Đang tải..." : `${count} ${countLabel}`}</p>
        </div>

        <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
          {description}
        </p>
      </div>

      <button
        type="button"
        onClick={onClick}
        className="mt-4 w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#073554] hover:bg-[#0d466f] text-white py-2 px-3 text-xs font-black shadow-xs transition-all"
      >
        <span>{actionLabel}</span>
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
