import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ShieldAlert,
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
  ShieldCheck,
  GraduationCap
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
  className: string;
  studentName?: string;
  sessionId: number;
  disputeDeadline: string;
}

const DISPUTE_STATUS_META: Record<string, { label: string; className: string }> = {
  FAILED_RETRYABLE: { label: 'CẦN KIỂM TRA LẠI - TIỀN VẪN ĐƯỢC GIỮ', className: 'bg-orange-100 text-orange-800 border border-orange-200' },
  OPENING: { label: 'ĐANG XÁC NHẬN MỞ KHIẾU NẠI', className: 'bg-blue-100 text-blue-800 border border-blue-200' },
  OPEN: { label: 'ĐANG MỞ KHIẾU NẠI', className: 'bg-amber-100 text-amber-800 border border-amber-200' },
  RESOLUTION_PENDING: { label: 'ĐANG XÁC NHẬN PHÁN QUYẾT', className: 'bg-indigo-100 text-indigo-800 border border-indigo-200' },
  APPROVED: { label: 'CHẤP THUẬN - HOÀN TIỀN HỌC VIÊN', className: 'bg-emerald-100 text-emerald-800 border border-emerald-200' },
  REJECTED: { label: 'BÁC BỎ - TRẢ TIỀN GIA SƯ', className: 'bg-rose-100 text-rose-800 border border-rose-200' },
};

export function DisputeManagementPanel({
  activeRole,
  userEmail = '',
}: DisputeManagementPanelProps) {
  const activeChainId = DEFAULT_CHAIN_ID;

  // Real data
  const [disputes, setDisputes] = useState<DisputeDto[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState('');
  const [historyStatus, setHistoryStatus] = useState('ALL');
  const [historyOrigin, setHistoryOrigin] = useState('ALL');
  const [historyPage, setHistoryPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

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
  }, [activeRole]);

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
            className: agreement.className || `Lớp học #${agreement.classroomId}`,
            studentName: agreement.studentName,
            sessionId: settlement.sessionId,
            disputeDeadline: settlement.disputeDeadline as string,
          }))
      );
      setEligibleSessions(options);
      if (options.length > 0) {
        setAgreementIdInput(options[0].agreementId);
        setSessionIdInput(String(options[0].sessionId));
      }
    } catch (err: any) {
      setActionError(err?.message || 'Không thể tải các buổi còn hạn khiếu nại.');
      setEligibleSessions([]);
    } finally {
      setEligibleSessionsLoading(false);
    }
  }, [activeRole]);

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
      setActionError('Vui lòng nhập nội dung giải trình.');
      return;
    }

    try {
      setIsTutorSubmitting(true);
      setActionError(null);
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

      setActionSuccess('Đã gửi giải trình và minh chứng đối chất thành công!');
      setIsTutorModalOpen(false);
      setSelectedDisputeForTutor(null);
      setTutorResponseText('');
      setTutorEvidenceUrl('');
      setTutorEvidenceFile(null);
      await fetchDisputes();
    } catch (err: any) {
      setActionError(err?.reason || err?.message || 'Không thể gửi giải trình.');
    } finally {
      setIsTutorSubmitting(false);
    }
  };

  const handleCreateDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreementIdInput || !eligibleSessions.some((item) => item.key === `${agreementIdInput}:${sessionIdInput}`)) {
      setActionError('Buổi học không còn đủ điều kiện khiếu nại. Vui lòng tải lại danh sách.');
      return;
    }
    if (!reasonInput) {
      setActionError('Vui lòng nhập lý do khiếu nại.');
      return;
    }

    try {
      setIsSubmitting(true);
      setActionError(null);
      if (evidenceFile) {
        await contractsApi.openDisputeWithFile(
          agreementIdInput.trim(),
          Number(sessionIdInput),
          reasonInput.trim(),
          evidenceFile
        );
      } else {
        await contractsApi.openDispute(agreementIdInput.trim(), Number(sessionIdInput), {
          reason: reasonInput.trim(),
          evidenceObjectKey: evidenceTextInput.trim() || undefined,
          contentType: evidenceTextInput.trim() ? 'text/uri-list' : undefined,
        });
      }

      setActionSuccess(`Đã gửi yêu cầu khiếu nại cho buổi #${sessionIdInput}. Đang chờ xác nhận blockchain.`);
      setIsCreateModalOpen(false);
      setReasonInput('');
      setEvidenceTextInput('');
      setEvidenceFile(null);
      await fetchDisputes();
      await fetchEligibleDisputeSessions();
    } catch (err: any) {
      setActionError(err?.reason || err?.message || 'Không thể tạo khiếu nại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolve = async (dispute: DisputeDto, complaintApproved: boolean) => {
    const resolutionLabel = dispute.complainantRole === 'TUTOR'
      ? (complaintApproved ? 'chấp thuận khiếu nại của gia sư' : 'bác khiếu nại của gia sư')
      : (complaintApproved ? 'chấp thuận hoàn tiền học viên' : 'bác khiếu nại của học viên');
    const reason = window.prompt(
      `Nhập lý do ${resolutionLabel}:`, ''
    );
    if (reason === null) return; // cancelled
    try {
      setResolvingId(dispute.id);
      setActionError(null);
      const result = await contractsApi.resolveDispute(dispute.id, complaintApproved, reason || 'Admin resolution');
      setActionSuccess(
        `Đã gửi yêu cầu phân xử: ${resolutionLabel}. Đang chờ xác nhận blockchain (${result.transactionStatus}).`
      );
      await fetchDisputes();
    } catch (err: any) {
      setActionError(err?.reason || err?.message || 'Lỗi khi phân xử khiếu nại.');
    } finally {
      setResolvingId(null);
    }
  };

  // Check authorization for Staff
  const canStaffResolve = (dispute: DisputeDto): boolean => {
    if (activeRole === 'admin') return true;
    if (activeRole === 'staff') {
      return (
        !!dispute.classroomReviewerEmail &&
        dispute.classroomReviewerEmail.toLowerCase() === userEmail.toLowerCase()
      );
    }
    return false;
  };

  const openManagedEvidence = async (disputeId: string, evidenceId: string) => {
    const previewWindow = window.open('', '_blank');
    if (previewWindow) previewWindow.opener = null;
    try {
      const blob = await contractsApi.getDisputeEvidenceFile(disputeId, evidenceId);
      const url = URL.createObjectURL(blob);
      if (previewWindow) previewWindow.location.href = url;
      else throw new Error('Trình duyệt đã chặn cửa sổ xem minh chứng.');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err: any) {
      previewWindow?.close();
      setActionError(err?.message || 'Không thể mở file minh chứng.');
    }
  };

  const selectedStudentEvidenceItems = selectedDisputeForTutor?.evidenceItems
    ?.filter((item) => item.submittedByRole === 'STUDENT') || [];
  const selectedStudentEvidence = selectedStudentEvidenceItems.length > 0
    ? selectedStudentEvidenceItems[selectedStudentEvidenceItems.length - 1]
    : undefined;

  const kpis = useMemo(() => {
    const total = disputes.length;
    const pending = disputes.filter(
      (d) => d.status === 'OPEN' || d.status === 'OPENING' || d.status === 'RESOLUTION_PENDING'
    ).length;
    const approved = disputes.filter((d) => d.status === 'APPROVED').length;
    const rejected = disputes.filter((d) => d.status === 'REJECTED').length;
    const tutorOriginCount = disputes.filter((d) => d.complainantRole === 'TUTOR').length;
    const studentOriginCount = disputes.filter((d) => d.complainantRole === 'STUDENT').length;
    const tutorNeedsActionCount = disputes.filter(
      (d) => d.complainantRole === 'STUDENT' && d.status === 'OPEN' && !d.tutorResponse
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

  const historyItems = useMemo(() => {
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
        dispute.tutorWallet ||
        ''
      ).toLowerCase().includes(q);

      return (
        matchId ||
        matchAgreement ||
        matchSession ||
        matchReason ||
        matchResolution ||
        matchStudent ||
        matchTutor
      );
    });
  }, [disputes, historyStatus, historyOrigin, searchQuery]);

  const historyPages = Math.max(1, Math.ceil(historyItems.length / 10));
  const currentHistoryPage = Math.min(historyPage, historyPages - 1);
  const visibleHistory = historyItems.slice(currentHistoryPage * 10, (currentHistoryPage + 1) * 10);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-500 to-red-600 flex items-center justify-center text-white shadow-md shadow-rose-500/20">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div>
            <h2 className="font-display font-black text-xl lg:text-2xl text-slate-900">
              {activeRole === 'student' || activeRole === 'tutor' ? 'Lịch sử & Theo dõi khiếu nại' : 'Quản lý & Phân xử khiếu nại'}
            </h2>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">
              {activeRole === 'tutor'
                ? 'Theo dõi khiếu nại các buổi học và gửi minh chứng đối chất cho Staff/Admin xem xét'
                : activeRole === 'student'
                ? 'Gửi và theo dõi khiếu nại minh bạch trên Smart Contract Escrow bảo vệ quyền lợi học tập'
                : 'Phân xử minh bạch trên Smart Contract Escrow bảo vệ quyền lợi đôi bên'}
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
            className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-display font-black text-xs rounded-xl shadow-md hover:shadow-lg transition-all"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Gửi Khiếu Nại Buổi Học</span>
          </button>
        )}
      </div>

      {/* Notifications */}
      {actionSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-600 hover:underline">
            Đóng
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-800 text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 text-red-600" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-red-600 hover:underline">
            Đóng
          </button>
        </div>
      )}

      {/* Metric KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            {activeRole === 'tutor' ? 'Tổng khiếu nại liên quan' : 'Tổng số khiếu nại'}
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 block">{kpis.total}</span>
            <span className="text-xs text-slate-400 font-semibold">đơn</span>
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

      {/* Modern Filter, Search & Tab Controls */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        {/* Top bar: Search + Refresh */}
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
              placeholder="Tìm theo mã hợp đồng, số buổi học, lý do khiếu nại, kết quả phân xử..."
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

        {/* Second row: Status tabs & Tutor origin segmented controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          {/* Status filter tabs */}
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

          {/* Tutor Origin Segmented Selector */}
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

        {/* Results summary counter */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100/80">
          <span>
            Hiển thị <strong>{historyItems.length === 0 ? 0 : currentHistoryPage * 10 + 1} - {Math.min((currentHistoryPage + 1) * 10, historyItems.length)}</strong> trong tổng số <strong>{historyItems.length}</strong> khiếu nại phù hợp
          </span>
          {historyPages > 1 && (
            <span>
              Trang {currentHistoryPage + 1} / {historyPages}
            </span>
          )}
        </div>
      </div>
      <div className="space-y-4">
        {dataLoading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
            <span className="text-sm font-semibold">Đang tải danh sách khiếu nại...</span>
          </div>
        )}
        {dataError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm font-semibold">
            {dataError}
          </div>
        )}
        {!dataLoading && !dataError && historyItems.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 text-slate-400">
            <ShieldAlert className="w-12 h-12 mx-auto mb-3 opacity-40 text-slate-400" />
            <p className="font-bold text-sm text-slate-600">Chưa có khiếu nại phù hợp</p>
            <p className="text-xs text-slate-400 mt-1">Đơn đã gửi sẽ được lưu tại đây, kể cả sau khi đã giải quyết. Thử chọn tất cả lịch sử để xem lại.</p>
          </div>
        ) : !dataLoading && (
          visibleHistory.map((dispute) => {
            const hasResolvePermission = canStaffResolve(dispute);
            const statusMeta = DISPUTE_STATUS_META[dispute.status] || {
              label: dispute.status,
              className: 'bg-slate-100 text-slate-700 border border-slate-200',
            };
            const effectiveStatusMeta = dispute.complainantRole === 'TUTOR' && dispute.status === 'APPROVED'
              ? { ...statusMeta, label: 'CHẤP THUẬN KHIẾU NẠI GIA SƯ' }
              : dispute.complainantRole === 'TUTOR' && dispute.status === 'REJECTED'
                ? { ...statusMeta, label: 'BÁC KHIẾU NẠI GIA SƯ' }
                : statusMeta;
            const allEvidence = dispute.evidenceItems?.length
              ? dispute.evidenceItems
              : [
                  dispute.studentEvidenceObjectKey ? {
                    id: `${dispute.id}-student-legacy`,
                    submittedByRole: 'STUDENT' as const,
                    objectKey: dispute.studentEvidenceObjectKey,
                    contentType: dispute.studentEvidenceContentType,
                    sha256: dispute.studentEvidenceSha256 || '',
                    createdAt: dispute.createdAt,
                  } : null,
                  dispute.tutorEvidenceObjectKey ? {
                    id: `${dispute.id}-tutor-legacy`,
                    submittedByRole: 'TUTOR' as const,
                    objectKey: dispute.tutorEvidenceObjectKey,
                    contentType: dispute.tutorEvidenceContentType,
                    sha256: dispute.tutorEvidenceSha256 || '',
                    createdAt: dispute.tutorRespondedAt,
                  } : null,
                ].filter((item): item is NonNullable<typeof item> => item !== null);

            const complainantEvidence = allEvidence.filter(
              (item) => item.submittedByRole === dispute.complainantRole
            );
            const tutorCounterEvidence = allEvidence.filter(
              (item) => item.submittedByRole === 'TUTOR' && dispute.complainantRole === 'STUDENT'
            );

            return (
              <div
                key={dispute.id}
                className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all p-6 space-y-5"
              >
                {/* Header Row */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider ${effectiveStatusMeta.className}`}
                    >
                      {effectiveStatusMeta.label}
                    </span>
                    {dispute.complainantRole === 'TUTOR' ? (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-purple-100 text-purple-800 border border-purple-200 flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {activeRole === 'tutor' ? 'ĐƠN TÔI ĐÃ GỬI (GIA SƯ)' : 'KHIẾU NẠI TỪ GIA SƯ'}
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {activeRole === 'student' ? 'ĐƠN KHIẾU NẠI CỦA TÔI' : 'KHIẾU NẠI TỪ HỌC VIÊN'}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Tạo lúc: {dispute.createdAt ? new Date(dispute.createdAt).toLocaleString('vi-VN') : 'N/A'}</span>
                    {dispute.disputeDeadline && (
                      <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                        Hạn: {new Date(dispute.disputeDeadline).toLocaleString('vi-VN')}
                      </span>
                    )}
                  </div>
                </div>

                {(dispute.resolutionReason || dispute.resolvedAt || dispute.status === 'APPROVED' || dispute.status === 'REJECTED' || dispute.status === 'RESOLUTION_PENDING') && (
                  <div className={`rounded-2xl p-4 text-sm space-y-2 border ${
                    dispute.status === 'APPROVED'
                      ? 'bg-emerald-50/90 border-emerald-200 text-emerald-950'
                      : dispute.status === 'REJECTED'
                      ? 'bg-rose-50/90 border-rose-200 text-rose-950'
                      : 'bg-indigo-50/90 border-indigo-200 text-indigo-950'
                  }`}>
                    <div className="flex items-start gap-2.5">
                      {dispute.status === 'APPROVED' ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      ) : dispute.status === 'REJECTED' ? (
                        <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                      ) : (
                        <Clock className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-sm">
                          {dispute.status === 'RESOLUTION_PENDING'
                            ? 'Quyết định phân xử đang chờ xác nhận on-chain'
                            : dispute.status === 'APPROVED'
                            ? dispute.complainantRole === 'TUTOR'
                              ? 'Kết quả: Chấp thuận khiếu nại của gia sư (Giải ngân cho gia sư)'
                              : 'Kết quả: Chấp thuận khiếu nại (Hoàn tiền học phí cho học viên)'
                            : dispute.complainantRole === 'TUTOR'
                            ? 'Kết quả: Bác bỏ khiếu nại của gia sư'
                            : 'Kết quả: Bác bỏ khiếu nại (Giải ngân học phí cho gia sư)'}
                        </h4>
                        <p className="whitespace-pre-wrap mt-1 text-xs leading-relaxed font-medium">
                          {dispute.resolutionReason || 'Không có ghi chú thêm về lý do phân xử.'}
                        </p>
                        <div className="flex items-center gap-3 mt-2 pt-2 border-t border-black/5 text-[11px] opacity-80 flex-wrap">
                          <span>Phân xử bởi: <strong>{dispute.resolvedByEmail || dispute.resolvedByRole || 'Staff/Admin'}</strong></span>
                          {dispute.resolvedAt && (
                            <span>Thời gian: {new Date(dispute.resolvedAt).toLocaleString('vi-VN')}</span>
                          )}
                          {dispute.status === 'RESOLUTION_PENDING' && (
                            <span className="text-indigo-700 font-bold">Tiền đang được giữ ký quỹ chờ mạng blockchain xác nhận.</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Left Col: Session & Reason */}
                  <div className="md:col-span-2 space-y-3">
                    <div>
                      <h4 className="font-bold text-slate-900 text-base">
                        {dispute.complainantRole === 'TUTOR'
                          ? 'Khiếu nại của gia sư gửi Staff/Admin'
                          : 'Khiếu nại của học viên về buổi học'}
                      </h4>
                      <p className="text-xs text-slate-400 font-semibold">
                        Hợp đồng #{dispute.agreementId?.slice(0,8)} - Buổi học #{dispute.sessionId}
                      </p>
                    </div>

                    <div className="bg-rose-50/50 border border-rose-100 rounded-2xl p-4 space-y-2">
                      <div className="flex items-center gap-1.5 text-rose-900 font-bold text-xs">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>Lý do khiếu nại:</span>
                      </div>
                      <p className="text-xs text-slate-700 font-medium pl-5 whitespace-pre-wrap">
                        {dispute.reason || 'Chưa có nội dung khiếu nại.'}
                      </p>
                      {complainantEvidence.length > 0 && (
                        <div className="pl-5 pt-1 space-y-2">
                          {complainantEvidence.map((evidence, index) => (
                            <div key={evidence.id} className="rounded-xl border border-rose-100 bg-white/80 p-2.5">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                {evidence.objectKey.startsWith('disputes/') ? (
                                  <button
                                    type="button"
                                    onClick={() => openManagedEvidence(dispute.id, evidence.id)}
                                    className="inline-flex items-center gap-1 text-rose-700 font-bold text-[11px] hover:underline"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    File minh chứng người khiếu nại #{index + 1}
                                  </button>
                                ) : (
                                  <a
                                    href={evidence.objectKey.startsWith('http')
                                      ? evidence.objectKey
                                      : `https://${evidence.objectKey}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-rose-700 font-bold text-[11px] hover:underline"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    Link minh chứng #{index + 1}
                                  </a>
                                )}
                                {evidence.createdAt && (
                                  <span className="text-[10px] text-slate-400">
                                    {new Date(evidence.createdAt).toLocaleString('vi-VN')}
                                  </span>
                                )}
                              </div>
                              {evidence.sha256 && (
                                <p className="mt-1 font-mono text-[10px] text-slate-400 break-all">
                                  SHA-256: {evidence.sha256}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {dispute.complainantRole === 'STUDENT' && dispute.tutorResponse ? (() => {
                      const fileMatch = dispute.tutorResponse.match(/\s*\[File:\s*([^\]]+)\]$/);
                      const textOnly = fileMatch ? dispute.tutorResponse.replace(fileMatch[0], '') : dispute.tutorResponse;
                      const legacyFileUrl = dispute.tutorEvidenceObjectKey || (fileMatch ? fileMatch[1] : null);
                      return (
                        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-xs space-y-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 font-bold text-slate-700">
                              <FileText className="w-4 h-4 text-indigo-600" />
                              <span>Phản hồi & Minh chứng đối chất từ gia sư:</span>
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {dispute.tutorRespondedAt
                                ? `Đã nộp ${new Date(dispute.tutorRespondedAt).toLocaleString('vi-VN')}`
                                : 'Đã nộp đối chất'}
                            </span>
                          </div>
                          <p className="text-slate-700 text-xs pl-5 leading-relaxed font-medium">{textOnly}</p>

                          {/* Managed or structured Tutor Evidence items */}
                          {tutorCounterEvidence.length > 0 && (
                            <div className="pl-5 pt-1 space-y-2">
                              {tutorCounterEvidence.map((evidence, idx) => (
                                <div key={evidence.id} className="rounded-xl border border-indigo-100 bg-white p-2.5">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    {evidence.objectKey.startsWith('disputes/') ? (
                                      <button
                                        type="button"
                                        onClick={() => openManagedEvidence(dispute.id, evidence.id)}
                                        className="inline-flex items-center gap-1 text-indigo-700 font-bold text-[11px] hover:underline"
                                      >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                        File đối chất gia sư #{idx + 1}
                                      </button>
                                    ) : (
                                      <a
                                        href={evidence.objectKey.startsWith('http') ? evidence.objectKey : `https://${evidence.objectKey}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 text-indigo-700 font-bold text-[11px] hover:underline"
                                      >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                        Link đối chất #{idx + 1}
                                      </a>
                                    )}
                                    {evidence.createdAt && (
                                      <span className="text-[10px] text-slate-400">
                                        {new Date(evidence.createdAt).toLocaleString('vi-VN')}
                                      </span>
                                    )}
                                  </div>
                                  {evidence.sha256 && (
                                    <p className="mt-1 font-mono text-[10px] text-slate-400 break-all">
                                      SHA-256: {evidence.sha256}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Fallback legacy single link if not in tutorCounterEvidence */}
                          {legacyFileUrl && tutorCounterEvidence.length === 0 && (
                            <div className="pl-5 pt-1">
                              {legacyFileUrl.startsWith('disputes/') ? (
                                <button
                                  type="button"
                                  onClick={() => openManagedEvidence(dispute.id, `${dispute.id}-tutor-legacy`)}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-slate-100 text-indigo-700 font-bold border border-indigo-200 rounded-lg text-[11px] shadow-2xs transition-all"
                                >
                                  <ExternalLink className="w-3.5 h-3.5 text-indigo-500" />
                                  <span>Xem file đối chất của gia sư</span>
                                </button>
                              ) : (
                                <a
                                  href={legacyFileUrl.startsWith('http') ? legacyFileUrl : `https://${legacyFileUrl}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-slate-100 text-indigo-700 font-bold border border-indigo-200 rounded-lg text-[11px] shadow-2xs transition-all"
                                >
                                  <ExternalLink className="w-3.5 h-3.5 text-indigo-500" />
                                  <span>Xem file tài liệu / link minh chứng của gia sư</span>
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })() : dispute.complainantRole === 'STUDENT' ? (
                      <div className="bg-amber-50/50 border border-dashed border-amber-200 rounded-2xl p-3 text-xs text-amber-800 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Chưa có phản hồi đối chất từ gia sư.</span>
                      </div>
                    ) : null}
                  </div>

                  {/* Right Col: Parties & Blockchain Audit Links */}
                  <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4 space-y-3 flex flex-col justify-between">
                    <div className="space-y-2.5 text-xs">
                      <div>
                        <span className="text-slate-400 font-semibold block text-[11px]">
                          {dispute.complainantRole === 'TUTOR' ? 'Gia sư khiếu nại:' : 'Học viên khiếu nại:'}
                        </span>
                        <span className="font-bold text-slate-800">#{dispute.complainantId}</span>
                        <div className="mt-0.5">
                          <EtherscanLink
                            address={dispute.complainantRole === 'TUTOR' ? dispute.tutorWallet : dispute.studentWallet}
                            chainId={activeChainId}
                          />
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-400 font-semibold block text-[11px]">
                          {dispute.complainantRole === 'TUTOR' ? 'Học viên liên quan:' : 'Gia sư bị khiếu nại:'}
                        </span>
                        <span className="font-bold text-slate-800">
                          {dispute.complainantRole === 'TUTOR' ? 'Ví học viên' : 'Ví gia sư'}
                        </span>
                        <div className="mt-0.5">
                          <EtherscanLink
                            address={dispute.complainantRole === 'TUTOR' ? dispute.studentWallet : dispute.tutorWallet}
                            chainId={activeChainId}
                          />
                        </div>
                      </div>

                      {dispute.classroomReviewerEmail && (
                        <div className="border-t border-slate-200/60 pt-2">
                          <span className="text-slate-400 font-semibold block text-[10px] uppercase tracking-wider">
                            Staff phụ trách lớp:
                          </span>
                          <span className="font-mono text-xs font-bold text-blue-700">
                            {dispute.classroomReviewerEmail}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Blockchain Tx Audit */}
                    <div className="border-t border-slate-200/60 pt-2.5 space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Minh chứng On-chain
                      </span>
                      {dispute.openTxHash && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 text-[11px]">Tx Mở khiếu nại:</span>
                          <EtherscanLink txHash={dispute.openTxHash} chainId={activeChainId} />
                        </div>
                      )}
                      {dispute.resolveTxHash && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 text-[11px]">Tx Phân xử:</span>
                          <EtherscanLink txHash={dispute.resolveTxHash} chainId={activeChainId} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Tutor Actions (Submit / Update Counter Evidence) */}
                {activeRole === 'tutor' && dispute.complainantRole === 'STUDENT' && dispute.status === 'OPEN' && (
                  <div className="border-t border-slate-100 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-indigo-50/50 p-4 rounded-2xl">
                    <div className="flex items-center gap-2 text-xs text-indigo-900 font-medium">
                      <Info className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span>
                        {dispute.tutorResponse
                          ? 'Bạn đã nộp giải trình đối chất. Bạn có thể cập nhật lại trước khi Staff/Admin phân xử.'
                          : 'Học viên đã mở khiếu nại cho buổi học này. Vui lòng gửi giải trình và bằng chứng để bảo vệ quyền lợi.'}
                      </span>
                    </div>

                    <button
                      onClick={() => handleOpenTutorModal(dispute)}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-display font-black text-xs rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-1.5 shrink-0"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{dispute.tutorResponse ? 'Cập Nhật Giải Trình' : 'Gửi Giải Trình & Minh Chứng'}</span>
                    </button>
                  </div>
                )}
                {/* Footer Resolution Actions (Staff / Admin only) */}
                {(activeRole === 'admin' || activeRole === 'staff') && dispute.status === 'OPEN' && (
                  <div className="border-t border-slate-100 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 p-4 rounded-2xl">
                    <div className="flex items-center gap-2 text-xs">
                      {hasResolvePermission ? (
                        <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Bạn có quyền phân xử khiếu nại này ({activeRole === 'admin' ? 'ADMIN' : 'STAFF PHỤ TRÁCH'}).</span>
                        </span>
                      ) : (
                        <span className="text-amber-700 font-bold flex items-center gap-1.5">
                          <Lock className="w-4 h-4 text-amber-600" />
                          <span>Chỉ Staff đã duyệt lớp học này hoặc Quản trị viên (ADMIN) mới có quyền phân xử.</span>
                        </span>
                      )}
                    </div>

                    {hasResolvePermission && (
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleResolve(dispute, false)}
                          disabled={resolvingId === dispute.id}
                          className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition-all disabled:opacity-50"
                        >
                          {resolvingId === dispute.id
                            ? 'Đang gửi tx...'
                            : dispute.complainantRole === 'TUTOR'
                              ? 'Bác khiếu nại (Hoàn tiền học viên)'
                              : 'Bác bỏ khiếu nại (Trả tiền gia sư)'}
                        </button>
                        <button
                          onClick={() => handleResolve(dispute, true)}
                          disabled={resolvingId === dispute.id}
                          className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md hover:shadow transition-all disabled:opacity-50"
                        >
                          {resolvingId === dispute.id
                            ? 'Đang gửi tx...'
                            : dispute.complainantRole === 'TUTOR'
                              ? 'Chấp thuận (Trả tiền gia sư)'
                              : 'Chấp thuận (Hoàn tiền học viên)'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Pagination Controls */}
      {historyPages > 1 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500">
            Trang {currentHistoryPage + 1} của {historyPages} ({historyItems.length} khiếu nại)
          </span>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              disabled={currentHistoryPage === 0}
              onClick={() => {
                setHistoryPage(currentHistoryPage - 1);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Trước</span>
            </button>

            {Array.from({ length: historyPages }, (_, i) => i).map((pageIdx) => {
              if (
                historyPages > 7 &&
                Math.abs(currentHistoryPage - pageIdx) > 2 &&
                pageIdx !== 0 &&
                pageIdx !== historyPages - 1
              ) {
                if (Math.abs(currentHistoryPage - pageIdx) === 3) {
                  return <span key={pageIdx} className="px-1 text-xs text-slate-400">...</span>;
                }
                return null;
              }
              return (
                <button
                  key={pageIdx}
                  type="button"
                  onClick={() => {
                    setHistoryPage(pageIdx);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={`w-8 h-8 rounded-xl text-xs font-extrabold transition-colors ${
                    currentHistoryPage === pageIdx
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {pageIdx + 1}
                </button>
              );
            })}

            <button
              type="button"
              disabled={currentHistoryPage + 1 >= historyPages}
              onClick={() => {
                setHistoryPage(currentHistoryPage + 1);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
            >
              <span>Sau</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
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
                  Chỉ có thể gửi trong hạn 24 giờ và trước khi giải ngân. Smart Contract V1 hiện hỗ trợ khóa/phân xử on-chain cho buổi `BOTH_PRESENT`.
                  {activeRole === 'tutor' && ' Khiếu nại của gia sư chỉ Staff/Admin được xem; học viên không thấy nội dung và minh chứng.'}
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
                    Hợp đồng #{selectedDisputeForTutor.agreementId?.slice(0, 8)} • Buổi học #{selectedDisputeForTutor.sessionId}
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
                {(selectedStudentEvidence || selectedDisputeForTutor.studentEvidenceObjectKey) && (
                  selectedStudentEvidence?.objectKey.startsWith('disputes/') ? (
                    <button
                      type="button"
                      onClick={() => openManagedEvidence(selectedDisputeForTutor.id, selectedStudentEvidence.id)}
                      className="inline-flex items-center gap-1 text-rose-700 font-bold underline pl-5"
                    >
                      <ExternalLink className="w-3 h-3" /> Xem file học viên gửi
                    </button>
                  ) : (
                    <a
                      href={(selectedStudentEvidence?.objectKey || selectedDisputeForTutor.studentEvidenceObjectKey || '').startsWith('http')
                        ? (selectedStudentEvidence?.objectKey || selectedDisputeForTutor.studentEvidenceObjectKey || '')
                        : `https://${selectedStudentEvidence?.objectKey || selectedDisputeForTutor.studentEvidenceObjectKey}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-rose-700 font-bold underline pl-5"
                    >
                      <ExternalLink className="w-3 h-3" /> Xem link học viên gửi
                    </a>
                  )
                )}
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
                <p className="text-[11px] text-slate-400 mt-1">
                  Nhập link Google Drive hoặc file lưu trữ ảnh màn hình điểm danh, video ghi hình buổi học để Staff/Admin đối chiếu.
                </p>
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
