import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  RefreshCw,
  Loader2,
  Check,
  X,
  MessageSquare,
  ClipboardCheck,
  Paperclip,
  ExternalLink,
  AlertTriangle,
  ShieldCheck,
  User,
  Users,
  BookOpen,
  Clock,
  CheckCircle2,
  XCircle,
  Info,
  DollarSign,
  FileImage,
  FileVideo,
  FileAudio,
  History,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Award,
  Eye,
  Send,
  Trash2,
  FileText,
  Search,
  Filter,
} from 'lucide-react';
import { contractsApi, AgreementSummary, DisputeDto } from '../../api/contractsApi';
import { useAuth } from '../../hooks/useAuth';
import { terminationsApi, TerminationView } from '../../api/terminationsApi';
import { useRealtimeRefresh } from '../../realtime/useRealtimeRefresh';
import { TerminationRequestModal } from './TerminationRequestModal';
import { terminationCaseLabel, terminationItemLabel, terminationProgressText, terminationWaitingDetail } from './terminationStatus';

const labels: Record<string, string> = {
  HOLD_PENDING: 'Đang tạm dừng lịch học',
  RELEASE_PENDING: 'Đang khôi phục lịch học',
  REQUESTED: 'Đang chờ Staff thẩm định',
  RECOMMENDED: 'Staff đã đề xuất (Chờ Admin duyệt)',
  APPROVED: 'Admin đã duyệt - đang quyết toán, chưa hoàn tiền xong',
  REJECTED: 'Đã từ chối (Khôi phục lớp học)',
  COMPLETED: 'Hoàn tất chấm dứt & hoàn tiền',
  LEARNING_PENDING: 'Đang cập nhật lịch học',
  WAITING_SETTLEMENT: 'Đang quyết toán các buổi đã dạy',
  WAITING_PAYMENT: 'Chờ xử lý nạp cọc',
  BLOCKCHAIN_PENDING: 'Đang xử lý giao dịch On-chain',
  TRANSACTION_FAILED: 'Giao dịch cần kiểm tra lại',
  WAITING_REFUND_EVENT: 'Chờ hoàn tiền Escrow Smart Contract',
  RESPOND: 'Phản hồi/giải trình từ bên hợp đồng',
  RECOMMEND: 'Staff đề xuất chấm dứt',
  APPROVE: 'Admin phê duyệt chấm dứt',
  FORCE_APPROVE: 'Admin quyết định hủy khẩn cấp',
  REJECT: 'Từ chối đề xuất',
};

const statusTone = (status: string) => {
  if (status === 'COMPLETED') return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (status === 'TRANSACTION_FAILED') return 'text-red-700 bg-red-50 border-red-200';
  if (status === 'REJECTED') return 'text-slate-600 bg-slate-100 border-slate-200';
  if (status === 'RECOMMENDED') return 'text-indigo-700 bg-indigo-50 border-indigo-200';
  if (['HOLD_PENDING', 'REQUESTED', 'RELEASE_PENDING', 'APPROVED', 'WAITING_SETTLEMENT', 'WAITING_PAYMENT'].includes(status))
    return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-blue-700 bg-blue-50 border-blue-200';
};

const message = (error: unknown) => (error instanceof Error ? error.message : 'Không thể xử lý yêu cầu.');

const units = (value?: string | null, decimals: number = 6) => {
  if (!value) return '0';
  const digits = String(value).padStart(decimals + 1, '0');
  return decimals ? `${digits.slice(0, -decimals)}.${digits.slice(-decimals)}` : digits;
};

const remainingEscrow = (agreement: AgreementSummary) => {
  if (agreement.remainingDeposit != null && Number.isFinite(Number(agreement.remainingDeposit))) {
    return Math.max(0, Number(agreement.remainingDeposit));
  }
  return Math.max(0,
    (Number(agreement.totalAmountUsdc) || 0)
      - (Number(agreement.releasedAmountUsdc) || 0)
      - (Number(agreement.refundedAmountUsdc) || 0));
};

const parseAudit = (json?: string | null) => {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed)
      ? (parsed as Array<{ actor: string; role?: string; action: string; reason: string; at: string }>)
      : [];
  } catch {
    return [];
  }
};

const getFileIcon = (contentType: string, filename: string) => {
  const lower = (filename || '').toLowerCase();
  if (contentType?.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(lower)) return FileImage;
  if (contentType?.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(lower)) return FileVideo;
  if (contentType?.startsWith('audio/') || /\.(mp3|wav|m4a)$/i.test(lower)) return FileAudio;
  return FileText;
};

interface TerminationPanelProps {
  activeRole: string;
  initialAgreements?: AgreementSummary[];
  onNavigate?: (page: string) => void;
  selectedClassroomId?: number | string | null;
  selectedAgreementId?: string | null;
  onClearClassFilter?: () => void;
}

const UNRESOLVED_DISPUTE_STATUSES = new Set(['OPENING', 'OPEN', 'UNDER_REVIEW', 'RESOLUTION_PENDING', 'FAILED_RETRYABLE']);

const fetchAllDisputes = async (): Promise<DisputeDto[]> => {
  const first = await contractsApi.listDisputes({ page: 0, size: 100 });
  const rows = [...(first.content ?? [])];
  for (let page = 1; page < first.totalPages; page++) {
    const next = await contractsApi.listDisputes({ page, size: 100 });
    rows.push(...(next.content ?? []));
  }
  return rows;
};

export function TerminationPanel({
  activeRole,
  initialAgreements,
  onNavigate,
  selectedClassroomId,
  selectedAgreementId,
  onClearClassFilter,
}: TerminationPanelProps) {
  const { user } = useAuth();
  const [requests, setRequests] = useState<TerminationView[]>([]);
  const [agreements, setAgreements] = useState<AgreementSummary[]>(initialAgreements || []);
  const [disputes, setDisputes] = useState<DisputeDto[]>([]);
  const [error, setError] = useState('');
  const [refreshError, setRefreshError] = useState('');
  const [complaintBlockWarning, setComplaintBlockWarning] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Filters & display state
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>(
    selectedClassroomId != null ? String(selectedClassroomId) : 'ALL'
  );
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'RECOMMENDED' | 'APPROVED' | 'REJECTED'>('ALL');
  const [originFilter, setOriginFilter] = useState<'ALL' | 'TUTOR_PROPOSAL' | 'AUTO_ABSENCE' | 'STUDENT_UNILATERAL' | 'ADMIN_DIRECT'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCaseIds, setExpandedCaseIds] = useState<Set<string>>(new Set());
  const [isTutorProposeModalOpen, setIsTutorProposeModalOpen] = useState(false);
  const [tutorProposeTargetAgreement, setTutorProposeTargetAgreement] = useState<AgreementSummary | null>(null);
  const [showClassPickerModal, setShowClassPickerModal] = useState(false);

  // Staff / Admin Review action
  const [action, setAction] = useState<{ id: string; type: string } | null>(null);
  const [reviewReason, setReviewReason] = useState('');

  // Student unified supplement staging states per case
  const [stagedFilesMap, setStagedFilesMap] = useState<Record<string, File[]>>({});
  const [stagedNotesMap, setStagedNotesMap] = useState<Record<string, string>>({});
  const [submittingCaseId, setSubmittingCaseId] = useState<string | null>(null);
  const [showWorkflowGuide, setShowWorkflowGuide] = useState(false);
  const [showAdminCreate, setShowAdminCreate] = useState(false);
  const [adminAgreementId, setAdminAgreementId] = useState('');
  const [adminWholeClass, setAdminWholeClass] = useState(true);
  const [adminApproveImmediately, setAdminApproveImmediately] = useState(false);
  const [adminReason, setAdminReason] = useState('');

  // Sync external selectedClassroomId prop
  const initializedCases = useRef(new Set<string>());
  useEffect(() => {
    initializedCases.current.clear();
    setSelectedClassFilter(selectedClassroomId != null ? String(selectedClassroomId) : 'ALL');
    setStatusFilter('ALL');
    setOriginFilter('ALL');
    setSearchQuery('');
  }, [selectedClassroomId, selectedAgreementId]);

  // Auto-expand pending or targeted cases, collapse completed/rejected cases by default
  useEffect(() => {
    if (requests.length === 0) return;
    const newRequests = requests.filter(({ request }) => !initializedCases.current.has(request.id));
    newRequests.forEach(({ request }) => initializedCases.current.add(request.id));
    setExpandedCaseIds((prev) => {
      const next = new Set(prev);
      newRequests.forEach(({ request: c }) => {
        const isPending = ['HOLD_PENDING', 'REQUESTED', 'RECOMMENDED'].includes(c.status);
        const matchesClass = selectedClassroomId != null && String(c.classroomId) === String(selectedClassroomId);
        const matchesAgreement = selectedAgreementId != null && c.anchorAgreementId === selectedAgreementId;
        if (isPending || matchesClass || matchesAgreement || requests.length === 1) {
          next.add(c.id);
        }
      });
      return next;
    });
  }, [requests, selectedClassroomId, selectedAgreementId]);

  const toggleCaseExpand = (id: string) => {
    setExpandedCaseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedCaseIds(new Set(requests.map((r) => r.request.id)));
  };

  const collapseAll = () => {
    setExpandedCaseIds(new Set());
  };

  const normalizedRole = (activeRole || '').toLowerCase();
  const isTutor = normalizedRole === 'tutor';
  const isStudent = normalizedRole === 'student';
  const isStaff = normalizedRole === 'staff';
  const isAdmin = normalizedRole === 'admin';
  const isManager = isAdmin || isStaff;

  const load = useCallback(async () => {
    try {
      setRequests(await terminationsApi.list());
      setRefreshError('');
    } catch (e) {
      setRefreshError(message(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useRealtimeRefresh(
    [
      'TERMINATION_UPDATED',
      'TERMINATION_COMPLETED',
      'TERMINATION_EVIDENCE_SUBMITTED',
      'TERMINATION_REQUESTED',
      'TERMINATION_APPROVED',
      'TERMINATION_REJECTED'
    ],
    load
  );

  useEffect(() => {
    let active = true;
    void load();
    const refreshRelated = () => {
      void (async () => {
        try {
          const result: AgreementSummary[] = [];
          for (let page = 0; ; page++) {
            const response = await contractsApi.listAgreements({ page, size: 100 });
            const content = response.content ?? [];
            result.push(...content);
            if (content.length < 100 || result.length >= response.totalElements) break;
          }
          if (active) setAgreements(result);
        } catch (e) {
          if (active) setError(message(e));
        }
      })();
      if (isManager) {
        void (async () => {
          try {
            const rows = await fetchAllDisputes();
            if (active) setDisputes(rows);
          } catch {
            // The backend remains authoritative and will reject a review if a complaint is pending.
          }
        })();
      }
    };
    refreshRelated();
    const timer = window.setInterval(() => {
      void load();
      refreshRelated();
    }, 15000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [load, isManager]);

  const agreementMap = useMemo(() => new Map(agreements.map((a) => [a.id, a])), [agreements]);
  const classroomMap = useMemo(() => {
    const map = new Map<number, AgreementSummary[]>();
    agreements.forEach((a) => {
      if (a.classroomId) {
        const list = map.get(a.classroomId) || [];
        list.push(a);
        map.set(a.classroomId, list);
      }
    });
    return map;
  }, [agreements]);

  const getPendingDisputes = useCallback((termination: TerminationView, allDisputes: DisputeDto[]) => {
    const targets = termination.request.wholeClass
      ? (classroomMap.get(Number(termination.request.classroomId)) || [])
          .filter((a) => !['CANCELLED', 'EXPIRED', 'COMPLETED'].includes(a.status))
          .map((a) => a.id)
      : [termination.request.anchorAgreementId];
    const targetIds = new Set(targets);
    return allDisputes.filter((d) => targetIds.has(d.agreementId) && UNRESOLVED_DISPUTE_STATUSES.has(d.status));
  }, [classroomMap]);

  const beginManagerAction = async (termination: TerminationView, type: string) => {
    let currentDisputes = disputes;
    try {
      currentDisputes = await fetchAllDisputes();
      setDisputes(currentDisputes);
    } catch {
      // Submission still goes through the backend's authoritative dispute check.
      currentDisputes = [];
    }
    const pending = getPendingDisputes(termination, currentDisputes);
    if (pending.length && type !== 'FORCE_APPROVE') {
      const sessions = [...new Set(pending.map((d) => `#${d.sessionId}`))].join(', ');
      setComplaintBlockWarning(`Chưa thể xử lý yêu cầu này: cần giải quyết khiếu nại ở buổi ${sessions} trước. Khiếu nại chỉ giữ quyết toán các buổi đó; yêu cầu hủy lớp vẫn giữ nguyên trạng thái dừng lịch tương lai.`);
      setAction(null);
      return;
    }
    setError('');
    setComplaintBlockWarning('');
    setAction({ id: termination.request.id, type });
    setReviewReason('');
  };

  const stats = useMemo(() => {
    const total = requests.length;
    const pending = requests.filter((r) => ['HOLD_PENDING', 'REQUESTED'].includes(r.request.status)).length;
    const recommended = requests.filter((r) => r.request.status === 'RECOMMENDED').length;
    const approved = requests.filter((r) => ['APPROVED', 'COMPLETED'].includes(r.request.status)).length;
    const rejected = requests.filter((r) => r.request.status === 'REJECTED').length;
    return { total, pending, recommended, approved, rejected };
  }, [requests]);

  const originStats = useMemo(() => {
    let tutor = 0;
    let autoAbsence = 0;
    let student = 0;
    let admin = 0;
    requests.forEach(({ request: c }) => {
      if (c.origin === 'AUTO_TUTOR_ABSENCE') autoAbsence++;
      else if (c.origin === 'ADMIN_DIRECT') admin++;
      else if (c.wholeClass) tutor++;
      else student++;
    });
    return { tutor, autoAbsence, student, admin };
  }, [requests]);

  const uniqueClassrooms = useMemo(() => {
    const map = new Map<number | string, { id: number | string; name: string; count: number }>();
    requests.forEach((r) => {
      const cid = r.request.classroomId;
      const anchor = agreementMap.get(r.request.anchorAgreementId);
      const name = anchor?.className || `Lớp #${cid}`;
      if (!map.has(cid)) {
        map.set(cid, { id: cid, name, count: 0 });
      }
      map.get(cid)!.count += 1;
    });
    return Array.from(map.values());
  }, [requests, agreementMap]);

  const tutorActiveClasses = useMemo(() => {
    if (!isTutor) return [];
    const map = new Map<number | string, { classroomId: number | string; className: string; agreements: AgreementSummary[] }>();
    agreements.forEach((a) => {
      if (a.status === 'ACTIVE' && (!user?.id || a.tutorId === user.id)) {
        const cid = a.classroomId;
        if (!map.has(cid)) {
          map.set(cid, { classroomId: cid, className: a.className || `Lớp #${cid}`, agreements: [] });
        }
        map.get(cid)!.agreements.push(a);
      }
    });
    return Array.from(map.values());
  }, [isTutor, agreements, user?.id]);

  const currentFilteredClass = useMemo(() => {
    if (selectedClassFilter === 'ALL') return null;
    return uniqueClassrooms.find((c) => String(c.id) === String(selectedClassFilter)) || null;
  }, [selectedClassFilter, uniqueClassrooms]);

  const filteredRequests = useMemo(() => {
    return requests
      .filter(({ request: c }) => {
        if (selectedAgreementId && c.anchorAgreementId !== selectedAgreementId) {
          const selected = agreementMap.get(selectedAgreementId);
          if (!c.wholeClass || !selected || String(selected.classroomId) !== String(c.classroomId)) return false;
        }
        if (selectedClassFilter !== 'ALL' && String(c.classroomId) !== String(selectedClassFilter)) {
          return false;
        }
        if (statusFilter === 'PENDING' && !['HOLD_PENDING', 'REQUESTED'].includes(c.status)) return false;
        if (statusFilter === 'RECOMMENDED' && c.status !== 'RECOMMENDED') return false;
        if (statusFilter === 'APPROVED' && !['APPROVED', 'COMPLETED'].includes(c.status)) return false;
        if (statusFilter === 'REJECTED' && c.status !== 'REJECTED') return false;
        if (originFilter === 'TUTOR_PROPOSAL') {
          if (!c.wholeClass || c.origin === 'AUTO_TUTOR_ABSENCE' || c.origin === 'ADMIN_DIRECT') return false;
        } else if (originFilter === 'AUTO_ABSENCE') {
          if (c.origin !== 'AUTO_TUTOR_ABSENCE') return false;
        } else if (originFilter === 'STUDENT_UNILATERAL') {
          if (c.wholeClass || c.origin === 'ADMIN_DIRECT') return false;
        } else if (originFilter === 'ADMIN_DIRECT') {
          if (c.origin !== 'ADMIN_DIRECT') return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const anchor = agreementMap.get(c.anchorAgreementId);
          const className = (anchor?.className || `Lớp #${c.classroomId}`).toLowerCase();
          const tutorName = (anchor?.tutorName || '').toLowerCase();
          const studentName = (anchor?.studentName || '').toLowerCase();
          const reason = (c.reason || '').toLowerCase();
          const caseId = c.id.toLowerCase();
          if (
            !className.includes(q) &&
            !tutorName.includes(q) &&
            !studentName.includes(q) &&
            !reason.includes(q) &&
            !caseId.includes(q)
          ) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        const isPendingA = ['HOLD_PENDING', 'REQUESTED', 'RECOMMENDED'].includes(a.request.status) ? 1 : 0;
        const isPendingB = ['HOLD_PENDING', 'REQUESTED', 'RECOMMENDED'].includes(b.request.status) ? 1 : 0;
        if (isPendingA !== isPendingB) return isPendingB - isPendingA;
        return new Date(b.request.createdAt).getTime() - new Date(a.request.createdAt).getTime();
      });
  }, [requests, selectedClassFilter, statusFilter, originFilter, searchQuery, agreementMap, selectedAgreementId]);

  const activeAdminAgreements = useMemo(
    () => agreements.filter((agreement) => agreement.status === 'ACTIVE' && !agreement.legacyUnreconciled),
    [agreements]
  );

  const submitAdminTermination = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!adminAgreementId || !adminReason.trim()) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const created = await terminationsApi.adminRequest(
        adminAgreementId,
        adminWholeClass,
        adminReason.trim(),
        adminApproveImmediately
      );
      setAdminReason('');
      setShowAdminCreate(false);
      setSuccess(created.request.status === 'HOLD_PENDING'
        ? 'Đã lưu hồ sơ, đang chờ đồng bộ tạm dừng lịch. Admin cần phê duyệt sau khi đồng bộ thành công.'
        : adminApproveImmediately
        ? 'Admin đã dừng phạm vi đã chọn và phê duyệt thanh lý. Hoàn tiền sẽ chạy sau khi các buổi đã bắt đầu được quyết toán.'
        : 'Admin đã tạm dừng phạm vi đã chọn và tạo hồ sơ xem xét.');
      await load();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };

  // Handle Staff/Admin action review
  const handleManagerReview = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!action) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const updated = await terminationsApi.act(action.id, action.type, reviewReason);
      setAction(null);
      setReviewReason('');
      setComplaintBlockWarning('');
      setSuccess(`Đã lưu quyết định. ${terminationProgressText(updated)}.`);
      await load();
    } catch (e) {
      const text = message(e);
      if (text.toLowerCase().includes('khiếu nại')) {
        setComplaintBlockWarning(text);
      } else {
        setError(text);
      }
    } finally {
      setBusy(false);
    }
  };

  // Student Staging Handlers
  const handlePickStagedFiles = (caseId: string, event: React.ChangeEvent<HTMLInputElement>, existingCount: number) => {
    if (!event.target.files) return;
    const selected = Array.from(event.target.files);
    event.target.value = '';

    const currentStaged = stagedFilesMap[caseId] || [];
    const remainingSlots = 5 - existingCount - currentStaged.length;
    if (remainingSlots <= 0) {
      setError('Bạn đã đạt giới hạn tối đa 5 tệp minh chứng cho hồ sơ này.');
      return;
    }

    const validFiles: File[] = [];
    for (const f of selected) {
      if (f.size > 50 * 1024 * 1024) {
        setError(`Tệp "${f.name}" vượt quá kích thước tối đa 50 MB.`);
        continue;
      }
      validFiles.push(f);
      if (validFiles.length >= remainingSlots) break;
    }

    setStagedFilesMap((prev) => ({
      ...prev,
      [caseId]: [...(prev[caseId] || []), ...validFiles],
    }));
  };

  const handleRemoveStagedFile = (caseId: string, index: number) => {
    setStagedFilesMap((prev) => ({
      ...prev,
      [caseId]: (prev[caseId] || []).filter((_, i) => i !== index),
    }));
  };

  const handleClearStaged = (caseId: string) => {
    setStagedFilesMap((prev) => ({ ...prev, [caseId]: [] }));
    setStagedNotesMap((prev) => ({ ...prev, [caseId]: '' }));
  };

  const handleSubmitSupplement = async (caseId: string) => {
    const filesToUpload = stagedFilesMap[caseId] || [];
    const noteText = (stagedNotesMap[caseId] || '').trim();

    if (filesToUpload.length === 0 && !noteText) {
      setError('Vui lòng chọn ít nhất một tệp minh chứng hoặc nhập lời giải thích trước khi bấm gửi.');
      return;
    }

    setSubmittingCaseId(caseId);
    setError('');
    setSuccess('');

    try {
      // 1. Upload staged files sequentially
      for (const file of filesToUpload) {
        const updated = await terminationsApi.uploadEvidence(caseId, file);
        setRequests((prev) => prev.map((entry) => entry.request.id === caseId ? updated : entry));
        // Keep only unsent files if a later upload or the explanation fails.
        setStagedFilesMap((prev) => ({ ...prev, [caseId]: (prev[caseId] || []).filter((pending) => pending !== file) }));
      }

      // 2. Submit explanation note if entered
      if (noteText) {
        await terminationsApi.act(caseId, 'RESPOND', noteText);
      }

      setSuccess('Đã gửi bổ sung tài liệu minh chứng & lời giải thích thành công. Mốc thời gian gửi đã được lưu lại.');
      handleClearStaged(caseId);
      await load();
    } catch (e) {
      setError(`${message(e)} Các tệp đã gửi thành công được giữ trong hồ sơ; chỉ tệp chưa gửi và lời nhắn còn lại được giữ để thử lại.`);
      await load();
    } finally {
      setSubmittingCaseId(null);
    }
  };

  return (
    <section className="space-y-6 text-slate-800 font-sans">
      {/* 1. ROLE-SPECIFIC TOP BANNER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center border shadow-2xs ${
                isTutor
                  ? 'bg-amber-500/10 text-amber-700 border-amber-200'
                  : isStudent
                  ? 'bg-blue-500/10 text-blue-700 border-blue-200'
                  : isStaff
                  ? 'bg-indigo-500/10 text-indigo-700 border-indigo-200'
                  : 'bg-emerald-500/10 text-emerald-700 border-emerald-200'
              }`}
            >
              {isTutor && <Eye className="w-5 h-5" />}
              {isStudent && <User className="w-5 h-5" />}
              {isStaff && <ClipboardCheck className="w-5 h-5" />}
              {isAdmin && <ShieldCheck className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-display font-black text-slate-900">
                  {isTutor && 'Bảng Theo Dõi Chấm Dứt & Quyết Toán (Gia Sư)'}
                  {isStudent && 'Hồ Sơ Chấm Dứt Hợp Đồng Của Tôi'}
                  {isStaff && 'Bàn Làm Việc Thẩm Định Hồ Sơ Chấm Dứt (Staff)'}
                  {isAdmin && 'Bảng Quản Trị Phê Duyệt & Quyết Toán Escrow (Admin)'}
                </h2>
                <span
                  className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                    isTutor
                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                      : isStudent
                      ? 'bg-blue-100 text-blue-900 border-blue-300'
                      : isStaff
                      ? 'bg-indigo-100 text-indigo-900 border-indigo-300'
                      : 'bg-red-100 text-red-900 border-red-300'
                  }`}
                >
                  {isTutor && 'GIA SƯ • THEO DÕI'}
                  {isStudent && 'HỌC VIÊN • NỘP MINH CHỨNG'}
                  {isStaff && 'STAFF • THẨM ĐỊNH'}
                  {isAdmin && 'ADMIN • PHÊ DUYỆT'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">
                {isTutor && 'Theo dõi tình trạng học viên xin nghỉ đơn phương hoặc tiến trình đề xuất dừng lớp. Bảo vệ thù lao các buổi đã dạy.'}
                {isStudent && 'Theo dõi tiến độ xét duyệt đơn, đính kèm file minh chứng hoặc gửi thêm lời nhắn giải thích để nhận hoàn tiền cọc.'}
                {isStaff && 'Kiểm tra lý do, xác minh tài liệu minh chứng của học viên, thẩm định và đề xuất lên Admin phê duyệt.'}
                {isAdmin && 'Cấp phê duyệt tối cao: Chốt quyết toán các buổi đã dạy cho gia sư và hoàn tiền cọc Escrow về ví học viên.'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          {isTutor && (
            <button
              type="button"
              onClick={() => {
                if (tutorActiveClasses.length === 0) {
                  setError('Hiện tại bạn không có lớp học nào đang hoạt động (ACTIVE) đủ điều kiện để đề xuất dừng lớp.');
                  return;
                }
                if (selectedClassFilter !== 'ALL') {
                  const targetCls = tutorActiveClasses.find((cls) => String(cls.classroomId) === String(selectedClassFilter));
                  if (targetCls && targetCls.agreements.length > 0) {
                    setTutorProposeTargetAgreement(targetCls.agreements[0]);
                    setIsTutorProposeModalOpen(true);
                    return;
                  }
                }
                if (tutorActiveClasses.length === 1) {
                  setTutorProposeTargetAgreement(tutorActiveClasses[0].agreements[0]);
                  setIsTutorProposeModalOpen(true);
                } else {
                  setShowClassPickerModal(true);
                }
              }}
              className="px-3 py-1.5 rounded-xl border border-purple-300 bg-purple-50 text-xs font-black text-purple-800 hover:bg-purple-100 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              title="Gia sư gửi đề xuất dừng lớp học và bảo lưu thù lao các buổi đã dạy"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-purple-600" />
              Đề xuất dừng lớp học
            </button>
          )}
          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowAdminCreate((value) => !value)}
              className="px-3 py-1.5 rounded-xl border border-red-200 bg-red-50 text-xs font-black text-red-700 hover:bg-red-100 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Quyền dừng của Admin
            </button>
          )}
          <button
            onClick={() => setShowWorkflowGuide(!showWorkflowGuide)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
            <span>Quy trình xử lý</span>
            {showWorkflowGuide ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          <button
            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 cursor-pointer"
            onClick={load}
            disabled={busy || loading}
            title="Làm mới danh sách"
            aria-label="Làm mới"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin text-blue-600' : ''} />
          </button>
        </div>
      </div>

      {/* KPI Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <button
          type="button"
          onClick={() => setStatusFilter('ALL')}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'ALL'
              ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/20'
              : 'bg-slate-50 border-slate-200/80 hover:bg-slate-100'
          }`}
        >
          <span className={`text-[10px] font-black uppercase tracking-wider block ${statusFilter === 'ALL' ? 'text-slate-300' : 'text-slate-500'}`}>
            Tổng hồ sơ
          </span>
          <span className={`text-2xl font-display font-black ${statusFilter === 'ALL' ? 'text-white' : 'text-slate-900'}`}>
            {stats.total}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter('PENDING')}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'PENDING'
              ? 'bg-amber-600 text-white border-amber-600 shadow-md ring-2 ring-amber-600/20'
              : 'bg-amber-50/70 border-amber-200 hover:bg-amber-100'
          }`}
        >
          <span className={`text-[10px] font-black uppercase tracking-wider block ${statusFilter === 'PENDING' ? 'text-amber-100' : 'text-amber-700'}`}>
            Chờ thẩm định
          </span>
          <span className={`text-2xl font-display font-black ${statusFilter === 'PENDING' ? 'text-white' : 'text-amber-900'}`}>
            {stats.pending}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter('RECOMMENDED')}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'RECOMMENDED'
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-600/20'
              : 'bg-indigo-50/70 border-indigo-200 hover:bg-indigo-100'
          }`}
        >
          <span className={`text-[10px] font-black uppercase tracking-wider block ${statusFilter === 'RECOMMENDED' ? 'text-indigo-100' : 'text-indigo-700'}`}>
            Đã đề xuất
          </span>
          <span className={`text-2xl font-display font-black ${statusFilter === 'RECOMMENDED' ? 'text-white' : 'text-indigo-900'}`}>
            {stats.recommended}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter('APPROVED')}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'APPROVED'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-600/20'
              : 'bg-emerald-50/70 border-emerald-200 hover:bg-emerald-100'
          }`}
        >
          <span className={`text-[10px] font-black uppercase tracking-wider block ${statusFilter === 'APPROVED' ? 'text-emerald-100' : 'text-emerald-700'}`}>
            Đã duyệt / Hoàn tất
          </span>
          <span className={`text-2xl font-display font-black ${statusFilter === 'APPROVED' ? 'text-white' : 'text-emerald-900'}`}>
            {stats.approved}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter('REJECTED')}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer col-span-2 sm:col-span-1 ${
            statusFilter === 'REJECTED'
              ? 'bg-rose-600 text-white border-rose-600 shadow-md ring-2 ring-rose-600/20'
              : 'bg-rose-50/70 border-rose-200 hover:bg-rose-100'
          }`}
        >
          <span className={`text-[10px] font-black uppercase tracking-wider block ${statusFilter === 'REJECTED' ? 'text-rose-100' : 'text-rose-700'}`}>
            Đã từ chối
          </span>
          <span className={`text-2xl font-display font-black ${statusFilter === 'REJECTED' ? 'text-white' : 'text-rose-900'}`}>
            {stats.rejected}
          </span>
        </button>
      </div>

      {isAdmin && showAdminCreate && (
        <form onSubmit={submitAdminTermination} className="rounded-3xl border-2 border-red-200 bg-red-50/60 p-5 space-y-4 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
            <div>
              <h3 className="font-black text-red-950">Tạm dừng hoặc hủy theo quyền quản trị</h3>
              <p className="text-xs text-red-800 mt-1 leading-relaxed">
                Lịch tương lai được giữ ngay khi Learning xác nhận. Hoàn USDC chỉ bắt đầu sau khi các buổi đã diễn ra và khiếu nại liên quan được xử lý xong.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <label className="space-y-1.5 text-xs font-bold text-slate-700">
              <span>Hợp đồng/lớp làm căn cứ *</span>
              <select
                required
                value={adminAgreementId}
                onChange={(event) => setAdminAgreementId(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs"
              >
                <option value="">Chọn hợp đồng ACTIVE</option>
                {activeAdminAgreements.map((agreement) => (
                  <option key={agreement.id} value={agreement.id}>
                    {agreement.className || `Lớp #${agreement.classroomId}`} — {agreement.studentName || agreement.studentEmail || agreement.id}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5 text-xs font-bold text-slate-700">
              <span>Phạm vi xử lý *</span>
              <select
                value={adminWholeClass ? 'CLASS' : 'AGREEMENT'}
                onChange={(event) => setAdminWholeClass(event.target.value === 'CLASS')}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs"
              >
                <option value="CLASS">Toàn bộ lớp và mọi hợp đồng ACTIVE</option>
                <option value="AGREEMENT">Một học viên/hợp đồng đã chọn</option>
              </select>
            </label>
          </div>
          <label className="block space-y-1.5 text-xs font-bold text-slate-700">
            <span>Căn cứ và lý do quyết định *</span>
            <textarea
              required
              maxLength={5000}
              rows={3}
              value={adminReason}
              onChange={(event) => setAdminReason(event.target.value)}
              placeholder="Ghi rõ căn cứ, phạm vi ảnh hưởng và lý do tạm dừng/hủy..."
              className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs"
            />
          </label>
          <label className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950 cursor-pointer">
            <input
              type="checkbox"
              checked={adminApproveImmediately}
              onChange={(event) => setAdminApproveImmediately(event.target.checked)}
              className="mt-0.5"
            />
            <span><strong>Quyết định hủy khẩn cấp ngay:</strong> tạo hồ sơ, hold lịch và phê duyệt thanh lý trong cùng thao tác. Lý do trên được lưu vào audit.</span>
          </label>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowAdminCreate(false)} className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600">Đóng</button>
            <button type="submit" disabled={busy || !adminAgreementId || !adminReason.trim()} className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-black disabled:opacity-50 inline-flex items-center gap-2">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
              {adminApproveImmediately ? 'Dừng và phê duyệt hủy ngay' : 'Tạm dừng và tạo hồ sơ'}
            </button>
          </div>
        </form>
      )}

      {/* Collapsible Workflow Stepper */}
      {showWorkflowGuide && (
        <div className="p-5 rounded-3xl bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-slate-50 border border-blue-200 text-xs space-y-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-blue-950 flex items-center gap-2 text-sm">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              Quy trình 5 bước chấm dứt hợp đồng & quyết toán Escrow Smart Contract
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2.5 pt-1">
            <div className="p-3 rounded-2xl bg-white border border-blue-100 space-y-1">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center font-mono font-black text-[10px]">1</span>
              <p className="font-bold text-slate-900">Ký số EIP-712</p>
              <p className="text-[11px] text-slate-500 leading-snug">Học viên (đơn phương) hoặc Gia sư (dừng cả lớp) ký xác nhận bằng ví MetaMask.</p>
            </div>
            <div className="p-3 rounded-2xl bg-white border border-blue-100 space-y-1">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center font-mono font-black text-[10px]">2</span>
              <p className="font-bold text-slate-900">Tạm dừng lịch học</p>
              <p className="text-[11px] text-slate-500 leading-snug">Hệ thống freeze các buổi học tương lai; giữ nguyên các buổi đã học để chờ quyết toán.</p>
            </div>
            <div className="p-3 rounded-2xl bg-white border border-blue-100 space-y-1">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center font-mono font-black text-[10px]">3</span>
              <p className="font-bold text-slate-900">Thẩm định (Staff)</p>
              <p className="text-[11px] text-slate-500 leading-snug">Staff kiểm tra lý do, kiểm tra minh chứng do học viên nộp và đối chiếu tiến độ lớp.</p>
            </div>
            <div className="p-3 rounded-2xl bg-white border border-blue-100 space-y-1">
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center font-mono font-black text-[10px]">4</span>
              <p className="font-bold text-slate-900">Đề xuất chấm dứt</p>
              <p className="text-[11px] text-slate-500 leading-snug">Staff thẩm định và gửi đề xuất lên Admin. Admin quyết định hủy hoặc khôi phục lớp.</p>
            </div>
            <div className="p-3 rounded-2xl bg-white border border-blue-100 space-y-1">
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-mono font-black text-[10px]">5</span>
              <p className="font-bold text-slate-900">Admin Duyệt & Quyết toán</p>
              <p className="text-[11px] text-slate-500 leading-snug">Admin APPROVE: Quyết toán tiền buổi đã dạy cho gia sư, hoàn số dư cọc còn lại cho học viên.</p>
            </div>
          </div>
        </div>
      )}

      {/* Notifications */}
      {(error || refreshError || complaintBlockWarning) && (
        <div role="alert" className="flex flex-wrap items-center gap-2 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold">
          <XCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{complaintBlockWarning || error || refreshError}</span>
          <button type="button" onClick={() => { setError(''); setRefreshError(''); setComplaintBlockWarning(''); }} aria-label="Đóng thông báo lỗi" className="p-1"><X size={16} /></button>
          {complaintBlockWarning && onNavigate && (
            <button type="button" onClick={() => { setComplaintBlockWarning(''); onNavigate('complaints'); }} className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-2 text-red-800 border border-red-200 hover:bg-red-100">
              <ExternalLink size={14} /> Mở xử lý khiếu nại
            </button>
          )}
        </div>
      )}
      {success && (
        <div role="status" className="flex items-center gap-2 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="text-xs font-semibold">Đang tải danh sách hồ sơ chấm dứt hợp đồng...</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && requests.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
          <ShieldCheck className="w-12 h-12 text-slate-300" />
          <p className="text-sm font-bold text-slate-600">Hiện tại không có yêu cầu chấm dứt hợp đồng nào.</p>
          <p className="text-xs text-slate-400">
            {isTutor
              ? 'Khi có học viên xin nghỉ đơn phương hoặc bạn đề xuất dừng lớp, thông tin sẽ hiển thị tại đây.'
              : 'Các yêu cầu chấm dứt hợp đồng sẽ được hiển thị tại đây.'}
          </p>
        </div>
      )}

      {/* 2. SEARCH & FILTER TOOLBAR */}
      {!loading && requests.length > 0 && (
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm theo tên lớp, gia sư, học viên, lý do hoặc mã hồ sơ..."
                className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400 font-medium"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 cursor-pointer"
                  title="Xóa tìm kiếm"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Class Dropdown */}
            <div className="flex items-center gap-2">
              <label htmlFor="termination-class-select" className="text-xs font-bold text-slate-600 shrink-0 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                Lớp học:
              </label>
              <select
                id="termination-class-select"
                value={selectedClassFilter}
                onChange={(e) => setSelectedClassFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all max-w-[260px] truncate cursor-pointer"
              >
                <option value="ALL">Tất cả các lớp ({requests.length})</option>
                {uniqueClassrooms.map((cls) => (
                  <option key={cls.id} value={String(cls.id)}>
                    {cls.name} ({cls.count} hồ sơ)
                  </option>
                ))}
              </select>
            </div>

            {/* Expand / Collapse All buttons */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={expandAll}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-semibold transition-colors cursor-pointer"
              >
                Mở rộng tất cả
              </button>
              <button
                type="button"
                onClick={collapseAll}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-semibold transition-colors cursor-pointer"
              >
                Thu gọn tất cả
              </button>
            </div>
          </div>

          {/* Origin / Type Filters */}
          <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-slate-100">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1">Nguồn gốc:</span>
            <button
              type="button"
              onClick={() => setOriginFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                originFilter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              Tất cả ({requests.length})
            </button>
            <button
              type="button"
              onClick={() => setOriginFilter('TUTOR_PROPOSAL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1 ${
                originFilter === 'TUTOR_PROPOSAL'
                  ? 'bg-purple-700 text-white shadow-2xs'
                  : 'bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200'
              }`}
            >
              <Users className="w-3 h-3" />
              Gia sư đề xuất ({originStats.tutor})
            </button>
            <button
              type="button"
              onClick={() => setOriginFilter('AUTO_ABSENCE')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1 ${
                originFilter === 'AUTO_ABSENCE'
                  ? 'bg-orange-600 text-white shadow-2xs'
                  : 'bg-orange-50 hover:bg-orange-100 text-orange-950 border border-orange-200'
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              Cảnh cáo vắng 3 buổi ({originStats.autoAbsence})
            </button>
            <button
              type="button"
              onClick={() => setOriginFilter('STUDENT_UNILATERAL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1 ${
                originFilter === 'STUDENT_UNILATERAL'
                  ? 'bg-sky-600 text-white shadow-2xs'
                  : 'bg-sky-50 hover:bg-sky-100 text-sky-950 border border-sky-200'
              }`}
            >
              <User className="w-3 h-3" />
              Học viên xin nghỉ ({originStats.student})
            </button>
            {originStats.admin > 0 && (
              <button
                type="button"
                onClick={() => setOriginFilter('ADMIN_DIRECT')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1 ${
                  originFilter === 'ADMIN_DIRECT'
                    ? 'bg-rose-700 text-white shadow-2xs'
                    : 'bg-rose-50 hover:bg-rose-100 text-rose-950 border border-rose-200'
                }`}
              >
                <ShieldCheck className="w-3 h-3" />
                Admin can thiệp ({originStats.admin})
              </button>
            )}
          </div>

          {/* Active Filter Banner if class is filtered */}
          {currentFilteredClass && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 p-3 rounded-2xl bg-blue-50/80 border border-blue-200 text-blue-900 text-xs">
              <div className="flex items-center gap-2 flex-wrap font-medium">
                <Filter className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  Đang lọc hồ sơ lớp: <strong className="font-bold text-blue-950">{currentFilteredClass.name}</strong> (Mã lớp #{currentFilteredClass.id})
                </span>
                <span className="px-2 py-0.5 rounded-md bg-blue-200/80 text-blue-900 font-bold text-[11px]">
                  {currentFilteredClass.count} hồ sơ
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedClassFilter('ALL')}
                className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:text-blue-900 hover:underline cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" /> Xem tất cả các lớp ({requests.length})
              </button>
            </div>
          )}
        </div>
      )}

      {/* Empty Filter Result State */}
      {!loading && requests.length > 0 && filteredRequests.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
          <Filter className="w-10 h-10 text-slate-300" />
          <p className="text-sm font-bold text-slate-600">Không tìm thấy hồ sơ chấm dứt nào phù hợp với bộ lọc.</p>
          <p className="text-xs text-slate-400">
            Thử đổi lớp học, điều kiện trạng thái hoặc xóa từ khóa tìm kiếm.
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedClassFilter('ALL');
              setStatusFilter('ALL');
              setOriginFilter('ALL');
              setSearchQuery('');
            }}
            className="mt-2 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
          >
            Xóa bộ lọc
          </button>
        </div>
      )}

      {/* 3. LIST OF TERMINATION CASES */}
      {!loading && filteredRequests.length > 0 && (
        <div className="space-y-6">
          {filteredRequests.map(({ request: c, items, evidence = [] }) => {
            const anchorAgreement = agreementMap.get(c.anchorAgreementId);
            const className = anchorAgreement?.className || `Lớp #${c.classroomId}`;
            const tutorName = anchorAgreement?.tutorName || 'Chưa cập nhật gia sư';
            const studentName = anchorAgreement?.studentName || 'Chưa cập nhật học viên';

            const allClassAgreements = c.wholeClass
              ? classroomMap.get(c.classroomId) || (anchorAgreement ? [anchorAgreement] : [])
              : anchorAgreement
              ? [anchorAgreement]
              : [];

            const itemMap = new Map(items.map((i) => [i.agreementId, i]));

            // Only include agreements that are active/in-scope, or explicitly tracked by a termination item
            const affectedAgreements = allClassAgreements.filter(
              (a) => !['COMPLETED', 'CANCELLED', 'EXPIRED'].includes(a.status) || itemMap.has(a.id)
            );

            // Previous agreements in the class that had already been terminated or completed prior to this request
            const priorClosedAgreements = allClassAgreements.filter(
              (a) => ['COMPLETED', 'CANCELLED', 'EXPIRED'].includes(a.status) && !itemMap.has(a.id)
            );

            const totalEscrowPool = affectedAgreements.reduce((sum, a) => sum + (Number(a.totalAmountUsdc) || 0), 0);
            const totalSettledUsdc = affectedAgreements.reduce((sum, a) => sum + (Number(a.releasedAmountUsdc) || 0), 0);
            const totalConfirmedRefundUsdc = items.reduce((sum, item) => sum +
              (item.status === 'COMPLETED' && item.refundedUnits != null
                ? Number(item.refundedUnits) / 10 ** item.tokenDecimals : 0), 0);
            const totalPendingRefundUsdc = affectedAgreements.reduce((sum, agreement) =>
              sum + (itemMap.get(agreement.id)?.status === 'COMPLETED' ? 0 : remainingEscrow(agreement)), 0);
            const totalRefundUsdc = c.status === 'REJECTED' ? 0 : totalConfirmedRefundUsdc + totalPendingRefundUsdc;
            const refundConfirmed = c.status === 'COMPLETED';

            // If current viewer is a student, calculate their specific refund numbers
            const studentSelfAgreement = isStudent
              ? affectedAgreements.find(
                  (a) =>
                    (user?.id && a.studentId === user.id) ||
                    (user?.email && a.studentEmail?.toLowerCase() === user.email.toLowerCase())
                ) || anchorAgreement
              : null;

            const studentEscrowPool = studentSelfAgreement
              ? Number(studentSelfAgreement.totalAmountUsdc) || 0
              : totalEscrowPool;
            const studentItem = studentSelfAgreement ? itemMap.get(studentSelfAgreement.id) : null;
            const studentRefundUsdc = studentItem?.status === 'COMPLETED' && studentItem.refundedUnits != null
              ? Number(studentItem.refundedUnits) / 10 ** studentItem.tokenDecimals
              : studentSelfAgreement ? remainingEscrow(studentSelfAgreement) : totalRefundUsdc;
            const studentSettledUsdc = Math.max(0, studentEscrowPool - studentRefundUsdc);
            const auditEntries = parseAudit(c.auditJson);
            const ownEvidenceCount = evidence.filter((ev) => ev.submittedByRole.toLowerCase() === normalizedRole).length;
            const automaticAbsenceWarning = c.origin === 'AUTO_TUTOR_ABSENCE';
            const responseDeadlinePassed = !!c.responseDeadline && new Date(c.responseDeadline).getTime() <= Date.now();
            const warningReadyForNormalReview = !automaticAbsenceWarning || !!c.tutorRespondedAt || responseDeadlinePassed;
            const isExpanded = expandedCaseIds.has(c.id);

            return (
              <article
                key={c.id}
                className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-all space-y-5"
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-100 pb-5">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border flex items-center gap-1.5 ${
                          c.origin === 'AUTO_TUTOR_ABSENCE'
                            ? 'bg-orange-100 text-orange-950 border-orange-300 ring-2 ring-orange-400/20'
                            : c.origin === 'ADMIN_DIRECT'
                            ? 'bg-rose-100 text-rose-950 border-rose-300'
                            : c.wholeClass
                            ? 'bg-purple-100 text-purple-950 border-purple-300'
                            : 'bg-sky-100 text-sky-950 border-sky-300'
                        }`}
                      >
                        {c.origin === 'AUTO_TUTOR_ABSENCE' ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-orange-600" />
                        ) : c.origin === 'ADMIN_DIRECT' ? (
                          <ShieldCheck className="w-3.5 h-3.5 text-rose-600" />
                        ) : c.wholeClass ? (
                          <Users className="w-3.5 h-3.5 text-purple-700" />
                        ) : (
                          <User className="w-3.5 h-3.5 text-sky-700" />
                        )}
                        {c.origin === 'AUTO_TUTOR_ABSENCE'
                          ? 'Cảnh cáo tự động: Gia sư vắng 3 buổi'
                          : c.origin === 'ADMIN_DIRECT'
                          ? (c.wholeClass ? 'Admin dừng/hủy toàn bộ lớp' : 'Admin chấm dứt hợp đồng học viên')
                          : c.wholeClass
                          ? 'Gia sư đề xuất dừng & hủy toàn bộ lớp'
                          : 'Học viên xin chấm dứt đơn phương'}
                      </span>
                      <span className="text-xs text-slate-400 font-semibold flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(c.createdAt).toLocaleString('vi-VN')}
                      </span>
                    </div>

                    <h3 className="text-lg sm:text-xl font-display font-black text-slate-950 flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-blue-600 shrink-0" />
                      <span>{className}</span>
                    </h3>

                    {c.signerWallet && (
                      <div className="flex items-center gap-2 pt-0.5">
                        <span className="font-mono text-emerald-800 text-xs font-bold bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200 inline-flex items-center gap-1.5 shadow-2xs">
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          Ví MetaMask ký xác thực: {c.signerWallet.slice(0, 6)}...{c.signerWallet.slice(-4)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="self-start sm:self-auto shrink-0 flex items-center gap-2 flex-wrap">
                    <span
                      className={`px-3.5 py-1.5 rounded-2xl text-xs font-black uppercase tracking-wider border inline-flex items-center gap-2 shadow-2xs ${statusTone(
                        c.status
                      )}`}
                    >
                      <span className="w-2 h-2 rounded-full bg-current animate-pulse"></span>
                      {terminationProgressText({ request: c, items, evidence })}
                    </span>

                    <button
                      type="button"
                      onClick={() => toggleCaseExpand(c.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                      title={isExpanded ? 'Thu gọn hồ sơ này' : 'Mở rộng xem chi tiết hồ sơ'}
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="w-4 h-4 text-slate-500" />
                          <span>Thu gọn</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-4 h-4 text-slate-500" />
                          <span>Xem chi tiết</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Collapsed Summary Strip */}
                {!isExpanded && (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-bold text-slate-800 line-clamp-1 max-w-md">
                        Lý do: &ldquo;{c.reason || 'Không ghi rõ lý do'}&rdquo;
                      </span>
                      <span className="text-slate-300">|</span>
                      <span>Học viên: <strong className="text-slate-700">{studentName}</strong></span>
                      <span className="text-slate-300">|</span>
                      <span>Quy mô: <strong className="text-slate-700">{c.wholeClass ? 'Toàn bộ lớp' : '1 học viên'}</strong></span>
                      <span className="text-slate-300">|</span>
                      <span>Ký quỹ: <strong className="text-blue-700">${(isStudent ? studentEscrowPool : totalEscrowPool).toFixed(2)} USDC</strong></span>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleCaseExpand(c.id)}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer shrink-0"
                    >
                      Mở xem toàn bộ nội dung & minh chứng →
                    </button>
                  </div>
                )}

                {isExpanded && (
                  <>

                {automaticAbsenceWarning && (
                  <div className="rounded-2xl border-2 border-orange-300 bg-orange-50 p-4 text-xs text-orange-950 space-y-2">
                    <div className="flex items-center gap-2 font-black text-sm">
                      <AlertTriangle className="w-4 h-4 text-orange-600" />
                      Cảnh cáo tự động: Gia sư vắng 3 buổi liên tiếp
                    </div>
                    <p>Lịch tương lai của lớp đã được giữ trong lúc gia sư giải trình và Ban quản trị xem xét.</p>
                    <div className="flex flex-wrap gap-2 font-bold">
                      <span className="rounded-lg border border-orange-200 bg-white px-2.5 py-1">
                        Hạn giải trình: {c.responseDeadline ? new Date(c.responseDeadline).toLocaleString('vi-VN') : 'Đang xác định theo lịch lớp'}
                      </span>
                      <span className={`rounded-lg border px-2.5 py-1 ${c.tutorRespondedAt ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-orange-200 bg-white'}`}>
                        {c.tutorRespondedAt
                          ? `Đã giải trình: ${new Date(c.tutorRespondedAt).toLocaleString('vi-VN')}`
                          : responseDeadlinePassed ? 'Đã hết hạn, Admin được quyền quyết định' : 'Chưa có giải trình của gia sư'}
                      </span>
                    </div>
                  </div>
                )}

                {/* ROLE-SPECIFIC NOTICE BANNER */}
                {isTutor && (
                  <div className="rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 p-4 text-xs space-y-1.5 text-amber-950 shadow-2xs">
                    <div className="flex items-center gap-2 font-black text-[13px]">
                      <Info className="w-4 h-4 text-amber-700" />
                      {c.status === 'COMPLETED'
                        ? (c.wholeClass ? 'Lớp đã hủy và tiền cọc dư đã được xử lý xong' : 'Hợp đồng của học viên đã chấm dứt và tất toán')
                        : c.status === 'REJECTED'
                        ? 'Yêu cầu đã bị từ chối, lịch học được khôi phục'
                        : c.wholeClass
                        ? 'Đề xuất dừng toàn bộ lớp học của bạn đang được xử lý'
                        : `Học viên ${studentName} đã gửi yêu cầu xin dừng học hợp đồng này`}
                    </div>
                    <p className="text-amber-800 font-medium leading-relaxed">
                      {c.status === 'COMPLETED'
                        ? 'Các buổi trước mốc hủy đã được quyết toán. Phần cọc dư đã hoàn về ví từng học viên theo giao dịch xác nhận bên dưới.'
                        : c.status === 'REJECTED'
                        ? 'Hồ sơ không được chấp thuận. Lớp hoặc lịch của học viên tiếp tục theo trạng thái đã khôi phục.'
                        : c.wholeClass
                        ? 'Đề xuất dừng lớp của bạn đang được Staff & Admin thẩm định. Hệ thống bảo lưu các buổi bạn đã giảng dạy để quyết toán thù lao.'
                        : `Lịch học tương lai của học viên ${studentName} đã được tạm dừng. Gia sư chỉ cần theo dõi tiến trình xử lý tại đây; toàn bộ thù lao các buổi bạn đã dạy sẽ được đảm bảo quyết toán đầy đủ khi hồ sơ được duyệt.`}
                    </p>
                  </div>
                )}

                {isStudent && (
                  <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 text-xs space-y-1.5 text-blue-950 shadow-2xs">
                    <div className="flex items-center gap-2 font-black text-[13px]">
                      <Info className="w-4 h-4 text-blue-700" />
                      {c.status === 'COMPLETED'
                        ? 'Hồ sơ đã hoàn tất, xem tiền hoàn và giao dịch bên dưới'
                        : c.status === 'REJECTED'
                        ? 'Yêu cầu đã bị từ chối, lịch học được khôi phục'
                        : c.wholeClass ? 'Gia sư đề xuất hủy lớp, hồ sơ đang được xử lý' : 'Yêu cầu chấm dứt của bạn đang được xử lý'}
                    </div>
                    <p className="text-blue-800 font-medium leading-relaxed">
                      {c.status === 'COMPLETED'
                        ? 'Hệ thống đã ghi nhận kết quả thanh lý. Số tiền hoàn hiển thị bên dưới lấy từ giao dịch đã xác nhận.'
                        : c.status === 'REJECTED'
                        ? 'Hồ sơ không phát sinh giao dịch hoàn cọc. Hãy xem lý do xử lý trong lịch sử bên dưới.'
                        : c.status === 'APPROVED'
                        ? 'Các buổi trước mốc hủy phải được quyết toán xong, sau đó hệ thống sẽ tự gửi giao dịch hoàn phần cọc dư.'
                        : <>Bạn có thể <strong>bổ sung minh chứng</strong> hoặc <strong>gửi lời giải thích</strong> trong khi hồ sơ đang chờ xét duyệt.</>}
                    </p>
                  </div>
                )}

                <div className={`rounded-2xl border p-4 text-xs leading-relaxed ${
                  c.wholeClass ? 'border-violet-200 bg-violet-50/70 text-violet-950' : 'border-sky-200 bg-sky-50/70 text-sky-950'
                }`}>
                  <div className="flex items-center gap-2 font-black text-[13px]">
                    {c.wholeClass ? <Users className="w-4 h-4 text-violet-700" /> : <User className="w-4 h-4 text-sky-700" />}
                    {c.wholeClass ? 'Phạm vi xử lý: toàn bộ lớp học' : 'Phạm vi xử lý: một học viên, một hợp đồng'}
                  </div>
                  {c.wholeClass ? (
                    <p className="mt-1.5 text-violet-900">
                      {c.status === 'COMPLETED'
                        ? 'Tất cả hợp đồng đã hoàn tất thanh lý. Lớp đã chuyển sang CANCELLED, không nhận học viên và Gia sư không thể tự mở lại.'
                        : c.status === 'REJECTED'
                        ? 'Yêu cầu hủy lớp đã bị từ chối. Lịch học tương lai được khôi phục.'
                        : c.status === 'APPROVED'
                        ? `Admin đã duyệt. Lớp đang LOCKED, các buổi tương lai đã dừng; ${affectedAgreements.length} hợp đồng được quyết toán riêng trên Escrow trước khi lớp được hủy hoàn toàn.`
                        : 'Lớp chưa bị hủy. Hệ thống chỉ đang giữ các buổi tương lai để Admin/Staff xem xét; điểm danh và lịch sử buổi đã diễn ra vẫn được bảo toàn để quyết toán.'}
                    </p>
                  ) : (
                    <p className="mt-1.5 text-sky-900">
                      {c.status === 'COMPLETED'
                        ? 'Hợp đồng đã thanh lý xong. Enrollment của học viên đã được hủy và học viên không còn trong danh sách thành viên lớp; các học viên khác không bị ảnh hưởng.'
                        : c.status === 'REJECTED'
                        ? 'Yêu cầu chấm dứt đã bị từ chối. Lịch học của học viên được khôi phục.'
                        : c.status === 'APPROVED'
                        ? 'Admin đã duyệt. Chỉ học viên của hợp đồng này bị dừng các buổi sau cutoff; lịch sử điểm danh cũ được giữ để settlement, sau đó enrollment sẽ tự chuyển CANCELLED khi chain xác nhận.'
                        : 'Yêu cầu này chỉ ảnh hưởng một hợp đồng. Lớp, danh sách các học viên khác và lịch chung vẫn tiếp tục bình thường.'}
                    </p>
                  )}
                </div>

                {/* AUTOMATED BLOCKCHAIN PIPELINE PROGRESS BANNER */}
                {c.status === 'APPROVED' && (
                  <div className="rounded-2xl border-2 border-indigo-200 bg-gradient-to-r from-indigo-50/90 via-blue-50/70 to-indigo-50/90 p-4 text-xs text-indigo-950 space-y-2 shadow-2xs">
                    <div className="flex items-center gap-2 font-black text-sm text-indigo-900">
                      <RefreshCw className="w-4 h-4 text-indigo-600 animate-spin" />
                      <span>Admin đã duyệt — Blockchain Smart Contract đang tự động thực hiện hoàn cọc</span>
                    </div>
                    <p className="leading-relaxed text-indigo-900 font-medium">
                      Hệ thống đang tự động quyết toán các buổi đã dạy cho gia sư, sau đó gửi giao dịch hoàn trả số dư cọc Escrow chưa dùng về ví từng học viên trên mạng Sepolia. Bạn có thể theo dõi mã giao dịch (TX) và trạng thái từng hợp đồng bên dưới.
                    </p>
                  </div>
                )}

                {/* Initial Reason Box */}
                <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50/70 via-orange-50/30 to-amber-50/70 p-4 space-y-2.5">
                  <div className="flex items-center justify-between gap-2 border-b border-amber-200/60 pb-2">
                    <span className="text-xs font-black uppercase tracking-wider text-amber-900 flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-amber-700" />
                      Lý do ban đầu khi gửi yêu cầu:
                    </span>
                    <span className="text-[11px] font-bold text-amber-800 bg-amber-100/90 px-2.5 py-0.5 rounded-lg">
                      Bên gửi: {c.wholeClass ? `Gia sư (${tutorName})` : `Học viên (${studentName})`}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-amber-950 whitespace-pre-wrap leading-relaxed">
                    "{c.reason}"
                  </p>
                </div>

                {/* UNIFIED EVIDENCE & ADDITIONAL NOTES SECTION */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4.5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
                    <div>
                      <span className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                        <Paperclip className="w-4 h-4 text-amber-600" />
                        Tài liệu minh chứng đã nộp chính thức ({evidence.length} tệp)
                      </span>
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                        Các tài liệu này đã được ghi nhận vào hồ sơ đối soát (đã gửi là lưu cố định, không thể xóa).
                      </p>
                    </div>
                  </div>

                  {/* Evidence Files Grid (Uploaded files - Immutable) */}
                  {evidence.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {evidence.map((ev) => {
                        const IconComponent = getFileIcon(ev.contentType, ev.originalFilename);
                        return (
                          <div
                            key={ev.id}
                            className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200 text-xs shadow-2xs hover:border-blue-300 transition-all"
                          >
                            <div className="flex items-center gap-2.5 min-w-0 pr-2">
                              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-100">
                                <IconComponent size={16} />
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-slate-900 truncate" title={ev.originalFilename}>
                                  {ev.originalFilename}
                                </p>
                                <p className="text-[10px] text-slate-500 font-medium">
                                  {(ev.sizeBytes / (1024 * 1024)).toFixed(2)} MB &bull; {ev.submittedByRole}
                                </p>
                                <p className="text-[9px] text-slate-400 font-mono">
                                  Đã nộp: {new Date(ev.createdAt).toLocaleString('vi-VN')}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <a
                                href={terminationsApi.getEvidenceContentUrl(c.id, ev.id)}
                                target="_blank"
                                rel="noreferrer"
                                className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold rounded-lg border border-amber-200 inline-flex items-center gap-1 text-[11px] transition-colors"
                                title="Xem file minh chứng"
                              >
                                <ExternalLink size={12} /> Xem
                              </a>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl border border-dashed border-slate-300 bg-white text-center text-xs text-slate-400 font-medium">
                      {isStudent
                        ? 'Chưa có tệp minh chứng nào được nộp. Bạn có thể chọn tệp và gửi ở khung bên dưới.'
                        : 'Chưa có tệp minh chứng nào được đính kèm cho hồ sơ này.'}
                    </div>
                  )}

                  {/* KHU VỰC GỬI BỔ SUNG MINH CHỨNG & LỜI GIẢI THÍCH CHO BÊN THAM GIA */}
                  {(isStudent || isTutor) && ['HOLD_PENDING', 'REQUESTED', 'RECOMMENDED'].includes(c.status) && (
                    <div className="p-4.5 rounded-2xl border-2 border-blue-400 bg-white space-y-4 shadow-sm transition-all">
                      <div>
                        <div className="flex items-center gap-2 font-black text-xs uppercase tracking-wider text-blue-950">
                          <MessageSquare className="w-4 h-4 text-blue-600" />
                          {automaticAbsenceWarning && isTutor ? 'Giải trình cảnh cáo vắng học' : 'Gửi minh chứng và phản hồi'}
                        </div>
                        <p className="text-[11px] text-blue-800 font-medium mt-1 leading-relaxed">
                          Mỗi lần gửi sẽ được hệ thống lưu lại ngày giờ chính xác. Bạn có thể chọn tệp và xóa tệp chọn nhầm ở danh sách tạm trước khi gửi. Khi bấm nút <strong>"Gửi đi"</strong>, tài liệu sẽ được lưu cố định vào hồ sơ và không thể xóa.
                        </p>
                      </div>

                      {/* 1. Chọn tệp từ máy tính */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-700 block">
                            1. Chọn tệp minh chứng (Ảnh chụp, video, PDF, tài liệu):
                          </label>
                          <span className="text-[11px] text-slate-500 font-medium">
                            Tối đa còn lại của bạn: {Math.max(0, 5 - ownEvidenceCount - (stagedFilesMap[c.id]?.length || 0))} tệp (≤ 50MB/tệp)
                          </span>
                        </div>

                        <label className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-2 border border-slate-300 shadow-2xs">
                          <Paperclip size={14} className="text-blue-600" />
                          <span>Chọn tệp từ máy tính</span>
                          <input
                            type="file"
                            multiple
                            className="hidden"
                            disabled={submittingCaseId === c.id || 5 - ownEvidenceCount - (stagedFilesMap[c.id]?.length || 0) <= 0}
                            onChange={(e) => handlePickStagedFiles(c.id, e, ownEvidenceCount)}
                            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.xls,.xlsx"
                          />
                        </label>

                        {/* Danh sách tệp đang chọn tạm (Có thể xóa trước khi gửi) */}
                        {(stagedFilesMap[c.id]?.length || 0) > 0 && (
                          <div className="space-y-1.5 pt-1">
                            <span className="text-[11px] font-bold text-blue-900 block">
                              Các tệp đã chọn (Chưa gửi - Bấm nút Xóa nếu bạn chọn nhầm):
                            </span>
                            <div className="space-y-1">
                              {stagedFilesMap[c.id].map((file, idx) => {
                                const IconComponent = getFileIcon(file.type, file.name);
                                return (
                                  <div
                                    key={idx}
                                    className="flex items-center justify-between p-2.5 rounded-xl bg-blue-50/60 border border-blue-200 text-xs"
                                  >
                                    <div className="flex items-center gap-2 min-w-0 pr-2">
                                      <IconComponent size={15} className="text-blue-600 shrink-0" />
                                      <span className="font-bold text-slate-900 truncate">{file.name}</span>
                                      <span className="text-[10px] text-slate-500 font-mono shrink-0">
                                        ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveStagedFile(c.id, idx)}
                                      disabled={submittingCaseId === c.id}
                                      className="px-2.5 py-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1"
                                      title="Xóa tệp này, không gửi"
                                    >
                                      <X size={13} />
                                      <span>Xóa</span>
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 2. Lời nhắn / Giải thích thêm */}
                      <div className="space-y-1.5">
                        {automaticAbsenceWarning && isTutor && (
                          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 space-y-2">
                            <p>Nêu lý do vắng, các buổi bị ảnh hưởng, ngày có thể dạy lại và lịch bù cụ thể. Đính kèm minh chứng nếu có. Admin sẽ xem xét cho tiếp tục hoặc chấm dứt; gửi giải trình không tự mở lại lớp.</p>
                            <button type="button" disabled={submittingCaseId === c.id || !!(stagedNotesMap[c.id] || '').trim()}
                              onClick={() => setStagedNotesMap((prev) => ({ ...prev, [c.id]: 'Lý do vắng và các buổi bị ảnh hưởng:\n\nMinh chứng kèm theo (nếu có):\n\nNgày có thể tiếp tục dạy:\n\nLịch bù đề xuất (ngày, giờ, nội dung):\n\nCam kết và đề nghị Admin xem xét:' }))}
                              className="font-bold underline disabled:opacity-50">Dùng mẫu giải trình và lịch bù</button>
                          </div>
                        )}
                        <label className="text-xs font-bold text-slate-700 block">
                          2. Lời nhắn / Giải thích thêm cho Staff & Admin (Tùy chọn):
                        </label>
                        <textarea
                          className="w-full rounded-xl border border-slate-300 p-3 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                          maxLength={5000}
                          rows={3}
                          placeholder="Nhập chi tiết lời giải thích hoàn cảnh, lý do hoặc thông tin thêm để Staff & Admin xem xét duyệt nhanh hơn..."
                          value={stagedNotesMap[c.id] || ''}
                          onChange={(e) => setStagedNotesMap((prev) => ({ ...prev, [c.id]: e.target.value }))}
                          disabled={submittingCaseId === c.id}
                        />
                      </div>

                      {/* 3. Action buttons với nút GỬI ĐI to, rõ ràng */}
                      <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                        {((stagedFilesMap[c.id]?.length || 0) > 0 || (stagedNotesMap[c.id] || '').trim().length > 0) && (
                          <button
                            type="button"
                            className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold transition-colors cursor-pointer"
                            onClick={() => handleClearStaged(c.id)}
                            disabled={submittingCaseId === c.id}
                          >
                            Làm lại / Xóa trắng
                          </button>
                        )}
                        <button
                          type="button"
                          className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black transition-all shadow-md inline-flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={() => void handleSubmitSupplement(c.id)}
                          disabled={
                            submittingCaseId === c.id ||
                            ((stagedFilesMap[c.id]?.length || 0) === 0 && !(stagedNotesMap[c.id] || '').trim())
                          }
                        >
                          {submittingCaseId === c.id ? (
                            <>
                              <Loader2 size={15} className="animate-spin" />
                              <span>Đang gửi đi...</span>
                            </>
                          ) : (
                            <>
                              <Send size={15} />
                              <span>Gửi đi</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* ROLE-SPECIFIC CARDS */}
                {/* TUTOR FINANCIAL CARD */}
                {isTutor && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-emerald-900 flex items-center gap-2">
                        <Award className="w-4 h-4 text-emerald-700" />
                        Quyền lợi thù lao của Gia sư (Bảo vệ bởi Escrow)
                      </span>
                      <span className="text-[11px] font-bold text-emerald-800">
                        {terminationCaseLabel(c.status)}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3 bg-white rounded-xl border border-emerald-200 space-y-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">Lượt học đã quyết toán theo hợp đồng</span>
                        <span className="text-lg font-black text-slate-900 block">
                          {affectedAgreements.reduce((sum, a) => sum + a.settledSessions, 0)} lượt
                        </span>
                        <span className="text-[10px] text-emerald-600 font-semibold">Một buổi có thể thuộc nhiều hợp đồng; thù lao theo kết quả quyết toán.</span>
                      </div>
                      <div className="p-3 bg-white rounded-xl border border-emerald-200 space-y-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">Thù lao đã / sẽ nhận</span>
                        <span className="text-lg font-black text-emerald-700 font-mono block">
                          ${totalSettledUsdc.toFixed(2)} USDC
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">Quyết toán qua Smart Contract</span>
                      </div>
                      <div className="p-3 bg-white rounded-xl border border-emerald-200 space-y-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">Cọc hoàn lại cho học viên</span>
                        <span className="text-lg font-black text-blue-700 font-mono block">
                          ${totalRefundUsdc.toFixed(2)} USDC
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">{refundConfirmed ? 'Đã xác nhận trên blockchain' : 'Dự tính, sẽ chốt sau quyết toán'}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* STUDENT REFUND CARD */}
                {isStudent && c.status !== 'REJECTED' && (
                  <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-blue-900 flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-blue-700" />
                        {refundConfirmed ? 'Tiền cọc dư đã hoàn về ví MetaMask của bạn' : 'Dự tính tiền cọc dư sẽ hoàn về ví MetaMask của bạn'}
                      </span>
                      <span className="text-[11px] font-bold text-blue-800">
                        Smart Contract Escrow
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3 bg-white rounded-xl border border-blue-200 space-y-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">Tổng tiền bạn đã cọc</span>
                        <span className="text-lg font-black text-slate-900 font-mono block">
                          ${studentEscrowPool.toFixed(2)} USDC
                        </span>
                      </div>
                      <div className="p-3 bg-white rounded-xl border border-blue-200 space-y-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">Đã phân bổ cho các buổi trước mốc hủy</span>
                        <span className="text-lg font-black text-amber-700 font-mono block">
                          -${studentSettledUsdc.toFixed(2)} USDC
                        </span>
                      </div>
                      <div className="p-3 bg-white rounded-xl border border-emerald-300 bg-emerald-50/50 space-y-1">
                        <span className="text-[10px] font-bold text-emerald-800 uppercase block">{studentItem?.status === 'COMPLETED' ? 'Đã hoàn về ví' : 'Dự tính sẽ hoàn về ví'}</span>
                        <span className="text-lg font-black text-emerald-700 font-mono block">
                          +${studentRefundUsdc.toFixed(2)} USDC
                        </span>
                        <span className="text-[10px] text-emerald-600 font-semibold">{studentItem?.status === 'COMPLETED' ? 'Đã xác nhận từ sự kiện hoàn tiền trên blockchain' : 'Chỉ là ước tính đến khi giao dịch hoàn tiền được xác nhận'}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* STAFF & ADMIN CONTRACTS TABLE */}
                {isManager && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4.5 space-y-3.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                        <Users className="w-4 h-4 text-blue-600" />
                        {c.wholeClass
                          ? `Danh sách hợp đồng trong lớp học (${affectedAgreements.length} học viên đang xử lý)`
                          : 'Hợp đồng bị ảnh hưởng'}
                      </span>
                      <div className="flex items-center gap-3 text-xs font-bold text-slate-600">
                        <span>
                          Tổng cọc cần xử lý: <strong className="text-emerald-700 font-mono">${totalEscrowPool.toFixed(2)} USDC</strong>
                        </span>
                        <span>&bull;</span>
                        <span>
                          {refundConfirmed ? 'Đã hoàn:' : 'Dự tính hoàn:'} <strong className="text-blue-700 font-mono">${totalRefundUsdc.toFixed(2)} USDC</strong>
                        </span>
                      </div>
                    </div>

                    {affectedAgreements.length > 0 ? (
                      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-bold">
                              <th className="py-2.5 px-3">Học viên</th>
                              <th className="py-2.5 px-3">Trạng thái HĐ</th>
                              <th className="py-2.5 px-3">Tiến độ buổi học</th>
                              <th className="py-2.5 px-3">Tiền ký quỹ</th>
                              <th className="py-2.5 px-3">Xử lý khi chấm dứt</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {affectedAgreements.map((a) => {
                              const termItem = itemMap.get(a.id);
                              const progress = a.totalSessions > 0 ? Math.round((a.settledSessions / a.totalSessions) * 100) : 0;
                              return (
                                <tr key={a.id} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="py-3 px-3">
                                    <p className="font-bold text-slate-900">{a.studentName || studentName}</p>
                                    <p className="text-[11px] text-slate-500">{a.studentEmail}</p>
                                    <p className="text-[10px] font-mono text-slate-400">
                                      HĐ #{a.id.slice(0, 8)} &bull; Ví: {a.studentWallet?.slice(0, 6)}...{a.studentWallet?.slice(-4)}
                                    </p>
                                  </td>
                                  <td className="py-3 px-3">
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-slate-100 text-slate-700 border border-slate-200">
                                      {a.status}
                                    </span>
                                  </td>
                                  <td className="py-3 px-3">
                                    <span className="font-bold text-slate-800">
                                      {a.settledSessions} / {a.totalSessions} buổi ({progress}%)
                                    </span>
                                    <div className="w-24 h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${progress}%` }} />
                                    </div>
                                  </td>
                                  <td className="py-3 px-3">
                                    <p className="font-black text-emerald-700 font-mono">
                                      ${a.totalAmountUsdc.toFixed(2)} {a.tokenSymbol}
                                    </p>
                                    <p className="text-[10px] text-slate-400">
                                      ${a.pricePerSessionUsdc.toFixed(2)}/buổi
                                    </p>
                                  </td>
                                  <td className="py-3 px-3">
                                    {termItem ? (
                                      <div className="space-y-0.5">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${statusTone(termItem.status)}`}>
                                          {terminationItemLabel(termItem)}
                                        </span>
                                        {termItem.refundedUnits != null && (
                                          <p className="text-[11px] font-bold text-emerald-700 font-mono">
                                            Hoàn: {units(termItem.refundedUnits, termItem.tokenDecimals)} USDC
                                          </p>
                                        )}
                                        {termItem.transactionHash && (
                                          <p className="text-[10px]">
                                            <a
                                              href={`https://sepolia.etherscan.io/tx/${termItem.transactionHash}`}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="text-blue-600 hover:underline inline-flex items-center gap-0.5"
                                            >
                                              TX: {termItem.transactionHash.slice(0, 8)}... <ExternalLink size={10} />
                                            </a>
                                          </p>
                                        )}
                                        {termItem.lastError && (
                                          <p className={`text-[10px] font-semibold ${termItem.lastError.startsWith('Waiting for') ? 'text-amber-700' : 'text-red-600'}`}>{terminationWaitingDetail(termItem.lastError)}</p>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="text-[11px] text-slate-500">
                                        {['APPROVED', 'COMPLETED'].includes(c.status) ? (
                                          <span className="text-amber-600 font-semibold">Đang chuẩn bị quyết toán</span>
                                        ) : (
                                          <span className="text-slate-400 italic">
                                            Sẽ hoàn phần cọc chưa học sau khi Admin duyệt
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-3 text-center text-xs text-slate-400 italic">
                        Không tìm thấy hợp đồng nào liên kết với lớp học này.
                      </div>
                    )}

                    {priorClosedAgreements.length > 0 && (
                      <div className="rounded-xl border border-slate-200 bg-slate-100/70 p-3.5 text-xs text-slate-600 space-y-2">
                        <div className="flex items-center gap-1.5 font-bold text-slate-700">
                          <Info className="w-4 h-4 text-slate-500 shrink-0" />
                          <span>Hợp đồng trong lớp đã thanh lý/hủy trước đó ({priorClosedAgreements.length} học viên):</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {priorClosedAgreements.map((pa) => (
                            <div
                              key={pa.id}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] shadow-2xs"
                            >
                              <span className="font-bold text-slate-800">{pa.studentName || 'Học viên'}</span>
                              <span className="font-mono text-[10px] text-slate-400">#{pa.id.slice(0, 8)}</span>
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-slate-100 text-slate-600 border border-slate-200">
                                {pa.status}
                              </span>
                              <span className="text-[10px] text-slate-500 italic">(Đã thanh lý xong trước đó)</span>
                            </div>
                          ))}
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed italic">
                          Học viên trên đã hoàn tất thủ tục hủy hợp đồng từ trước, không nằm trong đợt hoàn tiền hay quyết toán của yêu cầu hủy lớp hiện tại.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* REVIEW & ACTIVITY HISTORY WITH NUMBERED ROUNDS */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4.5 space-y-3.5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                      <History className="w-4 h-4 text-indigo-600" />
                      Lịch sử các lần gửi hồ sơ & Thẩm định đối soát
                    </span>
                    <span className="text-[11px] font-bold text-slate-500">
                      Tổng số mốc: {1 + auditEntries.filter((e) => e.action !== 'REQUESTED').length} mốc
                    </span>
                  </div>

                  <div className="space-y-3 pt-1">
                    {/* MỐC LẦN 1: KHỞI TẠO HỒ SƠ */}
                    <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/40 space-y-2 text-xs">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-blue-600 text-white shadow-2xs">
                            LẦN 1: KHỞI TẠO HỒ SƠ
                          </span>
                          <span className="font-bold text-slate-900">
                            {c.wholeClass ? `Gia sư (${tutorName})` : `Học viên (${studentName})`}
                          </span>
                          <span className="text-slate-400">&bull;</span>
                          <span className="text-slate-600 font-medium">{c.requestedBy}</span>
                        </div>
                        <span className="text-[11px] text-blue-900 font-mono font-bold flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(c.createdAt).toLocaleString('vi-VN')}
                        </span>
                      </div>
                      <div className="pl-2 border-l-2 border-blue-300">
                        <span className="text-[10px] font-bold text-slate-500 block mb-0.5">Lý do ban đầu khi gửi:</span>
                        <p className="text-slate-800 font-semibold whitespace-pre-wrap leading-relaxed">
                          "{c.reason}"
                        </p>
                      </div>
                    </div>

                    {/* CÁC MỐC TIẾP THEO: LẦN 2, LẦN 3... HOẶC THẨM ĐỊNH */}
                    {(() => {
                      let studentRound = 1;
                      return auditEntries
                        .filter((e) => e.action !== 'REQUESTED')
                        .map((entry, index) => {
                          const isStaffActor = entry.role?.toUpperCase() === 'STAFF';
                          const isAdminActor = entry.role?.toUpperCase() === 'ADMIN';
                          const isStudentActor = entry.role?.toUpperCase() === 'STUDENT';
                          const isTutorActor = entry.role?.toUpperCase() === 'TUTOR';
                          const isRespond = entry.action === 'RESPOND';
                          if (isRespond) studentRound++;

                          let badgeLabel = `LẦN ${studentRound}: BỔ SUNG THÔNG TIN`;
                          let badgeStyle = 'bg-indigo-600 text-white';
                          let boxStyle = 'border-indigo-200 bg-indigo-50/30';
                          let borderAccent = 'border-indigo-300';

                          if (entry.action === 'RECOMMEND') {
                            badgeLabel = 'STAFF ĐỀ XUẤT CHẤM DỨT';
                            badgeStyle = 'bg-purple-600 text-white';
                            boxStyle = 'border-purple-200 bg-purple-50/30';
                            borderAccent = 'border-purple-300';
                          } else if (entry.action === 'APPROVE') {
                            badgeLabel = 'ADMIN PHÊ DUYỆT & QUYẾT TOÁN';
                            badgeStyle = 'bg-emerald-600 text-white';
                            boxStyle = 'border-emerald-200 bg-emerald-50/30';
                            borderAccent = 'border-emerald-300';
                          } else if (entry.action === 'REJECT') {
                            badgeLabel = 'TỪ CHỐI ĐỀ XUẤT (KHÔI PHỤC LỚP)';
                            badgeStyle = 'bg-rose-600 text-white';
                            boxStyle = 'border-rose-200 bg-rose-50/30';
                            borderAccent = 'border-rose-300';
                          }

                          return (
                            <div
                              key={index}
                              className={`p-3.5 rounded-xl border ${boxStyle} space-y-2 text-xs`}
                            >
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${badgeStyle} shadow-2xs`}>
                                    {badgeLabel}
                                  </span>
                                  <strong className="text-slate-900">{entry.actor}</strong>
                                  <span className="text-slate-400">&bull;</span>
                                  <span className="text-slate-600 font-medium">
                                    {isStudentActor
                                      ? 'Học viên'
                                      : isTutorActor
                                      ? 'Gia sư'
                                      : isStaffActor
                                      ? 'Staff kiểm duyệt'
                                      : isAdminActor
                                      ? 'Admin quản trị'
                                      : entry.role}
                                  </span>
                                </div>
                                <span className="text-[11px] text-slate-500 font-mono font-bold flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {entry.at ? new Date(entry.at).toLocaleString('vi-VN') : ''}
                                </span>
                              </div>
                              <div className={`pl-2 border-l-2 ${borderAccent}`}>
                                <p className="text-slate-800 font-semibold whitespace-pre-wrap leading-relaxed">
                                  {entry.reason}
                                </p>
                              </div>
                            </div>
                          );
                        });
                    })()}
                  </div>
                </div>

                {/* 4. MANAGEMENT ACTIONS AREA (STAFF & ADMIN ONLY) */}
                {isManager && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4.5 space-y-3">
                    <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 pb-2">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                        <ClipboardCheck className="w-4 h-4 text-emerald-600" />
                        Quyền hạn & Thao tác của người quản trị
                      </span>
                      <span className="text-[11px] font-bold text-slate-500">
                        Vai trò hiện tại: <strong className="text-slate-900 uppercase font-mono">{activeRole}</strong>
                      </span>
                    </div>

                    {/* STAFF ACTIONS */}
                    {isStaff && (
                      <div className="space-y-3">
                        <p className="text-xs text-slate-600 leading-relaxed">
                          <strong>Nhiệm vụ của Staff:</strong> Kiểm tra kỹ lý do, minh chứng và lời nhắn của học viên.
                          Nhấn <strong>"Đề xuất chấm dứt"</strong> để chuyển hồ sơ lên Admin phê duyệt, hoặc <strong>"Từ chối"</strong> để bác bỏ và khôi phục lớp.
                        </p>
                        <div className="flex flex-wrap items-center gap-2.5">
                          {c.status === 'REQUESTED' && (
                            <button
                              className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:opacity-90 text-white text-xs font-black transition-all shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                              onClick={() => {
                                beginManagerAction({ request: c, items, evidence }, 'RECOMMEND');
                              }}
                              disabled={busy || !warningReadyForNormalReview}
                            >
                              <ClipboardCheck size={16} /> Đề xuất chấm dứt lên Admin
                            </button>
                          )}
                          {c.status === 'RECOMMENDED' && (
                            <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-200">
                              ✓ Bạn đã gửi đề xuất chấm dứt. Đang chờ Admin phê duyệt.
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* ADMIN ACTIONS */}
                    {isAdmin && (
                      <div className="space-y-3">
                        <p className="text-xs text-slate-600 leading-relaxed">
                          <strong>Nhiệm vụ của Admin:</strong> Phê duyệt quyết định chấm dứt cuối cùng để kích hoạt Smart Contract Escrow tự động hoàn cọc cho học viên và quyết toán thù lao cho gia sư.
                        </p>

                        {c.status === 'RECOMMENDED' && (
                          <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-xs font-bold text-indigo-900 flex items-center gap-2">
                            <ClipboardCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                            <span>Staff kiểm duyệt đã thẩm định hồ sơ này và gửi đề xuất chấm dứt lên Admin.</span>
                          </div>
                        )}

                        {c.status === 'REQUESTED' && (
                          <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs font-medium text-amber-900 flex items-center gap-2">
                            <Info className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>Hồ sơ đang ở trạng thái chờ thẩm định. Admin có thể trực tiếp phê duyệt quyết toán hoặc từ chối yêu cầu.</span>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2.5 pt-1">
                          {['REQUESTED', 'RECOMMENDED'].includes(c.status) && (
                            <>
                              <button
                                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-95 text-white text-xs font-black transition-all shadow-md inline-flex items-center gap-2 cursor-pointer"
                                onClick={() => {
                                  beginManagerAction({ request: c, items, evidence }, 'APPROVE');
                                }}
                                disabled={busy || !warningReadyForNormalReview}
                              >
                                <Check size={16} /> {c.wholeClass ? 'Duyệt hủy cả lớp và xử lý hoàn cọc' : 'Duyệt chấm dứt hợp đồng học viên'}
                              </button>
                              {isAdmin && (
                                <button
                                  className="px-4 py-2.5 rounded-xl bg-red-700 hover:bg-red-800 text-white text-xs font-black transition-all shadow-md inline-flex items-center gap-2 cursor-pointer"
                                  onClick={() => beginManagerAction({ request: c, items, evidence }, 'FORCE_APPROVE')}
                                  disabled={busy}
                                >
                                  <AlertTriangle size={16} /> Hủy khẩn cấp theo quyền Admin
                                </button>
                              )}
                              <button
                                className="px-4 py-2.5 rounded-xl bg-white hover:bg-red-50 text-red-700 border border-red-200 text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                onClick={() => {
                                  beginManagerAction({ request: c, items, evidence }, 'REJECT');
                                }}
                                disabled={busy}
                              >
                                <X size={15} /> {c.wholeClass ? 'Cho lớp tiếp tục (Từ chối hủy)' : 'Từ chối chấm dứt · Khôi phục phần học'}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Action confirmation form */}
                    {action?.id === c.id && (
                      <form
                        onSubmit={handleManagerReview}
                        className="mt-3 p-4.5 rounded-2xl border-2 border-indigo-200 bg-white space-y-3.5 shadow-md"
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="font-display font-black text-sm text-slate-900 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-indigo-600" />
                            Xác nhận thao tác: <span className="underline">{labels[action.type] || action.type}</span>
                          </h4>
                          <button
                            type="button"
                            onClick={() => setAction(null)}
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                          >
                            <X size={16} />
                          </button>
                        </div>

                        {['APPROVE', 'FORCE_APPROVE'].includes(action.type) && (
                          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 leading-relaxed font-semibold">
                            ⚠️ <strong>Cảnh báo quan trọng:</strong> Hành động này sẽ dừng vĩnh viễn các buổi học tương lai của
                            {c.wholeClass ? ' TOÀN BỘ LỚP HỌC' : ' HỌC VIÊN NÀY'}. Hệ thống sẽ thực hiện quyết toán tiền các buổi đã dạy cho gia sư và hoàn trả toàn bộ số tiền cọc chưa dùng qua Smart Contract Escrow. Quyết định này không thể thu hồi.
                          </div>
                        )}

                        {action.type === 'REJECT' && (
                          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-950 leading-relaxed font-semibold">
                            ℹ️ <strong>Thông báo:</strong> Bác bỏ đề xuất chấm dứt sẽ gửi thông báo đến các bên và tự động khôi phục lại toàn bộ lịch học bình thường của lớp.
                          </div>
                        )}

                        <label className="block space-y-1 text-xs font-bold text-slate-700">
                          <span>Biên bản thẩm định / Ghi chú lý do: *</span>
                          <textarea
                            className="w-full rounded-xl border border-slate-300 p-3 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                            required
                            maxLength={5000}
                            rows={3}
                            placeholder="Nhập nhận xét thẩm định, căn cứ quyết định hoặc lý do từ chối..."
                            value={reviewReason}
                            onChange={(e) => setReviewReason(e.target.value)}
                            disabled={busy}
                          />
                        </label>

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="submit"
                            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            disabled={busy || !reviewReason.trim()}
                          >
                            {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                            Xác nhận & Lưu quyết định
                          </button>
                          <button
                            type="button"
                            className="px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold transition-colors cursor-pointer"
                            onClick={() => setAction(null)}
                            disabled={busy}
                          >
                            Hủy
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
                  </>
                )}
              </article>
            );
          })}
        </div>
      )}
      {/* Tutor Active Class Picker Modal */}
      {showClassPickerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-4 border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="space-y-0.5">
                <h3 className="font-display font-black text-slate-900 text-base flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  Chọn lớp học để đề xuất dừng
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Chọn một trong các lớp học đang hoạt động của bạn để tiến hành đề xuất dừng giảng dạy.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowClassPickerModal(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {tutorActiveClasses.map((cls) => {
                const totalEscrow = cls.agreements.reduce((sum, a) => sum + (Number(a.totalAmountUsdc) || 0), 0);
                const hasPendingTerm = requests.some(
                  (r) => r.request.classroomId === cls.classroomId && !['REJECTED', 'COMPLETED'].includes(r.request.status)
                );
                return (
                  <div
                    key={cls.classroomId}
                    className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                      hasPendingTerm
                        ? 'border-amber-200 bg-amber-50/50 opacity-75'
                        : 'border-slate-200 hover:border-blue-400 hover:bg-blue-50/30'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                        <span className="font-bold text-slate-900 text-xs">{cls.className}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-100 rounded text-slate-500">
                          #{cls.classroomId}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        <span>{cls.agreements.length} học viên</span>
                        <span>&bull;</span>
                        <span className="font-mono text-emerald-700 font-bold">${totalEscrow.toFixed(2)} USDC</span>
                        {hasPendingTerm && (
                          <>
                            <span>&bull;</span>
                            <span className="text-amber-700 font-bold">Đang có hồ sơ xử lý</span>
                          </>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={hasPendingTerm}
                      onClick={() => {
                        setShowClassPickerModal(false);
                        setTutorProposeTargetAgreement(cls.agreements[0]);
                        setIsTutorProposeModalOpen(true);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer disabled:cursor-not-allowed"
                    >
                      {hasPendingTerm ? 'Đang xử lý' : 'Chọn lớp này'}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowClassPickerModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tutor Propose Modal */}
      {isTutorProposeModalOpen && tutorProposeTargetAgreement && (
        <TerminationRequestModal
          isOpen={isTutorProposeModalOpen}
          onClose={() => {
            setIsTutorProposeModalOpen(false);
            setTutorProposeTargetAgreement(null);
          }}
          agreement={tutorProposeTargetAgreement}
          activeRole={activeRole}
          onSuccess={() => {
            const cid = tutorProposeTargetAgreement.classroomId;
            setIsTutorProposeModalOpen(false);
            setTutorProposeTargetAgreement(null);
            if (cid) setSelectedClassFilter(String(cid));
            void load();
          }}
        />
      )}
    </section>
  );
}
