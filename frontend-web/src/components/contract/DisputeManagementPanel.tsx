import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  Clock,
  ExternalLink,
  Upload,
  User,
  Users,
  Hash,
  RefreshCw,
  Info,
  Lock,
  Search,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  GraduationCap,
  BookOpen,
  Layers,
  ChevronDown,
  ChevronUp,
  Eye,
  Scale,
  Calendar,
  DollarSign,
  MessageSquare,
  Sparkles,
  Building2,
  UserCheck,
  History,
  UserCog,
  FileCheck,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { EtherscanLink } from '../common/EtherscanLink';
import { DEFAULT_CHAIN_ID } from '../../web3/web3Config';
import { contractsApi, DisputeDto } from '../../api/contractsApi';
import { fetchUserDirectory, getUserDisplayName, UserSummary } from '../../utils/userDisplay';
import { Loader2 } from 'lucide-react';
import { useRealtimeRefresh } from '../../realtime/useRealtimeRefresh';
import { Pager } from '../../portal/components/OperationalUi';

export interface DisputeItem {
  id: string | number;
  agreementId: string;
  sessionId: number;
  studentName: string;
  studentEmail: string;
  studentAddress: string;
  tutorName: string;
  tutorAddress: string;
  classroomReviewerEmail?: string;
  sessionTitle: string;
  disputeReason: string;
  evidenceSummary: string;
  evidenceHash: string;
  status: 'OPENING' | 'OPEN' | 'RESOLUTION_PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  disputeDeadline?: string;
  openTxHash?: string;
  resolveTxHash?: string;
  resolutionAuditHash?: string;
}

interface DisputeManagementPanelProps {
  activeRole: 'student' | 'tutor' | 'staff' | 'admin';
  userEmail?: string;
}

interface EligibleDisputeSession {
  key: string;
  agreementId: string;
  classroomId: number;
  className: string;
  studentName?: string;
  sessionId: number;
  disputeDeadline: string;
}

const DISPUTE_STATUS_META: Record<string, { label: string; className: string; badgeColor: string }> = {
  FAILED_RETRYABLE: { label: 'CẦN THỬ LẠI - TIỀN VẪN ĐƯỢC GIỮ', className: 'bg-orange-100 text-orange-800 border border-orange-200', badgeColor: 'orange' },
  OPENING: { label: 'ĐANG XÁC NHẬN MỞ KHIẾU NẠI', className: 'bg-blue-100 text-blue-800 border border-blue-200', badgeColor: 'blue' },
  OPEN: { label: 'ĐANG MỞ KHIẾU NẠI', className: 'bg-amber-100 text-amber-800 border border-amber-200', badgeColor: 'amber' },
  RESOLUTION_PENDING: { label: 'ĐANG XÁC NHẬN PHÁN QUYẾT', className: 'bg-indigo-100 text-indigo-800 border border-indigo-200', badgeColor: 'indigo' },
  APPROVED: { label: 'CHẤP THUẬN - HOÀN TIỀN HỌC VIÊN', className: 'bg-emerald-100 text-emerald-800 border border-emerald-200', badgeColor: 'emerald' },
  REJECTED: { label: 'BÁC BỎ - GIẢI NGÂN GIA SƯ', className: 'bg-rose-100 text-rose-800 border border-rose-200', badgeColor: 'rose' },
};

const isReadyForResolution = (dispute: DisputeDto, nowMs: number): boolean => {
  if (dispute.status !== 'OPEN') return false;
  if (dispute.complainantRole === 'TUTOR' || !!dispute.tutorResponse) return true;
  if (!dispute.tutorResponseDeadline) return dispute.readyForResolution;
  return nowMs >= new Date(dispute.tutorResponseDeadline).getTime();
};

const formatRemainingTime = (deadline: string, nowMs: number): string => {
  const remainingMs = Math.max(0, new Date(deadline).getTime() - nowMs);
  const totalMinutes = Math.ceil(remainingMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours} giờ ${minutes} phút` : `${minutes} phút`;
};

const formatExactTime = (dateStr?: string | null): string => {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

interface ClassroomGroup {
  groupKey: string;
  classroomId: number | null;
  className: string;
  agreementId: string;
  tutorName: string;
  tutorEmail: string;
  tutorWallet: string;
  studentName: string;
  studentEmail: string;
  studentWallet: string;
  classroomReviewerEmail?: string;
  sessionPriceUsdc?: number;
  totalDisputes: number;
  pendingDisputes: number;
  approvedDisputes: number;
  rejectedDisputes: number;
  needsTutorResponseDisputes: number;
  studentCount: number;
  sessions: {
    sessionId: number;
    disputes: DisputeDto[];
  }[];
}

export function DisputeManagementPanel({
  activeRole,
  userEmail = '',
}: DisputeManagementPanelProps) {
  const activeChainId = DEFAULT_CHAIN_ID;
  const requestedSessionId = useMemo(() => {
    const value = new URLSearchParams(window.location.search).get('sessionId');
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  }, []);
  const requestedClassroomId = useMemo(() => {
    const value = new URLSearchParams(window.location.search).get('classroomId');
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  }, []);
  const requestedSessionHandled = useRef(false);
  const [clockNow, setClockNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  // View mode: GROUPED (by classroom) vs FLAT (all dispute cards)
  const [viewMode, setViewMode] = useState<'GROUPED' | 'FLAT'>('GROUPED');
  const [expandedClassrooms, setExpandedClassrooms] = useState<Record<string, boolean>>({});

  // Real data
  const [disputes, setDisputes] = useState<DisputeDto[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState('');
  const [historyStatus, setHistoryStatus] = useState('ALL');
  const [historyOrigin, setHistoryOrigin] = useState('ALL');
  const [historyPage, setHistoryPage] = useState(0);
  const [historyPageSize, setHistoryPageSize] = useState(10);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const tutorPriorityInitialized = useRef(false);

  useEffect(() => {
    fetchUserDirectory().then((list) => setUsers(Array.isArray(list) ? list : []));
  }, []);

  // Dispute Detail Modal state
  const [selectedDisputeForDetail, setSelectedDisputeForDetail] = useState<DisputeDto | null>(null);
  const [applyVerdictToAllSessionDisputes, setApplyVerdictToAllSessionDisputes] = useState(false);
  const [adminOverrideMode, setAdminOverrideMode] = useState(false);

  // Reviewer filters
  const [adminReviewerFilter, setAdminReviewerFilter] = useState<string>('ALL');

  useEffect(() => {
    setAdminOverrideMode(false);
  }, [selectedDisputeForDetail?.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
      setHistoryPage(0);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const fetchDisputes = useCallback(async (isSilent = false) => {
    if (!isSilent) setDataLoading(true);
    setDataError('');
    try {
      const exactStatuses = new Set(['OPENING', 'OPEN', 'UNDER_REVIEW', 'RESOLUTION_PENDING', 'APPROVED', 'REJECTED', 'FAILED_RETRYABLE']);
      const result = await contractsApi.listDisputes({
        page: historyPage,
        size: historyPageSize,
        status: exactStatuses.has(historyStatus) ? historyStatus : undefined,
        statusGroup: ['PENDING', 'RESOLVED', 'NEEDS_RESPONSE'].includes(historyStatus) ? historyStatus : undefined,
        origin: historyOrigin !== 'ALL' ? historyOrigin : undefined,
        reviewer: activeRole === 'admin' && adminReviewerFilter !== 'ALL' ? adminReviewerFilter : undefined,
        keyword: debouncedSearchQuery || undefined,
      });
      setDisputes(result?.content ?? []);
      setHistoryTotal(Number(result?.totalElements ?? 0));
      setHistoryTotalPages(Math.max(1, Number(result?.totalPages ?? 1)));
    } catch (err: any) {
      setDataError(err?.message || 'Không thể tải danh sách khiếu nại.');
    } finally {
      if (!isSilent) setDataLoading(false);
    }
  }, [activeRole, adminReviewerFilter, debouncedSearchQuery, historyOrigin, historyPage, historyPageSize, historyStatus]);

  useEffect(() => {
    fetchDisputes();
    const timer = window.setInterval(() => fetchDisputes(true), 30000);
    return () => window.clearInterval(timer);
  }, [fetchDisputes]);

  useRealtimeRefresh(
    [
      'DISPUTE_OPENED',
      'DISPUTE_UPDATED',
      'DISPUTE_RESOLVED',
      'DISPUTE_MUTATED',
      'SESSION_SETTLED',
      'AGREEMENT_FUNDED',
      'SETTLEMENT_PROPOSED',
    ],
    () => {
      fetchDisputes(true);
      if (activeRole === 'student') {
        fetchEligibleDisputeSessions(true);
      }
    }
  );

  // Keep open detail modal dispute data strictly in sync with incoming realtime updates
  useEffect(() => {
    if (!selectedDisputeForDetail) return;
    const fresh = disputes.find((d) => String(d.id) === String(selectedDisputeForDetail.id));
    if (fresh && (fresh.status !== selectedDisputeForDetail.status || fresh.tutorResponse !== selectedDisputeForDetail.tutorResponse)) {
      setSelectedDisputeForDetail(fresh);
    }
  }, [disputes, selectedDisputeForDetail]);

  // New dispute modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [agreementIdInput, setAgreementIdInput] = useState<string>('');
  const [sessionIdInput, setSessionIdInput] = useState<string>('1');
  const [eligibleSessions, setEligibleSessions] = useState<EligibleDisputeSession[]>([]);
  const [eligibleSessionsLoading, setEligibleSessionsLoading] = useState(false);
  const [reasonInput, setReasonInput] = useState<string>('');
  const [evidenceTextInput, setEvidenceTextInput] = useState<string>('');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Resolution state
  const [resolvingId, setResolvingId] = useState<string | number | null>(null);
  const [resolveReasonInput, setResolveReasonInput] = useState('');
  const [resolveActionType, setResolveActionType] = useState<boolean | null>(null);

  // Tutor evidence state
  const [isTutorModalOpen, setIsTutorModalOpen] = useState(false);
  const [selectedDisputeForTutor, setSelectedDisputeForTutor] = useState<DisputeDto | null>(null);
  const [selectedTutorSessionDisputes, setSelectedTutorSessionDisputes] = useState<DisputeDto[]>([]);
  const [tutorResponseText, setTutorResponseText] = useState('');
  const [tutorEvidenceUrl, setTutorEvidenceUrl] = useState('');
  const [tutorEvidenceFile, setTutorEvidenceFile] = useState<File | null>(null);
  const [isTutorSubmitting, setIsTutorSubmitting] = useState(false);

  const fetchEligibleDisputeSessions = useCallback(async (isSilent = false) => {
    if (activeRole !== 'student') return;
    if (!isSilent) setEligibleSessionsLoading(true);
    try {
      const agreementPage = await contractsApi.listAgreements({ page: 0, size: 50 });
      const agreements = agreementPage?.content ?? [];
      const settlementLists = await Promise.all(
        agreements.map(async (agreement) => ({
          agreement,
          settlements: await contractsApi.getSettlements(agreement.id).catch(() => []),
        }))
      );
      const currentTime = Date.now();
      const options = settlementLists.flatMap(({ agreement, settlements }) =>
        settlements
          .filter((settlement) => settlement.status === 'PROPOSED'
            && settlement.outcome === 'BOTH_PRESENT'
            && !!settlement.disputeDeadline
            && new Date(settlement.disputeDeadline).getTime() >= currentTime)
          .map((settlement) => ({
            key: `${agreement.id}:${settlement.sessionId}`,
            agreementId: agreement.id,
            classroomId: agreement.classroomId,
            className: agreement.className || `Lớp học #${agreement.classroomId}`,
            studentName: agreement.studentName,
            sessionId: settlement.sessionId,
            disputeDeadline: settlement.disputeDeadline as string,
          }))
      );
      setEligibleSessions(options);
      const requestedOption = requestedSessionId == null
        ? null
        : options.find((option) => option.sessionId === requestedSessionId
          && (requestedClassroomId == null || Number(option.classroomId) === Number(requestedClassroomId)));
      const selectedOption = requestedOption ?? options[0];

      if (selectedOption) {
        setAgreementIdInput(selectedOption.agreementId);
        setSessionIdInput(String(selectedOption.sessionId));
      }

      if (!requestedSessionHandled.current && requestedSessionId != null) {
        requestedSessionHandled.current = true;
        if (requestedOption) {
          setActionError(null);
          setIsCreateModalOpen(true);
        } else {
          setActionError(`Buổi #${requestedSessionId} chưa ở trạng thái có thể khiếu nại. Chỉ mở đơn khi cả hai đã có mặt, quyết toán đã được xác nhận và vẫn còn hạn 24 giờ.`);
        }
      }
    } catch (err: any) {
      setActionError(err?.message || 'Không thể tải các buổi còn hạn khiếu nại.');
      setEligibleSessions([]);
    } finally {
      if (!isSilent) setEligibleSessionsLoading(false);
    }
  }, [activeRole, requestedSessionId, requestedClassroomId]);

  useEffect(() => {
    fetchEligibleDisputeSessions();
  }, [fetchEligibleDisputeSessions]);

  const handleOpenTutorModal = (dispute: DisputeDto) => {
    const sameSessionOpenStudentDisputes = disputes.filter((item) => {
      const sameClass = String(item.classroomId ?? item.agreementId) === String(dispute.classroomId ?? dispute.agreementId);
      const responseWindowOpen = !item.tutorResponseDeadline || clockNow < new Date(item.tutorResponseDeadline).getTime();
      return sameClass
        && item.sessionId === dispute.sessionId
        && item.complainantRole === 'STUDENT'
        && item.status === 'OPEN'
        && responseWindowOpen;
    });
    const tutorSessionResponse = disputes.find((item) => {
      const sameClass = String(item.classroomId ?? item.agreementId) === String(dispute.classroomId ?? dispute.agreementId);
      return sameClass
        && item.sessionId === dispute.sessionId
        && item.complainantRole === 'STUDENT'
        && Boolean(item.tutorResponse);
    });
    const existingTutorEvidence = tutorSessionResponse?.evidenceItems?.find((item) => item.submittedByRole === 'TUTOR');

    setSelectedDisputeForTutor(dispute);
    setSelectedTutorSessionDisputes(sameSessionOpenStudentDisputes.length > 0 ? sameSessionOpenStudentDisputes : [dispute]);
    setTutorEvidenceFile(null);
    const rawResponse = dispute.tutorResponse || tutorSessionResponse?.tutorResponse || '';
    const fileMatch = rawResponse.match(/\s*\[File:\s*([^\]]+)\]$/);
    if (fileMatch) {
      setTutorResponseText(rawResponse.replace(fileMatch[0], ''));
      setTutorEvidenceUrl(dispute.tutorEvidenceObjectKey || existingTutorEvidence?.objectKey || fileMatch[1]);
    } else {
      setTutorResponseText(rawResponse);
      setTutorEvidenceUrl(dispute.tutorEvidenceObjectKey || existingTutorEvidence?.objectKey || '');
    }
    setIsTutorModalOpen(true);
  };

  const handleSubmitTutorEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDisputeForTutor) return;
    if (!tutorResponseText.trim()) {
      setActionError('Vui lòng nhập lời giải trình đối chất.');
      return;
    }

    setIsTutorSubmitting(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const targets = selectedTutorSessionDisputes.length > 0
        ? selectedTutorSessionDisputes
        : [selectedDisputeForTutor];

      for (const target of targets) {
        if (tutorEvidenceFile) {
          await contractsApi.submitTutorDisputeEvidenceFile(
            target.id,
            tutorResponseText.trim(),
            tutorEvidenceFile
          );
        } else {
          await contractsApi.submitTutorDisputeEvidence(target.id, {
            responseText: tutorResponseText.trim(),
            evidenceFileUrl: tutorEvidenceUrl.trim() || undefined,
          });
        }
      }

      setActionSuccess('Đã gửi phản hồi giải trình & bằng chứng đối chất thành công!');
      setActionSuccess(`Đã gửi giải trình & minh chứng cho ${targets.length} đơn khiếu nại cùng buổi học.`);
      setIsTutorModalOpen(false);
      setSelectedDisputeForTutor(null);
      setSelectedTutorSessionDisputes([]);
      await fetchDisputes();
    } catch (err: any) {
      setActionError(err?.message || 'Không thể gửi phản hồi giải trình. Vui lòng thử lại.');
    } finally {
      setIsTutorSubmitting(false);
    }
  };

  const handleCreateDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreementIdInput || !sessionIdInput || !reasonInput.trim()) {
      setActionError('Vui lòng chọn buổi học và nhập lý do khiếu nại chi tiết.');
      return;
    }

    setIsSubmitting(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      if (evidenceFile) {
        await contractsApi.openDisputeWithFile(
          agreementIdInput,
          Number(sessionIdInput),
          reasonInput.trim(),
          evidenceFile
        );
      } else {
        await contractsApi.openDispute(
          agreementIdInput,
          Number(sessionIdInput),
          {
            reason: reasonInput.trim(),
            evidenceHash: evidenceTextInput.trim() || undefined,
          }
        );
      }

      setActionSuccess(`Đã ghi nhận khiếu nại cho Buổi học #${sessionIdInput}. Khoản quyết toán đang được giữ và chờ xác nhận on-chain; gia sư sẽ nhận thông báo để nộp giải trình/minh chứng trong thời hạn quy định.`);
      setIsCreateModalOpen(false);
      setReasonInput('');
      setEvidenceTextInput('');
      setEvidenceFile(null);
      await fetchDisputes();
      await fetchEligibleDisputeSessions();
    } catch (err: any) {
      setActionError(err?.message || 'Không thể gửi khiếu nại. Vui lòng kiểm tra lại thời hạn hoặc liên hệ hỗ trợ.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canStaffResolve = useCallback((dispute: DisputeDto) => {
    if (activeRole === 'admin') return true;
    if (activeRole !== 'staff') return false;
    if (!dispute.classroomReviewerEmail || !userEmail) return false;
    return dispute.classroomReviewerEmail.trim().toLowerCase() === userEmail.trim().toLowerCase();
  }, [activeRole, userEmail]);

  const handleResolve = async (dispute: DisputeDto, approved: boolean, customReason?: string) => {
    const reason = customReason ?? '';
    if (!reason.trim()) {
      setActionError('Vui lòng nhập lý do phân xử để đảm bảo tính minh bạch trên hệ thống.');
      return;
    }
    const sessionTutorHasResponded = disputes.some((item) =>
      String(item.classroomId ?? item.agreementId) === String(dispute.classroomId ?? dispute.agreementId)
      && item.sessionId === dispute.sessionId
      && Boolean(item.tutorResponse)
    );
    if (!isReadyForResolution(dispute, clockNow) && !sessionTutorHasResponded) {
      const deadlineText = dispute.tutorResponseDeadline ? formatExactTime(dispute.tutorResponseDeadline) : 'hết hạn phản hồi';
      setActionError(`Chưa thể phân xử. Gia sư vẫn còn thời gian nộp giải trình/minh chứng đến ${deadlineText}; Staff/Admin chỉ xử lý ngay khi gia sư đã phản hồi hoặc sau khi hết hạn.`);
      return;
    }

    const openSessionDisputes = selectedSessionDisputes.filter(
      (d) => d.status === 'OPEN' && canStaffResolve(d)
    );
    const targets = (applyVerdictToAllSessionDisputes && openSessionDisputes.length > 1)
      ? openSessionDisputes
      : [dispute];

    setResolvingId(dispute.id);
    setActionError(null);
    setActionSuccess(null);

    try {
      let resolvedCount = 0;
      for (const target of targets) {
        await contractsApi.resolveDispute(target.id, approved, reason.trim());
        resolvedCount++;
      }
      setActionSuccess(
        targets.length > 1
          ? `Đã phân xử thành công toàn bộ ${resolvedCount} đơn khiếu nại trong Buổi #${dispute.sessionId}: ${approved ? 'CHẤP THUẬN (Hoàn tiền học viên)' : 'BÁC BỎ (Giải ngân gia sư)'}`
          : `Đã phân xử thành công khiếu nại Buổi #${dispute.sessionId}: ${approved ? 'CHẤP THUẬN (Hoàn tiền học viên)' : 'BÁC BỎ (Giải ngân gia sư)'}`
      );
      if (selectedDisputeForDetail) {
        setSelectedDisputeForDetail(null);
        setResolveReasonInput('');
        setApplyVerdictToAllSessionDisputes(false);
      }
      await fetchDisputes();
    } catch (err: any) {
      setActionError(err?.message || 'Không thể thực hiện phân xử. Vui lòng kiểm tra quyền hạn của Staff/Admin.');
    } finally {
      setResolvingId(null);
    }
  };

  const openManagedEvidence = async (disputeId: string | number, evidenceId: string) => {
    try {
      const blob = await contractsApi.getDisputeEvidenceFile(String(disputeId), evidenceId);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err: any) {
      setActionError(err?.message || 'Không thể tải file minh chứng.');
    }
  };

  const availableReviewers = useMemo(() => {
    const set = new Set<string>();
    disputes.forEach((d) => {
      if (d.classroomReviewerEmail) {
        set.add(d.classroomReviewerEmail.trim().toLowerCase());
      }
    });
    return Array.from(set).map((email) => {
      const user = users.find((u) => u.email?.toLowerCase() === email);
      return {
        email,
        displayName: user?.name || user?.fullName || getUserDisplayName(email, users).fullName || email,
        count: disputes.filter((d) => d.classroomReviewerEmail?.trim().toLowerCase() === email).length,
      };
    });
  }, [disputes, users]);

  const staffKpis = useMemo(() => {
    const normUserEmail = (userEmail || '').trim().toLowerCase();
    const mine = disputes.filter(
      (d) => d.classroomReviewerEmail && d.classroomReviewerEmail.trim().toLowerCase() === normUserEmail
    ).length;
    const others = disputes.filter(
      (d) => !d.classroomReviewerEmail || d.classroomReviewerEmail.trim().toLowerCase() !== normUserEmail
    ).length;
    const unassigned = disputes.filter((d) => !d.classroomReviewerEmail).length;
    return { mine, others, unassigned };
  }, [disputes, userEmail]);

  const kpis = useMemo(() => {
    const total = historyTotal;
    const pending = disputes.filter((d) => d.status === 'OPEN' || d.status === 'OPENING' || d.status === 'FAILED_RETRYABLE' || d.status === 'RESOLUTION_PENDING').length;
    const approved = disputes.filter((d) => d.status === 'APPROVED').length;
    const rejected = disputes.filter((d) => d.status === 'REJECTED').length;
    const tutorOriginCount = disputes.filter((d) => d.complainantRole === 'TUTOR').length;
    const studentOriginCount = disputes.filter((d) => d.complainantRole === 'STUDENT').length;
    const tutorNeedsActionCount = disputes.filter((d) =>
      d.complainantRole === 'STUDENT' && d.status === 'OPEN' && !d.tutorResponse
    ).length;
    const classroomCount = new Set(disputes.map((d) => d.classroomId ?? d.agreementId).filter(Boolean)).size;
    const sessionCount = new Set(disputes.map((d) => `${d.classroomId ?? d.agreementId}:${d.sessionId}`)).size;
    const studentCount = new Set(disputes.map((d) => d.studentEmail ?? d.studentWallet ?? d.complainantId).filter(Boolean)).size;

    return {
      total,
      pending,
      approved,
      rejected,
      tutorOriginCount,
      studentOriginCount,
      tutorNeedsActionCount,
      classroomCount,
      sessionCount,
      studentCount,
    };
  }, [disputes, historyTotal]);

  useEffect(() => {
    if (activeRole !== 'tutor' || tutorPriorityInitialized.current || kpis.tutorNeedsActionCount <= 0) return;
    tutorPriorityInitialized.current = true;
    setViewMode('GROUPED');
    setHistoryStatus('NEEDS_RESPONSE');
    setHistoryOrigin('STUDENT');
    setHistoryPage(0);
  }, [activeRole, kpis.tutorNeedsActionCount]);

  const filteredDisputes = useMemo(() => {
    const normUserEmail = (userEmail || '').trim().toLowerCase();
    return disputes.filter((dispute) => {
      const resolved = dispute.status === 'APPROVED' || dispute.status === 'REJECTED';
      const matchesStatus =
        historyStatus === 'ALL' ||
        (historyStatus === 'PENDING' && !resolved) ||
        (historyStatus === 'RESOLVED' && resolved) ||
        (historyStatus === 'NEEDS_RESPONSE' &&
          dispute.complainantRole === 'STUDENT' &&
          dispute.status === 'OPEN' &&
          !dispute.tutorResponse) ||
        historyStatus === dispute.status;

      const matchesOrigin =
        historyOrigin === 'ALL' || dispute.complainantRole === historyOrigin;

      if (!matchesStatus || !matchesOrigin) return false;

      // Admin role reviewer filter
      if (activeRole === 'admin') {
        const reviewer = (dispute.classroomReviewerEmail || '').trim().toLowerCase();
        if (adminReviewerFilter === 'UNASSIGNED' && reviewer) return false;
        if (adminReviewerFilter !== 'ALL' && adminReviewerFilter !== 'UNASSIGNED') {
          if (reviewer !== adminReviewerFilter.toLowerCase()) return false;
        }
      }

      if (!searchQuery.trim()) return true;
      const q = searchQuery.trim().toLowerCase();
      const matchId = String(dispute.id).toLowerCase().includes(q);
      const matchAgreement = String(dispute.agreementId || '').toLowerCase().includes(q);
      const matchClassName = (dispute.className || '').toLowerCase().includes(q);
      const matchSession =
        `buổi ${dispute.sessionId}`.includes(q) ||
        `#${dispute.sessionId}`.includes(q) ||
        String(dispute.sessionId) === q;
      const matchReason = (dispute.reason || '').toLowerCase().includes(q);
      const matchResolution = (dispute.resolutionReason || '').toLowerCase().includes(q);
      const matchStudent = (
        dispute.studentName ||
        dispute.studentEmail ||
        dispute.studentWallet ||
        ''
      ).toLowerCase().includes(q);
      const matchTutor = (
        dispute.tutorName ||
        dispute.tutorEmail ||
        dispute.tutorWallet ||
        ''
      ).toLowerCase().includes(q);

      return (
        matchId ||
        matchAgreement ||
        matchClassName ||
        matchSession ||
        matchReason ||
        matchResolution ||
        matchStudent ||
        matchTutor
      );
    });
  }, [adminReviewerFilter, activeRole, disputes, historyOrigin, historyStatus, searchQuery, userEmail]);

  // Grouped by Classroom
  const classroomGroups = useMemo<ClassroomGroup[]>(() => {
    const groupsMap = new Map<string, ClassroomGroup>();

    for (const dispute of filteredDisputes) {
      const groupKey = dispute.classroomId ? `class-${dispute.classroomId}` : `agree-${dispute.agreementId}`;
      if (!groupsMap.has(groupKey)) {
        groupsMap.set(groupKey, {
          groupKey,
          classroomId: dispute.classroomId ?? null,
          className: dispute.className || (dispute.classroomId ? `Lớp học #${dispute.classroomId}` : `Hợp đồng #${dispute.agreementId?.slice(0, 8)}`),
          agreementId: dispute.agreementId,
          tutorName: dispute.tutorName || 'Gia sư',
          tutorEmail: dispute.tutorEmail || '',
          tutorWallet: dispute.tutorWallet,
          studentName: dispute.studentName || 'Học viên',
          studentEmail: dispute.studentEmail || '',
          studentWallet: dispute.studentWallet,
          classroomReviewerEmail: dispute.classroomReviewerEmail || undefined,
          sessionPriceUsdc: dispute.sessionPriceUsdc || undefined,
          totalDisputes: 0,
          pendingDisputes: 0,
          approvedDisputes: 0,
          rejectedDisputes: 0,
          needsTutorResponseDisputes: 0,
          studentCount: 0,
          sessions: [],
        });
      }

      const grp = groupsMap.get(groupKey)!;
      grp.totalDisputes += 1;
      const resolved = dispute.status === 'APPROVED' || dispute.status === 'REJECTED';
      if (!resolved) grp.pendingDisputes += 1;
      if (dispute.status === 'APPROVED') grp.approvedDisputes += 1;
      if (dispute.status === 'REJECTED') grp.rejectedDisputes += 1;
      if (dispute.complainantRole === 'STUDENT' && dispute.status === 'OPEN' && !dispute.tutorResponse) {
        grp.needsTutorResponseDisputes += 1;
      }

      let sess = grp.sessions.find((s) => s.sessionId === dispute.sessionId);
      if (!sess) {
        sess = { sessionId: dispute.sessionId, disputes: [] };
        grp.sessions.push(sess);
      }
      sess.disputes.push(dispute);
    }

    // Sort sessions/classes so multi-class, multi-session queues show urgent work first.
    for (const grp of groupsMap.values()) {
      grp.sessions.sort((a, b) => {
        const aNeedsTutor = a.disputes.some((d) => d.complainantRole === 'STUDENT' && d.status === 'OPEN' && !d.tutorResponse) ? 1 : 0;
        const bNeedsTutor = b.disputes.some((d) => d.complainantRole === 'STUDENT' && d.status === 'OPEN' && !d.tutorResponse) ? 1 : 0;
        if (activeRole === 'tutor' && aNeedsTutor !== bNeedsTutor) return bNeedsTutor - aNeedsTutor;
        const aPending = a.disputes.some((d) => d.status !== 'APPROVED' && d.status !== 'REJECTED') ? 1 : 0;
        const bPending = b.disputes.some((d) => d.status !== 'APPROVED' && d.status !== 'REJECTED') ? 1 : 0;
        if (aPending !== bPending) return bPending - aPending;
        return a.sessionId - b.sessionId;
      });
      grp.studentCount = new Set(
        grp.sessions.flatMap((session) =>
          session.disputes.map((dispute) =>
            dispute.studentEmail ?? dispute.studentWallet ?? dispute.complainantId
          )
        ).filter(Boolean)
      ).size;
      for (const session of grp.sessions) {
        session.disputes.sort((a, b) => {
          const aNeedsTutor = a.complainantRole === 'STUDENT' && a.status === 'OPEN' && !a.tutorResponse ? 1 : 0;
          const bNeedsTutor = b.complainantRole === 'STUDENT' && b.status === 'OPEN' && !b.tutorResponse ? 1 : 0;
          if (aNeedsTutor !== bNeedsTutor) return bNeedsTutor - aNeedsTutor;
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        });
      }
    }

    return Array.from(groupsMap.values()).sort((a, b) => {
      if (activeRole === 'tutor' && a.needsTutorResponseDisputes !== b.needsTutorResponseDisputes) {
        return b.needsTutorResponseDisputes - a.needsTutorResponseDisputes;
      }
      if (a.pendingDisputes !== b.pendingDisputes) return b.pendingDisputes - a.pendingDisputes;
      return a.className.localeCompare(b.className, 'vi');
    });
  }, [activeRole, filteredDisputes]);

  const toggleClassroomExpand = (groupKey: string) => {
    setExpandedClassrooms((prev) => ({
      ...prev,
      [groupKey]: prev[groupKey] === false ? true : false,
    }));
  };

  const isClassroomExpanded = (groupKey: string) => {
    return expandedClassrooms[groupKey] !== false; // Default expanded
  };

  const historyPages = historyTotalPages;
  const currentHistoryPage = Math.min(historyPage, historyPages - 1);
  const visibleFlatHistory = filteredDisputes;
  const selectedSessionDisputes = useMemo(() => {
    if (!selectedDisputeForDetail) return [];
    const selectedGroupKey = String(selectedDisputeForDetail.classroomId ?? selectedDisputeForDetail.agreementId);
    return disputes
      .filter((item) =>
        String(item.classroomId ?? item.agreementId) === selectedGroupKey
        && item.sessionId === selectedDisputeForDetail.sessionId
      )
      .sort((a, b) => {
        const aPending = a.status !== 'APPROVED' && a.status !== 'REJECTED' ? 1 : 0;
        const bPending = b.status !== 'APPROVED' && b.status !== 'REJECTED' ? 1 : 0;
        if (aPending !== bPending) return bPending - aPending;
        const aReady = isReadyForResolution(a, clockNow) ? 1 : 0;
        const bReady = isReadyForResolution(b, clockNow) ? 1 : 0;
        if (aReady !== bReady) return bReady - aReady;
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });
  }, [clockNow, disputes, selectedDisputeForDetail]);
  const selectedSessionPendingCount = selectedSessionDisputes.filter((item) => item.status !== 'APPROVED' && item.status !== 'REJECTED').length;
  const selectedSessionStudentCount = new Set(
    selectedSessionDisputes.map((item) => item.studentEmail ?? item.studentWallet ?? item.complainantId).filter(Boolean)
  ).size;
  const selectedSessionTutorResponse = useMemo(() => {
    if (!selectedDisputeForDetail) return null;
    return selectedSessionDisputes.find((item) => Boolean(item.tutorResponse)) || null;
  }, [selectedDisputeForDetail, selectedSessionDisputes]);

  const allSessionTutorEvidences = useMemo(() => {
    if (!selectedDisputeForDetail) return [];
    const list: Array<{
      id: string;
      objectKey: string;
      contentType?: string | null;
      sha256?: string;
      createdAt?: string | null;
      targetDisputeId: string | number;
      submittedAtText?: string;
    }> = [];
    const seenKeys = new Set<string>();

    for (const d of selectedSessionDisputes) {
      for (const ev of (d.evidenceItems || [])) {
        if (ev.submittedByRole === 'TUTOR') {
          const key = (ev.id || ev.objectKey || '').trim();
          if (key && !seenKeys.has(key)) {
            seenKeys.add(key);
            list.push({
              ...ev,
              targetDisputeId: d.id,
              submittedAtText: ev.createdAt ? formatExactTime(ev.createdAt) : undefined
            });
          }
        }
      }
      if (d.tutorEvidenceObjectKey) {
        const key = d.tutorEvidenceObjectKey.trim();
        if (key && !seenKeys.has(key)) {
          seenKeys.add(key);
          list.push({
            id: `link-${d.id}`,
            objectKey: d.tutorEvidenceObjectKey,
            contentType: d.tutorEvidenceContentType,
            sha256: d.tutorEvidenceSha256 || '',
            createdAt: d.tutorRespondedAt,
            targetDisputeId: d.id,
            submittedAtText: d.tutorRespondedAt ? formatExactTime(d.tutorRespondedAt) : undefined
          });
        }
      }
    }
    return list;
  }, [selectedDisputeForDetail, selectedSessionDisputes]);

  const selectedReadyForResolution = selectedDisputeForDetail
    ? (isReadyForResolution(selectedDisputeForDetail, clockNow) || Boolean(selectedSessionTutorResponse))
    : false;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-500 to-red-600 flex items-center justify-center text-white shadow-md shadow-rose-500/20">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display font-black text-xl lg:text-2xl text-slate-900">
                {activeRole === 'student'
                  ? 'Lịch sử & Theo dõi khiếu nại'
                  : activeRole === 'tutor'
                  ? 'Quản lý khiếu nại lớp học'
                  : 'Quản lý & Phân xử khiếu nại Escrow'}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                {activeRole === 'student' ? 'Học viên' : activeRole === 'tutor' ? 'Gia sư' : activeRole === 'admin' ? 'Quản trị viên' : 'Nhân viên'}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">
              {activeRole === 'tutor'
                ? 'Theo dõi danh sách các lớp học bị khiếu nại, xem từng buổi và nộp minh chứng đối chất'
                : activeRole === 'student'
                ? 'Theo dõi minh bạch tiến độ phân xử và hoàn tiền học phí theo từng lớp học & buổi học'
                : 'Thẩm định hồ sơ đối chất của Gia sư và Học viên theo từng lớp học để ra phán quyết on-chain'}
            </p>
          </div>
        </div>

        {activeRole === 'student' && (
          <button
            onClick={() => {
              setActionError(null);
              setIsCreateModalOpen(true);
              fetchEligibleDisputeSessions();
            }}
            className="flex items-center gap-2 px-5 py-2.5 text-white font-display font-black text-xs rounded-xl shadow-md hover:shadow-lg transition-all shrink-0 bg-rose-600 hover:bg-rose-700"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Gửi Khiếu Nại Buổi Học</span>
          </button>
        )}
      </div>

      {/* Notifications */}
      {actionSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3 text-emerald-800 text-xs font-bold animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-600 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between gap-3 text-rose-800 text-xs font-bold animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-rose-600 hover:text-rose-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Tổng kết quả phù hợp
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 block">{kpis.total}</span>
            <span className="text-xs text-slate-400 font-semibold">đơn</span>
          </div>
        </div>

        <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200/80 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">
            Đang chờ trên trang
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-900 block">{kpis.pending}</span>
            <span className="text-xs text-amber-600 font-semibold">đang mở</span>
          </div>
        </div>

        <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200/80 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">
            Chấp thuận trên trang
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-900 block">{kpis.approved}</span>
            <span className="text-xs text-emerald-600 font-semibold">đã xử lý</span>
          </div>
        </div>

        <div className="bg-rose-50/70 p-4 rounded-2xl border border-rose-200/80 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider block">
            Bác bỏ trên trang
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-rose-900 block">{kpis.rejected}</span>
            <span className="text-xs text-rose-600 font-semibold">kết thúc</span>
          </div>
        </div>
      </div>

      {/* Modern Filter, Search & View Mode Switcher */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        {/* Top bar: Search + View Mode Switcher + Refresh */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setHistoryPage(0);
              }}
              placeholder="Tìm theo tên lớp học, môn học, số buổi, tên học viên/gia sư, lý do..."
              className="w-full pl-10 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-rose-500 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setHistoryPage(0);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/60">
              <button
                type="button"
                onClick={() => setViewMode('GROUPED')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                  viewMode === 'GROUPED'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Gom nhóm theo Lớp học"
              >
                <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                <span>Xem theo Lớp học</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('FLAT')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                  viewMode === 'FLAT'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Xem danh sách đơn"
              >
                <Layers className="w-3.5 h-3.5 text-rose-600" />
                <span>Danh sách đơn</span>
              </button>
            </div>

            <button
              type="button"
              disabled={dataLoading}
              onClick={() => fetchDisputes()}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shrink-0 disabled:opacity-50"
              title="Làm mới danh sách khiếu nại"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${dataLoading ? 'animate-spin text-rose-600' : 'text-slate-500'}`} />
              <span>{dataLoading ? 'Đang tải...' : 'Làm mới'}</span>
            </button>
          </div>
        </div>

        {/* Second row: Status filter tabs */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Trạng thái:
            </span>
            <button
              type="button"
              onClick={() => { setHistoryStatus('ALL'); setHistoryPage(0); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                historyStatus === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
              }`}
            >
              Tất cả ({kpis.total})
            </button>
            <button
              type="button"
              onClick={() => { setHistoryStatus('PENDING'); setHistoryPage(0); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                historyStatus === 'PENDING'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-800 border border-amber-200/60 hover:bg-amber-100'
              }`}
            >
              Đang chờ xử lý ({kpis.pending})
            </button>
            <button
              type="button"
              onClick={() => { setHistoryStatus('RESOLVED'); setHistoryPage(0); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                historyStatus === 'RESOLVED'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-blue-50 text-blue-800 border border-blue-200/60 hover:bg-blue-100'
              }`}
            >
              Đã giải quyết ({kpis.approved + kpis.rejected})
            </button>
            <button
              type="button"
              onClick={() => { setHistoryStatus('APPROVED'); setHistoryPage(0); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                historyStatus === 'APPROVED'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200/60 hover:bg-emerald-100'
              }`}
            >
              Chấp thuận ({kpis.approved})
            </button>
            <button
              type="button"
              onClick={() => { setHistoryStatus('REJECTED'); setHistoryPage(0); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                historyStatus === 'REJECTED'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 text-rose-800 border border-rose-200/60 hover:bg-rose-100'
              }`}
            >
              Bác bỏ ({kpis.rejected})
            </button>

            {activeRole === 'tutor' && kpis.tutorNeedsActionCount > 0 && (
              <button
                type="button"
                onClick={() => { setHistoryStatus('NEEDS_RESPONSE'); setHistoryPage(0); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 animate-pulse ${
                  historyStatus === 'NEEDS_RESPONSE'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-rose-100 text-rose-800 border border-rose-300'
                }`}
              >
                <AlertTriangle className="w-3 h-3" />
                <span>Cần nộp giải trình ({kpis.tutorNeedsActionCount})</span>
              </button>
            )}
          </div>

          {(activeRole === 'staff' || activeRole === 'admin') && kpis.tutorOriginCount > 0 && (
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl shrink-0">
              <button
                type="button"
                onClick={() => { setHistoryOrigin('ALL'); setHistoryPage(0); }}
                className={`px-3 py-1 rounded-xl text-xs font-extrabold transition-all ${
                  historyOrigin === 'ALL'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tất cả đơn
              </button>
              <button
                type="button"
                onClick={() => { setHistoryOrigin('STUDENT'); setHistoryPage(0); }}
                className={`px-3 py-1 rounded-xl text-xs font-extrabold transition-all ${
                  historyOrigin === 'STUDENT'
                    ? 'bg-white text-amber-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Đơn học viên ({kpis.studentOriginCount})
              </button>
              <button
                type="button"
                onClick={() => { setHistoryOrigin('TUTOR'); setHistoryPage(0); }}
                className={`px-3 py-1 rounded-xl text-xs font-extrabold transition-all ${
                  historyOrigin === 'TUTOR'
                    ? 'bg-white text-purple-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Đơn gia sư cũ ({kpis.tutorOriginCount})
              </button>
            </div>
          )}
        </div>

        {/* Staff scope is enforced by the backend before pagination. */}
        {activeRole === 'staff' && (
          <div className="flex items-center gap-2 pt-3 border-t border-slate-200/80 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1.5 font-bold">
              <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
              Chỉ hiển thị khiếu nại thuộc lớp bạn được phân công phụ trách.
            </span>
          </div>
        )}

        {/* Admin Role Reviewer Responsibility Filter */}
        {activeRole === 'admin' && (
          <div className="flex items-center gap-3 pt-3 border-t border-slate-200/80 flex-wrap">
            <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5 shrink-0">
              <Building2 className="w-3.5 h-3.5 text-indigo-600" />
              Nhân viên phụ trách duyệt lớp:
            </span>
            <select
              value={adminReviewerFilter}
              onChange={(e) => { setAdminReviewerFilter(e.target.value); setHistoryPage(0); }}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-600"
            >
              <option value="ALL">Tất cả nhân viên phụ trách ({disputes.length} đơn)</option>
              {staffKpis.unassigned > 0 && (
                <option value="UNASSIGNED">Chưa có Staff duyệt ({staffKpis.unassigned} đơn)</option>
              )}
              {availableReviewers.map((rev) => (
                <option key={rev.email} value={rev.email}>
                  Staff: {rev.displayName} ({rev.count} đơn)
                </option>
              ))}
            </select>
            <span className="text-[11px] text-slate-400 font-medium">
              Admin có thể theo dõi tiến độ của từng nhân viên hoặc can thiệp xử lý khi cần.
            </span>
          </div>
        )}
      </div>

      {activeRole === 'tutor' && (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className={`rounded-3xl border p-5 shadow-sm ${
            kpis.tutorNeedsActionCount > 0
              ? 'bg-amber-50 border-amber-200'
              : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                kpis.tutorNeedsActionCount > 0 ? 'bg-amber-500 text-white' : 'bg-indigo-50 text-indigo-700'
              }`}>
                {kpis.tutorNeedsActionCount > 0 ? <AlertTriangle className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
              </div>
              <div className="min-w-0">
                <h4 className="font-display font-black text-slate-950 text-base">
                  {kpis.tutorNeedsActionCount > 0
                    ? `${kpis.tutorNeedsActionCount} đơn cần bạn nộp giải trình`
                    : 'Không có đơn nào đang chờ bạn đối chất'}
                </h4>
                <p className="text-xs text-slate-600 font-medium mt-1 leading-relaxed">
                  Danh sách của gia sư được gom theo lớp và buổi học. Trong mỗi buổi, các đơn của nhiều học viên được xếp ưu tiên theo hạn nộp minh chứng để bạn xử lý nhanh.
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-[11px] font-black uppercase tracking-wider text-slate-400">Tổng quan theo lớp</div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-slate-50 p-3">
                <div className="text-xl font-black text-slate-950">{kpis.classroomCount}</div>
                <div className="text-[10px] font-bold text-slate-500">lớp</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <div className="text-xl font-black text-slate-950">{kpis.sessionCount}</div>
                <div className="text-[10px] font-bold text-slate-500">buổi</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <div className="text-xl font-black text-slate-950">{kpis.studentCount}</div>
                <div className="text-[10px] font-bold text-slate-500">học viên</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Eligible Dispute Sessions (24h Window) Banner for Students */}
      {activeRole === 'student' && eligibleSessions.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-indigo-500/10 border border-amber-200/90 rounded-3xl p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-display font-black text-slate-900 text-sm sm:text-base">
                  Buổi học đang trong thời hạn khiếu nại 24h ({eligibleSessions.length} buổi)
                </h4>
                <p className="text-xs text-slate-600">
                  Bạn có thể xem xét và gửi khiếu nại bảo vệ quyền lợi học phí trước khi hệ thống hoàn tất giải ngân on-chain.
                </p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {eligibleSessions.map((session) => (
              <div
                key={session.key}
                className="bg-white rounded-2xl border border-amber-200/80 p-4 flex flex-col justify-between gap-3 shadow-2xs hover:border-amber-300 transition-all"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                    <span className="font-bold text-slate-900 text-xs">{session.className}</span>
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-slate-900 text-white">
                      Buổi #{session.sessionId}
                    </span>
                  </div>
                  <div className="text-[11px] text-amber-800 font-semibold flex items-center gap-1.5 mt-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    <span>
                      Còn: <strong>{formatRemainingTime(session.disputeDeadline, clockNow)}</strong> (đến {formatExactTime(session.disputeDeadline)})
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAgreementIdInput(session.agreementId);
                    setSessionIdInput(String(session.sessionId));
                    setIsCreateModalOpen(true);
                  }}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Gửi khiếu nại buổi này</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {dataLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400 bg-white rounded-3xl border border-slate-200">
          <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
          <span className="text-sm font-semibold">Đang tải danh sách khiếu nại...</span>
        </div>
      ) : filteredDisputes.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 p-8 shadow-xs">
          <ShieldAlert className="w-12 h-12 mx-auto mb-3 opacity-40 text-slate-400" />
          <p className="font-bold text-base text-slate-700">Chưa có đơn khiếu nại nào phù hợp</p>
          <p className="text-xs text-slate-400 mt-1">Các khiếu nại của lớp học sẽ được hiển thị và phân loại theo từng lớp tại đây.</p>
        </div>
      ) : viewMode === 'GROUPED' ? (
        <div className="space-y-6">
          {classroomGroups.map((group) => {
            const isExpanded = isClassroomExpanded(group.groupKey);

            return (
              <div
                key={group.groupKey}
                className="bg-white rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all overflow-hidden"
              >
                {/* Classroom Header Banner */}
                <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-5 sm:p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white shrink-0 shadow-inner">
                        <BookOpen className="w-6 h-6 text-rose-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h3 className="font-display font-black text-lg sm:text-xl text-white">
                            {group.className}
                          </h3>
                          {group.classroomId && (
                            <span className="px-2.5 py-0.5 rounded-lg text-xs font-extrabold bg-white/15 text-white border border-white/20">
                              Mã lớp #{group.classroomId}
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                            HĐ: #{group.agreementId?.slice(0, 8)}
                          </span>
                        </div>

                        {activeRole === 'tutor' && (
                          <div className="flex items-center gap-4 text-xs text-slate-300 font-medium mt-2 flex-wrap">
                            <span className="flex items-center gap-1.5">
                              <Users className="w-4 h-4 text-emerald-400" />
                              Học viên liên quan: <strong className="text-white">{group.studentCount}</strong>
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Calendar className="w-4 h-4 text-rose-400" />
                              Buổi có khiếu nại: <strong className="text-white">{group.sessions.length}</strong>
                            </span>
                          </div>
                        )}

                        {/* Sub details: Tutor, Student, Staff */}
                        <div className={`flex items-center gap-4 text-xs text-slate-300 font-medium mt-2 flex-wrap ${activeRole === 'tutor' ? 'hidden' : ''}`}>
                          <span className="flex items-center gap-1.5">
                            <GraduationCap className="w-4 h-4 text-indigo-400" />
                            Gia sư: <strong className="text-white">{group.tutorName}</strong>
                            {group.tutorEmail && <span className="opacity-75">({group.tutorEmail})</span>}
                          </span>
                          {group.studentName && (
                            <span className="flex items-center gap-1.5">
                              <User className="w-4 h-4 text-emerald-400" />
                              Học viên: <strong className="text-white">{group.studentName}</strong>
                            </span>
                          )}
                          {group.classroomReviewerEmail ? (
                            <span className="flex items-center gap-1.5 flex-wrap">
                              <Building2 className="w-4 h-4 text-amber-400 shrink-0" />
                              <span>Nhân viên duyệt lớp:</span>
                              <strong className="text-white">{getUserDisplayName(group.classroomReviewerEmail, users).fullName}</strong>
                              <span className="font-mono text-amber-200/80 text-[10px]">({group.classroomReviewerEmail})</span>
                              {activeRole === 'staff' && (
                                group.classroomReviewerEmail.trim().toLowerCase() === userEmail?.trim().toLowerCase() ? (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-500 text-white border border-emerald-400 shadow-2xs">
                                    ✓ Bạn duyệt lớp này (Thẩm quyền phân xử)
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-700 text-slate-300 border border-slate-600">
                                    Staff khác duyệt (Quyền quan sát)
                                  </span>
                                )
                              )}
                              {activeRole === 'admin' && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/40 text-indigo-200 border border-indigo-400/50">
                                  Giám sát Admin
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-amber-300 font-semibold">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                              <span>Chưa phân công Staff duyệt lớp</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Classroom Dispute Stats & Collapse Button */}
                    <div className="flex items-center gap-3 shrink-0 self-end lg:self-center">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-3 py-1 rounded-xl text-xs font-extrabold bg-white/10 text-white border border-white/20">
                          {group.sessions.length} buổi có khiếu nại ({group.totalDisputes} đơn)
                        </span>
                        {group.pendingDisputes > 0 && (
                          <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-amber-500 text-slate-950 shadow-xs flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" /> {group.pendingDisputes} đang chờ xử lý
                          </span>
                        )}
                        {group.needsTutorResponseDisputes > 0 && activeRole === 'tutor' && (
                          <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-rose-500 text-white animate-pulse shadow-xs flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" /> {group.needsTutorResponseDisputes} cần đối chất
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleClassroomExpand(group.groupKey)}
                        className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                        title={isExpanded ? 'Thu gọn danh sách buổi học' : 'Mở rộng danh sách buổi học'}
                      >
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Sessions list within Classroom */}
                {isExpanded && (
                  <div className="p-5 sm:p-6 bg-slate-50/50 space-y-4">
                    <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-wider pb-2 border-b border-slate-200">
                      <span>Danh sách các buổi học bị khiếu nại trong lớp ({group.sessions.length} buổi)</span>
                      <span>Nhấn "Xem chi tiết" để xem hồ sơ & chứng cứ đối chất</span>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      {group.sessions.map((sess) => {
                        const pendingSessionDisputes = sess.disputes.filter((d) => d.status !== 'APPROVED' && d.status !== 'REJECTED');
                        const pendingSessionStudents = new Set(
                          pendingSessionDisputes.map((d) => d.studentEmail ?? d.studentWallet ?? d.complainantId).filter(Boolean)
                        ).size;
                        const needsTutorResponseInSession = sess.disputes.filter(
                          (d) => d.complainantRole === 'STUDENT' && d.status === 'OPEN' && !d.tutorResponse
                        ).length;
                        return (
                          <div
                            key={sess.sessionId}
                            className="bg-white rounded-2xl border border-slate-200 shadow-2xs hover:border-slate-300 transition-all p-5 space-y-4"
                          >
                            {(activeRole === 'tutor' || activeRole === 'staff' || activeRole === 'admin') && (
                              <div className="flex items-center justify-between gap-3 rounded-2xl bg-indigo-50/70 border border-indigo-100 px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                                    <Calendar className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <div className="text-sm font-display font-black text-slate-950">Buổi học #{sess.sessionId}</div>
                                    <div className="text-[11px] font-semibold text-slate-500">
                                      {sess.disputes.length} đơn từ {new Set(sess.disputes.map((d) => d.studentEmail ?? d.studentWallet ?? d.complainantId).filter(Boolean)).size} học viên
                                      {pendingSessionDisputes.length > 0 && (
                                        <span className="ml-1 text-amber-700">
                                          • {pendingSessionDisputes.length} đơn/{pendingSessionStudents} học viên đang giữ quyết toán
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                {sess.disputes.some((d) => Boolean(d.tutorResponse)) ? (
                                  <span className="inline-flex items-center gap-1 rounded-xl bg-emerald-100 px-3 py-1 text-[11px] font-black text-emerald-900 border border-emerald-200">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                                    <span>Đã có minh chứng gia sư • Sẵn sàng phân xử</span>
                                  </span>
                                ) : needsTutorResponseInSession > 0 ? (
                                  <span className="inline-flex items-center gap-1 rounded-xl bg-amber-100 px-3 py-1 text-[11px] font-black text-amber-900 border border-amber-200">
                                    <Clock className="w-3.5 h-3.5" />
                                    {activeRole === 'tutor' ? `${needsTutorResponseInSession} cần đối chất` : 'Chờ gia sư/đủ hạn'}
                                  </span>
                                ) : null}
                              </div>
                            )}
                            {sess.disputes.map((dispute) => {
                              const readyToResolve = isReadyForResolution(dispute, clockNow);
                              const hasResolvePermission = canStaffResolve(dispute);
                              const tutorResponseWindowOpen = dispute.complainantRole === 'STUDENT'
                                && dispute.status === 'OPEN'
                                && !!dispute.tutorResponseDeadline
                                && clockNow < new Date(dispute.tutorResponseDeadline).getTime();
                              const statusMeta = DISPUTE_STATUS_META[dispute.status] || {
                                label: dispute.status,
                                className: 'bg-slate-100 text-slate-700 border border-slate-200',
                                badgeColor: 'slate'
                              };

                              return (
                                <div key={dispute.id} className="space-y-4">
                                  {/* Session Row Header */}
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                                    <div className="flex items-center gap-3 flex-wrap">
                                      <div className="px-3 py-1.5 rounded-xl bg-slate-900 text-white font-display font-black text-xs shadow-xs flex items-center gap-1.5">
                                        <Calendar className="w-3.5 h-3.5 text-rose-400" />
                                        <span>BUỔI HỌC #{dispute.sessionId}</span>
                                      </div>

                                      <span className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider ${statusMeta.className}`}>
                                        {statusMeta.label}
                                      </span>

                                      {dispute.complainantRole === 'STUDENT' ? (
                                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                                          <User className="w-3 h-3 text-amber-600" />
                                          Khiếu nại từ học viên ({dispute.studentName || `#${dispute.complainantId}`})
                                        </span>
                                      ) : (
                                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-purple-50 text-purple-800 border border-purple-200 flex items-center gap-1">
                                          <GraduationCap className="w-3 h-3 text-purple-600" />
                                          Khiếu nại từ gia sư
                                        </span>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold">
                                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                                      <span>Tạo lúc: {dispute.createdAt ? new Date(dispute.createdAt).toLocaleString('vi-VN') : 'N/A'}</span>
                                    </div>
                                  </div>

                                  {/* Session Reason & Timeline Banner */}
                                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                                    {/* Reason box (col 7) */}
                                    <div className="lg:col-span-7 bg-rose-50/40 border border-rose-100 rounded-2xl p-4 space-y-2">
                                      <div className="flex items-center gap-1.5 text-rose-900 font-bold text-xs">
                                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                                        <span>
                                          {dispute.complainantRole === 'STUDENT'
                                            ? 'Lý do khiếu nại của học viên:'
                                            : 'Nội dung báo cáo của gia sư:'}
                                        </span>
                                      </div>
                                      <p className="text-xs text-slate-800 font-medium leading-relaxed pl-5 whitespace-pre-wrap line-clamp-3">
                                        {dispute.reason || 'Chưa có nội dung khiếu nại.'}
                                      </p>
                                    </div>

                                    {/* Counter status / resolution box (col 5) */}
                                    <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between space-y-2">
                                      <div>
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                                          {activeRole === 'student' ? 'Tiến độ xử lý khiếu nại:' : 'Trạng thái đối chất & phân xử:'}
                                        </span>
                                        {dispute.status === 'APPROVED' ? (
                                          <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-xs">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                            <span>Đã chấp thuận khiếu nại (Hoàn tiền học viên 100%)</span>
                                          </div>
                                        ) : dispute.status === 'REJECTED' ? (
                                          <div className="flex items-center gap-1.5 text-rose-800 font-bold text-xs">
                                            <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                                            <span>Đã bác bỏ khiếu nại (Giải ngân cho gia sư)</span>
                                          </div>
                                        ) : dispute.tutorResponse ? (
                                          <div className="space-y-1">
                                            <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-xs">
                                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                              <span>
                                                {activeRole === 'student'
                                                  ? `Gia sư đã nộp giải trình tới Staff phụ trách (${formatExactTime(dispute.tutorRespondedAt)})`
                                                  : `Gia sư đã gửi giải trình (${formatExactTime(dispute.tutorRespondedAt)})`}
                                              </span>
                                            </div>
                                            {(activeRole === 'admin' || activeRole === 'staff') && (
                                              <div className="text-[11px] text-indigo-700 font-semibold pl-5">
                                                ✨ Đã đủ hồ sơ đối chất. Admin/Staff có thể phân xử ngay.
                                              </div>
                                            )}
                                          </div>
                                        ) : tutorResponseWindowOpen ? (
                                          <div className="space-y-1">
                                            <div className="flex items-center gap-1.5 text-amber-800 font-bold text-xs">
                                              <Clock className="w-4 h-4 text-amber-600 shrink-0 animate-pulse" />
                                              <span>
                                                Gia sư còn <strong>{formatRemainingTime(dispute.tutorResponseDeadline!, clockNow)}</strong> để nộp giải trình
                                              </span>
                                            </div>
                                            <div className="text-[11px] text-amber-700 pl-5">
                                              Hạn chót: <strong>{formatExactTime(dispute.tutorResponseDeadline)}</strong>. Sau giờ này sẽ chuyển giao Staff/Admin phân xử.
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="space-y-1">
                                            <div className="flex items-center gap-1.5 text-rose-800 font-bold text-xs">
                                              <Clock className="w-4 h-4 text-rose-600 shrink-0" />
                                              <span>Đã hết hạn giải trình ({formatExactTime(dispute.tutorResponseDeadline)})</span>
                                            </div>
                                            <div className="text-[11px] text-rose-700 font-semibold pl-5">
                                              ⚡ Gia sư không gửi phản hồi. Staff/Admin có toàn quyền phân xử ngay.
                                            </div>
                                          </div>
                                        )}
                                      </div>

                                      {/* Blockchain Proof Preview */}
                                      {dispute.openTxHash && (
                                        <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-200/60">
                                          <span className="text-slate-500 font-medium">Bằng chứng On-Chain:</span>
                                          <EtherscanLink txHash={dispute.openTxHash} chainId={activeChainId} />
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Action Buttons Row */}
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                                    <button
                                      type="button"
                                      onClick={() => setSelectedDisputeForDetail(dispute)}
                                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold transition-all shadow-2xs"
                                    >
                                      <Eye className="w-3.5 h-3.5 text-indigo-600" />
                                      <span>
                                        {activeRole === 'student'
                                          ? 'Xem chi tiết khiếu nại & tiến trình'
                                          : activeRole === 'tutor'
                                          ? 'Xem nội dung khiếu nại & đối chất'
                                          : 'Xem hồ sơ đối chất 2 bên & phân xử'}
                                      </span>
                                    </button>

                                    <div className="flex items-center gap-2 flex-wrap">
                                      {/* Tutor counter button */}
                                      {activeRole === 'tutor' && dispute.complainantRole === 'STUDENT' && dispute.status === 'OPEN' && tutorResponseWindowOpen && (
                                        <button
                                          type="button"
                                          onClick={() => handleOpenTutorModal(dispute)}
                                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-display font-black shadow-md hover:shadow-lg transition-all"
                                        >
                                          <Upload className="w-3.5 h-3.5" />
                                          <span>{dispute.tutorResponse ? 'Cập nhật đối chất' : 'Nộp giải trình & minh chứng'}</span>
                                        </button>
                                      )}

                                      {/* Staff without permission notice */}
                                      {activeRole === 'staff' && dispute.status === 'OPEN' && !hasResolvePermission && (
                                        <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-semibold border border-slate-200">
                                          <Lock className="w-3.5 h-3.5 text-slate-400" />
                                          <span>Staff khác duyệt (Chỉ xem)</span>
                                        </span>
                                      )}

                                      {/* Resolved info preview */}
                                      {dispute.resolvedByEmail && (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 text-[11px] font-bold border border-emerald-200">
                                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                          <span>Đã giải quyết ({getUserDisplayName(dispute.resolvedByEmail, users, dispute.resolvedByRole || 'Staff').label})</span>
                                        </span>
                                      )}

                                      {/* Staff / Admin quick resolve button */}
                                      {(activeRole === 'admin' || activeRole === 'staff') && dispute.status === 'OPEN' && hasResolvePermission && (
                                        <button
                                          type="button"
                                          onClick={() => setSelectedDisputeForDetail(dispute)}
                                          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-display font-black shadow-md transition-all ${
                                            readyToResolve
                                              ? 'bg-rose-600 hover:bg-rose-700 text-white'
                                              : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                          }`}
                                        >
                                          <Scale className="w-3.5 h-3.5" />
                                          <span>{readyToResolve ? 'Tiến hành phân xử ngay' : 'Xem điều kiện phân xử'}</span>
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* ========================================================================= */
        /* MODE 2: FLAT LIST OF ALL DISPUTES                                         */
        /* ========================================================================= */
        <div className="space-y-4">
          {visibleFlatHistory.map((dispute) => {
            const statusMeta = DISPUTE_STATUS_META[dispute.status] || {
              label: dispute.status,
              className: 'bg-slate-100 text-slate-700 border border-slate-200',
              badgeColor: 'slate'
            };

            return (
              <div
                key={dispute.id}
                className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all p-6 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider ${statusMeta.className}`}>
                      {statusMeta.label}
                    </span>
                    <span className="px-2.5 py-1 rounded-xl text-xs font-extrabold bg-slate-900 text-white">
                      {dispute.className || `Lớp học #${dispute.classroomId || '---'}`} • Buổi #{dispute.sessionId}
                    </span>
                  </div>

                  <span className="text-xs text-slate-400 font-semibold">
                    {new Date(dispute.createdAt).toLocaleString('vi-VN')}
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="text-xs text-slate-500 font-bold">Lý do khiếu nại:</div>
                  <p className="text-xs text-slate-800 bg-rose-50/50 p-3 rounded-xl border border-rose-100 font-medium">
                    {dispute.reason}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 flex-wrap gap-2">
                  <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                    <span>
                      Người gửi: <strong>{dispute.studentName || dispute.tutorName || `#${dispute.complainantId}`}</strong>
                    </span>
                    {dispute.classroomReviewerEmail && (
                      <span className="flex items-center gap-1 text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                        <Building2 className="w-3 h-3 text-indigo-500" />
                        Phụ trách: <strong>{getUserDisplayName(dispute.classroomReviewerEmail, users).fullName}</strong>
                      </span>
                    )}
                    {dispute.resolvedByEmail && (
                      <span className="flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" />
                        Giải quyết bởi: <strong>{getUserDisplayName(dispute.resolvedByEmail, users, dispute.resolvedByRole || 'Staff').label}</strong>
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedDisputeForDetail(dispute)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800"
                  >
                    <Eye className="w-3.5 h-3.5" /> Xem chi tiết
                  </button>
                </div>
              </div>
            );
          })}

        </div>
      )}

      {!dataLoading && !dataError && (historyTotal > 0 || historyPages > 1) && (
        <Pager
          page={currentHistoryPage}
          pages={historyPages}
          total={historyTotal}
          size={historyPageSize}
          onChange={setHistoryPage}
          onSizeChange={(nextSize) => {
            setHistoryPageSize(nextSize);
            setHistoryPage(0);
          }}
        />
      )}

      {/* DISPUTE DETAIL MODAL (SIDE-BY-SIDE FULL COMPARISON & RESOLUTION) */}
      {selectedDisputeForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full overflow-hidden border border-slate-200 my-8 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 px-6 py-5 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-md">
                  <ShieldAlert className="w-5 h-5 text-rose-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display font-black text-lg text-white">
                      Hồ Sơ Khiếu Nại Chi Tiết
                    </h3>
                    <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-white/20 text-white">
                      Buổi #{selectedDisputeForDetail.sessionId}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 font-semibold mt-0.5">
                    {selectedDisputeForDetail.className || `Lớp học #${selectedDisputeForDetail.classroomId}`} • Hợp đồng #{selectedDisputeForDetail.agreementId?.slice(0, 8)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDisputeForDetail(null)}
                className="text-white/80 hover:text-white p-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* Status Banner */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-slate-500">Trạng thái:</span>
                  <span className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider ${
                    DISPUTE_STATUS_META[selectedDisputeForDetail.status]?.className || 'bg-slate-200 text-slate-800'
                  }`}>
                    {DISPUTE_STATUS_META[selectedDisputeForDetail.status]?.label || selectedDisputeForDetail.status}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-slate-600 font-medium text-xs flex-wrap">
                  <div>
                    Mở lúc: <strong className="text-slate-900">{formatExactTime(selectedDisputeForDetail.createdAt)}</strong>
                  </div>
                  {selectedDisputeForDetail.tutorResponseDeadline && selectedDisputeForDetail.status === 'OPEN' && (
                    <div className="px-2.5 py-1 rounded-xl bg-amber-100/70 border border-amber-200 text-amber-900 font-bold text-[11px] flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-700" />
                      <span>
                        Hạn giải trình: <strong>{formatExactTime(selectedDisputeForDetail.tutorResponseDeadline)}</strong>
                        {clockNow < new Date(selectedDisputeForDetail.tutorResponseDeadline).getTime()
                          ? ` (Còn ${formatRemainingTime(selectedDisputeForDetail.tutorResponseDeadline, clockNow)})`
                          : ' (Đã hết hạn)'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Reviewer & Authority Assignment Card for Staff and Admin */}
              {(activeRole === 'staff' || activeRole === 'admin') && (
                <div className={`rounded-2xl p-4 border transition-all ${
                  activeRole === 'admin'
                    ? 'bg-gradient-to-r from-indigo-50/80 to-purple-50/80 border-indigo-200'
                    : canStaffResolve(selectedDisputeForDetail)
                    ? 'bg-emerald-50/80 border-emerald-200'
                    : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        activeRole === 'admin'
                          ? 'bg-indigo-600 text-white'
                          : canStaffResolve(selectedDisputeForDetail)
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-400 text-white'
                      }`}>
                        {activeRole === 'admin' ? (
                          <Shield className="w-5 h-5" />
                        ) : canStaffResolve(selectedDisputeForDetail) ? (
                          <UserCheck className="w-5 h-5" />
                        ) : (
                          <Lock className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-display font-black text-xs text-slate-900">
                            {activeRole === 'admin' ? 'GIÁM SÁT & QUẢN TRỊ VIÊN HỆ THỐNG' : 'PHÂN QUYỀN PHỤ TRÁCH LỚP HỌC'}
                          </span>
                          {selectedDisputeForDetail.classroomReviewerEmail ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white text-slate-700 border border-slate-200">
                              Staff duyệt lớp: <strong>{getUserDisplayName(selectedDisputeForDetail.classroomReviewerEmail, users).fullName}</strong> ({selectedDisputeForDetail.classroomReviewerEmail})
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              Lớp chưa có Staff duyệt
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-slate-600 font-medium mt-1 leading-relaxed">
                          {activeRole === 'admin' ? (
                            adminOverrideMode ? (
                              <span className="text-indigo-900 font-semibold">
                                ⚡ <strong>Chế độ Admin Can Thiệp Trực Tiếp đang bật:</strong> Bạn có quyền ra phán quyết on-chain ngay lập tức thay cho nhân viên phụ trách.
                              </span>
                            ) : (
                              <span>
                                👀 <strong>Chế độ Quan Sát & Giám Sát:</strong> Bạn đang theo dõi tiến độ xử lý của Staff phụ trách. Nếu nhân viên vắng mặt hoặc cần giải quyết khẩn cấp, hãy bật nút can thiệp bên cạnh.
                              </span>
                            )
                          ) : canStaffResolve(selectedDisputeForDetail) ? (
                            <span className="text-emerald-800 font-semibold">
                              ✓ <strong>Bạn là nhân viên duyệt lớp này:</strong> Bạn có toàn quyền thẩm định hồ sơ, đối chiếu giải trình của gia sư và ra phán quyết on-chain.
                            </span>
                          ) : (
                            <span className="text-slate-600">
                              🔒 <strong>Chế độ chỉ xem:</strong> Lớp học này do nhân viên <strong>{getUserDisplayName(selectedDisputeForDetail.classroomReviewerEmail, users).fullName}</strong> phụ trách duyệt. Bạn chỉ có quyền quan sát, không có quyền ra phán quyết.
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    {activeRole === 'admin' && selectedDisputeForDetail.status === 'OPEN' && (
                      <div className="shrink-0 pt-2 sm:pt-0">
                        <button
                          type="button"
                          onClick={() => setAdminOverrideMode(!adminOverrideMode)}
                          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black shadow-xs transition-all ${
                            adminOverrideMode
                              ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                              : 'bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-50'
                          }`}
                        >
                          {adminOverrideMode ? (
                            <>
                              <ToggleRight className="w-4 h-4" />
                              <span>Đang bật Admin Can Thiệp</span>
                            </>
                          ) : (
                            <>
                              <ToggleLeft className="w-4 h-4" />
                              <span>Bật can thiệp phân xử thay Staff</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Session-wide disputes overview when multiple students disputed this session */}
              {selectedSessionDisputes.length > 1 && (
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                        <Layers className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="font-display font-black text-xs text-indigo-950">
                          Toàn bộ khiếu nại trong Buổi #{selectedDisputeForDetail.sessionId} ({selectedSessionDisputes.length} đơn từ {selectedSessionStudentCount} học viên)
                        </div>
                        <div className="text-[11px] text-indigo-700 font-medium">
                          {selectedSessionPendingCount} đơn đang giữ quyết toán • Quyết toán chỉ bảo lưu riêng cho từng học viên khiếu nại; học viên khác trong lớp không bị giữ.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {selectedSessionDisputes.map((d) => {
                      const isCurrent = d.id === selectedDisputeForDetail.id;
                      const hasTutorEvidence = Boolean(
                        d.tutorResponse ||
                        d.evidenceItems?.some((e) => e.submittedByRole === 'TUTOR') ||
                        selectedSessionTutorResponse
                      );
                      return (
                        <div
                          key={d.id}
                          className={`p-3 rounded-xl border transition-all text-xs flex flex-col justify-between ${
                            isCurrent
                              ? 'bg-white border-indigo-600 ring-2 ring-indigo-500/20 shadow-xs'
                              : 'bg-white/80 border-slate-200 hover:border-indigo-300 hover:bg-white'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1 mb-1.5">
                              <span className="font-bold text-slate-900 truncate">
                                {d.studentName || d.studentEmail || `Học viên #${d.complainantId}`}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider shrink-0 ${
                                DISPUTE_STATUS_META[d.status]?.className || 'bg-slate-200 text-slate-800'
                              }`}>
                                {DISPUTE_STATUS_META[d.status]?.label || d.status}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 line-clamp-2 italic mb-2">
                              "{d.reason || 'Chưa có lý do'}"
                            </p>
                          </div>

                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 mt-auto">
                            <span className="text-[10px] font-semibold text-slate-500 flex items-center gap-1">
                              {hasTutorEvidence ? (
                                <span className="text-emerald-700 flex items-center gap-0.5">
                                  <ShieldCheck className="w-3 h-3" /> Đã có giải trình
                                </span>
                              ) : (
                                <span className="text-amber-700 flex items-center gap-0.5">
                                  <Clock className="w-3 h-3" /> Chờ gia sư
                                </span>
                              )}
                            </span>
                            {!isCurrent ? (
                              <button
                                type="button"
                                onClick={() => setSelectedDisputeForDetail(d)}
                                className="px-2 py-0.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] transition-colors"
                              >
                                Xem đơn này
                              </button>
                            ) : (
                              <span className="px-2 py-0.5 rounded-lg bg-indigo-600 text-white font-bold text-[10px]">
                                Đang xem
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Side-by-side Evidence & Statements */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Column 1: Student Claim */}
                <div className="bg-rose-50/40 border border-rose-200 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-rose-200/80 pb-3">
                    <div className="flex items-center gap-2 font-display font-black text-sm text-rose-900">
                      <User className="w-4 h-4 text-rose-600" />
                      <span>HỌC VIÊN KHIẾU NẠI</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                      Bên khiếu nại
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-700">
                    <div>Họ và tên: <strong className="text-slate-900">{selectedDisputeForDetail.studentName || 'Học viên'}</strong></div>
                    {selectedDisputeForDetail.studentEmail && (
                      <div>Email: <span className="font-mono text-slate-600">{selectedDisputeForDetail.studentEmail}</span></div>
                    )}
                    <div>
                      Ví học viên:
                      <div className="mt-0.5">
                        <EtherscanLink address={selectedDisputeForDetail.studentWallet} chainId={activeChainId} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-rose-200/60">
                    <span className="font-bold text-rose-900 block">Lý do khiếu nại chi tiết:</span>
                    <p className="bg-white p-3 rounded-xl border border-rose-100 text-slate-800 font-medium leading-relaxed whitespace-pre-wrap">
                      {selectedDisputeForDetail.reason}
                    </p>
                  </div>

                  {/* Student Evidence Files */}
                  {selectedDisputeForDetail.evidenceItems?.filter((e) => e.submittedByRole === 'STUDENT').length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-rose-200/60">
                      <span className="font-bold text-rose-900 block">File / Minh chứng đính kèm:</span>
                      {selectedDisputeForDetail.evidenceItems.filter((e) => e.submittedByRole === 'STUDENT').map((ev, idx) => (
                        <div key={ev.id} className="bg-white p-2.5 rounded-xl border border-rose-100 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => openManagedEvidence(selectedDisputeForDetail.id, ev.id)}
                            className="inline-flex items-center gap-1.5 text-rose-700 font-bold hover:underline"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>File minh chứng học viên #{idx + 1}</span>
                          </button>
                          {ev.sha256 && (
                            <span className="text-[10px] font-mono text-slate-400">SHA-256: {ev.sha256.slice(0, 10)}...</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Column 2: Dependent on Active Role */}
                {activeRole === 'student' ? (
                  /* ========================================================================= */
                  /* STUDENT VIEW: Confidential Process & Review Status (NO TUTOR LEAKS)       */
                  /* ========================================================================= */
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                      <div className="flex items-center gap-2 font-display font-black text-sm text-slate-800">
                        <Shield className="w-4 h-4 text-indigo-600" />
                        <span>TIẾN TRÌNH & THẨM ĐỊNH TỪ BAN QUẢN TRỊ</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        Bảo mật hệ thống
                      </span>
                    </div>

                    <div className="space-y-2 text-xs text-slate-700">
                      <div>Gia sư lớp học: <strong className="text-slate-900">{selectedDisputeForDetail.tutorName || 'Gia sư'}</strong></div>
                      {selectedDisputeForDetail.tutorEmail && (
                        <div>Email gia sư: <span className="font-mono text-slate-600">{selectedDisputeForDetail.tutorEmail}</span></div>
                      )}
                      <div>
                        Staff phụ trách thẩm định: <strong className="text-indigo-900">{getUserDisplayName(selectedDisputeForDetail.classroomReviewerEmail, users, 'Ban Quản Trị Hệ Thống').label}</strong>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-200">
                      <span className="font-bold text-slate-800 block">Trạng thái giải trình từ gia sư:</span>
                      {selectedDisputeForDetail.tutorRespondedAt ? (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 space-y-2">
                          <div className="flex items-center gap-1.5 text-emerald-900 font-bold text-xs">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>Gia sư đã nộp giải trình tới Staff lúc {formatExactTime(selectedDisputeForDetail.tutorRespondedAt)}</span>
                          </div>
                          <p className="text-[11px] text-emerald-800 leading-relaxed">
                            🔒 <em>Nhằm đảm bảo tính khách quan, bảo mật và tránh xung đột hai chiều, toàn bộ tài liệu giải trình của gia sư được chuyển trực tiếp cho Hội đồng phân xử (Staff/Admin) độc lập thẩm định.</em>
                          </p>
                        </div>
                      ) : selectedDisputeForDetail.tutorResponseDeadline && clockNow < new Date(selectedDisputeForDetail.tutorResponseDeadline).getTime() ? (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs">
                            <Clock className="w-4 h-4 text-amber-600 shrink-0 animate-pulse" />
                            <span>Đang trong thời hạn gia sư gửi giải trình</span>
                          </div>
                          <p className="text-[11px] text-amber-800">
                            Gia sư còn <strong>{formatRemainingTime(selectedDisputeForDetail.tutorResponseDeadline, clockNow)}</strong> (đến đúng <strong>{formatExactTime(selectedDisputeForDetail.tutorResponseDeadline)}</strong>) để gửi phản hồi và minh chứng đối chất tới Staff phụ trách.
                          </p>
                          <p className="text-[10px] text-amber-700 font-medium">
                            Sau thời gian này nếu gia sư không phản hồi, Staff/Admin sẽ toàn quyền phân xử bảo vệ quyền lợi của bạn.
                          </p>
                        </div>
                      ) : (
                        <div className="bg-slate-100 border border-slate-200 rounded-xl p-3.5 text-slate-700 text-xs space-y-1">
                          <div className="font-bold text-rose-700">⏳ Đã hết thời hạn gửi giải trình 24h ({formatExactTime(selectedDisputeForDetail.tutorResponseDeadline)})</div>
                          <p className="text-[11px] text-slate-600">Gia sư đã không gửi phản hồi trong thời hạn quy định. Staff/Admin đang tiến hành phân xử trên cơ sở dữ liệu hệ thống và minh chứng của bạn.</p>
                        </div>
                      )}
                    </div>

                    <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 text-[11px] text-indigo-900 space-y-1">
                      <div className="font-bold flex items-center gap-1">
                        <Lock className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Bảo vệ ký quỹ Escrow:</span>
                      </div>
                      <p>
                        Khoản học phí Buổi học #{selectedDisputeForDetail.sessionId} ({selectedDisputeForDetail.sessionPriceUsdc ? `${selectedDisputeForDetail.sessionPriceUsdc} USDC` : '100% học phí buổi'}) đang được bảo lưu an toàn trên Smart Contract cho đến khi có phán quyết chính thức từ Staff/Admin.
                      </p>
                    </div>
                  </div>
                ) : activeRole === 'tutor' ? (
                  /* ========================================================================= */
                  /* TUTOR VIEW: Tutor's Own Response & Evidence Upload                        */
                  /* ========================================================================= */
                  <div className="bg-indigo-50/40 border border-indigo-200 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-indigo-200/80 pb-3">
                      <div className="flex items-center gap-2 font-display font-black text-sm text-indigo-900">
                        <GraduationCap className="w-4 h-4 text-indigo-600" />
                        <span>BẢN GIẢI TRÌNH CỦA BẠN (GIA SƯ)</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
                        Hồ sơ đối chất
                      </span>
                    </div>

                    <div className="space-y-1.5 pt-2">
                      <span className="font-bold text-indigo-900 block">Nội dung giải trình đối chất của bạn:</span>
                      {selectedDisputeForDetail.tutorResponse ? (
                        <div className="space-y-2">
                          <p className="bg-white p-3 rounded-xl border border-indigo-100 text-slate-800 font-medium leading-relaxed whitespace-pre-wrap">
                            {selectedDisputeForDetail.tutorResponse}
                          </p>
                          <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                            <div className="text-[11px] text-emerald-700 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Đã gửi lúc {formatExactTime(selectedDisputeForDetail.tutorRespondedAt)}</span>
                            </div>
                            {selectedDisputeForDetail.tutorResponseDeadline && clockNow < new Date(selectedDisputeForDetail.tutorResponseDeadline).getTime() && (
                              <button
                                type="button"
                                onClick={() => handleOpenTutorModal(selectedDisputeForDetail)}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 px-2.5 py-1 rounded-lg hover:bg-indigo-100 transition-colors"
                              >
                                <Upload className="w-3 h-3" />
                                <span>Bổ sung / Cập nhật</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ) : selectedSessionTutorResponse ? (
                        <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 space-y-2">
                          <div className="flex items-center gap-1.5 text-emerald-900 font-bold text-xs">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>Đã áp dụng giải trình & minh chứng bạn gửi cho buổi học này</span>
                          </div>
                          <p className="bg-white p-3 rounded-xl border border-emerald-100 text-slate-800 font-medium leading-relaxed whitespace-pre-wrap">
                            {selectedSessionTutorResponse.tutorResponse}
                          </p>
                          <div className="text-[11px] text-emerald-800 leading-relaxed">
                            Hệ thống đã tự động liên kết minh chứng này từ lần gửi trước. Bạn không phải làm lại; nếu muốn gửi bổ sung thêm cho buổi học này, bạn vẫn có thể nộp.
                          </div>
                          {selectedDisputeForDetail.tutorResponseDeadline && clockNow < new Date(selectedDisputeForDetail.tutorResponseDeadline).getTime() && (
                            <button
                              type="button"
                              onClick={() => handleOpenTutorModal(selectedDisputeForDetail)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              <span>Gửi Bổ Sung Minh Chứng Cho Buổi Này</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="bg-white p-3.5 rounded-xl border border-dashed border-amber-300 text-amber-800 font-medium space-y-3">
                          {selectedDisputeForDetail.tutorResponseDeadline && clockNow < new Date(selectedDisputeForDetail.tutorResponseDeadline).getTime() ? (
                            <>
                              <div>
                                ⏳ Bạn chưa nộp bản giải trình. Còn <strong>{formatRemainingTime(selectedDisputeForDetail.tutorResponseDeadline, clockNow)}</strong> (đến đúng <strong>{formatExactTime(selectedDisputeForDetail.tutorResponseDeadline)}</strong>) để nộp đối chất bảo vệ học phí.
                              </div>
                              <div className="text-[11px] text-amber-700">
                                ⚠️ Sau thời điểm này, hệ thống sẽ đóng cổng giải trình và chuyển toàn quyền cho Staff/Admin phân xử.
                              </div>
                              <button
                                type="button"
                                onClick={() => handleOpenTutorModal(selectedDisputeForDetail)}
                                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-display font-black text-xs shadow-md transition-all"
                              >
                                <Upload className="w-4 h-4" />
                                <span>Nộp Giải Trình & Minh Chứng Đối Chất Ngay</span>
                              </button>
                            </>
                          ) : (
                            <div className="text-xs text-rose-700 font-semibold">
                              ⚠️ Đã hết thời hạn 24 giờ nộp giải trình ({formatExactTime(selectedDisputeForDetail.tutorResponseDeadline)}). Cổng giải trình đã đóng và hồ sơ đã chuyển cho Staff/Admin phân xử.
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Tutor Evidence Files (Across all submissions for this session) */}
                    {allSessionTutorEvidences.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-indigo-200/60">
                        <span className="font-bold text-indigo-900 flex items-center justify-between">
                          <span>File minh chứng bạn đã nộp ({allSessionTutorEvidences.length} tài liệu):</span>
                          <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md">Áp dụng chung cả buổi</span>
                        </span>
                        {allSessionTutorEvidences.map((ev, idx) => (
                          <div key={ev.id || idx} className="bg-white p-2.5 rounded-xl border border-indigo-100 flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => openManagedEvidence(ev.targetDisputeId, ev.id)}
                              className="inline-flex items-center gap-1.5 text-indigo-700 font-bold hover:underline"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Minh chứng đối chất #{idx + 1}</span>
                            </button>
                            <div className="flex items-center gap-2 text-[10px] text-slate-500">
                              {ev.submittedAtText && <span>{ev.submittedAtText}</span>}
                              {ev.sha256 && (
                                <span className="font-mono text-slate-400">SHA-256: {ev.sha256.slice(0, 10)}...</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="p-2.5 bg-indigo-100/50 rounded-xl text-[11px] text-indigo-900 border border-indigo-200/50">
                      🔒 <em>Hồ sơ giải trình và minh chứng của bạn được chuyển riêng cho Ban Quản Trị & Staff phụ trách lớp thẩm định, không công khai cho học viên.</em>
                    </div>
                  </div>
                ) : (
                  /* ========================================================================= */
                  /* STAFF / ADMIN VIEW: Full Tutor Counter Response & Files (2-Way Full View) */
                  /* ========================================================================= */
                  <div className="bg-indigo-50/40 border border-indigo-200 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-indigo-200/80 pb-3">
                      <div className="flex items-center gap-2 font-display font-black text-sm text-indigo-900">
                        <GraduationCap className="w-4 h-4 text-indigo-600" />
                        <span>GIA SƯ PHẢN HỒI & ĐỐI CHẤT</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
                        Bên giải trình
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-700">
                      <div>Họ và tên: <strong className="text-slate-900">{selectedDisputeForDetail.tutorName || 'Gia sư'}</strong></div>
                      {selectedDisputeForDetail.tutorEmail && (
                        <div>Email: <span className="font-mono text-slate-600">{selectedDisputeForDetail.tutorEmail}</span></div>
                      )}
                      <div>
                        Ví gia sư:
                        <div className="mt-0.5">
                          <EtherscanLink address={selectedDisputeForDetail.tutorWallet} chainId={activeChainId} />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-indigo-200/60">
                      <span className="font-bold text-indigo-900 block">Nội dung giải trình đối chất:</span>
                      {selectedDisputeForDetail.tutorResponse ? (
                        <div className="space-y-2">
                          <p className="bg-white p-3 rounded-xl border border-indigo-100 text-slate-800 font-medium leading-relaxed whitespace-pre-wrap">
                            {selectedDisputeForDetail.tutorResponse}
                          </p>
                          <div className="text-[11px] text-emerald-700 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Gia sư nộp lúc {formatExactTime(selectedDisputeForDetail.tutorRespondedAt)} • Sẵn sàng phân xử</span>
                          </div>
                        </div>
                      ) : selectedSessionTutorResponse ? (
                        <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 space-y-2">
                          <div className="flex items-center gap-1.5 text-emerald-900 font-bold text-xs">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>Đã có giải trình đối chất chung của gia sư cho Buổi học #{selectedDisputeForDetail.sessionId}</span>
                          </div>
                          <p className="bg-white p-3 rounded-xl border border-emerald-100 text-slate-800 font-medium leading-relaxed whitespace-pre-wrap">
                            {selectedSessionTutorResponse.tutorResponse}
                          </p>
                          <div className="text-[11px] text-emerald-800">
                            ℹ️ Gia sư đã nộp đối chất buổi này (qua đơn của <strong>{selectedSessionTutorResponse.studentName || selectedSessionTutorResponse.studentEmail || 'học viên cùng buổi'}</strong>) lúc {formatExactTime(selectedSessionTutorResponse.tutorRespondedAt)}. Staff/Admin có thể phân xử ngay cho học viên này theo hồ sơ hiện có.
                          </div>
                        </div>
                      ) : (
                        <div className="bg-white p-3.5 rounded-xl border border-dashed border-amber-300 text-amber-800 font-medium space-y-1.5">
                          {selectedDisputeForDetail.tutorResponseDeadline && clockNow < new Date(selectedDisputeForDetail.tutorResponseDeadline).getTime() ? (
                            <>
                              <div>
                                ⏳ Gia sư chưa nộp giải trình. Còn <strong>{formatRemainingTime(selectedDisputeForDetail.tutorResponseDeadline, clockNow)}</strong> (hạn chót đến <strong>{formatExactTime(selectedDisputeForDetail.tutorResponseDeadline)}</strong>).
                              </div>
                              <div className="text-[11px] text-amber-700">
                                ℹ️ Staff/Admin có thể phân xử ngay sau khi gia sư nộp hoặc sau khi thời hạn trên kết thúc.
                              </div>
                            </>
                          ) : (
                            <div className="text-xs text-rose-700 font-semibold">
                              ⚡ Gia sư đã không nộp giải trình trong thời hạn 24 giờ (đã hết hạn lúc {formatExactTime(selectedDisputeForDetail.tutorResponseDeadline)}). Staff/Admin đã có toàn quyền phân xử ngay.
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Tutor Evidence Files (Full session aggregate across all submissions) */}
                    {allSessionTutorEvidences.length > 0 ? (
                      <div className="space-y-2 pt-2 border-t border-indigo-200/60">
                        <span className="font-bold text-indigo-900 flex items-center justify-between">
                          <span>Toàn bộ minh chứng đối chất của gia sư ({allSessionTutorEvidences.length} tài liệu đã cung cấp):</span>
                          <span className="text-[10px] text-indigo-700 font-semibold bg-indigo-100/70 px-2 py-0.5 rounded-md">Áp dụng chung buổi này</span>
                        </span>
                        {allSessionTutorEvidences.map((ev, idx) => (
                          <div key={ev.id || idx} className="bg-white p-2.5 rounded-xl border border-indigo-100 flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => openManagedEvidence(ev.targetDisputeId, ev.id)}
                              className="inline-flex items-center gap-1.5 text-indigo-700 font-bold hover:underline"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Minh chứng đối chất gia sư #{idx + 1}</span>
                            </button>
                            <div className="flex items-center gap-2 text-[10px] text-slate-500">
                              {ev.submittedAtText && <span>{ev.submittedAtText}</span>}
                              {ev.sha256 && (
                                <span className="font-mono text-slate-400">SHA-256: {ev.sha256.slice(0, 10)}...</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      selectedDisputeForDetail.tutorResponseDeadline && clockNow >= new Date(selectedDisputeForDetail.tutorResponseDeadline).getTime() && (
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-800 font-medium">
                          ⚠️ Gia sư không nộp bất kỳ tài liệu minh chứng nào trong suốt thời hạn 24 giờ.
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>

              {/* ========================================================================= */}
              {/* AUDIT TRAIL TIMELINE: LỊCH SỬ THẨM ĐỊNH & GHI NHẬN PHÁN QUYẾT            */}
              {/* ========================================================================= */}
              <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                  <div className="flex items-center gap-2 font-display font-black text-xs text-slate-900">
                    <History className="w-4 h-4 text-indigo-600" />
                    <span>NHẬT KÝ KIỂM TOÁN & TIẾN TRÌNH THẨM ĐỊNH (AUDIT TRAIL)</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    {selectedDisputeForDetail.status === 'APPROVED' || selectedDisputeForDetail.status === 'REJECTED'
                      ? '✓ Đã hoàn tất giải quyết'
                      : '⏳ Đang trong tiến trình giải quyết'}
                  </span>
                </div>

                <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  {/* Step 1: Open Dispute */}
                  <div className="relative group">
                    <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center text-[10px] font-bold shadow-xs">
                      1
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-xs">
                          {selectedDisputeForDetail.complainantRole === 'STUDENT' ? 'Học viên mở khiếu nại' : 'Gia sư mở khiếu nại'}:
                          {' '}<strong>{selectedDisputeForDetail.studentName || selectedDisputeForDetail.tutorName || `#${selectedDisputeForDetail.complainantId}`}</strong>
                        </span>
                        <span className="text-[11px] font-medium text-slate-500">
                          {formatExactTime(selectedDisputeForDetail.createdAt)}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-700 italic">
                        "{selectedDisputeForDetail.reason}"
                      </p>
                      {selectedDisputeForDetail.openTxHash && (
                        <div className="flex items-center gap-1.5 text-[10px] pt-1 text-slate-500">
                          <span>Tx ghi nhận on-chain:</span>
                          <EtherscanLink txHash={selectedDisputeForDetail.openTxHash} chainId={activeChainId} />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Step 2: Tutor Counter / Deadline */}
                  <div className="relative group">
                    <div className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-xs ${
                      selectedDisputeForDetail.tutorResponse || selectedDisputeForDetail.tutorRespondedAt
                        ? 'bg-emerald-500'
                        : selectedDisputeForDetail.tutorResponseDeadline && clockNow < new Date(selectedDisputeForDetail.tutorResponseDeadline).getTime()
                        ? 'bg-amber-500'
                        : 'bg-slate-600'
                    }`}>
                      2
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-xs">
                          Thời hạn giải trình & đối chất của gia sư
                        </span>
                        <span className="text-[11px] font-medium text-slate-500">
                          Hạn chót: {formatExactTime(selectedDisputeForDetail.tutorResponseDeadline)}
                        </span>
                      </div>
                      {selectedDisputeForDetail.tutorResponse || selectedDisputeForDetail.tutorRespondedAt ? (
                        <div className="text-[11px] text-emerald-800 font-medium flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Gia sư đã nộp giải trình lúc {formatExactTime(selectedDisputeForDetail.tutorRespondedAt)} ({allSessionTutorEvidences.length} tài liệu đối chất).</span>
                        </div>
                      ) : selectedDisputeForDetail.tutorResponseDeadline && clockNow < new Date(selectedDisputeForDetail.tutorResponseDeadline).getTime() ? (
                        <div className="text-[11px] text-amber-800 font-medium flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0 animate-pulse" />
                          <span>Gia sư còn {formatRemainingTime(selectedDisputeForDetail.tutorResponseDeadline, clockNow)} để nộp minh chứng đối chất.</span>
                        </div>
                      ) : (
                        <div className="text-[11px] text-rose-800 font-medium flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          <span>Gia sư không nộp minh chứng trong 24 giờ • Hồ sơ đủ điều kiện xử lý theo quy định bảo vệ học viên.</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Step 3: Assignment & Reviewer Responsibility */}
                  <div className="relative group">
                    <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[10px] font-bold shadow-xs">
                      3
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-xs">
                          Cán bộ thụ lý & Thẩm quyền giải quyết
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {selectedDisputeForDetail.classroomReviewerEmail ? 'Đã phân công Staff duyệt lớp' : 'Chưa gán Staff'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-700">
                        Nhân viên phụ trách duyệt lớp:{' '}
                        <strong className="text-slate-900">
                          {getUserDisplayName(selectedDisputeForDetail.classroomReviewerEmail, users).fullName}
                        </strong>
                        {selectedDisputeForDetail.classroomReviewerEmail && (
                          <span className="text-slate-500 font-mono ml-1">({selectedDisputeForDetail.classroomReviewerEmail})</span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Quy chế: Nhân viên duyệt lớp này chịu trách nhiệm thụ lý và ra phán quyết on-chain. Quản trị viên (Admin) có thẩm quyền giám sát và can thiệp trực tiếp khi cần thiết.
                      </div>
                    </div>
                  </div>

                  {/* Step 4: Resolution & Final Verdict */}
                  <div className="relative group">
                    <div className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-xs ${
                      selectedDisputeForDetail.status === 'APPROVED'
                        ? 'bg-emerald-600'
                        : selectedDisputeForDetail.status === 'REJECTED'
                        ? 'bg-rose-600'
                        : selectedDisputeForDetail.status === 'RESOLUTION_PENDING'
                        ? 'bg-indigo-600'
                        : 'bg-slate-300 text-slate-700'
                    }`}>
                      4
                    </div>
                    <div className={`p-3 rounded-xl border space-y-1.5 ${
                      selectedDisputeForDetail.status === 'APPROVED'
                        ? 'bg-emerald-50/70 border-emerald-200'
                        : selectedDisputeForDetail.status === 'REJECTED'
                        ? 'bg-rose-50/70 border-rose-200'
                        : selectedDisputeForDetail.status === 'RESOLUTION_PENDING'
                        ? 'bg-indigo-50/70 border-indigo-200'
                        : 'bg-white border-slate-200'
                    }`}>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-xs">
                          Kết quả phán quyết & Lịch sử ghi nhận
                        </span>
                        {selectedDisputeForDetail.resolvedAt && (
                          <span className="text-[11px] font-medium text-slate-500">
                            {formatExactTime(selectedDisputeForDetail.resolvedAt)}
                          </span>
                        )}
                      </div>

                      {selectedDisputeForDetail.status === 'APPROVED' || selectedDisputeForDetail.status === 'REJECTED' || selectedDisputeForDetail.status === 'RESOLUTION_PENDING' ? (
                        <div className="space-y-1.5 text-xs">
                          <div className="font-extrabold flex items-center gap-1.5">
                            {selectedDisputeForDetail.status === 'APPROVED' ? (
                              <span className="text-emerald-800 flex items-center gap-1">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                ĐÃ GIẢI QUYẾT: CHẤP THUẬN KHIẾU NẠI (HOÀN TIỀN HỌC VIÊN 100%)
                              </span>
                            ) : selectedDisputeForDetail.status === 'RESOLUTION_PENDING' ? (
                              <span className="text-indigo-800 flex items-center gap-1">
                                <Clock className="w-4 h-4 text-indigo-600 animate-spin" />
                                ĐANG XÁC NHẬN PHÁN QUYẾT TRÊN BLOCKCHAIN (CHỜ TX)
                              </span>
                            ) : (
                              <span className="text-rose-800 flex items-center gap-1">
                                <XCircle className="w-4 h-4 text-rose-600" />
                                ĐÃ GIẢI QUYẾT: BÁC BỎ KHIẾU NẠI (GIẢI NGÂN CHO GIA SƯ)
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] text-slate-700 bg-white/80 p-2.5 rounded-lg border border-black/5">
                            <strong>Căn cứ phán quyết:</strong> {selectedDisputeForDetail.resolutionReason || 'Không có ghi chú thêm.'}
                          </div>

                          <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-600 pt-1">
                            <span>Người giải quyết:</span>
                            <strong className="text-slate-900">
                              {getUserDisplayName(selectedDisputeForDetail.resolvedByEmail, users, selectedDisputeForDetail.resolvedByRole || 'Staff/Admin').label}
                            </strong>
                            {selectedDisputeForDetail.resolvedByRole === 'ADMIN' ? (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-200">
                                👑 Quản trị viên can thiệp xử lý thay
                              </span>
                            ) : selectedDisputeForDetail.resolvedByEmail && selectedDisputeForDetail.classroomReviewerEmail && selectedDisputeForDetail.resolvedByEmail.toLowerCase() === selectedDisputeForDetail.classroomReviewerEmail.toLowerCase() ? (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                                ✓ Nhân viên phụ trách duyệt lớp giải quyết
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                Staff giải quyết
                              </span>
                            )}
                          </div>

                          {selectedDisputeForDetail.resolveTxHash && (
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-600 pt-0.5">
                              <span>Mã Tx Phán Quyết:</span>
                              <EtherscanLink txHash={selectedDisputeForDetail.resolveTxHash} chainId={activeChainId} />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-500 italic">
                          Chưa có phán quyết. Khiếu nại đang được nhân viên phụ trách lớp theo dõi đối chất và hoàn tất thẩm định.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Resolution Form for Staff / Admin if open */}
              {selectedDisputeForDetail.status === 'OPEN' && (
                activeRole === 'staff' ? (
                  canStaffResolve(selectedDisputeForDetail) ? (
                    /* Staff who reviewed this class has resolution rights */
                    <div className="p-5 bg-slate-100 rounded-2xl border border-slate-200 space-y-4">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 font-display font-black text-slate-900 text-sm">
                          <Scale className="w-5 h-5 text-indigo-600" />
                          <span>HỘI ĐỒNG PHÂN XỬ ON-CHAIN (STAFF PHỤ TRÁCH LỚP)</span>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Thẩm quyền chính thức
                        </span>
                      </div>

                      <div className="space-y-3">
                        {!selectedReadyForResolution && selectedDisputeForDetail.complainantRole === 'STUDENT' && (
                          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs font-semibold text-amber-900">
                            Gia sư vẫn còn thời gian nộp giải trình/minh chứng đến{' '}
                            <strong>{formatExactTime(selectedDisputeForDetail.tutorResponseDeadline)}</strong>.
                            Staff phụ trách chỉ phân xử ngay khi gia sư đã phản hồi hoặc sau khi hết hạn 24 giờ; nếu gia sư không nộp minh chứng đúng hạn, hồ sơ này sẽ tự đủ điều kiện xử lý theo chứng cứ hiện có.
                          </div>
                        )}

                        {selectedReadyForResolution && !selectedSessionTutorResponse && selectedDisputeForDetail.complainantRole === 'STUDENT' && (
                          <div className="rounded-xl border border-rose-300 bg-rose-50/90 p-4 text-xs space-y-2 text-rose-950">
                            <div className="font-bold flex items-center gap-1.5 text-rose-900 text-sm">
                              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                              <span>XỬ LÝ THEO QUY ĐỊNH: GIA SƯ KHÔNG NỘP MINH CHỨNG & ĐÃ HẾT HẠN 24 GIỜ</span>
                            </div>
                            <p className="leading-relaxed">
                              Thời hạn giải trình đối chất 24 giờ đã kết thúc lúc <strong>{formatExactTime(selectedDisputeForDetail.tutorResponseDeadline)}</strong> mà gia sư không nộp bất kỳ tài liệu minh chứng nào.
                              Theo quy chế giải quyết tranh chấp hệ thống: Khiếu nại của học viên được mặc định xem là có cơ sở hợp lệ; Bạn tiến hành <strong>Chấp thuận khiếu nại (Hoàn tiền 100% cho học viên)</strong>.
                            </p>
                            <div className="pt-1">
                              <button
                                type="button"
                                onClick={() => setResolveReasonInput(`Gia sư không nộp giải trình hoặc minh chứng đối chất trong thời hạn 24 giờ quy định (hết hạn lúc ${formatExactTime(selectedDisputeForDetail.tutorResponseDeadline)}). Căn cứ quy chế hoạt động hệ thống, chấp thuận khiếu nại và hoàn trả 100% học phí cho học viên.`)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors shadow-xs"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>Điền sẵn căn cứ quy định (Hết hạn không giải trình)</span>
                              </button>
                            </div>
                          </div>
                        )}

                        {selectedSessionTutorResponse && (
                          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-xs font-semibold text-emerald-900 flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span>Đã có giải trình & {allSessionTutorEvidences.length} tài liệu đối chất của gia sư cho Buổi #{selectedDisputeForDetail.sessionId}. Sẵn sàng đối chiếu hai chiều để phân xử.</span>
                            </div>
                            <span className="text-[10px] text-emerald-800 font-bold bg-white px-2 py-0.5 rounded-md border border-emerald-200">
                              Đầy đủ 2 chiều
                            </span>
                          </div>
                        )}

                        <div>
                          <label className="font-bold text-slate-700 block mb-1">
                            Nhập lý do & căn cứ phán quyết <span className="text-red-500">*</span>
                          </label>
                          <textarea
                            rows={3}
                            value={resolveReasonInput}
                            onChange={(e) => setResolveReasonInput(e.target.value)}
                            placeholder="Ghi rõ căn cứ phân xử (ví dụ: Học viên cung cấp đủ video không có gia sư vào lớp, hoặc Gia sư đã chứng minh hoàn thành đủ buổi học...)"
                            className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs focus:outline-none focus:border-indigo-600 bg-white"
                            required
                          />
                        </div>

                        {selectedSessionDisputes.filter((d) => d.status === 'OPEN').length > 1 && (
                          <label className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                            <input
                              type="checkbox"
                              checked={applyVerdictToAllSessionDisputes}
                              onChange={(e) => setApplyVerdictToAllSessionDisputes(e.target.checked)}
                              className="mt-0.5 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                            />
                            <div className="text-xs">
                              <span className="font-bold text-slate-900 block">
                                Áp dụng phán quyết này cho toàn bộ {selectedSessionDisputes.filter((d) => d.status === 'OPEN').length} đơn đang chờ xử lý trong Buổi #{selectedDisputeForDetail.sessionId}
                              </span>
                              <span className="text-[11px] text-slate-500 leading-relaxed block mt-0.5">
                                Dựa trên cùng bộ minh chứng đối chất của buổi học, hệ thống sẽ tự động gửi lệnh phán quyết on-chain cho tất cả học viên đang khiếu nại buổi này mà không cần bấm từng đơn.
                              </span>
                            </div>
                          </label>
                        )}

                        <div className="flex items-center justify-end gap-3 pt-2">
                          <button
                            type="button"
                            disabled={resolvingId === selectedDisputeForDetail.id || !resolveReasonInput.trim() || !selectedReadyForResolution}
                            onClick={() => handleResolve(selectedDisputeForDetail, false, resolveReasonInput.trim())}
                            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl shadow-sm transition-all disabled:opacity-50"
                          >
                            {resolvingId === selectedDisputeForDetail.id
                              ? 'Đang gửi tx...'
                              : applyVerdictToAllSessionDisputes && selectedSessionDisputes.filter((d) => d.status === 'OPEN').length > 1
                              ? `Bác bỏ tất cả ${selectedSessionDisputes.filter((d) => d.status === 'OPEN').length} đơn (Giải ngân cho Gia sư)`
                              : 'Bác bỏ (Giải ngân 85% cho Gia sư)'}
                          </button>

                          <button
                            type="button"
                            disabled={resolvingId === selectedDisputeForDetail.id || !resolveReasonInput.trim() || !selectedReadyForResolution}
                            onClick={() => handleResolve(selectedDisputeForDetail, true, resolveReasonInput.trim())}
                            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-md transition-all disabled:opacity-50"
                          >
                            {resolvingId === selectedDisputeForDetail.id
                              ? 'Đang gửi tx...'
                              : applyVerdictToAllSessionDisputes && selectedSessionDisputes.filter((d) => d.status === 'OPEN').length > 1
                              ? `Chấp thuận tất cả ${selectedSessionDisputes.filter((d) => d.status === 'OPEN').length} đơn (Hoàn tiền học viên)`
                              : 'Chấp thuận (Hoàn tiền 100% cho Học viên)'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Staff but not the reviewer of this classroom */
                    <div className="p-4 bg-slate-100 rounded-2xl border border-slate-200 text-slate-700 text-xs flex items-start gap-3">
                      <Lock className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-slate-900">Bạn đang ở chế độ xem tham khảo (Không phụ trách lớp này)</div>
                        <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                          Lớp học này do nhân viên <strong>{getUserDisplayName(selectedDisputeForDetail.classroomReviewerEmail, users).fullName}</strong> ({selectedDisputeForDetail.classroomReviewerEmail || 'Chưa gán'}) duyệt.
                          Theo quy chế giải quyết tranh chấp hệ thống, chỉ nhân viên duyệt lớp này hoặc Quản trị viên (Admin) mới có quyền ra phán quyết on-chain.
                        </p>
                      </div>
                    </div>
                  )
                ) : activeRole === 'admin' ? (
                  adminOverrideMode ? (
                    /* Admin with override mode ON */
                    <div className="p-5 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl border border-indigo-200 space-y-4 shadow-sm">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 font-display font-black text-indigo-950 text-sm">
                          <Scale className="w-5 h-5 text-indigo-600" />
                          <span>HỘI ĐỒNG PHÂN XỬ: ADMIN TRỰC TIẾP CAN THIỆP XỬ LÝ THAY</span>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-600 text-white shadow-xs">
                          👑 Admin Override Kích Hoạt
                        </span>
                      </div>

                      <div className="space-y-3">
                        {!selectedReadyForResolution && selectedDisputeForDetail.complainantRole === 'STUDENT' && (
                          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs font-semibold text-amber-900">
                            Gia sư vẫn còn thời gian nộp giải trình/minh chứng đến{' '}
                            <strong>{formatExactTime(selectedDisputeForDetail.tutorResponseDeadline)}</strong>.
                            Admin có thể chờ gia sư đối chất hoặc xử lý ngay nếu có đủ căn cứ khẩn cấp.
                          </div>
                        )}

                        {selectedReadyForResolution && !selectedSessionTutorResponse && selectedDisputeForDetail.complainantRole === 'STUDENT' && (
                          <div className="rounded-xl border border-rose-300 bg-rose-50/90 p-4 text-xs space-y-2 text-rose-950">
                            <div className="font-bold flex items-center gap-1.5 text-rose-900 text-sm">
                              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                              <span>XỬ LÝ THEO QUY ĐỊNH: GIA SƯ KHÔNG NỘP MINH CHỨNG & ĐÃ HẾT HẠN 24 GIỜ</span>
                            </div>
                            <p className="leading-relaxed">
                              Thời hạn giải trình đối chất 24 giờ đã kết thúc lúc <strong>{formatExactTime(selectedDisputeForDetail.tutorResponseDeadline)}</strong> mà gia sư không nộp bất kỳ tài liệu minh chứng nào.
                              Theo quy chế: Khiếu nại của học viên mặc định có cơ sở hợp lệ; Admin tiến hành <strong>Chấp thuận khiếu nại (Hoàn tiền 100% cho học viên)</strong>.
                            </p>
                            <div className="pt-1">
                              <button
                                type="button"
                                onClick={() => setResolveReasonInput(`Quản trị viên can thiệp xử lý: Gia sư không nộp giải trình hoặc minh chứng đối chất trong thời hạn 24 giờ quy định (hết hạn lúc ${formatExactTime(selectedDisputeForDetail.tutorResponseDeadline)}). Căn cứ quy chế hoạt động hệ thống, chấp thuận khiếu nại và hoàn trả 100% học phí cho học viên.`)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors shadow-xs"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>Điền sẵn căn cứ quy định (Admin giải quyết)</span>
                              </button>
                            </div>
                          </div>
                        )}

                        {selectedSessionTutorResponse && (
                          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-xs font-semibold text-emerald-900 flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span>Đã có giải trình & {allSessionTutorEvidences.length} tài liệu đối chất của gia sư cho Buổi #{selectedDisputeForDetail.sessionId}. Sẵn sàng đối chiếu hai chiều để phân xử.</span>
                            </div>
                            <span className="text-[10px] text-emerald-800 font-bold bg-white px-2 py-0.5 rounded-md border border-emerald-200">
                              Đầy đủ 2 chiều
                            </span>
                          </div>
                        )}

                        <div>
                          <label className="font-bold text-slate-700 block mb-1">
                            Nhập lý do & căn cứ phán quyết của Quản trị viên <span className="text-red-500">*</span>
                          </label>
                          <textarea
                            rows={3}
                            value={resolveReasonInput}
                            onChange={(e) => setResolveReasonInput(e.target.value)}
                            placeholder="Ghi rõ lý do Admin trực tiếp can thiệp phân xử..."
                            className="w-full px-3.5 py-2.5 border border-indigo-200 rounded-xl text-xs focus:outline-none focus:border-indigo-600 bg-white"
                            required
                          />
                        </div>

                        {selectedSessionDisputes.filter((d) => d.status === 'OPEN').length > 1 && (
                          <label className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-indigo-100 cursor-pointer hover:bg-indigo-50/50 transition-colors">
                            <input
                              type="checkbox"
                              checked={applyVerdictToAllSessionDisputes}
                              onChange={(e) => setApplyVerdictToAllSessionDisputes(e.target.checked)}
                              className="mt-0.5 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                            />
                            <div className="text-xs">
                              <span className="font-bold text-slate-900 block">
                                Áp dụng phán quyết này cho toàn bộ {selectedSessionDisputes.filter((d) => d.status === 'OPEN').length} đơn đang chờ xử lý trong Buổi #{selectedDisputeForDetail.sessionId}
                              </span>
                              <span className="text-[11px] text-slate-500 leading-relaxed block mt-0.5">
                                Hệ thống sẽ tự động gửi lệnh phán quyết on-chain với tư cách Quản Trị Viên cho tất cả học viên trong buổi học này.
                              </span>
                            </div>
                          </label>
                        )}

                        <div className="flex items-center justify-end gap-3 pt-2">
                          <button
                            type="button"
                            disabled={resolvingId === selectedDisputeForDetail.id || !resolveReasonInput.trim() || !selectedReadyForResolution}
                            onClick={() => handleResolve(selectedDisputeForDetail, false, resolveReasonInput.trim())}
                            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl shadow-sm transition-all disabled:opacity-50"
                          >
                            {resolvingId === selectedDisputeForDetail.id
                              ? 'Đang gửi tx...'
                              : applyVerdictToAllSessionDisputes && selectedSessionDisputes.filter((d) => d.status === 'OPEN').length > 1
                              ? `Admin Bác bỏ tất cả ${selectedSessionDisputes.filter((d) => d.status === 'OPEN').length} đơn (Giải ngân cho Gia sư)`
                              : 'Admin Bác bỏ (Giải ngân 85% cho Gia sư)'}
                          </button>

                          <button
                            type="button"
                            disabled={resolvingId === selectedDisputeForDetail.id || !resolveReasonInput.trim() || !selectedReadyForResolution}
                            onClick={() => handleResolve(selectedDisputeForDetail, true, resolveReasonInput.trim())}
                            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-md transition-all disabled:opacity-50"
                          >
                            {resolvingId === selectedDisputeForDetail.id
                              ? 'Đang gửi tx...'
                              : applyVerdictToAllSessionDisputes && selectedSessionDisputes.filter((d) => d.status === 'OPEN').length > 1
                              ? `Admin Chấp thuận tất cả ${selectedSessionDisputes.filter((d) => d.status === 'OPEN').length} đơn (Hoàn tiền học viên)`
                              : 'Admin Chấp thuận (Hoàn tiền 100% cho Học viên)'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Admin in Observation Mode */
                    <div className="p-4 bg-indigo-50/60 rounded-2xl border border-indigo-200 text-indigo-950 text-xs flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2.5">
                        <Eye className="w-5 h-5 text-indigo-600 shrink-0" />
                        <div>
                          <div className="font-bold">Quản trị viên đang ở chế độ Giám Sát & Theo Dõi Tiến Độ</div>
                          <p className="text-[11px] text-indigo-700 mt-0.5 leading-relaxed">
                            Đơn khiếu nại đang do Staff phụ trách ({selectedDisputeForDetail.classroomReviewerEmail || 'Chưa phân công'}) thụ lý. Bạn có thể quan sát tiến độ hoặc nhấn nút bên cạnh để trực tiếp can thiệp giải quyết.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAdminOverrideMode(true)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors shadow-xs"
                      >
                        Bật Can Thiệp Phân Xử Ngay
                      </button>
                    </div>
                  )
                ) : null
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end shrink-0">
              <button
                type="button"
                onClick={() => setSelectedDisputeForDetail(null)}
                className="px-5 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Dispute Modal for Student or Tutor */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="bg-gradient-to-r from-rose-600 to-red-700 px-6 py-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-md">
                  <AlertTriangle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-display font-black text-lg text-white">Gửi Khiếu Nại Buổi Học</h3>
                  <p className="text-xs text-rose-100 font-semibold">Khung giờ giải quyết khiếu nại trong vòng 24h</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-xl"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateDispute} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Buổi học cần khiếu nại</label>
                <select
                  value={`${agreementIdInput}:${sessionIdInput}`}
                  onChange={(event) => {
                    const option = eligibleSessions.find((item) => item.key === event.target.value);
                    if (option) {
                      setAgreementIdInput(option.agreementId);
                      setSessionIdInput(String(option.sessionId));
                    }
                  }}
                  disabled={eligibleSessionsLoading || eligibleSessions.length === 0}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-rose-500 disabled:bg-slate-100 disabled:text-slate-400"
                  required
                >
                  {eligibleSessions.length === 0 && (
                    <option value=":1">
                      {eligibleSessionsLoading ? 'Đang tải buổi học...' : 'Không có buổi BOTH_PRESENT nào còn hạn khiếu nại'}
                    </option>
                  )}
                  {eligibleSessions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.className}
                      {activeRole === 'tutor' && option.studentName ? ` — Học viên: ${option.studentName}` : ''}
                      {' '}— Buổi #{option.sessionId} — hạn {new Date(option.disputeDeadline).toLocaleString('vi-VN')}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Chỉ có thể gửi trong hạn 24 giờ và trước khi giải ngân. Smart Contract V1 hỗ trợ đóng băng/phân xử on-chain cho buổi `BOTH_PRESENT`.
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Lý do khiếu nại chi tiết</label>
                <textarea
                  rows={3}
                  value={reasonInput}
                  onChange={(e) => setReasonInput(e.target.value)}
                  placeholder={activeRole === 'tutor'
                    ? 'Mô tả sự việc liên quan đến học viên trong buổi học để Staff/Admin xem xét...'
                    : 'Mô tả cụ thể sự việc (ví dụ: gia sư không dạy hoặc nội dung điểm danh không đúng...)'}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-rose-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Tải file minh chứng (không bắt buộc)</label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,audio/*,application/pdf,text/plain,.doc,.docx,.xls,.xlsx"
                  onChange={(event) => setEvidenceFile(event.target.files?.[0] || null)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-rose-50 file:px-3 file:py-1.5 file:font-bold file:text-rose-700"
                />
                <p className="text-[11px] text-slate-400 mt-1">Ảnh, video, âm thanh, PDF, TXT, Word hoặc Excel; tối đa 50 MB.</p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Hoặc đường dẫn bằng chứng</label>
                <input
                  type="text"
                  value={evidenceTextInput}
                  onChange={(e) => setEvidenceTextInput(e.target.value)}
                  disabled={!!evidenceFile}
                  placeholder="Link Google Drive, hình ảnh hoặc file log..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-rose-500 disabled:bg-slate-100"
                />
              </div>

              <div className="bg-rose-50 border border-rose-200/80 rounded-xl p-3 text-[11px] text-rose-800">
                <Info className="w-4 h-4 text-rose-600 inline mr-1" />
                Khiếu nại sẽ được ghi mã băm bảo mật SHA-256 lên Smart Contract Escrow để đảm bảo không ai có thể can thiệp làm sai lệch dữ liệu bằng chứng.
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || eligibleSessionsLoading || eligibleSessions.length === 0}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-display font-black text-xs rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isSubmitting ? 'Đang gửi...' : 'Xác nhận mở khiếu nại'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tutor Evidence Modal */}
      {isTutorModalOpen && selectedDisputeForTutor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="bg-gradient-to-r from-indigo-700 to-blue-800 px-6 py-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-md">
                  <Upload className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-display font-black text-lg text-white">
                    Giải Trình & Minh Chứng Đối Chất
                  </h3>
                  <p className="text-xs text-indigo-100 font-semibold">
                    {selectedDisputeForTutor.className || `Lớp học #${selectedDisputeForTutor.classroomId}`} • Buổi học #{selectedDisputeForTutor.sessionId}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsTutorModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-xl"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitTutorEvidence} className="p-6 space-y-4">
              <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-950">
                <div className="font-black flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-700" />
                  <span>Minh chứng theo cùng lớp/buổi</span>
                </div>
                <p className="mt-1 leading-relaxed">
                  Lần nộp này sẽ áp dụng cho <strong>{selectedTutorSessionDisputes.length || 1} đơn khiếu nại</strong> còn hạn phản hồi trong cùng lớp và buổi học. Nếu học viên khác gửi sau đó, gia sư có thể dùng lại nội dung/minh chứng đã nộp hoặc gửi bổ sung nếu cần.
                </p>
                {selectedTutorSessionDisputes.length > 1 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selectedTutorSessionDisputes.map((item) => (
                      <span key={item.id} className="rounded-lg bg-white px-2 py-1 text-[11px] font-bold text-indigo-800 border border-indigo-100">
                        {item.studentName || item.studentEmail || `Học viên #${item.complainantId}`}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {selectedTutorSessionDisputes.length > 1 ? (
                <div className="p-3.5 bg-rose-50 border border-rose-200/80 rounded-xl text-xs space-y-2.5">
                  <div className="font-bold text-rose-900 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span>Nội dung khiếu nại từ {selectedTutorSessionDisputes.length} học viên trong Buổi #{selectedDisputeForTutor.sessionId}:</span>
                  </div>
                  <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                    {selectedTutorSessionDisputes.map((item, idx) => (
                      <div key={item.id} className="p-2.5 rounded-lg bg-white border border-rose-100 text-slate-800 space-y-1">
                        <div className="font-bold text-rose-950 flex items-center justify-between">
                          <span>Học viên #{idx + 1}: {item.studentName || item.studentEmail || `ID #${item.complainantId}`}</span>
                          <span className="text-[10px] text-slate-500 font-normal">{formatExactTime(item.createdAt)}</span>
                        </div>
                        <p className="text-[11px] text-slate-700 whitespace-pre-wrap italic">
                          "{item.reason || 'Không có lý do chi tiết'}"
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-3.5 bg-rose-50 border border-rose-200/80 rounded-xl text-xs space-y-1">
                  <div className="font-bold text-rose-900 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span>Nội dung học viên khiếu nại:</span>
                  </div>
                  <p className="text-slate-700 pl-5 whitespace-pre-wrap">
                    {selectedDisputeForTutor.reason || 'Học viên phản ánh sai lệch điểm danh của buổi học.'}
                  </p>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Lời giải trình của gia sư <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={4}
                  value={tutorResponseText}
                  onChange={(e) => setTutorResponseText(e.target.value)}
                  placeholder="Mô tả cụ thể buổi học (ví dụ: tôi đã vào lớp từ 19:00 đến 20:30, học viên vào muộn 30 phút, nội dung giảng dạy đã hoàn tất đầy đủ theo giáo án...)"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Tải file minh chứng đối chất
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,audio/*,application/pdf,text/plain,.doc,.docx,.xls,.xlsx"
                  onChange={(event) => setTutorEvidenceFile(event.target.files?.[0] || null)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:font-bold file:text-indigo-700"
                />
                <p className="text-[11px] text-slate-400 mt-1">Ảnh, video, âm thanh, PDF, TXT, Word hoặc Excel; tối đa 50 MB.</p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Hoặc đường dẫn tài liệu / ảnh chụp / video đối chất
                </label>
                <input
                  type="text"
                  value={tutorEvidenceUrl}
                  onChange={(e) => setTutorEvidenceUrl(e.target.value)}
                  disabled={!!tutorEvidenceFile}
                  placeholder="Link Google Drive, ảnh chụp màn hình điểm danh, video record..."
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 disabled:bg-slate-100"
                />
              </div>

              <div className="bg-indigo-50 border border-indigo-200/80 rounded-xl p-3 text-[11px] text-indigo-900 flex items-start gap-2">
                <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <span>
                  Thông tin giải trình sẽ được gửi trực tiếp đến nhân viên vận hành (Staff phụ trách duyệt lớp) và Admin để xem xét trước khi đưa ra quyết định phân xử on-chain.
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsTutorModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isTutorSubmitting}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-display font-black text-xs rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isTutorSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isTutorSubmitting ? 'Đang gửi...' : 'Nộp Giải Trình Đối Chất'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default DisputeManagementPanel;
