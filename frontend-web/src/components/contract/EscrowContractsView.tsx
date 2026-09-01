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
  Award
} from 'lucide-react';
import { EtherscanLink } from '../common/EtherscanLink';
import { EscrowPaymentModal, AgreementPaymentDetails } from './EscrowPaymentModal';
import { DisputeManagementPanel } from './DisputeManagementPanel';
import { ContractAuditTimeline } from './ContractAuditTimeline';
import { ContractDocumentModal } from './ContractDocumentModal';
import { useWeb3Wallet } from '../../web3/useWeb3Wallet';
import { DEFAULT_CHAIN_ID } from '../../web3/web3Config';
import { contractsApi, AgreementSummary } from '../../api/contractsApi';
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
  PENDING_TUTOR_ACCEPTANCE: { label: 'Chờ gia sư đồng ý', cls: 'bg-amber-100 text-amber-800 border-amber-200 animate-pulse' },
  PENDING_STUDENT_ACCEPTANCE: { label: 'Chờ học viên đồng ý', cls: 'bg-amber-100 text-amber-800 border-amber-200 animate-pulse' },
  PREPARING_BLOCKCHAIN: { label: 'Đang đăng ký lên Chain', cls: 'bg-blue-100 text-blue-700 border-blue-200 animate-pulse' },
  WAITING_PAYMENT: { label: 'Chờ học viên ký quỹ', cls: 'bg-orange-100 text-orange-800 border-orange-200 animate-pulse' },
  PAYMENT_CONFIRMING: { label: 'Đang xác nhận thanh toán', cls: 'bg-indigo-100 text-indigo-700 border-indigo-200 animate-pulse' },
  ACTIVE: { label: 'Đã ký quỹ (Đang học)', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  COMPLETED: { label: 'Hoàn tất', cls: 'bg-blue-100 text-blue-800 border-blue-200' },
  EXPIRED: { label: 'Hết hạn', cls: 'bg-red-100 text-red-700 border-red-200' },
  CANCELLED: { label: 'Đã hủy', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
};

const FILTER_TABS = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'WAITING_PAYMENT', label: 'Chờ ký quỹ' },
  { value: 'ACTIVE', label: 'Đang học' },
  { value: 'COMPLETED', label: 'Hoàn tất' },
  { value: 'CANCELLED', label: 'Đã hủy' },
];

export function EscrowContractsView({
  activeRole,
  userEmail = '',
}: EscrowContractsViewProps) {
  const { address, chainId } = useWeb3Wallet();
  const { user } = useAuth();
  const activeChainId = chainId || DEFAULT_CHAIN_ID;

  const [activeTab, setActiveTab] = useState<'AGREEMENTS' | 'DISPUTES' | 'TIMELINE'>('AGREEMENTS');
  const [selectedAgreementForPayment, setSelectedAgreementForPayment] = useState<AgreementPaymentDetails | null>(null);
  const [selectedAgreementForTimeline, setSelectedAgreementForTimeline] = useState<AgreementSummary | null>(null);
  const [selectedAgreementForDocument, setSelectedAgreementForDocument] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedClassId, setSelectedClassId] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Real data state
  const [agreements, setAgreements] = useState<AgreementSummary[]>([]);
  const [classroomCache, setClassroomCache] = useState<Record<number, any>>({});
  const [requestsCache, setRequestsCache] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [totalElements, setTotalElements] = useState(0);

  const fetchAgreements = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [agreementsData, tutorClasses] = await Promise.all([
        contractsApi.listAgreements({
          status: statusFilter === 'ALL' ? undefined : statusFilter,
          page: 0,
          size: 100,
        }),
        classApi.getMyClasses().catch(() => []),
      ]);

      const content: AgreementSummary[] = agreementsData?.content ?? (Array.isArray(agreementsData) ? agreementsData : []);
      setAgreements(content);
      setTotalElements(agreementsData?.totalElements ?? content.length);

      // Build classroom cache from myClasses
      const classMap: Record<number, any> = {};
      if (Array.isArray(tutorClasses)) {
        tutorClasses.forEach((c: any) => {
          if (c && c.id) classMap[c.id] = c;
        });
      }

      // Fetch details for any missing classroom IDs
      const missingClassIds = Array.from(new Set(content.map((a) => a.classroomId))).filter((id) => id && !classMap[id]);
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
        const myRequests = await classApi.getAllTutorRequests().catch(() => []);
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
          resolvedClassName = `Lớp học #${a.classroomId}`;
        }
      }

      // Resolved Tutor Name & Email
      let resolvedTutorEmail = a.tutorEmail || a.classroomReviewerEmail || cls?.tutorEmail || 'thaiquochuynhngoc.004@gmail.com';
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
        } else if (activeRole === 'tutor' && user?.fullName) {
          resolvedTutorName = user.fullName;
        } else {
          resolvedTutorName = 'Thái Huỳnh Ngọc Quốc';
        }
      }

      // Resolved Student Name & Email
      let resolvedStudentEmail = a.studentEmail || req?.studentEmail || 'huynhngocquocthai.hkhk@gmail.com';
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
        } else if (activeRole === 'student' && user?.fullName) {
          resolvedStudentName = user.fullName;
        } else {
          resolvedStudentName = 'Thái Huỳnh Ngọc Quốc';
        }
      }

      const resolvedStudentPhone = a.studentPhone || (user?.email?.toLowerCase() === resolvedStudentEmail.toLowerCase() ? (user?.phone || user?.phoneNumber) : null) || '0733727345';
      const resolvedTutorPhone = a.tutorPhone || (user?.email?.toLowerCase() === resolvedTutorEmail.toLowerCase() ? (user?.phone || user?.phoneNumber) : null) || '0733727345';

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

  // Distinct classrooms list for dropdown filter
  const distinctClasses = useMemo(() => {
    const map = new Map<number, string>();
    enrichedAgreements.forEach((a) => {
      if (a.classroomId) {
        map.set(a.classroomId, a.className || `Lớp học #${a.classroomId}`);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [enrichedAgreements]);

  // Filtered agreements list
  const filteredAgreements = useMemo(() => {
    return enrichedAgreements.filter((a) => {
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
  }, [enrichedAgreements, selectedClassId, searchTerm]);

  // Financial KPIs
  const kpis = useMemo(() => {
    const totalCount = enrichedAgreements.length;
    const activeCount = enrichedAgreements.filter((a) => a.status === 'ACTIVE').length;
    const totalUsdc = enrichedAgreements.reduce((sum, a) => sum + (Number(a.totalAmountUsdc) || 0), 0);
    const settledUsdc = enrichedAgreements.reduce((sum, a) => sum + ((Number(a.settledSessions) || 0) * (Number(a.pricePerSessionUsdc) || 0)), 0);

    return { totalCount, activeCount, totalUsdc, settledUsdc };
  }, [enrichedAgreements]);

  const handleOpenPayment = (agreement: AgreementSummary) => {
    setSelectedAgreementForPayment({
      agreementId: agreement.id,
      onchainAgreementId: agreement.onchainAgreementId || agreement.id,
      classTitle: agreement.className || `Hợp đồng #${agreement.id.slice(0, 8)}`,
      tutorName: agreement.tutorName || `Gia sư #${agreement.tutorId}`,
      tutorAddress: agreement.tutorWallet,
      studentAddress: agreement.studentWallet,
      totalSessions: agreement.totalSessions,
      pricePerSession: agreement.pricePerSessionUsdc,
      totalAmount: agreement.totalAmountUsdc,
      platformFeePercent: 15,
    });
  };

  const handleOpenTimeline = (agreement: AgreementSummary) => {
    setSelectedAgreementForTimeline(agreement);
    setActiveTab('TIMELINE');
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

      try {
        tutorSignature = await signContractAgreementEip712(
          {
            id: agreement.id,
            tutorWallet: tutorWallet,
            studentWallet: agreement.studentWallet || "0x0000000000000000000000000000000000000000",
            totalAmountUsdc: agreement.totalAmountUsdc,
            createdAt: agreement.createdAt,
            chainId: agreement.chainId || DEFAULT_CHAIN_ID,
            escrowContractAddress: agreement.escrowContractAddress || undefined,
          },
          tutorWallet
        );
      } catch (signErr: any) {
        console.warn('MetaMask EIP-712 tutor sign skipped/failed:', signErr);
      }

      await contractsApi.signAgreement(agreement.id, {
        role: 'TUTOR',
        walletAddress: tutorWallet,
        signature: tutorSignature,
        userEmail: userEmail,
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

      try {
        studentSignature = await signContractAgreementEip712(
          {
            id: agreement.id,
            tutorWallet: agreement.tutorWallet,
            studentWallet: signingWallet,
            totalAmountUsdc: agreement.totalAmountUsdc,
            createdAt: agreement.createdAt,
            chainId: agreement.chainId || DEFAULT_CHAIN_ID,
            escrowContractAddress: agreement.escrowContractAddress || undefined,
          },
          signingWallet
        );
      } catch (signErr: any) {
        console.warn('MetaMask EIP-712 student sign skipped/failed:', signErr);
      }

      await contractsApi.signAgreement(agreement.id, {
        role: 'STUDENT',
        walletAddress: signingWallet,
        signature: studentSignature,
        userEmail: userEmail,
      });
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
        </div>
      </div>

      {/* Financial KPI Summary Cards */}
      {activeTab === 'AGREEMENTS' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Tổng số hợp đồng</span>
            <span className="text-xl font-black text-slate-900 block">{kpis.totalCount}</span>
          </div>
          <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-200/70 shadow-2xs space-y-1">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">Đang học (ACTIVE)</span>
            <span className="text-xl font-black text-emerald-900 block">{kpis.activeCount}</span>
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

            {/* Status Filter Tabs */}
            <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Trạng thái:
              </span>
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setStatusFilter(tab.value)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    statusFilter === tab.value
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
              <span className="ml-auto text-xs text-slate-400 font-semibold">
                Hiển thị <strong>{filteredAgreements.length}</strong> / {enrichedAgreements.length} hợp đồng
              </span>
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

          {/* Agreements Grid */}
          {!loading && filteredAgreements.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredAgreements.map((item) => {
                const cfg = getStatusCfg(item.status);
                const isWaitingPayment = item.status === 'WAITING_PAYMENT';
                const isActive = item.status === 'ACTIVE';
                const progressPct = item.totalSessions > 0
                  ? Math.round((item.settledSessions / item.totalSessions) * 100)
                  : 0;

                const isStudentWalletMismatch =
                  !!address &&
                  !!item.studentWallet &&
                  item.studentWallet !== "0x0000000000000000000000000000000000000000" &&
                  address.toLowerCase() !== item.studentWallet.toLowerCase();

                const displayClassName = item.className || `Lớp học #${item.classroomId}`;
                const displayStudentName = item.studentName || `Học viên #${item.studentId}`;
                const displayTutorName = item.tutorName || `Gia sư #${item.tutorId}`;
                const displayStudentEmail = item.studentEmail || "Chưa cập nhật email";
                const displayTutorEmail = item.tutorEmail || item.classroomReviewerEmail || "Chưa cập nhật email";

                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all space-y-5 flex flex-col justify-between"
                  >
                    {/* Top Row: Class Name & Status */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold font-mono">
                          {item.onchainAgreementId
                            ? `On-chain: ${item.onchainAgreementId.slice(0, 10)}...`
                            : `ID: ${item.id.slice(0, 8)}...`}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border ${cfg.cls}`}>
                          {cfg.label}
                        </span>
                      </div>

                      <div className="flex items-start gap-2.5 pt-1">
                        <div className="p-2 rounded-xl bg-blue-50 text-blue-600 shrink-0 mt-0.5">
                          <BookOpen className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-display font-black text-slate-950 text-lg sm:text-xl leading-tight">
                            {displayClassName}
                          </h3>
                          <p className="text-xs text-blue-600 font-bold mt-0.5">
                            Mã HĐ: <span className="font-mono font-semibold text-slate-700">#{item.id.slice(0, 8)}</span> &bull; Lớp #{item.classroomId} &bull; Token: {item.tokenSymbol}
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
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleOpenTimeline(item)}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          <Layers className="w-3.5 h-3.5" />
                          <span>Xem Audit</span>
                        </button>
                        <button
                          onClick={() => setSelectedAgreementForDocument(item.id)}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 hover:underline"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Văn bản hợp đồng</span>
                        </button>
                      </div>

                      {item.status === 'PENDING_TUTOR_ACCEPTANCE' && (activeRole === 'tutor' || activeRole === 'staff' || activeRole === 'admin') && (
                        <button
                          onClick={() => handleSignByTutor(item)}
                          className="flex items-center gap-1.5 px-4 py-2 text-white text-xs font-display font-black rounded-xl shadow-sm transition-all bg-gradient-to-r from-brand-primary to-brand-secondary hover:opacity-90 hover:shadow"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Ký hợp đồng (Gia sư)</span>
                        </button>
                      )}

                      {item.status === 'PENDING_STUDENT_ACCEPTANCE' && activeRole === 'student' && (
                        <button
                          onClick={() => handleSignByStudent(item)}
                          disabled={isStudentWalletMismatch}
                          className={`flex items-center gap-1.5 px-4 py-2 text-white text-xs font-display font-black rounded-xl shadow-sm transition-all ${
                            isStudentWalletMismatch
                              ? 'bg-slate-400 cursor-not-allowed opacity-60'
                              : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 hover:shadow'
                          }`}
                          title={isStudentWalletMismatch ? 'Vui lòng chuyển sang đúng ví học viên trong MetaMask' : undefined}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Ký xác nhận hợp đồng</span>
                        </button>
                      )}

                      {isWaitingPayment && activeRole === 'student' && (
                        <button
                          onClick={() => handleOpenPayment(item)}
                          disabled={isStudentWalletMismatch}
                          className={`flex items-center gap-1.5 px-4 py-2 text-white text-xs font-display font-black rounded-xl shadow-sm transition-all ${
                            isStudentWalletMismatch
                              ? 'bg-slate-400 cursor-not-allowed opacity-60'
                              : 'bg-emerald-600 hover:bg-emerald-700 hover:shadow'
                          }`}
                          title={isStudentWalletMismatch ? 'Vui lòng chuyển sang đúng ví học viên trong MetaMask' : undefined}
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>Ký quỹ ngay (${item.totalAmountUsdc.toFixed(0)} {item.tokenSymbol})</span>
                        </button>
                      )}

                      {isActive && (
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
                          Đang bảo vệ bởi Escrow
                        </span>
                      )}

                      {item.status === 'COMPLETED' && (
                        <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-xl border border-blue-200 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Đã hoàn tất
                        </span>
                      )}

                      {(item.status === 'EXPIRED' || item.status === 'CANCELLED') && (
                        <span className="text-[11px] font-bold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200 flex items-center gap-1">
                          <XCircle className="w-3 h-3" />
                          {item.status === 'EXPIRED' ? 'Hết hạn' : 'Đã hủy'}
                        </span>
                      )}
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
          />
        </div>
      )}

      {/* Contract Document PDF Modal */}
      {selectedAgreementForDocument && (
        <ContractDocumentModal
          agreementId={selectedAgreementForDocument}
          onClose={() => setSelectedAgreementForDocument(null)}
        />
      )}

      {/* Payment Modal */}
      {selectedAgreementForPayment && (
        <EscrowPaymentModal
          isOpen={!!selectedAgreementForPayment}
          onClose={() => setSelectedAgreementForPayment(null)}
          agreement={selectedAgreementForPayment}
          onPaymentSuccess={(txHash) => {
            console.log('Payment completed:', txHash);
            setSelectedAgreementForPayment(null);
            fetchAgreements();
          }}
        />
      )}
    </div>
  );
}

export default EscrowContractsView;
