import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
} from 'lucide-react';
import { contractsApi, AgreementSummary } from '../../api/contractsApi';
import { terminationsApi, TerminationView } from '../../api/terminationsApi';

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
  RESPOND: 'Lời nhắn bổ sung từ học viên',
  RECOMMEND: 'Staff đề xuất chấm dứt',
  APPROVE: 'Admin phê duyệt chấm dứt',
  REJECT: 'Từ chối đề xuất',
};

const statusTone = (status: string) => {
  if (status === 'COMPLETED' || status === 'APPROVED') return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (status === 'TRANSACTION_FAILED') return 'text-red-700 bg-red-50 border-red-200';
  if (status === 'REJECTED') return 'text-slate-600 bg-slate-100 border-slate-200';
  if (status === 'RECOMMENDED') return 'text-indigo-700 bg-indigo-50 border-indigo-200';
  if (['HOLD_PENDING', 'REQUESTED', 'RELEASE_PENDING', 'WAITING_SETTLEMENT', 'WAITING_PAYMENT'].includes(status))
    return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-blue-700 bg-blue-50 border-blue-200';
};

const message = (error: unknown) => (error instanceof Error ? error.message : 'Không thể xử lý yêu cầu.');

const units = (value?: string | null, decimals: number = 6) => {
  if (!value) return '0';
  const digits = String(value).padStart(decimals + 1, '0');
  return decimals ? `${digits.slice(0, -decimals)}.${digits.slice(-decimals)}` : digits;
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
}

export function TerminationPanel({ activeRole, initialAgreements }: TerminationPanelProps) {
  const [requests, setRequests] = useState<TerminationView[]>([]);
  const [agreements, setAgreements] = useState<AgreementSummary[]>(initialAgreements || []);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Staff / Admin Review action
  const [action, setAction] = useState<{ id: string; type: string } | null>(null);
  const [reviewReason, setReviewReason] = useState('');

  // Student unified supplement staging states per case
  const [stagedFilesMap, setStagedFilesMap] = useState<Record<string, File[]>>({});
  const [stagedNotesMap, setStagedNotesMap] = useState<Record<string, string>>({});
  const [submittingCaseId, setSubmittingCaseId] = useState<string | null>(null);
  const [showWorkflowGuide, setShowWorkflowGuide] = useState(false);

  const normalizedRole = (activeRole || '').toLowerCase();
  const isTutor = normalizedRole === 'tutor';
  const isStudent = normalizedRole === 'student';
  const isStaff = normalizedRole === 'staff';
  const isAdmin = normalizedRole === 'admin';
  const isManager = isAdmin || isStaff;

  const load = useCallback(async () => {
    try {
      setRequests(await terminationsApi.list());
      setError('');
    } catch (e) {
      setError(message(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void load();
    const timer = window.setInterval(load, 15000);
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
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [load]);

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

  const stats = useMemo(() => {
    const total = requests.length;
    const pending = requests.filter((r) => ['HOLD_PENDING', 'REQUESTED'].includes(r.request.status)).length;
    const recommended = requests.filter((r) => r.request.status === 'RECOMMENDED').length;
    const approved = requests.filter((r) => ['APPROVED', 'COMPLETED'].includes(r.request.status)).length;
    return { total, pending, recommended, approved };
  }, [requests]);

  // Handle Staff/Admin action review
  const handleManagerReview = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!action) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await terminationsApi.act(action.id, action.type, reviewReason);
      setAction(null);
      setReviewReason('');
      setSuccess('Đã cập nhật quyết định thành công.');
      await load();
    } catch (e) {
      setError(message(e));
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
      alert('Bạn đã đạt giới hạn tối đa 5 tệp minh chứng cho hồ sơ này.');
      return;
    }

    const validFiles: File[] = [];
    for (const f of selected) {
      if (f.size > 50 * 1024 * 1024) {
        alert(`Tệp "${f.name}" vượt quá kích thước tối đa 50 MB.`);
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
      alert('Vui lòng chọn ít nhất một tệp minh chứng hoặc nhập lời giải thích trước khi bấm gửi.');
      return;
    }

    setSubmittingCaseId(caseId);
    setError('');
    setSuccess('');

    try {
      // 1. Upload staged files sequentially
      for (const file of filesToUpload) {
        await terminationsApi.uploadEvidence(caseId, file);
      }

      // 2. Submit explanation note if entered
      if (noteText) {
        await terminationsApi.act(caseId, 'RESPOND', noteText);
      }

      setSuccess('Đã gửi bổ sung tài liệu minh chứng & lời giải thích thành công. Mốc thời gian gửi đã được lưu lại.');
      handleClearStaged(caseId);
      await load();
    } catch (e) {
      setError(message(e));
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">Tổng hồ sơ</span>
          <span className="text-2xl font-display font-black text-slate-900">{stats.total}</span>
        </div>
        <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 block">Chờ thẩm định</span>
          <span className="text-2xl font-display font-black text-amber-900">{stats.pending}</span>
        </div>
        <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 block">Đã đề xuất</span>
          <span className="text-2xl font-display font-black text-indigo-900">{stats.recommended}</span>
        </div>
        <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 block">Đã duyệt / Quyết toán</span>
          <span className="text-2xl font-display font-black text-emerald-900">{stats.approved}</span>
        </div>
      </div>

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
              <p className="text-[11px] text-slate-500 leading-snug">Staff gửi đề xuất (RECOMMEND) lên Admin hoặc Bác bỏ (REJECT - khôi phục lại lớp).</p>
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
      {error && (
        <div className="flex items-center gap-2 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold">
          <XCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
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

      {/* 2. LIST OF TERMINATION CASES */}
      {!loading && requests.length > 0 && (
        <div className="space-y-6">
          {requests.map(({ request: c, items, evidence = [] }) => {
            const anchorAgreement = agreementMap.get(c.anchorAgreementId);
            const className = anchorAgreement?.className || `Lớp #${c.classroomId}`;
            const tutorName = anchorAgreement?.tutorName || 'Chưa cập nhật gia sư';
            const studentName = anchorAgreement?.studentName || 'Chưa cập nhật học viên';

            const affectedAgreements = c.wholeClass
              ? classroomMap.get(c.classroomId) || (anchorAgreement ? [anchorAgreement] : [])
              : anchorAgreement
              ? [anchorAgreement]
              : [];

            const totalEscrowPool = affectedAgreements.reduce((sum, a) => sum + (Number(a.totalAmountUsdc) || 0), 0);
            const totalSettledUsdc = affectedAgreements.reduce((sum, a) => sum + (Number(a.releasedAmountUsdc) || 0), 0);
            const totalRemainingUsdc = Math.max(0, totalEscrowPool - totalSettledUsdc);

            const auditEntries = parseAudit(c.auditJson);
            const itemMap = new Map(items.map((i) => [i.agreementId, i]));
            const ownEvidenceCount = evidence.filter((ev) => ev.submittedByRole.toLowerCase() === normalizedRole).length;

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
                          c.wholeClass
                            ? 'bg-purple-100 text-purple-900 border-purple-200'
                            : 'bg-blue-100 text-blue-900 border-blue-200'
                        }`}
                      >
                        {c.wholeClass ? <Users className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                        {c.wholeClass ? 'Đề xuất dừng & hủy toàn bộ lớp' : 'Học viên chấm dứt đơn phương'}
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

                  <div className="self-start sm:self-auto shrink-0">
                    <span
                      className={`px-3.5 py-1.5 rounded-2xl text-xs font-black uppercase tracking-wider border inline-flex items-center gap-2 shadow-2xs ${statusTone(
                        c.status
                      )}`}
                    >
                      <span className="w-2 h-2 rounded-full bg-current animate-pulse"></span>
                      {labels[c.status] || c.status}
                    </span>
                  </div>
                </div>

                {/* ROLE-SPECIFIC NOTICE BANNER */}
                {isTutor && (
                  <div className="rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 p-4 text-xs space-y-1.5 text-amber-950 shadow-2xs">
                    <div className="flex items-center gap-2 font-black text-[13px]">
                      <Info className="w-4 h-4 text-amber-700" />
                      {c.wholeClass
                        ? 'Đề xuất dừng toàn bộ lớp học của bạn đang được xử lý'
                        : `Học viên ${studentName} đã gửi yêu cầu xin dừng học hợp đồng này`}
                    </div>
                    <p className="text-amber-800 font-medium leading-relaxed">
                      {c.wholeClass
                        ? 'Đề xuất dừng lớp của bạn đang được Staff & Admin thẩm định. Hệ thống bảo lưu các buổi bạn đã giảng dạy để quyết toán thù lao.'
                        : `Lịch học tương lai của học viên ${studentName} đã được tạm dừng. Gia sư chỉ cần theo dõi tiến trình xử lý tại đây; toàn bộ thù lao các buổi bạn đã dạy sẽ được đảm bảo quyết toán đầy đủ khi hồ sơ được duyệt.`}
                    </p>
                  </div>
                )}

                {isStudent && (
                  <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 text-xs space-y-1.5 text-blue-950 shadow-2xs">
                    <div className="flex items-center gap-2 font-black text-[13px]">
                      <Info className="w-4 h-4 text-blue-700" />
                      Yêu cầu chấm dứt của bạn đang được xem xét
                    </div>
                    <p className="text-blue-800 font-medium leading-relaxed">
                      Để Staff và Admin giải quyết nhanh chóng, bạn có thể <strong>bổ sung thêm minh chứng</strong> (giấy tờ khám bệnh, giấy công tác, tài liệu xác nhận) hoặc <strong>gửi thêm lời nhắn giải thích chi tiết</strong> ở ngay bên dưới.
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
                        : c.status === 'APPROVED'
                        ? `Admin đã duyệt. Lớp đang LOCKED, các buổi tương lai đã dừng; ${affectedAgreements.length} hợp đồng được quyết toán riêng trên Escrow trước khi lớp được hủy hoàn toàn.`
                        : 'Lớp chưa bị hủy. Hệ thống chỉ đang giữ các buổi tương lai để Admin/Staff xem xét; điểm danh và lịch sử buổi đã diễn ra vẫn được bảo toàn để quyết toán.'}
                    </p>
                  ) : (
                    <p className="mt-1.5 text-sky-900">
                      {c.status === 'COMPLETED'
                        ? 'Hợp đồng đã thanh lý xong. Enrollment của học viên đã được hủy và học viên không còn trong danh sách thành viên lớp; các học viên khác không bị ảnh hưởng.'
                        : c.status === 'APPROVED'
                        ? 'Admin đã duyệt. Chỉ học viên của hợp đồng này bị dừng các buổi sau cutoff; lịch sử điểm danh cũ được giữ để settlement, sau đó enrollment sẽ tự chuyển CANCELLED khi chain xác nhận.'
                        : 'Yêu cầu này chỉ ảnh hưởng một hợp đồng. Lớp, danh sách các học viên khác và lịch chung vẫn tiếp tục bình thường.'}
                    </p>
                  )}
                </div>

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
                          Gửi bổ sung minh chứng & lời giải thích (Lần gửi tiếp theo)
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
                        {labels[c.status] || c.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3 bg-white rounded-xl border border-emerald-200 space-y-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">Số buổi đã giảng dạy</span>
                        <span className="text-lg font-black text-slate-900 block">
                          {affectedAgreements.reduce((sum, a) => sum + a.settledSessions, 0)} buổi
                        </span>
                        <span className="text-[10px] text-emerald-600 font-semibold">Được tính đầy đủ thù lao</span>
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
                          ${totalRemainingUsdc.toFixed(2)} USDC
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">Các buổi chưa diễn ra</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* STUDENT REFUND CARD */}
                {isStudent && (
                  <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-blue-900 flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-blue-700" />
                        Dự tính số tiền cọc hoàn trả về ví MetaMask của bạn
                      </span>
                      <span className="text-[11px] font-bold text-blue-800">
                        Smart Contract Escrow
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3 bg-white rounded-xl border border-blue-200 space-y-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">Tổng tiền bạn đã cọc</span>
                        <span className="text-lg font-black text-slate-900 font-mono block">
                          ${totalEscrowPool.toFixed(2)} USDC
                        </span>
                      </div>
                      <div className="p-3 bg-white rounded-xl border border-blue-200 space-y-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">Trừ các buổi đã học</span>
                        <span className="text-lg font-black text-amber-700 font-mono block">
                          -${totalSettledUsdc.toFixed(2)} USDC
                        </span>
                      </div>
                      <div className="p-3 bg-white rounded-xl border border-emerald-300 bg-emerald-50/50 space-y-1">
                        <span className="text-[10px] font-bold text-emerald-800 uppercase block">Số tiền nhận lại vào ví</span>
                        <span className="text-lg font-black text-emerald-700 font-mono block">
                          +${totalRemainingUsdc.toFixed(2)} USDC
                        </span>
                        <span className="text-[10px] text-emerald-600 font-semibold">Hoàn sau khi các buổi trước cutoff quyết toán on-chain</span>
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
                          ? `Danh sách hợp đồng trong lớp học (${affectedAgreements.length} học viên)`
                          : 'Hợp đồng bị ảnh hưởng'}
                      </span>
                      <div className="flex items-center gap-3 text-xs font-bold text-slate-600">
                        <span>
                          Tổng cọc lớp: <strong className="text-emerald-700 font-mono">${totalEscrowPool.toFixed(2)} USDC</strong>
                        </span>
                        <span>&bull;</span>
                        <span>
                          Ước tính hoàn: <strong className="text-blue-700 font-mono">${totalRemainingUsdc.toFixed(2)} USDC</strong>
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
                                          {labels[termItem.status] || termItem.status}
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
                                          <p className="text-[10px] text-red-600 font-semibold">{termItem.lastError}</p>
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
                                setAction({ id: c.id, type: 'RECOMMEND' });
                                setReviewReason('');
                              }}
                              disabled={busy}
                            >
                              <ClipboardCheck size={16} /> Đề xuất chấm dứt lên Admin
                            </button>
                          )}
                          {['REQUESTED', 'RECOMMENDED'].includes(c.status) && (
                            <button
                              className="px-4 py-2 rounded-xl bg-white hover:bg-red-50 text-red-700 border border-red-200 text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer"
                              onClick={() => {
                                setAction({ id: c.id, type: 'REJECT' });
                                setReviewReason('');
                              }}
                              disabled={busy}
                            >
                              <X size={15} /> Từ chối đề xuất (Khôi phục lớp)
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
                                  setAction({ id: c.id, type: 'APPROVE' });
                                  setReviewReason('');
                                }}
                                disabled={busy}
                              >
                                <Check size={16} /> Phê duyệt chấm dứt & Kích hoạt Quyết toán Escrow
                              </button>
                              <button
                                className="px-4 py-2.5 rounded-xl bg-white hover:bg-red-50 text-red-700 border border-red-200 text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                onClick={() => {
                                  setAction({ id: c.id, type: 'REJECT' });
                                  setReviewReason('');
                                }}
                                disabled={busy}
                              >
                                <X size={15} /> Từ chối yêu cầu (Khôi phục lớp)
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

                        {action.type === 'APPROVE' && (
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
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
