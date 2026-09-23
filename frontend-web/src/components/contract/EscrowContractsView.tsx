import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ShieldCheck,
  Lock,
  CheckCircle2,
  AlertCircle,
  Layers,
  Filter,
  RefreshCw,
  Loader2,
  Clock,
  XCircle,
  AlertTriangle,
  Search,
  BookOpen,
  User,
  GraduationCap,
  Mail,
  Phone,
  Wallet,
  DollarSign,
  TrendingUp,
  Award,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  Users,
  FileText,
  ExternalLink,
} from 'lucide-react';
import { EtherscanLink } from '../common/EtherscanLink';
import { EscrowPaymentModal, AgreementPaymentDetails } from './EscrowPaymentModal';
import { DisputeManagementPanel } from './DisputeManagementPanel';
import { ContractAuditTimeline } from './ContractAuditTimeline';
import { ContractDocumentModal } from './ContractDocumentModal';
import { TerminationPanel } from './TerminationPanel';
import { terminationsApi, TerminationView } from '../../api/terminationsApi';
import { useWeb3Wallet } from '../../web3/useWeb3Wallet';
import { DEFAULT_CHAIN_ID } from '../../web3/web3Config';
import { contractsApi, AgreementSummary, SettlementDto } from '../../api/contractsApi';
import { classApi } from '../../api/classes';
import { signContractAgreementEip712 } from '../../web3/eip712Signer';
import { useAuth } from '../../hooks/useAuth';

interface EscrowContractsViewProps {
  activeRole: 'student' | 'tutor' | 'staff' | 'admin' | string;
  userEmail?: string;
}

// Status display mapping
const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: 'Bản nháp', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  PENDING_TUTOR_ACCEPTANCE: { label: '⏳ Chờ gia sư ký số', cls: 'bg-amber-100 text-amber-900 border-amber-200' },
  PENDING_STUDENT_ACCEPTANCE: { label: '⏳ Chờ học viên ký số', cls: 'bg-amber-100 text-amber-900 border-amber-200' },
  PREPARING_BLOCKCHAIN: { label: 'Đang ghi nhận on-chain', cls: 'bg-blue-100 text-blue-800 border-blue-200' },
  WAITING_PAYMENT: { label: '💳 Chờ học viên nạp cọc Escrow', cls: 'bg-orange-100 text-orange-900 border-orange-200' },
  PAYMENT_CONFIRMING: { label: '🔄 Đang xác nhận On-chain', cls: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  ACTIVE: { label: '🟢 Đã nạp cọc - Đang học (Chính thức vào lớp)', cls: 'bg-emerald-100 text-emerald-900 border-emerald-200 font-black' },
  COMPLETED: { label: '🏁 Khóa học hoàn tất & Quyết toán', cls: 'bg-blue-100 text-blue-900 border-blue-200' },
  EXPIRED: { label: 'Hết hạn thanh toán', cls: 'bg-red-100 text-red-800 border-red-200' },
  CANCELLED: { label: 'Đã hủy', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
};

const TERMINATION_LABELS: Record<string, string> = {
  HOLD_PENDING: 'Đang đồng bộ tạm dừng',
  RELEASE_PENDING: 'Đang khôi phục lịch học',
  REQUESTED: 'Chờ xem xét',
  RECOMMENDED: 'Đề xuất chấm dứt',
  APPROVED: 'Admin đã duyệt - đang chờ quyết toán on-chain',
  REJECTED: 'Không chấp thuận',
  COMPLETED: 'Hoàn tất',
  LEARNING_PENDING: 'Chờ dừng lịch học',
  WAITING_SETTLEMENT: 'Chờ quyết toán buổi đã học',
  WAITING_PAYMENT: 'Chờ xác nhận / hết hạn thanh toán',
  BLOCKCHAIN_PENDING: 'Chờ xác nhận giao dịch',
  TRANSACTION_FAILED: 'Giao dịch cần kiểm tra',
  WAITING_REFUND_EVENT: 'Chờ xác nhận hoàn tiền',
};

const formatDeadline = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(date);
};

const isSettlementOpen = (status: string) =>
  ['PREPARING', 'PROPOSE_PENDING', 'PROPOSED', 'FINALIZE_PENDING', 'FAILED_RETRYABLE', 'DISPUTE_OPENING', 'DISPUTED'].includes(status);

const FILTER_TABS = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'ACTIVE', label: 'Đang học (Đã nạp cọc)' },
  { value: 'WAITING_PAYMENT', label: 'Chờ nạp cọc' },
  { value: 'PENDING_SIGNATURE', label: 'Chờ ký xác nhận' },
  { value: 'TERMINATION_PENDING', label: '⚠️ Chờ xử lý chấm dứt' },
  { value: 'COMPLETED', label: 'Hoàn tất' },
  { value: 'HISTORY', label: 'Lịch sử (Quá hạn / Hủy)' },
];

export function EscrowContractsView({
  activeRole,
  userEmail = '',
}: EscrowContractsViewProps) {
  const { address, chainId, usdcBalance } = useWeb3Wallet();
  const { user } = useAuth();
  const activeChainId = chainId || DEFAULT_CHAIN_ID;

  const [activeTab, setActiveTab] = useState<'AGREEMENTS' | 'DISPUTES' | 'TIMELINE' | 'TERMINATIONS'>('AGREEMENTS');
  const [selectedAgreementForPayment, setSelectedAgreementForPayment] = useState<AgreementPaymentDetails | null>(null);
  const [selectedAgreementForTimeline, setSelectedAgreementForTimeline] = useState<AgreementSummary | null>(null);
  const [selectedAgreementForDocument, setSelectedAgreementForDocument] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [operationalFilter, setOperationalFilter] = useState<'ALL' | 'OPERATIONAL' | 'LEGACY'>('OPERATIONAL');
  const [selectedClassId, setSelectedClassId] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [viewMode, setViewMode] = useState<'BY_CLASS' | 'FLAT_CARDS'>('BY_CLASS');
  const [expandedClassKeys, setExpandedClassKeys] = useState<Set<string>>(new Set());

  // Real data state
  const [agreements, setAgreements] = useState<AgreementSummary[]>([]);
  const [terminationsList, setTerminationsList] = useState<TerminationView[]>([]);
  const [terminationSettlements, setTerminationSettlements] = useState<Record<string, SettlementDto[]>>({});
  const [classroomCache, setClassroomCache] = useState<Record<number, any>>({});
  const [requestsCache, setRequestsCache] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [totalElements, setTotalElements] = useState(0);

  const fetchAgreements = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const isTutor = activeRole === 'tutor';
      const [agreementsData, tutorClasses, terminationsData] = await Promise.all([
        contractsApi.listAgreements({
          status: (statusFilter === 'ALL' || statusFilter === 'PENDING_SIGNATURE' || statusFilter === 'HISTORY' || statusFilter === 'TERMINATION_PENDING') ? undefined : statusFilter,
          page: 0,
          size: 100,
        }),
        isTutor ? classApi.getMyClasses().catch(() => []) : Promise.resolve([]),
        terminationsApi.list().catch(() => []),
      ]);

      const content: AgreementSummary[] = agreementsData?.content ?? (Array.isArray(agreementsData) ? agreementsData : []);
      setAgreements(content);
      setTerminationsList(terminationsData || []);
      setTotalElements(agreementsData?.totalElements ?? content.length);

      // A termination cannot refund unused escrow until every session before its
      // cutoff is settled. Load those records so the contract card can say which
      // exact on-chain condition is still pending rather than a vague "waiting".
      const activeAgreementIds = new Set<string>();
      (terminationsData || []).forEach((termination) => {
        if (['COMPLETED', 'REJECTED'].includes(termination.request.status)) return;
        if (termination.request.anchorAgreementId) activeAgreementIds.add(termination.request.anchorAgreementId);
        termination.items?.forEach((item) => activeAgreementIds.add(item.agreementId));
      });
      const settlementEntries = await Promise.all([...activeAgreementIds].map(async (agreementId) => [
        agreementId,
        await contractsApi.getSettlements(agreementId).catch(() => [] as SettlementDto[]),
      ] as const));
      setTerminationSettlements(Object.fromEntries(settlementEntries));

      // Build classroom cache from myClasses
      const classMap: Record<number, any> = {};
      if (Array.isArray(tutorClasses)) {
        tutorClasses.forEach((c: any) => {
          if (c && c.id) classMap[c.id] = c;
        });
      }

      // Only query Learning when the immutable agreement snapshot does not already
      // contain enough display data. Legacy agreements can legitimately reference
      // classrooms that no longer exist, and repeatedly requesting those IDs only
      // creates noisy 404s without improving the contract view.
      const missingClassIds = Array.from(new Set(content
        .filter((agreement) => {
          const missingClassName = !agreement.className
            || agreement.className.startsWith('Lớp học #')
            || agreement.className.startsWith('Khóa học #');
          const missingTutorName = !agreement.tutorName
            || agreement.tutorName.includes('@')
            || agreement.tutorName.startsWith('Gia sư #');
          return missingClassName || missingTutorName;
        })
        .map((agreement) => agreement.classroomId)))
        .filter((id) => id && !classMap[id]);
      if (missingClassIds.length > 0) {
        await Promise.all(
          missingClassIds.map(async (classId) => {
            try {
              const c = await classApi.getPublicClassById(classId);
              if (c && c.id) classMap[c.id] = c;
            } catch (err) {
              // ignore
            }
          })
        );
      }
      setClassroomCache(classMap);

      // Fetch requests to enrich student details
      const reqMap: Record<string, any> = {};
      try {
        const myRequests = isTutor
          ? await classApi.getAllTutorRequests().catch(() => [])
          : await classApi.getMyEnrollmentRequests().catch(() => []);
        if (Array.isArray(myRequests)) {
          myRequests.forEach((r: any) => {
            if (r && r.classRoomId) {
              const key = `${r.classRoomId}_${r.studentEmail}`;
              reqMap[key] = r;
            }
          });
        }
      } catch {
        // ignore
      }
      setRequestsCache(reqMap);
    } catch (err: any) {
      setError(err?.message || 'Không thể tải danh sách hợp đồng.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchAgreements();
  }, [fetchAgreements]);

  useEffect(() => {
    const timer = window.setInterval(fetchAgreements, 30000);
    return () => window.clearInterval(timer);
  }, [fetchAgreements]);

  useEffect(() => {
    const handleContractUpdate = () => {
      fetchAgreements();
    };
    window.addEventListener('contract-state-updated', handleContractUpdate);
    return () => window.removeEventListener('contract-state-updated', handleContractUpdate);
  }, [fetchAgreements]);

  // Enriched agreements list with resolved names
  const enrichedAgreements = useMemo(() => {
    return agreements.map((a) => {
      const cls = classroomCache[a.classroomId];
      const reqKey = `${a.classroomId}_${a.studentEmail}`;
      const req = requestsCache[reqKey];

      // Resolved Class Name
      let resolvedClassName = a.className;
      if (!resolvedClassName || resolvedClassName.startsWith('Lớp học #') || resolvedClassName.startsWith('Khóa học #')) {
        if (cls?.name) {
          resolvedClassName = cls.name;
        } else {
          resolvedClassName = 'Chưa cập nhật tên lớp';
        }
      }

      // Resolved Tutor Name & Email
      let resolvedTutorEmail = a.tutorEmail || cls?.tutorEmail || '';
      let resolvedTutorName = a.tutorName;
      if (
        !resolvedTutorName ||
        resolvedTutorName.includes('@') ||
        resolvedTutorName.startsWith('Gia sư #') ||
        (resolvedTutorEmail && resolvedTutorName === resolvedTutorEmail.split('@')[0])
      ) {
        if (cls?.tutorFullName && !cls.tutorFullName.includes('@')) {
          resolvedTutorName = cls.tutorFullName;
        } else if (user?.email?.toLowerCase() === resolvedTutorEmail.toLowerCase() && user?.fullName) {
          resolvedTutorName = user.fullName;
        } else {
          resolvedTutorName = 'Chưa cập nhật tên gia sư';
        }
      }

      // Resolved Student Name & Email
      let resolvedStudentEmail = a.studentEmail || req?.studentEmail || '';
      let resolvedStudentName = a.studentName;
      if (
        !resolvedStudentName ||
        resolvedStudentName.includes('@') ||
        resolvedStudentName.startsWith('Học viên #') ||
        (resolvedStudentEmail && resolvedStudentName === resolvedStudentEmail.split('@')[0])
      ) {
        if (req?.studentName && !req.studentName.includes('@') && req.studentName.toLowerCase() !== req.studentEmail?.toLowerCase()) {
          resolvedStudentName = req.studentName;
        } else if (user?.email?.toLowerCase() === resolvedStudentEmail.toLowerCase() && user?.fullName) {
          resolvedStudentName = user.fullName;
        } else {
          resolvedStudentName = 'Chưa cập nhật tên học viên';
        }
      }

      const resolvedStudentPhone = a.studentPhone || (user?.email?.toLowerCase() === resolvedStudentEmail.toLowerCase() ? (user?.phone || user?.phoneNumber) : null) || '';
      const resolvedTutorPhone = a.tutorPhone || (user?.email?.toLowerCase() === resolvedTutorEmail.toLowerCase() ? (user?.phone || user?.phoneNumber) : null) || '';

      return {
        ...a,
        className: resolvedClassName,
        tutorName: resolvedTutorName,
        tutorEmail: resolvedTutorEmail,
        tutorPhone: resolvedTutorPhone,
        studentName: resolvedStudentName,
        studentEmail: resolvedStudentEmail,
        studentPhone: resolvedStudentPhone,
      };
    });
  }, [agreements, classroomCache, requestsCache, user, activeRole]);

  // Count of pending termination requests
  const pendingTerminationsCount = useMemo(() => {
    return terminationsList.filter((t) => !['COMPLETED', 'REJECTED'].includes(t.request.status)).length;
  }, [terminationsList]);

  // Active termination map by agreement ID
  const activeTerminationMap = useMemo(() => {
    const map = new Map<string, { status: string; wholeClass: boolean; reason: string; itemStatus?: string; transactionHash?: string | null }>();
    terminationsList.forEach((t) => {
      const isPending = !['COMPLETED', 'REJECTED'].includes(t.request.status);
      if (!isPending) return;
      const info = { status: t.request.status, wholeClass: t.request.wholeClass, reason: t.request.reason };
      const itemAgreementIds = new Set(t.items?.map((i) => i.agreementId) || []);

      if (t.request.anchorAgreementId) {
        const anchor = agreements.find((a) => a.id === t.request.anchorAgreementId);
        const isAnchorTerminal = anchor ? ['COMPLETED', 'CANCELLED', 'EXPIRED'].includes(anchor.status) : false;
        if (!isAnchorTerminal || itemAgreementIds.has(t.request.anchorAgreementId)) {
          map.set(t.request.anchorAgreementId, info);
        }
      }
      if (t.items && t.items.length > 0) {
        t.items.forEach((i) => map.set(i.agreementId, { ...info, itemStatus: i.status, transactionHash: i.transactionHash }));
      }
      if (t.request.wholeClass && t.request.classroomId) {
        agreements.forEach((a) => {
          if (a.classroomId === t.request.classroomId) {
            const isTerminal = ['COMPLETED', 'CANCELLED', 'EXPIRED'].includes(a.status);
            if (!isTerminal || itemAgreementIds.has(a.id)) {
              map.set(a.id, map.get(a.id) || info);
            }
          }
        });
      }
    });
    return map;
  }, [terminationsList, agreements]);

  // Distinct classrooms list for dropdown filter
  const distinctClasses = useMemo(() => {
    const map = new Map<number, string>();
    enrichedAgreements.forEach((a) => {
      if (a.classroomId) {
        map.set(a.classroomId, a.className || 'Chưa cập nhật tên lớp');
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [enrichedAgreements]);

  // Filtered agreements list
  const filteredAgreements = useMemo(() => {
    return enrichedAgreements.filter((a) => {
      // Filter by role/user ownership
      if (activeRole === 'tutor') {
        const matchTutor = (user?.id && a.tutorId === user.id) || (user?.email && a.tutorEmail?.toLowerCase() === user.email.toLowerCase());
        if (!matchTutor) return false;
      } else if (activeRole === 'student') {
        const matchStudent = (user?.id && a.studentId === user.id) || (user?.email && a.studentEmail?.toLowerCase() === user.email.toLowerCase());
        if (!matchStudent) return false;
      }

      // Filter by status tab
      if (statusFilter === 'TERMINATION_PENDING') {
        if (!activeTerminationMap.has(a.id)) return false;
      } else if (statusFilter === 'PENDING_SIGNATURE') {
        if (a.status !== 'PENDING_TUTOR_ACCEPTANCE' && a.status !== 'PENDING_STUDENT_ACCEPTANCE') {
          return false;
        }
      } else if (statusFilter === 'HISTORY') {
        if (a.status !== 'CANCELLED' && a.status !== 'EXPIRED') {
          return false;
        }
      } else if (statusFilter !== 'ALL' && a.status !== statusFilter) {
        return false;
      }

      if (operationalFilter === 'OPERATIONAL' && a.legacyUnreconciled) return false;
      if (operationalFilter === 'LEGACY' && !a.legacyUnreconciled) return false;

      // Filter by classroom
      if (selectedClassId !== 'ALL' && String(a.classroomId) !== selectedClassId) {
        return false;
      }
      // Filter by search query
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const classNameMatch = a.className?.toLowerCase().includes(query);
        const studentNameMatch = a.studentName?.toLowerCase().includes(query);
        const studentEmailMatch = a.studentEmail?.toLowerCase().includes(query);
        const tutorNameMatch = a.tutorName?.toLowerCase().includes(query);
        const tutorEmailMatch = a.tutorEmail?.toLowerCase().includes(query);
        const idMatch = a.id?.toLowerCase().includes(query);
        const walletMatch = a.studentWallet?.toLowerCase().includes(query) || a.tutorWallet?.toLowerCase().includes(query);

        return Boolean(
          classNameMatch ||
          studentNameMatch ||
          studentEmailMatch ||
          tutorNameMatch ||
          tutorEmailMatch ||
          idMatch ||
          walletMatch
        );
      }
      return true;
    });
  }, [enrichedAgreements, selectedClassId, searchTerm, statusFilter, operationalFilter, activeRole, user]);

  // Group filtered agreements by classroom
  const classroomGroups = useMemo(() => {
    const groupMap = new Map<string, {
      key: string;
      classroomId: number | null;
      className: string;
      tutorName?: string;
      tutorEmail?: string;
      tutorPhone?: string;
      tutorWallet?: string;
      agreements: typeof filteredAgreements;
      totalEscrowUsdc: number;
      totalSettledUsdc: number;
      totalStudents: number;
      activeCount: number;
      cancelledCount: number;
      pendingSignatureCount: number;
      waitingPaymentCount: number;
      hasTerminationPending: boolean;
    }>();

    filteredAgreements.forEach((a) => {
      const key = a.classroomId ? String(a.classroomId) : `independent_${a.id}`;
      let group = groupMap.get(key);
      if (!group) {
        group = {
          key,
          classroomId: a.classroomId || null,
          className: a.className || (a.classroomId ? `Lớp #${a.classroomId}` : 'Hợp đồng độc lập'),
          tutorName: a.tutorName,
          tutorEmail: a.tutorEmail,
          tutorPhone: a.tutorPhone,
          tutorWallet: a.tutorWallet,
          agreements: [],
          totalEscrowUsdc: 0,
          totalSettledUsdc: 0,
          totalStudents: 0,
          activeCount: 0,
          cancelledCount: 0,
          pendingSignatureCount: 0,
          waitingPaymentCount: 0,
          hasTerminationPending: false,
        };
        groupMap.set(key, group);
      }
      group.agreements.push(a);
      if (a.onchainFunded) {
        group.totalEscrowUsdc += Number(a.totalAmountUsdc) || 0;
        group.totalSettledUsdc += Number(a.releasedAmountUsdc) || 0;
      }
      group.totalStudents += 1;
      if (a.status === 'FUNDED') group.activeCount += 1;
      if (['CANCELLED', 'EXPIRED'].includes(a.status)) group.cancelledCount += 1;
      if (['PENDING_TUTOR_ACCEPTANCE', 'PENDING_STUDENT_ACCEPTANCE'].includes(a.status)) group.pendingSignatureCount += 1;
      if (a.status === 'WAITING_PAYMENT') group.waitingPaymentCount += 1;

      if (activeTerminationMap.has(a.id)) {
        group.hasTerminationPending = true;
      }
    });

    return Array.from(groupMap.values());
  }, [filteredAgreements, activeTerminationMap]);

  // Auto-expand all classes initially
  useEffect(() => {
    if (classroomGroups.length > 0 && expandedClassKeys.size === 0) {
      setExpandedClassKeys(new Set(classroomGroups.map((g) => g.key)));
    }
  }, [classroomGroups]);

  const toggleClassExpand = (key: string) => {
    setExpandedClassKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const expandAllClasses = () => {
    setExpandedClassKeys(new Set(classroomGroups.map((g) => g.key)));
  };

  const collapseAllClasses = () => {
    setExpandedClassKeys(new Set());
  };

  // Financial KPIs
  const kpis = useMemo(() => {
    const totalCount = enrichedAgreements.length;
    const activeCount = enrichedAgreements.filter((a) => a.settlementEligible).length;
    const legacyCount = enrichedAgreements.filter((a) => a.legacyUnreconciled).length;
    const verifiedAgreements = enrichedAgreements.filter((a) => a.onchainFunded);
    const totalUsdc = verifiedAgreements.reduce((sum, a) => sum + (Number(a.totalAmountUsdc) || 0), 0);
    const settledUsdc = verifiedAgreements.reduce((sum, a) => sum + (Number(a.releasedAmountUsdc) || 0), 0);

    return { totalCount, activeCount, legacyCount, totalUsdc, settledUsdc };
  }, [enrichedAgreements]);

  const handleOpenPayment = (agreement: AgreementSummary) => {
    if (agreement.status === 'EXPIRED') {
      alert("Hợp đồng này đã hết hạn thanh toán hoặc lớp học đã khóa vị trí. Bạn không thể thực hiện ký quỹ.");
      return;
    }
    if (agreement.paymentDeadline && new Date(agreement.paymentDeadline).getTime() < Date.now()) {
      alert("Hợp đồng này đã quá hạn thời gian ký quỹ. Hệ thống đã khóa quyền nạp cọc.");
      return;
    }
    setSelectedAgreementForPayment({
      agreementId: agreement.id,
      onchainAgreementId: agreement.onchainAgreementId || agreement.id,
      classTitle: agreement.className || 'Hợp đồng điện tử',
      tutorName: agreement.tutorName || 'Chưa cập nhật tên gia sư',
      tutorAddress: agreement.tutorWallet,
      studentAddress: agreement.studentWallet,
      totalSessions: agreement.totalSessions,
      pricePerSession: agreement.pricePerSessionUsdc,
      totalAmount: agreement.totalAmountUsdc,
      platformFeePercent: 15,
      status: agreement.status,
      paymentDeadline: agreement.paymentDeadline,
      chainId: agreement.chainId,
    });
  };

  const handleOpenTimeline = (agreement: AgreementSummary) => {
    setSelectedAgreementForTimeline(agreement);
    setActiveTab('TIMELINE');
  };

  const handleExpireAgreement = async (agreement: AgreementSummary) => {
    try {
      setLoading(true);
      const result = await contractsApi.expireAgreement(agreement.id);
      alert(`Expiration queued: ${result.transactionStatus}`);
      await fetchAgreements();
    } catch (err: any) {
      alert(err?.message || 'Cannot expire agreement.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelAgreement = async (agreement: AgreementSummary) => {
    const reason = window.prompt('Cancel reason:', 'Manual cancellation');
    if (reason === null) return;
    try {
      setLoading(true);
      const result = await contractsApi.cancelAgreement(agreement.id, reason);
      alert(`Cancellation queued: ${result.transactionStatus}`);
      await fetchAgreements();
    } catch (err: any) {
      alert(err?.message || 'Cannot cancel agreement.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignByTutor = async (agreement: AgreementSummary) => {
    const tutorWallet = address || agreement.tutorWallet;
    if (!tutorWallet || !tutorWallet.startsWith("0x")) {
      alert("Bạn chưa kết nối Ví MetaMask! Vui lòng kết nối ví trước khi thực hiện ký hợp đồng.");
      return;
    }

    try {
      setLoading(true);
      let tutorSignature: string | undefined = undefined;
      const agreementDetail = await contractsApi.getAgreement(agreement.id);

      try {
        tutorSignature = await signContractAgreementEip712(
          {
            id: agreement.id,
            tutorWallet: tutorWallet,
            studentWallet: agreement.studentWallet || "0x0000000000000000000000000000000000000000",
            totalAmountUsdc: agreement.totalAmountUsdc,
            termsHash: agreementDetail.termsHash,
            createdAt: agreement.createdAt,
            chainId: agreement.chainId || DEFAULT_CHAIN_ID,
            escrowContractAddress: agreement.escrowContractAddress || undefined,
          },
          tutorWallet
        );
      } catch (signErr: any) {
        console.warn('MetaMask EIP-712 tutor sign skipped/failed:', signErr);
      }
      if (!tutorSignature) {
        throw new Error("Không nhận được chữ ký EIP-712 từ MetaMask.");
      }

      await contractsApi.signAgreement(agreement.id, {
        walletAddress: tutorWallet,
        signature: tutorSignature,
      });
      await fetchAgreements();
    } catch (err: any) {
      alert(err?.message || 'Không thể ký xác nhận hợp đồng.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignByStudent = async (agreement: AgreementSummary) => {
    const signingWallet = address || agreement.studentWallet;
    if (!signingWallet || !signingWallet.startsWith("0x") || signingWallet === "0x0000000000000000000000000000000000000000") {
      alert("Bạn chưa kết nối Ví Web3! Vui lòng kết nối ví MetaMask trước khi thực hiện ký hợp đồng.");
      return;
    }

    try {
      setLoading(true);
      let studentSignature: string | undefined = undefined;
      const agreementDetail = await contractsApi.getAgreement(agreement.id);

      try {
        studentSignature = await signContractAgreementEip712(
          {
            id: agreement.id,
            tutorWallet: agreement.tutorWallet,
            studentWallet: signingWallet,
            totalAmountUsdc: agreement.totalAmountUsdc,
            termsHash: agreementDetail.termsHash,
            createdAt: agreement.createdAt,
            chainId: agreement.chainId || DEFAULT_CHAIN_ID,
            escrowContractAddress: agreement.escrowContractAddress || undefined,
          },
          signingWallet
        );
      } catch (signErr: any) {
        console.warn('MetaMask EIP-712 student sign skipped/failed:', signErr);
      }
      if (!studentSignature) {
        throw new Error("Không nhận được chữ ký EIP-712 từ MetaMask.");
      }

      await contractsApi.signAgreement(agreement.id, {
        walletAddress: signingWallet,
        signature: studentSignature,
      });
      window.dispatchEvent(new CustomEvent('contract-state-updated', {
        detail: { agreementId: agreement.id, action: 'signed', role: 'STUDENT' }
      }));
      await fetchAgreements();
    } catch (err: any) {
      alert(err?.message || 'Không thể ký xác nhận hợp đồng.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusCfg = (status: string) =>
    STATUS_CONFIG[status] ?? { label: status, cls: 'bg-slate-100 text-slate-600 border-slate-200' };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans select-none">
      {/* Top Banner Navigation */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <h2 className="font-display font-black text-xl lg:text-2xl text-slate-900">
              Quản Lý Hợp Đồng Ký Quỹ & Minh Chứng Blockchain
            </h2>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">
              EduConnect Smart Contract Escrow • Tự động quyết toán & phân xử minh bạch
            </p>
          </div>
        </div>

        {/* Tab Switchers */}
        <div className="flex items-center bg-slate-100 p-1.5 rounded-2xl gap-1">
          <button
            onClick={() => setActiveTab('AGREEMENTS')}
            className={`px-4 py-2 rounded-xl text-xs font-display font-black transition-all ${
              activeTab === 'AGREEMENTS'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Hợp Đồng ({totalElements})
          </button>
          <button
            onClick={() => setActiveTab('DISPUTES')}
            className={`px-4 py-2 rounded-xl text-xs font-display font-black transition-all ${
              activeTab === 'DISPUTES'
                ? 'bg-white text-rose-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Khiếu Nại (Disputes)
          </button>
          <button
            onClick={() => setActiveTab('TERMINATIONS')}
            className={`px-4 py-2 rounded-xl text-xs font-display font-black transition-all flex items-center gap-1.5 ${
              activeTab === 'TERMINATIONS'
                ? 'bg-white text-amber-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <XCircle size={14} /> Chấm Dứt Hợp Đồng
            {pendingTerminationsCount > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white shadow-xs animate-pulse">
                {pendingTerminationsCount} chờ xử lý
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Financial KPI Summary Cards */}
      {activeTab === 'AGREEMENTS' && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Tổng số hợp đồng</span>
            <span className="text-xl font-black text-slate-900 block">{kpis.totalCount}</span>
          </div>
          <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-200/70 shadow-2xs space-y-1">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">Đủ điều kiện giải ngân</span>
            <span className="text-xl font-black text-emerald-900 block">{kpis.activeCount}</span>
          </div>
          <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200 shadow-2xs space-y-1">
            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">Legacy chỉ tra cứu</span>
            <span className="text-xl font-black text-amber-900 block">{kpis.legacyCount}</span>
          </div>
          <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-200/70 shadow-2xs space-y-1">
            <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider block">Tổng giá trị ký quỹ</span>
            <span className="text-xl font-black text-blue-900 block">${kpis.totalUsdc.toFixed(2)} USDC</span>
          </div>
          <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-200/70 shadow-2xs space-y-1">
            <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider block">Đã quyết toán</span>
            <span className="text-xl font-black text-indigo-900 block">${kpis.settledUsdc.toFixed(2)} USDC</span>
          </div>
        </div>
      )}

      {/* AGREEMENTS TAB */}
      {activeTab === 'AGREEMENTS' && (
        <div className="space-y-6">
          {(activeRole === 'admin' || activeRole === 'staff') && (
            <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 text-xs text-slate-700 shadow-2xs">
              <p className="font-black text-blue-900">Phạm vi quản trị hợp đồng</p>
              <p className="mt-1 leading-relaxed">
                Admin giám sát toàn hệ thống; Staff chỉ xử lý lớp và khiếu nại được phân công. Hai vai trò có thể kiểm tra audit,
                theo dõi quyết toán và phân xử khiếu nại theo quyền, nhưng không ký thay học viên hoặc gia sư. Hủy/expire hợp đồng là tác vụ quản trị cấp Admin,
                không phải thao tác thường ngày trên lớp đang học. Chỉ hợp đồng có sự kiện
                <span className="font-mono font-bold"> AgreementFunded</span> đã xác nhận mới được tính vào tiền ký quỹ và giải ngân.
              </p>
            </div>
          )}

          {/* Controls: Filters & Search */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
              {/* Search input */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Tìm theo tên lớp, tên học viên, gia sư, email hoặc mã hợp đồng..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-blue-500 transition-all"
                />
              </div>

              {/* Classroom filter dropdown */}
              {distinctClasses.length > 0 && (
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5 text-blue-600" /> Lớp học:
                  </span>
                  <select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-blue-500 max-w-[220px] truncate"
                  >
                    <option value="ALL">Tất cả các lớp ({distinctClasses.length})</option>
                    {distinctClasses.map((cls) => (
                      <option key={cls.id} value={String(cls.id)}>
                        {cls.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                onClick={fetchAgreements}
                disabled={loading}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 flex items-center gap-1.5 shrink-0 transition-colors"
                title="Làm mới"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
                <span>Làm mới</span>
              </button>
            </div>

            {/* View Mode & Expand Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 w-fit">
                <button
                  type="button"
                  onClick={() => setViewMode('BY_CLASS')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    viewMode === 'BY_CLASS'
                      ? 'bg-white text-blue-700 shadow-xs font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Gom nhóm hợp đồng theo từng lớp học"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Theo lớp học ({classroomGroups.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('FLAT_CARDS')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    viewMode === 'FLAT_CARDS'
                      ? 'bg-white text-blue-700 shadow-xs font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Xem dạng thẻ từng hợp đồng riêng lẻ"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Thẻ lẻ ({filteredAgreements.length})</span>
                </button>
              </div>

              {viewMode === 'BY_CLASS' && classroomGroups.length > 0 && (
                <div className="flex items-center gap-3 text-xs">
                  <button
                    type="button"
                    onClick={expandAllClasses}
                    className="font-bold text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
                  >
                    <ChevronDown className="w-3.5 h-3.5" /> Mở rộng tất cả
                  </button>
                  <span className="text-slate-300">&bull;</span>
                  <button
                    type="button"
                    onClick={collapseAllClasses}
                    className="font-bold text-slate-500 hover:text-slate-700 hover:underline inline-flex items-center gap-1"
                  >
                    <ChevronUp className="w-3.5 h-3.5" /> Thu gọn tất cả
                  </button>
                </div>
              )}
            </div>

            {/* Status Filter Tabs */}
            <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Trạng thái:
              </span>
              {FILTER_TABS.map((tab) => {
                const isTerminationTab = tab.value === 'TERMINATION_PENDING';
                const count = isTerminationTab ? enrichedAgreements.filter((a) => activeTerminationMap.has(a.id)).length : undefined;
                return (
                  <button
                    key={tab.value}
                    onClick={() => setStatusFilter(tab.value)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      statusFilter === tab.value
                        ? isTerminationTab
                          ? 'bg-amber-600 text-white shadow-sm font-black'
                          : 'bg-slate-900 text-white shadow-sm'
                        : isTerminationTab
                        ? 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-300 font-extrabold'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    <span>{tab.label}</span>
                    {count !== undefined && count > 0 && (
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                        statusFilter === tab.value ? 'bg-white text-amber-800' : 'bg-amber-500 text-white animate-pulse'
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
              <span className="ml-auto text-xs text-slate-400 font-semibold">
                Hiển thị <strong>{filteredAgreements.length}</strong> / {enrichedAgreements.length} hợp đồng
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-400">Nguồn tiền:</span>
              {[
                { value: 'OPERATIONAL', label: 'On-chain hợp lệ' },
                { value: 'LEGACY', label: `Legacy chỉ audit (${kpis.legacyCount})` },
                { value: 'ALL', label: 'Hiển thị tất cả' },
              ].map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => setOperationalFilter(filter.value as 'ALL' | 'OPERATIONAL' | 'LEGACY')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    operationalFilter === filter.value
                      ? filter.value === 'LEGACY'
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'bg-blue-700 text-white shadow-sm'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm font-semibold">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <span className="text-sm font-semibold">Đang tải dữ liệu hợp đồng...</span>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && filteredAgreements.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400 bg-white rounded-3xl border border-slate-200">
              <ShieldCheck className="w-12 h-12 text-slate-300" />
              <p className="text-sm font-bold text-slate-600">Không tìm thấy hợp đồng nào phù hợp.</p>
              <p className="text-xs text-slate-400">Thử thay đổi từ khóa tìm kiếm hoặc chuyển bộ lọc trạng thái.</p>
            </div>
          )}

          {/* Agreements Render Area */}
          {!loading && filteredAgreements.length > 0 && viewMode === 'BY_CLASS' && (
            <div className="space-y-5">
              {classroomGroups.map((group) => {
                const isExpanded = expandedClassKeys.has(group.key);
                return (
                  <div
                    key={group.key}
                    className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all overflow-hidden"
                  >
                    {/* Class Group Header */}
                    <div
                      onClick={() => toggleClassExpand(group.key)}
                      className="p-4 sm:p-5 bg-gradient-to-r from-slate-50 via-white to-slate-50 border-b border-slate-200/80 flex flex-col lg:flex-row lg:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/80 transition-colors select-none"
                    >
                      <div className="flex items-start gap-3.5 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-md shadow-blue-500/20">
                          <BookOpen className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-display font-black text-slate-950 text-base sm:text-lg">
                              {group.className}
                            </h3>
                            {group.classroomId && (
                              <span className="px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-mono font-bold border border-blue-200">
                                Lớp #{group.classroomId}
                              </span>
                            )}
                            {group.hasTerminationPending && (
                              <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black animate-pulse flex items-center gap-1 shadow-2xs">
                                <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" /> Đang có đề xuất dừng / hủy lớp
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-1">
                            <span className="flex items-center gap-1.5 font-bold text-slate-800">
                              <GraduationCap className="w-3.5 h-3.5 text-blue-600" /> Gia sư: {group.tutorName || 'Chưa cập nhật'}
                            </span>
                            {group.tutorEmail && (
                              <span className="flex items-center gap-1 text-slate-600">
                                <Mail className="w-3 h-3 text-slate-400" /> {group.tutorEmail}
                              </span>
                            )}
                            {group.tutorPhone && (
                              <span className="flex items-center gap-1 text-slate-600">
                                <Phone className="w-3 h-3 text-slate-400" /> {group.tutorPhone}
                              </span>
                            )}
                            {group.tutorWallet && (
                              <EtherscanLink address={group.tutorWallet} chainId={activeChainId} />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Summary Metrics & Toggle Button */}
                      <div className="flex items-center gap-3 shrink-0 flex-wrap justify-between lg:justify-end">
                        <div className="flex items-center gap-2 text-xs font-bold">
                          <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-indigo-600" />
                            <span>{group.totalStudents} học viên</span>
                          </span>
                          <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200">
                            Quỹ cọc: <strong className="font-mono text-emerald-950">${group.totalEscrowUsdc.toFixed(2)} USDC</strong>
                          </span>
                          {group.totalSettledUsdc > 0 && (
                            <span className="px-3 py-1.5 rounded-xl bg-blue-50 text-blue-800 border border-blue-200">
                              Đã quyết toán: <strong className="font-mono text-blue-950">${group.totalSettledUsdc.toFixed(2)} USDC</strong>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 shadow-2xs transition-colors">
                          <span>{isExpanded ? 'Thu gọn' : `Xem ${group.agreements.length} HĐ`}</span>
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                        </div>
                      </div>
                    </div>

                    {/* Class Termination Banner if applicable */}
                    {group.hasTerminationPending && (
                      <div className="px-5 py-3 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950">
                        <div className="flex items-center gap-2 font-medium">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 animate-pulse" />
                          <span>
                            Lớp học này đang có hồ sơ đề xuất dừng & hủy lớp. Các buổi học tương lai được bảo lưu và tiền cọc chưa dùng sẽ được hoàn theo phê duyệt của Admin.
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveTab('TERMINATIONS')}
                          className="px-3 py-1 rounded-xl bg-amber-200 hover:bg-amber-300 text-amber-950 text-xs font-black shrink-0 transition-colors shadow-2xs cursor-pointer"
                        >
                          Theo dõi tiến độ chấm dứt &rarr;
                        </button>
                      </div>
                    )}

                    {/* Expanded: Class Contracts Table */}
                    {isExpanded && (
                      <div className="p-4 sm:p-5 bg-slate-50/60">
                        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-2xs">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-bold">
                                <th className="py-3 px-3.5">Học viên tham gia</th>
                                <th className="py-3 px-3.5">Trạng thái HĐ</th>
                                <th className="py-3 px-3.5">Tiến độ buổi học</th>
                                <th className="py-3 px-3.5">Tài chính ký quỹ</th>
                                <th className="py-3 px-3.5 text-right">Thao tác</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {group.agreements.map((item) => {
                                const cfg = getStatusCfg(item.status);
                                const isWaitingPayment = item.status === 'WAITING_PAYMENT';
                                const isActive = item.status === 'ACTIVE';
                                const isLegacy = Boolean(item.legacyUnreconciled);
                                const progressPct = item.totalSessions > 0
                                  ? Math.round((item.settledSessions / item.totalSessions) * 100)
                                  : 0;

                                const isStudentWalletMismatch =
                                  !!address &&
                                  !!item.studentWallet &&
                                  item.studentWallet !== "0x0000000000000000000000000000000000000000" &&
                                  address.toLowerCase() !== item.studentWallet.toLowerCase();

                                const activeTermination = activeTerminationMap.get(item.id);

                                return (
                                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                                    {/* Student Column */}
                                    <td className="py-3 px-3.5">
                                      <p className="font-bold text-slate-900 text-xs">
                                        {item.studentName || 'Chưa cập nhật tên'}
                                      </p>
                                      <p className="text-[11px] text-slate-500 mt-0.5">
                                        {item.studentEmail}
                                      </p>
                                      {item.studentPhone && (
                                        <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                          <Phone className="w-3 h-3 text-slate-400" /> {item.studentPhone}
                                        </p>
                                      )}
                                      <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[10px] font-mono text-slate-400">
                                          HĐ #{item.id.slice(0, 8)} &bull; {item.tokenSymbol}
                                        </span>
                                        {item.studentWallet && (
                                          <EtherscanLink address={item.studentWallet} chainId={activeChainId} />
                                        )}
                                      </div>
                                    </td>

                                    {/* Status Column */}
                                    <td className="py-3 px-3.5">
                                      <div className="space-y-1">
                                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${cfg.cls}`}>
                                          {cfg.label}
                                        </span>
                                        {activeTermination && (
                                          <div>
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black animate-pulse shadow-2xs">
                                              <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" /> Chờ xử lý chấm dứt
                                            </span>
                                          </div>
                                        )}
                                        {isLegacy && (
                                          <span className="block text-[10px] font-mono text-amber-700">Legacy audit</span>
                                        )}
                                      </div>
                                    </td>

                                    {/* Progress Column */}
                                    <td className="py-3 px-3.5">
                                      <span className="font-bold text-slate-800">
                                        {item.settledSessions} / {item.totalSessions} buổi ({progressPct}%)
                                      </span>
                                      <div className="w-24 h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                                        <div
                                          className="h-full bg-blue-500 rounded-full transition-all"
                                          style={{ width: `${progressPct}%` }}
                                        />
                                      </div>
                                    </td>

                                    {/* Financial Column */}
                                    <td className="py-3 px-3.5">
                                      <p className="font-black text-emerald-700 font-mono text-xs">
                                        ${Number(item.totalAmountUsdc).toFixed(2)} {item.tokenSymbol}
                                      </p>
                                      <p className="text-[10px] text-slate-400">
                                        ${Number(item.pricePerSessionUsdc).toFixed(2)}/buổi
                                      </p>
                                      {Number(item.releasedAmountUsdc) > 0 && (
                                        <p className="text-[10px] font-semibold text-blue-600 font-mono">
                                          Đã quyết toán: ${Number(item.releasedAmountUsdc).toFixed(2)}
                                        </p>
                                      )}
                                    </td>

                                    {/* Actions Column */}
                                    <td className="py-3 px-3.5 text-right">
                                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                        <button
                                          type="button"
                                          onClick={() => setSelectedAgreementForDocument(item.id)}
                                          className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-[11px] font-bold border border-indigo-200 transition-colors inline-flex items-center gap-1 cursor-pointer"
                                          title="Xem và tải văn bản hợp đồng Word/PDF"
                                        >
                                          <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                                          <span>Văn bản</span>
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => setSelectedAgreementForTimeline(item)}
                                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold border border-slate-200 transition-colors inline-flex items-center gap-1 cursor-pointer"
                                          title="Xem lịch sử tiến trình hợp đồng"
                                        >
                                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                                          <span>Audit</span>
                                        </button>

                                        {item.status === 'PENDING_TUTOR_ACCEPTANCE' && activeRole === 'tutor' && (
                                          <button
                                            type="button"
                                            onClick={() => handleSignByTutor(item)}
                                            className="px-2.5 py-1 text-white text-[11px] font-bold rounded-lg shadow-xs bg-gradient-to-r from-brand-primary to-brand-secondary hover:opacity-90 transition-all cursor-pointer inline-flex items-center gap-1"
                                          >
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            <span>Ký</span>
                                          </button>
                                        )}

                                        {item.status === 'PENDING_STUDENT_ACCEPTANCE' && activeRole === 'student' && (
                                          <button
                                            type="button"
                                            onClick={() => handleSignByStudent(item)}
                                            disabled={isStudentWalletMismatch}
                                            className={`px-2.5 py-1 text-white text-[11px] font-bold rounded-lg shadow-xs transition-all inline-flex items-center gap-1 ${
                                              isStudentWalletMismatch
                                                ? 'bg-slate-400 cursor-not-allowed opacity-60'
                                                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 cursor-pointer'
                                            }`}
                                          >
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            <span>Ký</span>
                                          </button>
                                        )}

                                        {isWaitingPayment && activeRole === 'student' && (
                                          <button
                                            type="button"
                                            onClick={() => handleOpenPayment(item)}
                                            disabled={isStudentWalletMismatch}
                                            className="px-2.5 py-1 text-white text-[11px] font-bold rounded-lg shadow-xs bg-emerald-600 hover:bg-emerald-700 transition-all cursor-pointer inline-flex items-center gap-1"
                                          >
                                            <Lock className="w-3.5 h-3.5" />
                                            <span>Ký quỹ</span>
                                          </button>
                                        )}

                                        {activeTermination && (
                                          <button
                                            type="button"
                                            onClick={() => setActiveTab('TERMINATIONS')}
                                            className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 text-[11px] font-bold border border-amber-300 transition-colors inline-flex items-center gap-1 cursor-pointer"
                                            title="Theo dõi tiến độ chấm dứt hợp đồng"
                                          >
                                            <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                                            <span>Chấm dứt</span>
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Agreements Grid (Flat Cards Mode) */}
          {!loading && filteredAgreements.length > 0 && viewMode === 'FLAT_CARDS' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredAgreements.map((item) => {
                const cfg = getStatusCfg(item.status);
                const isWaitingPayment = item.status === 'WAITING_PAYMENT';
                const isActive = item.status === 'ACTIVE';
                const isLegacy = Boolean(item.legacyUnreconciled);
                const progressPct = item.totalSessions > 0
                  ? Math.round((item.settledSessions / item.totalSessions) * 100)
                  : 0;

                const isStudentWalletMismatch =
                  !!address &&
                  !!item.studentWallet &&
                  item.studentWallet !== "0x0000000000000000000000000000000000000000" &&
                  address.toLowerCase() !== item.studentWallet.toLowerCase();

                const displayClassName = item.className || 'Chưa cập nhật tên lớp';
                const displayStudentName = item.studentName || 'Chưa cập nhật tên học viên';
                const displayTutorName = item.tutorName || 'Chưa cập nhật tên gia sư';
                const displayStudentEmail = item.studentEmail || "Chưa cập nhật email";
                const displayTutorEmail = item.tutorEmail || "Chưa cập nhật email";

                const activeTermination = activeTerminationMap.get(item.id);
                const terminationSessions = terminationSettlements[item.id] || [];
                const openTerminationSessions = terminationSessions.filter((session) => isSettlementOpen(session.status));
                const proposedTerminationSessions = openTerminationSessions
                  .filter((session) => session.status === 'PROPOSED' && session.disputeDeadline)
                  .sort((left, right) => new Date(left.disputeDeadline || 0).getTime() - new Date(right.disputeDeadline || 0).getTime());
                const nextFinalization = proposedTerminationSessions[0]?.disputeDeadline || null;
                const refundEstimate = Math.max(0, Number(item.remainingDeposit) || 0);

                return (
                  <div
                    key={item.id}
                    className={`rounded-3xl border p-6 shadow-sm hover:shadow-md transition-all space-y-5 flex flex-col justify-between ${
                      activeTermination
                        ? 'bg-amber-50/20 border-amber-300 ring-1 ring-amber-300/60'
                        : isLegacy
                        ? 'bg-amber-50/40 border-amber-300'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    {/* Top Row: Class Name & Status */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold font-mono">
                          {isLegacy
                            ? 'LEGACY • KHÔNG CÓ FUNDING EVENT'
                            : item.onchainAgreementId
                            ? `On-chain: ${item.onchainAgreementId.slice(0, 10)}...`
                            : 'Hợp đồng điện tử'}
                        </span>
                        <div className="flex items-center gap-2">
                          {activeTermination && (
                            <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black animate-pulse flex items-center gap-1 shadow-2xs">
                              <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" /> Chờ xử lý chấm dứt
                            </span>
                          )}
                          <span className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border ${cfg.cls}`}>
                            {cfg.label}
                          </span>
                        </div>
                      </div>

                      {/* Prominent Termination Notice Banner */}
                      {activeTermination && (
                        <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 p-3.5 text-xs text-amber-950 shadow-2xs">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5 animate-pulse" />
                            <div className="min-w-0">
                              <p className="font-extrabold text-amber-950 text-[13px]">
                                {activeTermination.wholeClass
                                  ? activeTermination.status === 'APPROVED'
                                    ? 'Admin đã duyệt hủy lớp - đang quyết toán từng hợp đồng'
                                    : 'Đang có đề xuất dừng & hủy toàn bộ lớp'
                                  : activeTermination.status === 'APPROVED'
                                    ? 'Admin đã duyệt chấm dứt - đang quyết toán trước khi hoàn escrow'
                                    : 'Đang có yêu cầu chấm dứt hợp đồng này'}
                              </p>
                              <p className="text-[11px] font-medium text-amber-800 mt-0.5">
                                Trạng thái: <span className="font-bold underline">{TERMINATION_LABELS[activeTermination.status] || activeTermination.status}</span>
                                {activeTermination.reason ? (
                                  <span className="italic"> &bull; "{activeTermination.reason.slice(0, 50)}{activeTermination.reason.length > 50 ? '...' : ''}"</span>
                                ) : null}
                              </p>
                              {activeTermination.status === 'APPROVED' && proposedTerminationSessions.length > 0 && nextFinalization && (
                                <p className="mt-1.5 text-[11px] leading-relaxed text-amber-950">
                                  Còn {proposedTerminationSessions.length} buổi trong cửa sổ khiếu nại 24 giờ. Sớm nhất hệ thống được phép quyết toán lúc{' '}
                                  <span className="font-black">{formatDeadline(nextFinalization)}</span>. Sau khi các buổi này được xác nhận on-chain, hệ thống tự gửi giao dịch hủy và hoàn{' '}
                                  <span className="font-black">{refundEstimate.toLocaleString('vi-VN')} USDC</span> cọc chưa dùng về ví học viên.
                                </p>
                              )}
                              {activeTermination.status === 'APPROVED' && proposedTerminationSessions.length === 0 && activeTermination.itemStatus === 'BLOCKCHAIN_PENDING' && (
                                <p className="mt-1.5 text-[11px] leading-relaxed text-amber-950">
                                  Các buổi trước cutoff đã xong. Giao dịch hủy và hoàn escrow đã được gửi; hệ thống đang chờ event blockchain xác nhận trước khi cập nhật lớp và ví.
                                </p>
                              )}
                              {activeTermination.status === 'APPROVED' && proposedTerminationSessions.length === 0 && activeTermination.itemStatus === 'WAITING_REFUND_EVENT' && (
                                <p className="mt-1.5 text-[11px] leading-relaxed text-amber-950">
                                  Smart contract đã xử lý hủy hợp đồng. Hệ thống đang chờ event hoàn tiền để xác nhận số USDC đã về đúng ví học viên.
                                </p>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setActiveTab('TERMINATIONS')}
                            className="shrink-0 px-3 py-1.5 rounded-xl bg-amber-200/90 hover:bg-amber-300 text-amber-950 text-xs font-black transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95"
                          >
                            Theo dõi tiến độ
                          </button>
                        </div>
                      )}

                      {isLegacy && (
                        <div className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-100/70 p-3 text-[11px] font-semibold leading-relaxed text-amber-950">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                          <span>
                            Dữ liệu lịch sử không có sự kiện <span className="font-mono font-black">AgreementFunded</span> tương ứng.
                            Hợp đồng này chỉ dùng để tra cứu; hệ thống không tự động đề xuất giải ngân, không tính vào KPI ký quỹ
                            và không cho gọi hoàn tiền qua Escrow V1.
                          </span>
                        </div>
                      )}

                      <div className="flex items-start gap-2.5 pt-1">
                        <div className="p-2 rounded-xl bg-blue-50 text-blue-600 shrink-0 mt-0.5">
                          <BookOpen className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-display font-black text-slate-950 text-lg sm:text-xl leading-tight">
                            {displayClassName}
                          </h3>
                          <p className="text-xs text-blue-600 font-bold mt-0.5">
                            Mã HĐ: <span className="font-mono font-semibold text-slate-700">#{item.id.slice(0, 8)}</span> &bull; Token: {item.tokenSymbol}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Parties and Progress Card */}
                    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3.5 text-xs">
                      {/* Distinct view for Tutor vs Student */}
                      {activeRole === 'tutor' ? (
                        <div className="p-3.5 bg-white rounded-xl border border-slate-200/80 space-y-2 shadow-2xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-black text-indigo-800 uppercase tracking-wider flex items-center gap-1">
                              <User className="w-3.5 h-3.5 text-indigo-600" /> Học viên tham gia:
                            </span>
                            <EtherscanLink address={item.studentWallet} chainId={activeChainId} />
                          </div>
                          <div>
                            <strong className="text-slate-950 font-black text-sm block font-display">{displayStudentName}</strong>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-600 text-[11px] font-medium mt-1">
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3 text-slate-400" /> {displayStudentEmail}
                              </span>
                              {item.studentPhone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3 h-3 text-slate-400" /> {item.studentPhone}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : activeRole === 'student' ? (
                        <div className="p-3.5 bg-white rounded-xl border border-slate-200/80 space-y-2 shadow-2xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-black text-blue-800 uppercase tracking-wider flex items-center gap-1">
                              <GraduationCap className="w-3.5 h-3.5 text-blue-600" /> Gia sư phụ trách:
                            </span>
                            <EtherscanLink address={item.tutorWallet} chainId={activeChainId} />
                          </div>
                          <div>
                            <strong className="text-slate-950 font-black text-sm block font-display">{displayTutorName}</strong>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-600 text-[11px] font-medium mt-1">
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3 text-slate-400" /> {displayTutorEmail}
                              </span>
                              {item.tutorPhone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3 h-3 text-slate-400" /> {item.tutorPhone}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="p-3 bg-white rounded-xl border border-slate-200/80 space-y-1.5 shadow-2xs">
                            <span className="text-[10px] font-black text-indigo-800 uppercase tracking-wider block">Học viên:</span>
                            <strong className="text-slate-950 font-bold block text-xs">{displayStudentName}</strong>
                            <span className="text-slate-500 text-[10px] block truncate">{displayStudentEmail}</span>
                            {item.studentPhone && <span className="text-slate-500 text-[10px] block truncate">SĐT: {item.studentPhone}</span>}
                            <div className="pt-1">
                              <EtherscanLink address={item.studentWallet} chainId={activeChainId} />
                            </div>
                          </div>
                          <div className="p-3 bg-white rounded-xl border border-slate-200/80 space-y-1.5 shadow-2xs">
                            <span className="text-[10px] font-black text-blue-800 uppercase tracking-wider block">Gia sư:</span>
                            <strong className="text-slate-950 font-bold block text-xs">{displayTutorName}</strong>
                            <span className="text-slate-500 text-[10px] block truncate">{displayTutorEmail}</span>
                            {item.tutorPhone && <span className="text-slate-500 text-[10px] block truncate">SĐT: {item.tutorPhone}</span>}
                            <div className="pt-1">
                              <EtherscanLink address={item.tutorWallet} chainId={activeChainId} />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Sessions Progress & Total Amount */}
                      <div className="border-t border-slate-200 pt-3 grid grid-cols-2 gap-3">
                        <div>
                          <span className="text-slate-500 font-bold block text-[11px]">Tiến độ quyết toán:</span>
                          <span className="font-mono font-bold text-slate-900 text-xs">
                            {item.settledSessions} / {item.totalSessions} buổi ({progressPct}%)
                          </span>
                          {/* Progress bar */}
                          <div className="mt-1.5 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-all"
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </div>
                        <div>
                          <span className="text-slate-500 font-bold block text-[11px]">Tổng giá trị ký quỹ:</span>
                          <span className="font-mono font-black text-emerald-700 text-sm block">
                            ${item.totalAmountUsdc.toFixed(2)} {item.tokenSymbol}
                          </span>
                          <span className="block text-[10px] text-slate-500 font-medium mt-0.5">
                            ${item.pricePerSessionUsdc.toFixed(2)} / buổi
                          </span>
                        </div>
                      </div>

                      {item.paymentDeadline && isWaitingPayment && (
                        <div className="flex items-center gap-1.5 text-[11px] text-orange-700 font-semibold pt-2 border-t border-slate-200">
                          <Clock className="w-3.5 h-3.5 text-orange-600" />
                          Hạn thanh toán: {new Date(item.paymentDeadline).toLocaleString('vi-VN')}
                        </div>
                      )}

                      {isWaitingPayment && activeRole === 'student' && isStudentWalletMismatch && (
                        <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <span>
                            MetaMask ({address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ''}) không khớp ví hợp đồng ({item.studentWallet.slice(0, 6)}...{item.studentWallet.slice(-4)}). Hãy đổi ví trong MetaMask để ký quỹ.
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Footer Action Buttons */}
                    <div className="border-t border-slate-100 pt-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 shrink-0">
                        <button
                          onClick={() => handleOpenTimeline(item)}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline whitespace-nowrap"
                        >
                          <Layers className="w-3.5 h-3.5 shrink-0" />
                          <span>Xem Audit</span>
                        </button>
                        <span className="text-slate-300 font-light">•</span>
                        <button
                          onClick={() => setSelectedAgreementForDocument(item.id)}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 hover:text-indigo-900 hover:underline whitespace-nowrap"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span>Văn bản hợp đồng</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {item.status === 'PENDING_TUTOR_ACCEPTANCE' && activeRole === 'tutor' && (
                          <button
                            onClick={() => handleSignByTutor(item)}
                            className="flex items-center gap-1.5 px-3.5 py-2 text-white text-xs font-display font-black rounded-xl shadow-xs transition-all bg-gradient-to-r from-brand-primary to-brand-secondary hover:opacity-90 whitespace-nowrap cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>Ký hợp đồng</span>
                          </button>
                        )}

                        {item.status === 'PENDING_STUDENT_ACCEPTANCE' && activeRole === 'student' && (
                          <button
                            onClick={() => handleSignByStudent(item)}
                            disabled={isStudentWalletMismatch}
                            className={`flex items-center gap-1.5 px-3.5 py-2 text-white text-xs font-display font-black rounded-xl shadow-xs transition-all whitespace-nowrap ${
                              isStudentWalletMismatch
                                ? 'bg-slate-400 cursor-not-allowed opacity-60'
                                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 cursor-pointer'
                            }`}
                            title={isStudentWalletMismatch ? 'Vui lòng chuyển sang đúng ví học viên trong MetaMask' : undefined}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>Ký xác nhận</span>
                          </button>
                        )}

                        {isWaitingPayment && activeRole === 'student' && (() => {
                          const balanceNum = parseFloat(usdcBalance || '0');
                          const isInsufficientBalance = Boolean(address) && balanceNum < item.totalAmountUsdc;

                          return (
                            <button
                              onClick={() => handleOpenPayment(item)}
                              disabled={isStudentWalletMismatch}
                              className={`flex items-center gap-1.5 px-3.5 py-2 text-white text-xs font-display font-black rounded-xl shadow-xs transition-all whitespace-nowrap ${
                                isStudentWalletMismatch
                                  ? 'bg-slate-400 cursor-not-allowed opacity-60'
                                  : isInsufficientBalance
                                  ? 'bg-amber-600 hover:bg-amber-700 cursor-pointer'
                                  : 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer'
                              }`}
                              title={
                                isStudentWalletMismatch
                                  ? 'Vui lòng chuyển sang đúng ví học viên trong MetaMask'
                                  : isInsufficientBalance
                                  ? `Số dư ví hiện tại: $${balanceNum.toFixed(2)} USDC (Còn thiếu $${(item.totalAmountUsdc - balanceNum).toFixed(2)} USDC)`
                                  : undefined
                              }
                            >
                              <Lock className="w-3.5 h-3.5 shrink-0" />
                              <span>
                                {isInsufficientBalance
                                  ? `Ký quỹ (Thiếu $${(item.totalAmountUsdc - balanceNum).toFixed(2)})`
                                  : `Ký quỹ ngay ($${item.totalAmountUsdc.toFixed(2)})`}
                              </span>
                            </button>
                          );
                        })()}

                        {isActive && item.settlementEligible && (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-200 whitespace-nowrap">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Đang bảo vệ bởi Escrow
                          </span>
                        )}

                        {isLegacy && (
                          <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2.5 py-1 rounded-xl border border-amber-300 whitespace-nowrap">
                            Chỉ tra cứu
                          </span>
                        )}

                        {activeRole === 'admin' && isWaitingPayment && (
                          <button
                            onClick={() => handleExpireAgreement(item)}
                            className="flex items-center gap-1.5 px-3 py-2 text-white text-xs font-display font-black rounded-xl bg-slate-700 hover:bg-slate-800 transition-all whitespace-nowrap"
                          >
                            <Clock className="w-3.5 h-3.5" />
                            <span>Expire</span>
                          </button>
                        )}

                        {item.status === 'COMPLETED' && (
                          <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-xl border border-blue-200 flex items-center gap-1 whitespace-nowrap">
                            <CheckCircle2 className="w-3 h-3" />
                            Đã hoàn tất
                          </span>
                        )}

                        {(item.status === 'EXPIRED' || item.status === 'CANCELLED') && (
                          <span className="text-[11px] font-bold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200 flex items-center gap-1 whitespace-nowrap">
                            <XCircle className="w-3 h-3" />
                            {item.status === 'EXPIRED' ? 'Hết hạn' : 'Đã hủy'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* DISPUTES TAB */}
      {activeTab === 'DISPUTES' && (
        <DisputeManagementPanel
          activeRole={activeRole as any}
          userEmail={userEmail}
        />
      )}

      {/* TERMINATIONS TAB */}
      {activeTab === 'TERMINATIONS' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <TerminationPanel activeRole={activeRole} initialAgreements={enrichedAgreements} />
        </div>
      )}

      {/* TIMELINE TAB */}
      {activeTab === 'TIMELINE' && selectedAgreementForTimeline && (
        <div className="space-y-4">
          <button
            onClick={() => setActiveTab('AGREEMENTS')}
            className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
          >
            ← Quay lại danh sách hợp đồng
          </button>
          <ContractAuditTimeline
            agreementId={selectedAgreementForTimeline.id}
            contractStatus={selectedAgreementForTimeline.status as any}
            chainId={activeChainId}
            activeRole={activeRole}
          />
        </div>
      )}

      {/* Contract Document PDF Modal */}
      {selectedAgreementForDocument && (
        <ContractDocumentModal
          agreementId={selectedAgreementForDocument}
          agreementSummary={agreements.find(a => a.id === selectedAgreementForDocument)}
          onClose={() => {
            setSelectedAgreementForDocument(null);
            fetchAgreements();
          }}
          onSignedSuccess={() => {
            fetchAgreements();
          }}
          onRequestPayment={() => {
            const targetAgr = agreements.find(a => a.id === selectedAgreementForDocument);
            setSelectedAgreementForDocument(null);
            if (targetAgr) {
              setSelectedAgreementForPayment(targetAgr as any);
            }
          }}
        />
      )}

      {/* Payment Modal */}
      {selectedAgreementForPayment && (
        <EscrowPaymentModal
          isOpen={!!selectedAgreementForPayment}
          onClose={() => {
            setSelectedAgreementForPayment(null);
            fetchAgreements();
          }}
          agreement={selectedAgreementForPayment}
          onPaymentSuccess={(txHash) => {
            console.log('Payment completed:', txHash);
            fetchAgreements();
          }}
        />
      )}

    </div>
  );
}

export default EscrowContractsView;
