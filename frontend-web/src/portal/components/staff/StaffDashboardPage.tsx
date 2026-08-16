import React, { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import { staffTutorsApi } from "../../../api/staffTutors";
import { subjectSuggestionApi } from "../../../api/subjectSuggestions";
import { useAuth } from "../../../hooks/useAuth";
import { TutorApprovalItem } from "../../types";
import { DashboardStats } from "./DashboardStats";
import { RejectTutorModal } from "./RejectTutorModal";
import { TutorApprovalQueue } from "./TutorApprovalQueue";
import { TutorDetailPanel } from "./TutorDetailPanel";

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
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [suggestionBusyId, setSuggestionBusyId] = useState<number>();

  async function load() {
    setLoading(true);
    setError("");

    try {
      const result = await staffTutorsApi.pending();
      const suggestionResult = await subjectSuggestionApi.staffPending().catch(() => []);
      const nextTutors = Array.isArray(result) ? result.map(normalizeSummary) : [];
      setTutors(nextTutors);
      setSuggestions(Array.isArray(suggestionResult) ? suggestionResult : []);
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

  async function approveSuggestionAsNew(id: number) {
    setSuggestionBusyId(id);
    setError("");
    try {
      await subjectSuggestionApi.approveAsNew(id, user?.id);
      setSuggestions((current) => current.filter((item) => item.id !== id));
      setToast("Đã duyệt đề xuất thành môn học mới.");
    } catch (error: any) {
      setError(error?.message || "Không thể duyệt đề xuất môn học.");
    } finally {
      setSuggestionBusyId(undefined);
    }
  }

  async function rejectSuggestion(id: number) {
    const reason = window.prompt("Lý do từ chối đề xuất môn học:");
    if (!reason?.trim()) return;
    setSuggestionBusyId(id);
    setError("");
    try {
      await subjectSuggestionApi.reject(id, reason.trim(), user?.id);
      setSuggestions((current) => current.filter((item) => item.id !== id));
      setToast("Đã từ chối đề xuất môn học.");
    } catch (error: any) {
      setError(error?.message || "Không thể từ chối đề xuất môn học.");
    } finally {
      setSuggestionBusyId(undefined);
    }
  }

  async function mapSuggestionToExisting(id: number) {
    const subjectId = window.prompt("Nhập ID môn học chính thức để ghép đề xuất này:");
    if (!subjectId?.trim()) return;
    const numericSubjectId = Number(subjectId);
    if (!Number.isFinite(numericSubjectId) || numericSubjectId <= 0) {
      setError("Subject ID không hợp lệ.");
      return;
    }
    setSuggestionBusyId(id);
    setError("");
    try {
      await subjectSuggestionApi.mapExisting(id, { subjectId: numericSubjectId });
      setSuggestions((current) => current.filter((item) => item.id !== id));
      setToast("Đã ghép đề xuất với môn học có sẵn.");
    } catch (error: any) {
      setError(error?.message || "Không thể ghép đề xuất với môn học có sẵn.");
    } finally {
      setSuggestionBusyId(undefined);
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
            Tổng quan / <span className="text-[#073554]">Vận hành</span>
          </p>
          <h1 className="mt-1 font-display text-2xl font-black uppercase tracking-tight text-[#073554]">Duyệt hồ sơ gia sư</h1>
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

      <DashboardStats pendingCount={tutors.length} approvedToday={0} rejectedToday={0} averageReviewTime="--" />

      <SubjectSuggestionReview
        suggestions={suggestions}
        busyId={suggestionBusyId}
        onApproveAsNew={approveSuggestionAsNew}
        onMapExisting={mapSuggestionToExisting}
        onReject={rejectSuggestion}
      />

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

function SubjectSuggestionReview({
  suggestions,
  busyId,
  onApproveAsNew,
  onMapExisting,
  onReject,
}: {
  suggestions: any[];
  busyId?: number;
  onApproveAsNew: (id: number) => void;
  onMapExisting: (id: number) => void;
  onReject: (id: number) => void;
}) {
  if (!suggestions.length) return null;

  return (
    <section className="mt-5 border border-[#d7dde6] bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Catalog</p>
          <h2 className="font-display text-lg font-black uppercase text-[#073554]">Đề xuất môn học mới</h2>
        </div>
        <span className="w-fit bg-[#f7f9fc] px-3 py-2 text-xs font-black text-slate-500">{suggestions.length} đề xuất chờ duyệt</span>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {suggestions.map((suggestion) => (
          <article key={suggestion.id} className="border border-[#d7dde6] bg-[#f7f9fc] p-4">
            <h3 className="font-display text-sm font-black text-[#073554]">{suggestion.suggestedName}</h3>
            <p className="mt-1 text-xs font-bold text-slate-500">
              {suggestion.category?.name} · {suggestion.group?.name}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(suggestion.levels || []).map((level: string) => (
                <span key={level} className="bg-white px-2 py-1 text-[10px] font-black text-[#073554]">
                  {levelLabels[level] || level}
                </span>
              ))}
            </div>
            {suggestion.note && <p className="mt-3 text-xs font-semibold leading-5 text-slate-600">{suggestion.note}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" disabled={busyId === suggestion.id} onClick={() => onApproveAsNew(suggestion.id)} className="bg-[#ff695f] px-3 py-2 text-[10px] font-black uppercase text-white disabled:opacity-50">
                Tạo môn mới
              </button>
              <button type="button" disabled={busyId === suggestion.id} onClick={() => onMapExisting(suggestion.id)} className="border border-[#d7dde6] bg-white px-3 py-2 text-[10px] font-black uppercase text-[#073554] disabled:opacity-50">
                Ghép môn có sẵn
              </button>
              <button type="button" disabled={busyId === suggestion.id} onClick={() => onReject(suggestion.id)} className="border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] font-black uppercase text-rose-700 disabled:opacity-50">
                Từ chối
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

const levelLabels: Record<string, string> = {
  PRIMARY: "Tiểu học",
  LOWER_SECONDARY: "THCS",
  UPPER_SECONDARY: "THPT",
  UNIVERSITY: "Đại học",
  ADULT: "Người lớn / Người đi làm",
  EXAM_PREPARATION: "Luyện thi / Chứng chỉ",
};
