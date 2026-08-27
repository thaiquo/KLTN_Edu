import React, { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Coins,
  Lock,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  FileText,
  User,
  Calendar,
  Layers,
  ArrowUpRight,
  Filter
} from 'lucide-react';
import { EtherscanLink } from '../common/EtherscanLink';
import { EscrowPaymentModal, AgreementPaymentDetails } from './EscrowPaymentModal';
import { DisputeManagementPanel } from './DisputeManagementPanel';
import { ContractAuditTimeline } from './ContractAuditTimeline';
import { useWeb3Wallet } from '../../web3/useWeb3Wallet';
import { DEFAULT_CHAIN_ID } from '../../web3/web3Config';

export interface AgreementSummary {
  id: number;
  onchainAgreementId: number;
  classTitle: string;
  subjectName: string;
  studentName: string;
  studentEmail: string;
  studentAddress: string;
  tutorName: string;
  tutorAddress: string;
  totalSessions: number;
  settledSessions: number;
  pricePerSession: number;
  totalAmount: number;
  remainingDeposit: number;
  status: 'REGISTERED' | 'FUNDED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
  fundedTxHash?: string;
}

interface EscrowContractsViewProps {
  activeRole: 'student' | 'tutor' | 'staff' | 'admin';
  userEmail?: string;
}

const SAMPLE_AGREEMENTS: AgreementSummary[] = [
  {
    id: 1,
    onchainAgreementId: 1,
    classTitle: 'Toán Cao Cấp A1 - Giải tích hàm một biến & nhiều biến',
    subjectName: 'Toán đại học',
    studentName: 'Alex Thompson',
    studentEmail: 'student@educonnect.vn',
    studentAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    tutorName: 'Dr. Julian Vance',
    tutorAddress: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    totalSessions: 10,
    settledSessions: 3,
    pricePerSession: 15,
    totalAmount: 150,
    remainingDeposit: 105,
    status: 'FUNDED',
    createdAt: '2026-08-20',
    fundedTxHash: '0x2b9f0a1c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0',
  },
  {
    id: 2,
    onchainAgreementId: 2,
    classTitle: 'Full Stack Web Development with React & Node.js',
    subjectName: 'Lập trình Web',
    studentName: 'Sarah Reed',
    studentEmail: 'sarah.reed@gmail.com',
    studentAddress: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    tutorName: 'Alex Rivera',
    tutorAddress: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
    totalSessions: 8,
    settledSessions: 0,
    pricePerSession: 20,
    totalAmount: 160,
    remainingDeposit: 0,
    status: 'REGISTERED',
    createdAt: '2026-08-26',
  },
  {
    id: 3,
    onchainAgreementId: 3,
    classTitle: 'Mastering AI Prompt Engineering & LLMs for Enterprise',
    subjectName: 'Trí tuệ nhân tạo',
    studentName: 'Leo Martinez',
    studentEmail: 'leo.m@educonnect.vn',
    studentAddress: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
    tutorName: 'Dr. Sarah Jenkins',
    tutorAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    totalSessions: 5,
    settledSessions: 5,
    pricePerSession: 25,
    totalAmount: 125,
    remainingDeposit: 0,
    status: 'COMPLETED',
    createdAt: '2026-08-10',
    fundedTxHash: '0x8f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1',
  },
];

export function EscrowContractsView({
  activeRole,
  userEmail = 'student@educonnect.vn',
}: EscrowContractsViewProps) {
  const { chainId } = useWeb3Wallet();
  const activeChainId = chainId || DEFAULT_CHAIN_ID;

  const [activeTab, setActiveTab] = useState<'AGREEMENTS' | 'DISPUTES' | 'TIMELINE'>('AGREEMENTS');
  const [selectedAgreementForPayment, setSelectedAgreementForPayment] = useState<AgreementPaymentDetails | null>(null);
  const [selectedAgreementForTimeline, setSelectedAgreementForTimeline] = useState<AgreementSummary | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const filteredAgreements = SAMPLE_AGREEMENTS.filter((item) => {
    if (statusFilter === 'ALL') return true;
    return item.status === statusFilter;
  });

  const handleOpenPayment = (agreement: AgreementSummary) => {
    setSelectedAgreementForPayment({
      agreementId: agreement.id,
      onchainAgreementId: agreement.onchainAgreementId,
      classTitle: agreement.classTitle,
      tutorName: agreement.tutorName,
      tutorAddress: agreement.tutorAddress,
      studentAddress: agreement.studentAddress,
      totalSessions: agreement.totalSessions,
      pricePerSession: agreement.pricePerSession,
      totalAmount: agreement.totalAmount,
      platformFeePercent: 5,
    });
  };

  const handleOpenTimeline = (agreement: AgreementSummary) => {
    setSelectedAgreementForTimeline(agreement);
    setActiveTab('TIMELINE');
  };

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
            Hợp Đồng ({SAMPLE_AGREEMENTS.length})
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

      {/* Main View Body */}
      {activeTab === 'AGREEMENTS' && (
        <div className="space-y-6">
          {/* Status Filter Bar */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" />
                Lọc trạng thái:
              </span>
              {['ALL', 'REGISTERED', 'FUNDED', 'COMPLETED'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    statusFilter === st
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {st === 'ALL'
                    ? 'Tất cả'
                    : st === 'REGISTERED'
                    ? 'Chờ ký quỹ'
                    : st === 'FUNDED'
                    ? 'Đã ký quỹ'
                    : 'Hoàn tất'}
                </button>
              ))}
            </div>

            <div className="text-xs text-slate-500 font-semibold">
              Hiển thị <strong>{filteredAgreements.length}</strong> hợp đồng
            </div>
          </div>

          {/* Agreements Grid Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredAgreements.map((item) => {
              const isRegistered = item.status === 'REGISTERED';
              const isFunded = item.status === 'FUNDED';
              const isCompleted = item.status === 'COMPLETED';

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all space-y-5 flex flex-col justify-between"
                >
                  {/* Top Row: Title & Status */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold font-mono">
                        Agreement #{item.onchainAgreementId}
                      </span>

                      <span
                        className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider ${
                          isFunded
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : isRegistered
                            ? 'bg-amber-100 text-amber-800 border border-amber-200 animate-pulse'
                            : 'bg-blue-100 text-blue-800 border border-blue-200'
                        }`}
                      >
                        {isRegistered
                          ? 'CHỜ HỌC VIÊN KÝ QUỸ'
                          : isFunded
                          ? 'ĐÃ KÝ QUỸ (FUNDED)'
                          : 'HOÀN TẤT (COMPLETED)'}
                      </span>
                    </div>

                    <h3 className="font-bold text-slate-900 text-base leading-snug">
                      {item.classTitle}
                    </h3>
                    <p className="text-xs text-blue-600 font-bold">{item.subjectName}</p>
                  </div>

                  {/* Info Table */}
                  <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 space-y-2.5 text-xs">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-slate-400 font-semibold block text-[11px]">Học viên:</span>
                        <span className="font-bold text-slate-800">{item.studentName}</span>
                        <div className="mt-0.5">
                          <EtherscanLink address={item.studentAddress} chainId={activeChainId} />
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-400 font-semibold block text-[11px]">Gia sư:</span>
                        <span className="font-bold text-slate-800">{item.tutorName}</span>
                        <div className="mt-0.5">
                          <EtherscanLink address={item.tutorAddress} chainId={activeChainId} />
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-slate-200/60 pt-2.5 grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-slate-400 font-semibold block text-[11px]">Tiến độ buổi học:</span>
                        <span className="font-mono font-bold text-slate-800">
                          {item.settledSessions} / {item.totalSessions} buổi đã quyết toán
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-400 font-semibold block text-[11px]">Tổng giá trị ký quỹ:</span>
                        <span className="font-mono font-black text-emerald-600 text-sm">
                          ${item.totalAmount} USDC
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Footer Action Buttons */}
                  <div className="border-t border-slate-100 pt-4 flex items-center justify-between gap-3">
                    <button
                      onClick={() => handleOpenTimeline(item)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Xem Blockchain Audit</span>
                    </button>

                    {isRegistered && activeRole === 'student' && (
                      <button
                        onClick={() => handleOpenPayment(item)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-display font-black rounded-xl shadow-sm hover:shadow transition-all"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>Ký quỹ ngay (${item.totalAmount} USDC)</span>
                      </button>
                    )}

                    {isFunded && (
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
                        Đang bảo vệ bởi Escrow
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Disputes View Tab */}
      {activeTab === 'DISPUTES' && (
        <DisputeManagementPanel
          activeRole={activeRole}
          userEmail={userEmail}
        />
      )}

      {/* Timeline View Tab */}
      {activeTab === 'TIMELINE' && selectedAgreementForTimeline && (
        <div className="space-y-4">
          <button
            onClick={() => setActiveTab('AGREEMENTS')}
            className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
          >
            ← Quay lại danh sách hợp đồng
          </button>
          <ContractAuditTimeline
            agreementId={selectedAgreementForTimeline.onchainAgreementId}
            contractStatus={selectedAgreementForTimeline.status}
            chainId={activeChainId}
          />
        </div>
      )}

      {/* Escrow Payment Modal for Students */}
      {selectedAgreementForPayment && (
        <EscrowPaymentModal
          isOpen={!!selectedAgreementForPayment}
          onClose={() => setSelectedAgreementForPayment(null)}
          agreement={selectedAgreementForPayment}
          onPaymentSuccess={(txHash) => {
            console.log('Payment completed:', txHash);
          }}
        />
      )}
    </div>
  );
}

export default EscrowContractsView;
