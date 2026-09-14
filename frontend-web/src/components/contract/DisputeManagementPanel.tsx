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
  Send,
  MessageSquare,
  Sparkles,
  ArrowRight,
  Building2,
  Check
} from 'lucide-react';
import { EtherscanLink } from '../common/EtherscanLink';
import { DEFAULT_CHAIN_ID } from '../../web3/web3Config';
import { contractsApi, DisputeDto } from '../../api/contractsApi';
import { Loader2 } from 'lucide-react';

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
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState('');
  const [historyStatus, setHistoryStatus] = useState('ALL');
  const [historyOrigin, setHistoryOrigin] = useState('ALL');
  const [historyPage, setHistoryPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  // Dispute Detail Modal state
  const [selectedDisputeForDetail, setSelectedDisputeForDetail] = useState<DisputeDto | null>(null);

  const fetchDisputes = useCallback(async () => {
    setDataLoading(true);
    setDataError('');
    try {
      const first = await contractsApi.listDisputes({ page: 0, size: 100 });
      const items = [...(first?.content ?? [])];
      for (let page = 1; page < (first?.totalPages ?? 1); page++) {
        const next = await contractsApi.listDisputes({ page, size: 100 });
        items.push(...(next.content ?? []));
      }
      setDisputes(items);
    } catch (err: any) {
      setDataError(err?.message || 'Không thể tải danh sách khiếu nại.');
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDisputes();
    const timer = window.setInterval(fetchDisputes, 15000);
    return () => window.clearInterval(timer);
  }, [fetchDisputes]);

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
  const [tutorResponseText, setTutorResponseText] = useState('');
  const [tutorEvidenceUrl, setTutorEvidenceUrl] = useState('');
  const [tutorEvidenceFile, setTutorEvidenceFile] = useState<File | null>(null);
  const [isTutorSubmitting, setIsTutorSubmitting] = useState(false);

  const fetchEligibleDisputeSessions = useCallback(async () => {
    if (activeRole !== 'student' && activeRole !== 'tutor') return;
    setEligibleSessionsLoading(true);
    try {
      const agreementPage = await contractsApi.listAgreements({ page: 0, size: 100 });
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
          && (requestedClassroomId == null || option.classroomId === requestedClassroomId));
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
      setEligibleSessionsLoading(false);
    }
  }, [activeRole, requestedSessionId, requestedClassroomId]);

  useEffect(() => {
    fetchEligibleDisputeSessions();
  }, [fetchEligibleDisputeSessions]);

  const handleOpenTutorModal = (dispute: DisputeDto) => {
    setSelectedDisputeForTutor(dispute);
    setTutorEvidenceFile(null);
    const rawResponse = dispute.tutorResponse || '';
    const fileMatch = rawResponse.match(/\s*\[File:\s*([^\]]+)\]$/);
    if (fileMatch) {
      setTutorResponseText(rawResponse.replace(fileMatch[0], ''));
      setTutorEvidenceUrl(dispute.tutorEvidenceObjectKey || fileMatch[1]);
    } else {
      setTutorResponseText(rawResponse);
      setTutorEvidenceUrl(dispute.tutorEvidenceObjectKey || '');
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
      if (tutorEvidenceFile) {
        await contractsApi.submitTutorDisputeEvidenceFile(
          selectedDisputeForTutor.id,
          tutorResponseText.trim(),
          tutorEvidenceFile
        );
      } else {
        await contractsApi.submitTutorDisputeEvidence(selectedDisputeForTutor.id, {
          responseText: tutorResponseText.trim(),
          evidenceFileUrl: tutorEvidenceUrl.trim() || undefined,
        });
      }

      setActionSuccess('Đã gửi phản hồi giải trình & bằng chứng đối chất thành công!');
      setIsTutorModalOpen(false);
      setSelectedDisputeForTutor(null);
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

      setActionSuccess(`Đã mở khiếu nại thành công cho Buổi học #${sessionIdInput}! Tiền ký quỹ của buổi học này đã được đóng băng.`);
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

  const handleResolve = async (dispute: DisputeDto, approved: boolean, customReason?: string) => {
    const reason = customReason ?? window.prompt(
      approved
        ? 'Nhập lý do CHẤP THUẬN khiếu nại (100% học phí buổi học sẽ được hoàn trả lại cho học viên):'
        : 'Nhập lý do BÁC BỎ khiếu nại (Học phí buổi học sẽ được giải ngân theo hợp đồng cho gia sư):',
      approved ? 'Xác nhận gia sư có sai lệch giờ dạy/vắng mặt. Hoàn trả học phí.' : 'Gia sư đã cung cấp đủ minh chứng giảng dạy hợp lệ.'
    );

    if (reason === null) return;
    if (!reason.trim()) {
      alert('Vui lòng nhập lý do phân xử để đảm bảo tính minh bạch trên hệ thống.');
      return;
    }

    setResolvingId(dispute.id);
    setActionError(null);
    setActionSuccess(null);

    try {
      await contractsApi.resolveDispute(dispute.id, approved, reason.trim());
      setActionSuccess(`Đã phân xử thành công khiếu nại Buổi #${dispute.sessionId}: ${approved ? 'CHẤP THUẬN (Hoàn tiền học viên)' : 'BÁC BỎ (Giải ngân gia sư)'}`);
      if (selectedDisputeForDetail?.id === dispute.id) {
        setSelectedDisputeForDetail(null);
      }
      await fetchDisputes();
    } catch (err: any) {
      setActionError(err?.message || 'Không thể thực hiện phân xử. Vui lòng kiểm tra quyền hạn của Staff/Admin.');
    } finally {
      setResolvingId(null);
    }
  };

  const canStaffResolve = useCallback((dispute: DisputeDto) => {
    if (activeRole === 'admin') return true;
    if (activeRole !== 'staff') return false;
    if (!dispute.classroomReviewerEmail || !userEmail) return true;
    return dispute.classroomReviewerEmail.trim().toLowerCase() === userEmail.trim().toLowerCase();
  }, [activeRole, userEmail]);

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

  const kpis = useMemo(() => {
    const total = disputes.length;
    const pending = disputes.filter((d) => d.status === 'OPEN' || d.status === 'OPENING' || d.status === 'FAILED_RETRYABLE' || d.status === 'RESOLUTION_PENDING').length;
    const approved = disputes.filter((d) => d.status === 'APPROVED').length;
    const rejected = disputes.filter((d) => d.status === 'REJECTED').length;
    const tutorOriginCount = disputes.filter((d) => d.complainantRole === 'TUTOR').length;
    const studentOriginCount = disputes.filter((d) => d.complainantRole === 'STUDENT').length;
    const tutorNeedsActionCount = disputes.filter((d) =>
      d.complainantRole === 'STUDENT' && d.status === 'OPEN' && !d.tutorResponse
    ).length;

    return {
      total,
      pending,
      approved,
      rejected,
      tutorOriginCount,
      studentOriginCount,
      tutorNeedsActionCount,
    };
  }, [disputes]);

  const filteredDisputes = useMemo(() => {
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
  }, [disputes, historyStatus, historyOrigin, searchQuery]);

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

    // Sort sessions in each classroom by sessionId asc
    for (const grp of groupsMap.values()) {
      grp.sessions.sort((a, b) => a.sessionId - b.sessionId);
    }

    return Array.from(groupsMap.values());
  }, [filteredDisputes]);

  const toggleClassroomExpand = (groupKey: string) => {
    setExpandedClassrooms((prev) => ({
      ...prev,
      [groupKey]: prev[groupKey] === false ? true : false,
    }));
  };

  const isClassroomExpanded = (groupKey: string) => {
    return expandedClassrooms[groupKey] !== false; // Default expanded
  };

  const historyPages = Math.max(1, Math.ceil(filteredDisputes.length / 10));
  const currentHistoryPage = Math.min(historyPage, historyPages - 1);
  const visibleFlatHistory = filteredDisputes.slice(currentHistoryPage * 10, (currentHistoryPage + 1) * 10);

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

        {(activeRole === 'student' || activeRole === 'tutor') && (
          <button
            onClick={() => {
              setActionError(null);
              setIsCreateModalOpen(true);
              fetchEligibleDisputeSessions();
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-display font-black text-xs rounded-xl shadow-md hover:shadow-lg transition-all shrink-0"
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
            Tổng số khiếu nại
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 block">{kpis.total}</span>
            <span className="text-xs text-slate-400 font-semibold">đơn ({classroomGroups.length} lớp học)</span>
          </div>
        </div>

        <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200/80 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">
            Đang chờ xem xét & phân xử
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-900 block">{kpis.pending}</span>
            <span className="text-xs text-amber-600 font-semibold">đang mở</span>
          </div>
        </div>

        <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200/80 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">
            Chấp thuận (Hoàn tiền học viên)
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-900 block">{kpis.approved}</span>
            <span className="text-xs text-emerald-600 font-semibold">đã xử lý</span>
          </div>
        </div>

        <div className="bg-rose-50/70 p-4 rounded-2xl border border-rose-200/80 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider block">
            Bác bỏ (Giải ngân gia sư)
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

          {activeRole === 'tutor' && (
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
                onClick={() => { setHistoryOrigin('TUTOR'); setHistoryPage(0); }}
                className={`px-3 py-1 rounded-xl text-xs font-extrabold transition-all ${
                  historyOrigin === 'TUTOR'
                    ? 'bg-white text-purple-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Đơn tôi gửi ({kpis.tutorOriginCount})
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
                Đơn học viên gửi ({kpis.studentOriginCount})
              </button>
            </div>
          )}
        </div>
      </div>

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

                        {/* Sub details: Tutor, Student, Staff */}
                        <div className="flex items-center gap-4 text-xs text-slate-300 font-medium mt-2 flex-wrap">
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
                          {group.classroomReviewerEmail && (
                            <span className="flex items-center gap-1.5">
                              <Building2 className="w-4 h-4 text-amber-400" />
                              Staff phụ trách: <span className="font-mono text-amber-200">{group.classroomReviewerEmail}</span>
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
                        return (
                          <div
                            key={sess.sessionId}
                            className="bg-white rounded-2xl border border-slate-200 shadow-2xs hover:border-slate-300 transition-all p-5 space-y-4"
                          >
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
                                        <span>Lý do khiếu nại của học viên:</span>
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

                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-slate-500">
                    Người gửi: <strong>{dispute.studentName || dispute.tutorName || `#${dispute.complainantId}`}</strong>
                  </span>
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

          {/* Flat pagination */}
          {historyPages > 1 && (
            <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-200">
              <span className="text-xs text-slate-500">Trang {currentHistoryPage + 1} / {historyPages}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentHistoryPage === 0}
                  onClick={() => setHistoryPage(currentHistoryPage - 1)}
                  className="px-3 py-1 rounded-lg border text-xs font-bold disabled:opacity-40"
                >
                  Trước
                </button>
                <button
                  type="button"
                  disabled={currentHistoryPage + 1 >= historyPages}
                  onClick={() => setHistoryPage(currentHistoryPage + 1)}
                  className="px-3 py-1 rounded-lg border text-xs font-bold disabled:opacity-40"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
        </div>
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
                        Staff phụ trách thẩm định: <strong className="text-indigo-900">{selectedDisputeForDetail.classroomReviewerEmail || 'Ban Quản Trị Hệ Thống'}</strong>
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
                          <div className="text-[11px] text-emerald-700 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Đã gửi lúc {formatExactTime(selectedDisputeForDetail.tutorRespondedAt)}</span>
                          </div>
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

                    {/* Tutor Evidence Files */}
                    {selectedDisputeForDetail.evidenceItems?.filter((e) => e.submittedByRole === 'TUTOR').length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-indigo-200/60">
                        <span className="font-bold text-indigo-900 block">File minh chứng bạn đã nộp:</span>
                        {selectedDisputeForDetail.evidenceItems.filter((e) => e.submittedByRole === 'TUTOR').map((ev, idx) => (
                          <div key={ev.id} className="bg-white p-2.5 rounded-xl border border-indigo-100 flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => openManagedEvidence(selectedDisputeForDetail.id, ev.id)}
                              className="inline-flex items-center gap-1.5 text-indigo-700 font-bold hover:underline"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>File đối chất #{idx + 1}</span>
                            </button>
                            {ev.sha256 && (
                              <span className="text-[10px] font-mono text-slate-400">SHA-256: {ev.sha256.slice(0, 10)}...</span>
                            )}
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

                    {/* Tutor Evidence Files */}
                    {selectedDisputeForDetail.evidenceItems?.filter((e) => e.submittedByRole === 'TUTOR').length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-indigo-200/60">
                        <span className="font-bold text-indigo-900 block">File minh chứng đối chất:</span>
                        {selectedDisputeForDetail.evidenceItems.filter((e) => e.submittedByRole === 'TUTOR').map((ev, idx) => (
                          <div key={ev.id} className="bg-white p-2.5 rounded-xl border border-indigo-100 flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => openManagedEvidence(selectedDisputeForDetail.id, ev.id)}
                              className="inline-flex items-center gap-1.5 text-indigo-700 font-bold hover:underline"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>File đối chất gia sư #{idx + 1}</span>
                            </button>
                            {ev.sha256 && (
                              <span className="text-[10px] font-mono text-slate-400">SHA-256: {ev.sha256.slice(0, 10)}...</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Resolution Verdict / Result Box */}
              {(selectedDisputeForDetail.resolutionReason || selectedDisputeForDetail.resolvedAt || selectedDisputeForDetail.status === 'APPROVED' || selectedDisputeForDetail.status === 'REJECTED') && (
                <div className={`rounded-2xl p-5 border ${
                  selectedDisputeForDetail.status === 'APPROVED'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                    : 'bg-rose-50 border-rose-200 text-rose-950'
                }`}>
                  <div className="flex items-start gap-3">
                    {selectedDisputeForDetail.status === 'APPROVED' ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-1.5 flex-1">
                      <h4 className="font-display font-black text-sm">
                        KẾT QUẢ PHÂN XỬ CHÍNH THỨC: {selectedDisputeForDetail.status === 'APPROVED' ? 'CHẤP THUẬN KHIẾU NẠI (HOÀN TIỀN HỌC VIÊN)' : 'BÁC BỎ KHIẾU NẠI (GIẢI NGÂN GIA SƯ)'}
                      </h4>
                      <p className="text-xs font-medium leading-relaxed whitespace-pre-wrap">
                        {selectedDisputeForDetail.resolutionReason || 'Không có ghi chú thêm.'}
                      </p>
                      <div className="flex items-center gap-4 pt-2 border-t border-black/10 text-[11px] opacity-80 flex-wrap">
                        <span>Phân xử bởi: <strong>{selectedDisputeForDetail.resolvedByEmail || selectedDisputeForDetail.resolvedByRole || 'Staff/Admin'}</strong></span>
                        {selectedDisputeForDetail.resolvedAt && (
                          <span>Thời gian: {new Date(selectedDisputeForDetail.resolvedAt).toLocaleString('vi-VN')}</span>
                        )}
                        {selectedDisputeForDetail.resolveTxHash && (
                          <div className="flex items-center gap-1">
                            <span>Tx Phán Quyết:</span>
                            <EtherscanLink txHash={selectedDisputeForDetail.resolveTxHash} chainId={activeChainId} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Resolution Form for Staff / Admin if open */}
              {(activeRole === 'admin' || activeRole === 'staff') && selectedDisputeForDetail.status === 'OPEN' && canStaffResolve(selectedDisputeForDetail) && (
                <div className="p-5 bg-slate-100 rounded-2xl border border-slate-200 space-y-4">
                  <div className="flex items-center gap-2 font-display font-black text-slate-900 text-sm">
                    <Scale className="w-5 h-5 text-indigo-600" />
                    <span>HỘI ĐỒNG PHÂN XỬ ON-CHAIN (STAFF / ADMIN)</span>
                  </div>

                  <div className="space-y-3">
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

                    <div className="flex items-center justify-end gap-3 pt-2">
                      <button
                        type="button"
                        disabled={resolvingId === selectedDisputeForDetail.id || !resolveReasonInput.trim()}
                        onClick={() => handleResolve(selectedDisputeForDetail, false, resolveReasonInput.trim())}
                        className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl shadow-sm transition-all disabled:opacity-50"
                      >
                        {resolvingId === selectedDisputeForDetail.id ? 'Đang gửi tx...' : 'Bác bỏ (Giải ngân 85% cho Gia sư)'}
                      </button>

                      <button
                        type="button"
                        disabled={resolvingId === selectedDisputeForDetail.id || !resolveReasonInput.trim()}
                        onClick={() => handleResolve(selectedDisputeForDetail, true, resolveReasonInput.trim())}
                        className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-md transition-all disabled:opacity-50"
                      >
                        {resolvingId === selectedDisputeForDetail.id ? 'Đang gửi tx...' : 'Chấp thuận (Hoàn tiền 100% cho Học viên)'}
                      </button>
                    </div>
                  </div>
                </div>
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
                  placeholder="Link Google Drive, S3 hình ảnh hoặc file log..."
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
              <div className="p-3.5 bg-rose-50 border border-rose-200/80 rounded-xl text-xs space-y-1">
                <div className="font-bold text-rose-900 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  <span>Nội dung học viên khiếu nại:</span>
                </div>
                <p className="text-slate-700 pl-5 whitespace-pre-wrap">
                  {selectedDisputeForTutor.reason || 'Học viên phản ánh sai lệch điểm danh của buổi học.'}
                </p>
              </div>

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
