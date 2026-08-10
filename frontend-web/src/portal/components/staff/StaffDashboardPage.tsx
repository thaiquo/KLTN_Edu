import React, { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import { staffTutorsApi } from "../../../api/staffTutors";
import { TutorApprovalItem } from "../../types";
import { DashboardStats } from "./DashboardStats";
import { RejectTutorModal } from "./RejectTutorModal";
import { TutorApprovalQueue } from "./TutorApprovalQueue";
import { TutorDetailPanel } from "./TutorDetailPanel";

const PREVIEW_TUTORS: TutorApprovalItem[] = [
  {
    id: 101,
    userId: 1001,
    fullName: "Nguyen Minh Anh",
    email: "minhanh.tutor@gmail.com",
    bio: "Tôi có 3 năm hỗ trợ học viên luyện IELTS Writing và Speaking, tập trung vào lộ trình cá nhân hóa theo mục tiêu band điểm.",
    education: "Đại học Ngoại Thương",
    experienceYears: 3,
    status: "PENDING",
    subjects: [
      { id: 1, name: "English" },
      { id: 2, name: "IELTS" },
    ],
    documents: [
      { id: "doc-1", name: "IELTS Academic Certificate.pdf" },
      { id: "doc-2", name: "Teaching Experience Letter.pdf" },
    ],
    createdAt: "2026-08-10T08:15:00",
  },
  {
    id: 102,
    userId: 1002,
    fullName: "Tran Quoc Bao",
    email: "bao.java@gmail.com",
    bio: "Giảng dạy Java, Spring Boot và cơ sở dữ liệu cho sinh viên năm 2-4. Ưu tiên thực hành dự án nhỏ sau mỗi module.",
    education: "Đại học Công nghiệp TP.HCM",
    experienceYears: 2,
    status: "PENDING",
    subjects: [
      { id: 3, name: "Java" },
      { id: 4, name: "Spring Boot" },
      { id: 5, name: "Database" },
      { id: 6, name: "Data Structures" },
    ],
    documents: [{ id: "doc-3", name: "Software Engineer CV.pdf" }],
    createdAt: "2026-08-09T19:40:00",
  },
  {
    id: 103,
    userId: 1003,
    fullName: "Le Hoang Nhi",
    email: "nhi.math@gmail.com",
    bio: "Ôn thi toán THPT, củng cố nền tảng giải tích và đại số tuyến tính cho học viên mất gốc.",
    education: "Đại học Sư phạm TP.HCM",
    experienceYears: 4,
    status: "PENDING",
    subjects: [
      { id: 7, name: "Toan lop 12" },
      { id: 8, name: "Giai tich 1" },
    ],
    createdAt: "2026-08-08T10:20:00",
  },
];

function normalizeTutor(raw: any): TutorApprovalItem {
  return {
    id: Number(raw.id),
    userId: raw.userId ? Number(raw.userId) : undefined,
    fullName: raw.fullName || raw.name || "Tutor applicant",
    email: raw.email || "",
    bio: raw.bio || raw.introduction || "",
    education: raw.education || "",
    experienceYears: Number(raw.experienceYears ?? raw.yearsOfExperience ?? 0),
    status: raw.status || raw.verificationStatus || "PENDING",
    rejectionReason: raw.rejectionReason || null,
    subjects: (raw.subjects || []).map((subject: any) => ({
      id: Number(subject.id),
      name: subject.name,
    })),
    documents: raw.documents || raw.certificates || [],
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export function StaffDashboardPage() {
  const [tutors, setTutors] = useState<TutorApprovalItem[]>([]);
  const [selectedTutorId, setSelectedTutorId] = useState<number>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [previewMode, setPreviewMode] = useState(false);
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [sort, setSort] = useState("newest");
  const [busyTutorId, setBusyTutorId] = useState<number>();
  const [rejectTutor, setRejectTutor] = useState<TutorApprovalItem>();
  const [toast, setToast] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const result = await staffTutorsApi.pending();
      const nextTutors = Array.isArray(result) ? result.map(normalizeTutor) : [];
      setTutors(nextTutors);
      setPreviewMode(false);
      setSelectedTutorId((current) => current && nextTutors.some((item) => item.id === current) ? current : nextTutors[0]?.id);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Khong the tai danh sach Tutor dang cho duyet.");
      setTutors(PREVIEW_TUTORS);
      setPreviewMode(true);
      setSelectedTutorId((current) => current || PREVIEW_TUTORS[0]?.id);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

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

  const selectedTutor = visibleTutors.find((item) => item.id === selectedTutorId) || visibleTutors[0];

  async function approveTutor(tutor: TutorApprovalItem) {
    if (previewMode) {
      setError("Dang hien thi du lieu preview. Hay ket noi backend Staff API de duyet ho so that.");
      return;
    }

    setBusyTutorId(tutor.id);
    setError("");

    try {
      await staffTutorsApi.approve(tutor.id);
      const nextTutors = tutors.filter((item) => item.id !== tutor.id);
      setTutors(nextTutors);
      setSelectedTutorId(nextTutors[0]?.id);
      setToast(`Da duyet ho so ${tutor.fullName}.`);
    } catch (approveError) {
      setError(approveError instanceof Error ? approveError.message : "Khong the duyet ho so Tutor.");
    } finally {
      setBusyTutorId(undefined);
    }
  }

  async function confirmReject(reason: string) {
    if (!rejectTutor) return;

    if (previewMode) {
      setError("Dang hien thi du lieu preview. Hay ket noi backend Staff API de tu choi ho so that.");
      setRejectTutor(undefined);
      return;
    }

    setBusyTutorId(rejectTutor.id);
    setError("");

    try {
      await staffTutorsApi.reject(rejectTutor.id, reason);
      const nextTutors = tutors.filter((item) => item.id !== rejectTutor.id);
      setTutors(nextTutors);
      setSelectedTutorId(nextTutors[0]?.id);
      setToast(`Da tu choi ho so ${rejectTutor.fullName}.`);
      setRejectTutor(undefined);
    } catch (rejectError) {
      setError(rejectError instanceof Error ? rejectError.message : "Khong the tu choi ho so Tutor.");
    } finally {
      setBusyTutorId(undefined);
    }
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-20 animate-pulse bg-white" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((item) => <div key={item} className="h-32 animate-pulse bg-white" />)}
        </div>
        <div className="grid grid-cols-[1fr_360px] gap-5">
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
            Tong quan / <span className="text-[#073554]">Van hanh</span>
          </p>
          <h1 className="mt-1 font-display text-2xl font-black uppercase tracking-tight text-[#073554]">Duyet ho so gia su</h1>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-slate-500">
          <button onClick={load} className="inline-flex items-center gap-2 border border-[#d7dde6] bg-[#f7f9fc] px-3 py-2 hover:border-[#ff695f]">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <span className="border border-[#d7dde6] bg-[#f7f9fc] px-3 py-2">Thu hai, 10 thang 8, 2026</span>
        </div>
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

      {previewMode && (
        <div className="mb-4 border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800">
          Backend Staff API chua tra du lieu trong phien nay. UI dang hien thi du lieu preview de kiem tra giao dien.
        </div>
      )}

      <DashboardStats pendingCount={tutors.length} />

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <TutorApprovalQueue
          tutors={visibleTutors}
          selectedTutorId={selectedTutor?.id}
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
          busy={busyTutorId === selectedTutor?.id}
          onApprove={approveTutor}
          onReject={setRejectTutor}
        />
      </div>

      <footer className="mt-5 grid gap-3 border border-[#d7dde6] bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.14em] text-slate-500 md:grid-cols-3">
        <span>Pending: {tutors.length}</span>
        <span>Approved today: 12</span>
        <span>Oldest pending: 31h</span>
      </footer>

      <RejectTutorModal
        tutor={rejectTutor}
        busy={busyTutorId === rejectTutor?.id}
        onClose={() => setRejectTutor(undefined)}
        onConfirm={confirmReject}
      />
    </div>
  );
}
