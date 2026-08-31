import React, { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import { EtherscanLink } from '../common/EtherscanLink';
import { EscrowPaymentModal, AgreementPaymentDetails } from './EscrowPaymentModal';
import { DisputeManagementPanel } from './DisputeManagementPanel';
import { ContractAuditTimeline } from './ContractAuditTimeline';
import { ContractDocumentModal } from './ContractDocumentModal';
import { useWeb3Wallet } from '../../web3/useWeb3Wallet';
import { DEFAULT_CHAIN_ID } from '../../web3/web3Config';
import { contractsApi, AgreementSummary } from '../../api/contractsApi';
import { signContractAgreementEip712 } from '../../web3/eip712Signer';

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
  const activeChainId = chainId || DEFAULT_CHAIN_ID;

  const [activeTab, setActiveTab] = useState<'AGREEMENTS' | 'DISPUTES' | 'TIMELINE'>('AGREEMENTS');
  const [selectedAgreementForPayment, setSelectedAgreementForPayment] = useState<AgreementPaymentDetails | null>(null);
  const [selectedAgreementForTimeline, setSelectedAgreementForTimeline] = useState<AgreementSummary | null>(null);
  const [selectedAgreementForDocument, setSelectedAgreementForDocument] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Real data state
  const [agreements, setAgreements] = useState<AgreementSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [totalElements, setTotalElements] = useState(0);

  const fetchAgreements = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await contractsApi.listAgreements({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        page: 0,
        size: 50,
      });
      const content = data?.content ?? (Array.isArray(data) ? data : []);
      setAgreements(content);
      setTotalElements(data?.totalElements ?? content.length);
    } catch (err: any) {
      setError(err?.message || 'Không thể tải danh sách hợp đồng.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchAgreements();
  }, [fetchAgreements]);

  const handleOpenPayment = (agreement: AgreementSummary) => {
    setSelectedAgreementForPayment({
      agreementId: parseInt(agreement.id) || 0,
      onchainAgreementId: parseInt(agreement.onchainAgreementId ?? '0') || 0,
      classTitle: `Hợp đồng #${agreement.id.slice(0, 8)}`,
      tutorName: `Gia sư #${agreement.tutorId}`,
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

  const handleSignByStudent = async (agreement: AgreementSummary) => {
    try {
      setLoading(true);
      let studentSignature: string | undefined = undefined;

      try {
        studentSignature = await signContractAgreementEip712(
          {
            id: agreement.id,
            tutorWallet: agreement.tutorWallet,
            studentWallet: agreement.studentWallet,
            totalAmountUsdc: agreement.totalAmountUsdc,
            createdAt: agreement.createdAt,
            chainId: agreement.chainId || DEFAULT_CHAIN_ID,
            escrowContractAddress: agreement.escrowContractAddress || undefined,
          },
          agreement.studentWallet
        );
      } catch (signErr: any) {
        console.warn('MetaMask EIP-712 student sign skipped/failed:', signErr);
      }

      await contractsApi.signAgreement(agreement.id, {
        role: 'STUDENT',
        walletAddress: agreement.studentWallet,
        signature: studentSignature,
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

      {/* AGREEMENTS TAB */}
      {activeTab === 'AGREEMENTS' && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" />
                Lọc trạng thái:
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
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-semibold">
                Hiển thị <strong>{agreements.length}</strong>{totalElements > agreements.length ? ` / ${totalElements}` : ''} hợp đồng
              </span>
              <button
                onClick={fetchAgreements}
                disabled={loading}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
                title="Làm mới"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
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
          {!loading && !error && agreements.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-400">
              <ShieldCheck className="w-12 h-12 text-slate-300" />
              <p className="text-sm font-bold">Chưa có hợp đồng nào.</p>
              <p className="text-xs text-slate-400">Hợp đồng sẽ xuất hiện khi học viên và gia sư ký kết thành công.</p>
            </div>
          )}

          {/* Agreements Grid */}
          {!loading && agreements.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {agreements.map((item) => {
                const cfg = getStatusCfg(item.status);
                const isWaitingPayment = item.status === 'WAITING_PAYMENT';
                const isActive = item.status === 'ACTIVE';
                const progressPct = item.totalSessions > 0
                  ? Math.round((item.settledSessions / item.totalSessions) * 100)
                  : 0;

                const isStudentWalletMismatch =
                  !!address &&
                  !!item.studentWallet &&
                  address.toLowerCase() !== item.studentWallet.toLowerCase();

                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all space-y-5 flex flex-col justify-between"
                  >
                    {/* Top Row: ID & Status */}
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

                      <h3 className="font-bold text-slate-900 text-base leading-snug">
                        Hợp đồng Escrow #{item.id.slice(0, 8)}
                      </h3>
                      <p className="text-xs text-blue-600 font-bold">
                        Lớp #{item.classroomId} • Token: {item.tokenSymbol}
                      </p>
                    </div>

                    {/* Info Table */}
                    <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 space-y-2.5 text-xs">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <span className="text-slate-400 font-semibold block text-[11px]">Học viên:</span>
                          <span className="font-bold text-slate-800">#{item.studentId}</span>
                          <div className="mt-0.5">
                            <EtherscanLink address={item.studentWallet} chainId={activeChainId} />
                          </div>
                        </div>
                        <div>
                          <span className="text-slate-400 font-semibold block text-[11px]">Gia sư:</span>
                          <span className="font-bold text-slate-800">#{item.tutorId}</span>
                          <div className="mt-0.5">
                            <EtherscanLink address={item.tutorWallet} chainId={activeChainId} />
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-slate-200/60 pt-2.5 grid grid-cols-2 gap-3">
                        <div>
                          <span className="text-slate-400 font-semibold block text-[11px]">Tiến độ buổi học:</span>
                          <span className="font-mono font-bold text-slate-800">
                            {item.settledSessions} / {item.totalSessions} buổi đã quyết toán
                          </span>
                          {/* Progress bar */}
                          <div className="mt-1.5 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-all"
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </div>
                        <div>
                          <span className="text-slate-400 font-semibold block text-[11px]">Tổng giá trị ký quỹ:</span>
                          <span className="font-mono font-black text-emerald-600 text-sm">
                            ${item.totalAmountUsdc.toFixed(2)} {item.tokenSymbol}
                          </span>
                          <span className="block text-[10px] text-slate-400 mt-0.5">
                            ${item.pricePerSessionUsdc.toFixed(2)} / buổi
                          </span>
                        </div>
                      </div>

                      {item.paymentDeadline && isWaitingPayment && (
                        <div className="flex items-center gap-1.5 text-[11px] text-orange-600 font-semibold pt-1 border-t border-slate-200/60">
                          <Clock className="w-3 h-3" />
                          Hạn thanh toán: {new Date(item.paymentDeadline).toLocaleString('vi-VN')}
                        </div>
                      )}

                      {item.classroomReviewerEmail && (
                        <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-200/60">
                          Reviewer: {item.classroomReviewerEmail}
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
                          className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          <Layers className="w-3.5 h-3.5" />
                          <span>Xem Audit</span>
                        </button>
                        <button
                          onClick={() => setSelectedAgreementForDocument(item.id)}
                          className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-slate-900 hover:underline"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Văn bản hợp đồng</span>
                        </button>
                      </div>

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
