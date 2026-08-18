import React, { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import { staffTutorsApi } from "../../../api/staffTutors";
import { useAuth } from "../../../hooks/useAuth";
import { TutorApprovalItem } from "../../types";
import { DashboardStats } from "./DashboardStats";
import { RejectTutorModal } from "./RejectTutorModal";
import { TutorApprovalQueue } from "./TutorApprovalQueue";
import { TutorDetailPanel } from "./TutorDetailPanel";
import { TeachingRegistrationReview } from "./TeachingRegistrationReview";

function normalizeSummary(raw: any): TutorApprovalItem {
  return {
    id: Number(raw.applicationId),
    userId: Number(raw.applicantUserId),
    fullName: raw.fullName || "Tutor applicant",
    email: raw.email || "",
    bio: "",
    education: raw.institution || raw.educationLevel || "",
    institution: raw.institution || "",
    experienceYears: 0,
    status: raw.status || "PENDING",
    subjects: [],
    documents: [],
    subjectCount: Number(raw.subjectCount || 0),
    documentCount: Number(raw.documentCount || 0),
    createdAt: raw.submittedAt,
    submittedAt: raw.submittedAt,
  };
}

function normalizeDetail(raw: any): TutorApprovalItem {
  const applicant = raw.applicant || {};
  const application = raw.application || {};
  return {
    id: Number(application.id),
    userId: Number(applicant.id),
    fullName: applicant.fullName || "Tutor applicant",
    email: applicant.email || "",
    phone: applicant.phone || "",
    dateOfBirth: applicant.dateOfBirth || "",
    gender: applicant.gender || "",
    province: applicant.province || "",
    commune: applicant.commune || "",
    addressDetail: applicant.addressDetail || "",
    accountStatus: applicant.accountStatus || "",
    avatarUrl: applicant.avatarUrl || "",
    bio: application.bio || "",
    education: application.institution || application.educationLevel || "",
    institution: application.institution || "",
    major: application.major || "",
    experienceSummary: application.experienceSummary || "",
    experienceYears: 0,
    status: application.status || "PENDING",
    rejectionReason: application.rejectionReason || null,
    reviewNote: application.reviewNote || null,
    subjects: (raw.subjects || []).map((subject: any) => ({
      id: Number(subject.id),
      name: subject.name,
      category: subject.category,
      group: subject.group,
      oneToOneHourlyRate: Number(subject.oneToOneHourlyRate || 0),
      experienceYears: Number(subject.experienceYears || 0),
      description: subject.description || "",
      levels: Array.isArray(subject.levels) ? subject.levels : [],
    })),
    documents: (raw.documents || []).map((document: any) => ({
      id: String(document.id),
      name: document.originalFilename,
      type: document.documentType,
      contentType: document.contentType,
      fileSize: Number(document.fileSize || 0),
      verificationStatus: document.verificationStatus,
      title: document.title || "",
      issuer: document.issuer || "",
      issueDate: document.issueDate || "",
      validityType: document.validityType || "",
      expiryDate: document.expiryDate || "",
      credentialNumber: document.credentialNumber || "",
      expired: Boolean(document.expired),
    })),
    createdAt: application.submittedAt,
    submittedAt: application.submittedAt,
    updatedAt: application.reviewedAt,
  };
}

export function StaffDashboardPage() {
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes("ADMIN");
  const [tutors, setTutors] = useState<TutorApprovalItem[]>([]);
  const [selectedTutorId, setSelectedTutorId] = useState<number>();
  const [selectedTutor, setSelectedTutor] = useState<TutorApprovalItem>();
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [sort, setSort] = useState("newest");
  const [busyTutorId, setBusyTutorId] = useState<number>();
  const [rejectTutor, setRejectTutor] = useState<TutorApprovalItem>();
  const [toast, setToast] = useState("");
  const [teachingPendingCount, setTeachingPendingCount] = useState(0);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const result = await staffTutorsApi.pending();
      const nextTutors = Array.isArray(result) ? result.map(normalizeSummary) : [];
      setTutors(nextTutors);
      setSelectedTutorId((current) => current && nextTutors.some((item) => item.id === current) ? current : nextTutors[0]?.id);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Không thể tải danh sách hồ sơ gia sư đang chờ duyệt.");
      setTutors([]);
      setSelectedTutorId(undefined);
      setSelectedTutor(undefined);
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(applicationId?: number) {
    if (!applicationId) {
      setSelectedTutor(undefined);
      return;
    }

    setDetailLoading(true);
    setError("");

    try {
      const detail = await staffTutorsApi.detail(applicationId);
      setSelectedTutor(normalizeDetail(detail));
    } catch (detailError) {
      setError(detailError instanceof Error ? detailError.message : "Không thể tải chi tiết hồ sơ.");
      setSelectedTutor(undefined);
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    loadDetail(selectedTutorId);
  }, [selectedTutorId]);

  const visibleTutors = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const filtered = tutors.filter((tutor) => {
      const matchesSearch = !keyword
        || tutor.fullName.toLowerCase().includes(keyword)
        || tutor.email.toLowerCase().includes(keyword);
      const matchesSubject = !subjectFilter
        || tutor.subjects.some((subject) => subject.name === subjectFilter);

      return matchesSearch && matchesSubject;
    });

    return [...filtered].sort((a, b) => {
      const first = new Date(a.createdAt || 0).getTime();
      const second = new Date(b.createdAt || 0).getTime();
      return sort === "oldest" ? first - second : second - first;
    });
  }, [tutors, search, subjectFilter, sort]);

  async function approveTutor(tutor: TutorApprovalItem, note?: string) {
    setBusyTutorId(tutor.id);
    setError("");

    try {
      await staffTutorsApi.approve(tutor.id, note || "");
      const nextTutors = tutors.filter((item) => item.id !== tutor.id);
      setTutors(nextTutors);
      setSelectedTutorId(nextTutors[0]?.id);
      setSelectedTutor(undefined);
      setToast(`Đã phê duyệt hồ sơ ${tutor.fullName}.`);
    } catch (approveError: any) {
      setError(approveError?.status === 409
        ? "Hồ sơ đã được xử lý bởi người khác. Vui lòng refresh danh sách."
        : approveError?.message || "Không thể phê duyệt hồ sơ gia sư.");
    } finally {
      setBusyTutorId(undefined);
    }
  }

  async function confirmReject(reason: string, note?: string) {
    if (!rejectTutor) return;

    setBusyTutorId(rejectTutor.id);
    setError("");

    try {
      await staffTutorsApi.reject(rejectTutor.id, reason, note || "");
      const nextTutors = tutors.filter((item) => item.id !== rejectTutor.id);
      setTutors(nextTutors);
      setSelectedTutorId(nextTutors[0]?.id);
      setSelectedTutor(undefined);
      setToast(`Đã từ chối hồ sơ ${rejectTutor.fullName}.`);
      setRejectTutor(undefined);
    } catch (rejectError: any) {
      setError(rejectError?.status === 409
        ? "Hồ sơ đã được xử lý bởi người khác. Vui lòng refresh danh sách."
        : rejectError?.message || "Không thể từ chối hồ sơ gia sư.");
    } finally {
      setBusyTutorId(undefined);
    }
  }

  async function viewDocument(tutor: TutorApprovalItem, documentId: string) {
    try {
      const response = await staffTutorsApi.documentDownload(tutor.id, documentId);
      if (response?.url) window.open(response.url, "_blank", "noopener,noreferrer");
    } catch (viewError) {
      setError(viewError instanceof Error ? viewError.message : "Không thể mở tài liệu.");
    }
  }


  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-20 animate-pulse bg-white" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((item) => <div key={item} className="h-32 animate-pulse bg-white" />)}
        </div>
        <div className="grid grid-cols-[1fr_380px] gap-5">
          <div className="h-[420px] animate-pulse bg-white" />
          <div className="h-[420px] animate-pulse bg-white" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-96px)] bg-[#f3f6f9] p-0 font-sans text-[#073554]">
      <header className="mb-5 flex flex-col gap-4 border border-[#d7dde6] bg-white px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
            Quản trị / <span className="text-[#073554]">Phê duyệt hồ sơ</span>
          </p>
          <h1 className="mt-1 font-display text-2xl font-black uppercase tracking-tight text-[#073554]">Admin duyệt hồ sơ gia sư</h1>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {isAdmin
              ? "Bạn đang duyệt với quyền Admin, bao gồm toàn bộ quyền của Staff."
              : "Staff có thể duyệt hồ sơ theo quyền vận hành được phân công."}
          </p>
        </div>

        <button onClick={load} className="inline-flex w-fit items-center gap-2 border border-[#d7dde6] bg-[#f7f9fc] px-3 py-2 text-xs font-bold text-slate-500 hover:border-[#ff695f]">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </header>

      {toast && (
        <div className="mb-4 flex items-center gap-2 border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          {toast}
          <button onClick={() => setToast("")} className="ml-auto text-emerald-900">Dismiss</button>
        </div>
      )}

      {error && (
        <div className="mb-4 flex items-start gap-2 border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
          <span>{error}</span>
        </div>
      )}

      <DashboardStats pendingCount={tutors.length + teachingPendingCount} approvedToday={0} rejectedToday={0} averageReviewTime="--" />

      <TeachingRegistrationReview onNotice={setToast} onError={setError} onPendingCountChange={setTeachingPendingCount} />

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <TutorApprovalQueue
          tutors={visibleTutors}
          selectedTutorId={selectedTutorId}
          search={search}
          subjectFilter={subjectFilter}
          sort={sort}
          onSearchChange={setSearch}
          onSubjectFilterChange={setSubjectFilter}
          onSortChange={setSort}
          onSelectTutor={(tutor) => setSelectedTutorId(tutor.id)}
        />

        <TutorDetailPanel
          tutor={selectedTutor}
          loading={detailLoading}
          busy={busyTutorId === selectedTutor?.id}
          onApprove={approveTutor}
          onReject={setRejectTutor}
          onViewDocument={viewDocument}
        />
      </div>

      <RejectTutorModal
        tutor={rejectTutor}
        busy={busyTutorId === rejectTutor?.id}
        onClose={() => setRejectTutor(undefined)}
        onConfirm={confirmReject}
      />
    </div>
  );
}

