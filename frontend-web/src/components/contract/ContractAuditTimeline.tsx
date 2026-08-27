import React from 'react';
import {
  FileText,
  Lock,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Coins,
  Clock
} from 'lucide-react';
import { EtherscanLink } from '../common/EtherscanLink';
import { DEFAULT_CHAIN_ID } from '../../web3/web3Config';

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
  agreementId: number | string;
  contractStatus: 'REGISTERED' | 'FUNDED' | 'SETTLING' | 'COMPLETED' | 'CANCELLED';
  events?: ContractTimelineEvent[];
  chainId?: number;
  className?: string;
}

const DEFAULT_EVENTS: ContractTimelineEvent[] = [
  {
    title: '1. Khởi tạo Hợp đồng Ký quỹ (Registered)',
    description: 'Hệ thống EduConnect ghi nhận thông tin học viên, gia sư, học phí và tỷ lệ hoa hồng lên Smart Contract.',
    status: 'COMPLETED',
    timestamp: '2026-08-27 09:00',
    blockNumber: '5892104',
    txHash: '0x1a8f9c2d3e4b5a6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0',
    amountUsdc: '100.00',
  },
  {
    title: '2. Học viên Ký quỹ Học phí (Funded)',
    description: 'Học viên phê duyệt và nạp $100 USDC vào Smart Contract Escrow để khóa bảo đảm.',
    status: 'COMPLETED',
    timestamp: '2026-08-27 09:15',
    blockNumber: '5892118',
    txHash: '0x2b9f0a1c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0',
    amountUsdc: '100.00',
  },
  {
    title: '3. Tiến trình Buổi học & Quyết toán từng phần',
    description: 'Hệ thống tự động quyết toán tiền cho gia sư sau khi từng buổi học hoàn tất và hết thời gian khiếu nại (24h).',
    status: 'IN_PROGRESS',
    timestamp: '2026-08-27 15:30',
    blockNumber: '5892250',
    txHash: '0x3c0a1b2d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1',
    amountUsdc: '25.00',
  },
  {
    title: '4. Nghiệm thu & Hoàn tất Hợp đồng (Completed)',
    description: 'Tất cả các buổi học được hoàn thành hoặc hoàn tiền thỏa đáng. Hợp đồng chính thức đóng trên Blockchain.',
    status: 'PENDING',
  },
];

export function ContractAuditTimeline({
  agreementId,
  contractStatus,
  events = DEFAULT_EVENTS,
  chainId = DEFAULT_CHAIN_ID,
  className = '',
}: ContractAuditTimelineProps) {
  return (
    <div className={`bg-white rounded-3xl border border-slate-200 p-6 shadow-sm ${className}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display font-black text-base text-slate-900">
              Nhật Ký Minh Chứng Blockchain (Audit Trail)
            </h3>
            <p className="text-xs text-slate-400 font-semibold">
              Hợp đồng Ký quỹ Escrow #{agreementId}
            </p>
          </div>
        </div>

        <span
          className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
            contractStatus === 'FUNDED'
              ? 'bg-emerald-100 text-emerald-800'
              : contractStatus === 'COMPLETED'
              ? 'bg-blue-100 text-blue-800'
              : 'bg-amber-100 text-amber-800'
          }`}
        >
          {contractStatus}
        </span>
      </div>

      {/* Stepper Timeline */}
      <div className="relative pl-6 space-y-8 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
        {events.map((event, index) => {
          const isCompleted = event.status === 'COMPLETED';
          const isInProgress = event.status === 'IN_PROGRESS';
          const isDisputed = event.status === 'DISPUTED';

          return (
            <div key={index} className="relative group">
              {/* Status Circle Node */}
              <div
                className={`absolute -left-6 top-0 w-5 h-5 rounded-full border-2 bg-white flex items-center justify-center transition-all ${
                  isCompleted
                    ? 'border-emerald-500 text-emerald-500'
                    : isInProgress
                    ? 'border-blue-600 bg-blue-50 text-blue-600 ring-4 ring-blue-100 animate-pulse'
                    : isDisputed
                    ? 'border-rose-500 text-rose-500'
                    : 'border-slate-300 text-slate-300'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-3.5 h-3.5 fill-emerald-500 text-white" />
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
                className={`p-4 rounded-2xl border transition-all ${
                  isInProgress
                    ? 'bg-blue-50/40 border-blue-200'
                    : isCompleted
                    ? 'bg-slate-50/80 border-slate-200/80'
                    : 'bg-white border-slate-200/60 opacity-60'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <h4 className="font-bold text-slate-900 text-sm">{event.title}</h4>
                  {event.timestamp && (
                    <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {event.timestamp}
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-600 leading-relaxed mb-3">
                  {event.description}
                </p>

                {/* Tx Hash & Metadata Row */}
                {(event.txHash || event.amountUsdc || event.blockNumber) && (
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200/60 text-xs font-mono">
                    <div className="flex items-center gap-3 text-slate-500 text-[11px]">
                      {event.blockNumber && (
                        <span>Block: #{event.blockNumber}</span>
                      )}
                      {event.amountUsdc && (
                        <span className="font-bold text-emerald-600">
                          ${event.amountUsdc} USDC
                        </span>
                      )}
                    </div>

                    {event.txHash && (
                      <EtherscanLink
                        txHash={event.txHash}
                        chainId={chainId}
                        label="Xem trên Etherscan"
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ContractAuditTimeline;
