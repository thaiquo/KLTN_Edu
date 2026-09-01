import React, { useEffect, useState } from 'react';
import {
  FileText,
  Lock,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Coins,
  Clock,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { EtherscanLink } from '../common/EtherscanLink';
import { DEFAULT_CHAIN_ID } from '../../web3/web3Config';
import { contractsApi, AgreementDetail, BlockchainTxDto } from '../../api/contractsApi';

export interface ContractTimelineEvent {
  title: string;
  description: string;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'PENDING' | 'DISPUTED' | 'REFUNDED';
  timestamp?: string;
  blockNumber?: number | string;
  txHash?: string;
  amountUsdc?: number | string;
}

interface ContractAuditTimelineProps {
  agreementId: string;
  contractStatus?: string;
  chainId?: number;
  className?: string;
}

export function ContractAuditTimeline({
  agreementId,
  contractStatus = 'ACTIVE',
  chainId = DEFAULT_CHAIN_ID,
  className = '',
}: ContractAuditTimelineProps) {
  const [detail, setDetail] = useState<AgreementDetail | null>(null);
  const [acceptances, setAcceptances] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<BlockchainTxDto[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAuditData = async () => {
    if (!agreementId) return;
    setLoading(true);
    try {
      const [agr, acc, setl, txs] = await Promise.all([
        contractsApi.getAgreement(agreementId).catch(() => null),
        contractsApi.getAcceptances(agreementId).catch(() => []),
        contractsApi.getSettlements(agreementId).catch(() => []),
        contractsApi.getAgreementTransactions(agreementId).catch(() => []),
      ]);

      if (agr) setDetail(agr);
      setAcceptances(acc || []);
      setSettlements(setl || []);
      setTransactions(txs || []);
    } catch (err) {
      console.error("Failed to load audit data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditData();
  }, [agreementId]);

  const summary = detail?.summary;
  const currentStatus = summary?.status || contractStatus;
  const activeChainId = summary?.chainId ? Number(summary.chainId) : chainId;

  // Find real deposit transaction from tx list
  const depositTx = transactions.find(
    (t) => t.action === 'DEPOSIT_ESCROW' && t.transactionHash && t.transactionHash.startsWith('0x')
  );

  const tutorAcceptance = acceptances.find((a) => a.role === 'TUTOR');
  const studentAcceptance = acceptances.find((a) => a.role === 'STUDENT');

  const totalAmountUsdc = summary?.totalAmountUsdc || 0;
  const pricePerSession = summary?.pricePerSessionUsdc || 0;
  const totalSessions = summary?.totalSessions || 0;
  const settledSessions = summary?.settledSessions || 0;

  const displayClassName = summary?.className || `Lớp học #${summary?.classroomId || 1}`;

  // Build Real Timeline Stages
  const events: ContractTimelineEvent[] = [
    {
      title: '1. Khởi tạo Hợp đồng Ký quỹ (Registered)',
      description: `Hệ thống EduConnect đã ghi nhận khởi tạo hợp đồng cho khóa học "${displayClassName}". Đơn giá: $${pricePerSession.toFixed(2)} USDC/buổi, tổng giá trị: $${totalAmountUsdc.toFixed(2)} USDC (${totalSessions} buổi học).`,
      status: 'COMPLETED',
      timestamp: summary?.createdAt
        ? new Date(summary.createdAt).toLocaleString('vi-VN')
        : 'Đã khởi tạo',
      amountUsdc: totalAmountUsdc > 0 ? totalAmountUsdc.toFixed(2) : undefined,
    },
    {
      title: '2. Xác thực Chữ ký số Mật mã học (EIP-712 Cryptographic Signatures)',
      description: tutorAcceptance && studentAcceptance
        ? `Cả Gia sư (${summary?.tutorName || 'Gia sư'}) và Học viên (${summary?.studentName || 'Học viên'}) đã hoàn tất ký xác thực hợp đồng điện tử theo tiêu chuẩn EIP-712 không tốn phí Gas.`
        : tutorAcceptance
        ? `Gia sư (${summary?.tutorName || 'Gia sư'}) đã ký số EIP-712 lúc ${new Date(tutorAcceptance.acceptedAt).toLocaleTimeString('vi-VN')}. Đang chờ Học viên xác nhận.`
        : 'Hợp đồng đang trong giai đoạn chờ các bên ký số xác thực.',
      status: tutorAcceptance && (studentAcceptance || currentStatus === 'ACTIVE' || currentStatus === 'WAITING_PAYMENT')
        ? 'COMPLETED'
        : 'IN_PROGRESS',
      timestamp: tutorAcceptance?.acceptedAt
        ? new Date(tutorAcceptance.acceptedAt).toLocaleString('vi-VN')
        : undefined,
    },
    {
      title: '3. Học viên Ký quỹ Học phí vào Smart Contract (Funded & Active)',
      description: currentStatus === 'ACTIVE' || currentStatus === 'COMPLETED'
        ? `Học viên đã nạp cọc thành công $${totalAmountUsdc.toFixed(2)} USDC vào quỹ Smart Contract Escrow trên mạng Ethereum Sepolia Testnet để khóa bảo đảm.`
        : currentStatus === 'WAITING_PAYMENT'
        ? `Hợp đồng đang chờ Học viên phê duyệt ví MetaMask và nạp $${totalAmountUsdc.toFixed(2)} USDC vào Smart Contract Escrow (Thời hạn 24 giờ).`
        : 'Chờ hoàn tất ký hợp đồng trước khi nạp cọc.',
      status: currentStatus === 'ACTIVE' || currentStatus === 'COMPLETED'
        ? 'COMPLETED'
        : currentStatus === 'WAITING_PAYMENT' || currentStatus === 'PAYMENT_CONFIRMING'
        ? 'IN_PROGRESS'
        : 'PENDING',
      timestamp: depositTx?.createdAt
        ? new Date(depositTx.createdAt).toLocaleString('vi-VN')
        : (currentStatus === 'ACTIVE' || currentStatus === 'COMPLETED')
        ? new Date().toLocaleString('vi-VN')
        : undefined,
      txHash: depositTx?.transactionHash || undefined,
      blockNumber: depositTx?.blockNumber ? `#${depositTx.blockNumber}` : undefined,
      amountUsdc: totalAmountUsdc > 0 ? totalAmountUsdc.toFixed(2) : undefined,
    },
    {
      title: '4. Tiến trình Giảng dạy & Quyết toán từng phần (Settlements)',
      description: settledSessions > 0
        ? `Đã quyết toán ${settledSessions}/${totalSessions} buổi học. Sau mỗi buổi học hoàn tất và hết 24h khiếu nại, Smart Contract tự động giải ngân 85% cho Gia sư và 15% phí nền tảng.`
        : `Lớp học đang diễn ra (${settledSessions}/${totalSessions} buổi). Sau mỗi buổi học được điểm danh hoàn thành, Smart Contract sẽ giải ngân $${(pricePerSession * 0.85).toFixed(2)} USDC cho Gia sư.`,
      status: settledSessions >= totalSessions && totalSessions > 0
        ? 'COMPLETED'
        : (currentStatus === 'ACTIVE')
        ? 'IN_PROGRESS'
        : 'PENDING',
      amountUsdc: settledSessions > 0
        ? (settledSessions * pricePerSession).toFixed(2)
        : pricePerSession.toFixed(2),
    },
    {
      title: '5. Nghiệm thu & Hoàn tất Hợp đồng (Completed)',
      description: currentStatus === 'COMPLETED'
        ? 'Toàn bộ khóa học đã hoàn tất trọn vẹn và toàn bộ học phí ký quỹ đã được giải ngân minh bạch trên Blockchain.'
        : 'Hợp đồng sẽ chính thức đóng sau khi hoàn tất toàn bộ các buổi học và giải ngân hết quỹ ký quỹ.',
      status: currentStatus === 'COMPLETED' ? 'COMPLETED' : 'PENDING',
    },
  ];

  return (
    <div className={`bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm ${className}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shadow-2xs">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-display font-black text-base sm:text-lg text-slate-900">
              Nhật Ký Minh Chứng Blockchain (Audit Trail)
            </h3>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">
              Hợp đồng: <strong className="text-slate-800">{displayClassName}</strong> &bull; Mã Escrow: <span className="font-mono">{agreementId.slice(0, 14)}...</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadAuditData}
            disabled={loading}
            className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors"
            title="Tải lại nhật ký"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
          <span
            className={`px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${
              currentStatus === 'ACTIVE'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : currentStatus === 'COMPLETED'
                ? 'bg-blue-50 text-blue-800 border-blue-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
          >
            {currentStatus}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="text-xs font-bold">Đang truy xuất dữ liệu minh chứng từ Blockchain...</span>
        </div>
      ) : (
        /* Stepper Timeline */
        <div className="relative pl-6 sm:pl-8 space-y-8 before:absolute before:left-3 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
          {events.map((event, index) => {
            const isCompleted = event.status === 'COMPLETED';
            const isInProgress = event.status === 'IN_PROGRESS';
            const isDisputed = event.status === 'DISPUTED';

            return (
              <div key={index} className="relative group">
                {/* Status Circle Node */}
                <div
                  className={`absolute -left-6 sm:-left-8 top-0 w-6 h-6 rounded-full border-2 bg-white flex items-center justify-center transition-all ${
                    isCompleted
                      ? 'border-emerald-500 text-emerald-500 shadow-xs'
                      : isInProgress
                      ? 'border-blue-600 bg-blue-50 text-blue-600 ring-4 ring-blue-100 animate-pulse'
                      : isDisputed
                      ? 'border-rose-500 text-rose-500'
                      : 'border-slate-300 text-slate-300'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 fill-emerald-500 text-white" />
                  ) : (
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isInProgress ? 'bg-blue-600' : 'bg-slate-300'
                      }`}
                    />
                  )}
                </div>

                {/* Event Content Card */}
                <div
                  className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                    isInProgress
                      ? 'bg-blue-50/50 border-blue-200 shadow-2xs'
                      : isCompleted
                      ? 'bg-slate-50/90 border-slate-200/90'
                      : 'bg-white border-slate-200/60 opacity-60'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                    <h4 className="font-bold text-slate-900 text-xs sm:text-sm">{event.title}</h4>
                    {event.timestamp && (
                      <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {event.timestamp}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed mb-3 font-medium">
                    {event.description}
                  </p>

                  {/* Tx Hash & Metadata Row */}
                  {(event.txHash || event.amountUsdc || event.blockNumber) && (
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-slate-200/70 text-xs">
                      <div className="flex items-center gap-3 text-slate-500 text-[11px]">
                        {event.blockNumber && (
                          <span className="font-mono font-bold text-slate-600">Block: {event.blockNumber}</span>
                        )}
                        {event.amountUsdc && (
                          <span className="font-mono font-black text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded-md border border-emerald-200">
                            ${event.amountUsdc} USDC
                          </span>
                        )}
                      </div>

                      {event.txHash && event.txHash.startsWith('0x') && (
                        <EtherscanLink
                          txHash={event.txHash}
                          chainId={activeChainId}
                          label="Xem giao dịch trên Etherscan Sepolia"
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ContractAuditTimeline;
