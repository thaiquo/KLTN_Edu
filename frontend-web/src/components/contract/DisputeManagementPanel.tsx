import React, { useState } from 'react';
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
  Lock
} from 'lucide-react';
import { EtherscanLink } from '../common/EtherscanLink';
import { useWeb3Wallet } from '../../web3/useWeb3Wallet';
import { EscrowContractService } from '../../web3/escrowContractService';
import { DEFAULT_CHAIN_ID } from '../../web3/web3Config';
import { ethers } from 'ethers';

export interface DisputeItem {
  id: string | number;
  agreementId: number;
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
  status: 'OPEN' | 'RESOLUTION_PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  disputeDeadline?: string;
  openTxHash?: string;
  resolveTxHash?: string;
  resolutionAuditHash?: string;
}

interface DisputeManagementPanelProps {
  activeRole: 'student' | 'tutor' | 'staff' | 'admin';
  userEmail?: string;
  disputes?: DisputeItem[];
  onOpenDispute?: (agreementId: number, sessionId: number, reason: string, evidenceHash: string) => Promise<void>;
  onResolveDispute?: (disputeId: string | number, approveRefund: boolean, auditProofHash: string) => Promise<void>;
}

// Sample fallback disputes for demonstration if empty
const SAMPLE_DISPUTES: DisputeItem[] = [
  {
    id: 'dsp-101',
    agreementId: 1,
    sessionId: 3,
    studentName: 'Alex Thompson',
    studentEmail: 'student@educonnect.vn',
    studentAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    tutorName: 'Dr. Julian Vance',
    tutorAddress: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    classroomReviewerEmail: 'staff@educonnect.vn',
    sessionTitle: 'Buổi 3: Vi phân hàm nhiều biến & Tích phân mặt',
    disputeReason: 'Gia sư chỉ dạy 15 phút rồi tắt máy và không quay lại',
    evidenceSummary: 'File ghi hình Zoom 15 phút + Tin nhắn Zalo xác nhận rời sớm',
    evidenceHash: '0x4f8b1c4e7a2b9d3e8f1a2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f',
    status: 'OPEN',
    createdAt: '2026-08-27 14:30',
    disputeDeadline: '2026-08-28 14:30 (Còn 18 giờ)',
    openTxHash: '0x3a1f8b...c9d0',
  },
  {
    id: 'dsp-102',
    agreementId: 2,
    sessionId: 1,
    studentName: 'Sarah Reed',
    studentEmail: 'sarah.reed@gmail.com',
    studentAddress: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    tutorName: 'Dr. Sarah Jenkins',
    tutorAddress: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
    classroomReviewerEmail: 'staff.reviewer@educonnect.vn',
    sessionTitle: 'Buổi 1: Tổng quan Prompt Engineering cơ bản',
    disputeReason: 'Gia sư vắng mặt không lý do nhưng vẫn đánh dấu hoàn thành',
    evidenceSummary: 'Biên bản log Google Meet 0 participants sau 30 phút chờ',
    evidenceHash: '0x9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8d',
    status: 'APPROVED',
    createdAt: '2026-08-26 10:00',
    openTxHash: '0x5b2c1d...f8e9',
    resolveTxHash: '0x7c3e2f...a1b2',
    resolutionAuditHash: '0x1a2b3c...4d5e',
  },
];

export function DisputeManagementPanel({
  activeRole,
  userEmail = 'staff@educonnect.vn',
  disputes = SAMPLE_DISPUTES,
  onOpenDispute,
  onResolveDispute,
}: DisputeManagementPanelProps) {
  const { chainId, signer } = useWeb3Wallet();
  const activeChainId = chainId || DEFAULT_CHAIN_ID;

  // New dispute modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [agreementIdInput, setAgreementIdInput] = useState<string>('1');
  const [sessionIdInput, setSessionIdInput] = useState<string>('1');
  const [reasonInput, setReasonInput] = useState<string>('');
  const [evidenceTextInput, setEvidenceTextInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Resolution state
  const [resolvingId, setResolvingId] = useState<string | number | null>(null);

  // Compute SHA-256 evidence hash
  const generateEvidenceHash = (text: string): string => {
    try {
      return ethers.keccak256(ethers.toUtf8Bytes(text || 'EduConnect_Evidence_Placeholder'));
    } catch {
      return '0x0000000000000000000000000000000000000000000000000000000000000000';
    }
  };

  const handleCreateDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reasonInput) {
      setActionError('Vui lòng nhập lý do khiếu nại.');
      return;
    }

    try {
      setIsSubmitting(true);
      setActionError(null);
      const computedHash = generateEvidenceHash(reasonInput + evidenceTextInput);

      if (signer) {
        const escrowService = new EscrowContractService(activeChainId);
        const tx = await escrowService.openTutorFraudDispute(
          signer,
          agreementIdInput,
          sessionIdInput,
          computedHash
        );
        await tx.wait(1);
      }

      if (onOpenDispute) {
        await onOpenDispute(Number(agreementIdInput), Number(sessionIdInput), reasonInput, computedHash);
      }

      setActionSuccess(`Đã mở khiếu nại thành công cho Buổi học #${sessionIdInput}!`);
      setIsCreateModalOpen(false);
      setReasonInput('');
      setEvidenceTextInput('');
    } catch (err: any) {
      setActionError(err?.reason || err?.message || 'Không thể tạo khiếu nại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolve = async (dispute: DisputeItem, approveRefund: boolean) => {
    try {
      setResolvingId(dispute.id);
      setActionError(null);
      const auditProofHash = ethers.keccak256(
        ethers.toUtf8Bytes(`AUDIT_RESOLUTION:${userEmail}:${dispute.id}:${approveRefund}:${Date.now()}`)
      );

      if (signer) {
        const escrowService = new EscrowContractService(activeChainId);
        const tx = await escrowService.resolveTutorFraudDispute(
          signer,
          dispute.agreementId,
          dispute.sessionId,
          approveRefund,
          auditProofHash
        );
        await tx.wait(1);
      }

      if (onResolveDispute) {
        await onResolveDispute(dispute.id, approveRefund, auditProofHash);
      }

      setActionSuccess(
        `Đã phân xử thành công: ${
          approveRefund ? 'Chấp thuận hoàn tiền cho học viên' : 'Bác bỏ khiếu nại, giải ngân cho gia sư'
        }!`
      );
    } catch (err: any) {
      setActionError(err?.reason || err?.message || 'Lỗi khi phân xử khiếu nại.');
    } finally {
      setResolvingId(null);
    }
  };

  // Check authorization for Staff
  const canStaffResolve = (dispute: DisputeItem): boolean => {
    if (activeRole === 'admin') return true;
    if (activeRole === 'staff') {
      return (
        !!dispute.classroomReviewerEmail &&
        dispute.classroomReviewerEmail.toLowerCase() === userEmail.toLowerCase()
      );
    }
    return false;
  };

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
              Trung Tâm Quản Lý & Phân Xử Khiếu Nại (Dispute Resolution)
            </h2>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">
              Phân xử minh bạch trên Smart Contract Escrow bảo vệ quyền lợi đôi bên
            </p>
          </div>
        </div>

        {activeRole === 'student' && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
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

      {/* Dispute List Cards */}
      <div className="space-y-4">
        {disputes.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 text-slate-400">
            <ShieldAlert className="w-12 h-12 mx-auto mb-3 opacity-40 text-slate-400" />
            <p className="font-bold text-sm text-slate-600">Không có khiếu nại nào cần xử lý</p>
            <p className="text-xs text-slate-400 mt-1">Mọi buổi học đều diễn ra an toàn và đúng tiến độ.</p>
          </div>
        ) : (
          disputes.map((dispute) => {
            const hasResolvePermission = canStaffResolve(dispute);

            return (
              <div
                key={dispute.id}
                className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all p-6 space-y-5"
              >
                {/* Header Row */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider ${
                        dispute.status === 'OPEN'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : dispute.status === 'APPROVED'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-rose-100 text-rose-800 border border-rose-200'
                      }`}
                    >
                      {dispute.status === 'OPEN'
                        ? 'ĐANG MỞ KHIẾU NẠI'
                        : dispute.status === 'APPROVED'
                        ? 'HOÀN TIỀN CHO HỌC VIÊN'
                        : 'BÁC BỎ - TRẢ TIỀN GIA SƯ'}
                    </span>
                    <span className="text-xs font-bold text-slate-400">ID #{dispute.id}</span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Tạo lúc: {dispute.createdAt}</span>
                    {dispute.disputeDeadline && (
                      <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                        {dispute.disputeDeadline}
                      </span>
                    )}
                  </div>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Left Col: Session & Reason */}
                  <div className="md:col-span-2 space-y-3">
                    <div>
                      <h4 className="font-bold text-slate-900 text-base">{dispute.sessionTitle}</h4>
                      <p className="text-xs text-slate-400 font-semibold">
                        Hợp đồng #{dispute.agreementId} - Buổi học #{dispute.sessionId}
                      </p>
                    </div>

                    <div className="bg-rose-50/50 border border-rose-100 rounded-2xl p-4 space-y-2">
                      <div className="flex items-center gap-1.5 text-rose-900 font-bold text-xs">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>Lý do khiếu nại của học viên:</span>
                      </div>
                      <p className="text-xs text-slate-700 font-medium pl-5">{dispute.disputeReason}</p>
                    </div>

                    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 text-xs space-y-1.5">
                      <div className="flex items-center gap-1.5 font-bold text-slate-700">
                        <FileText className="w-3.5 h-3.5 text-slate-500" />
                        <span>Bằng chứng đính kèm:</span>
                      </div>
                      <p className="text-slate-600 text-[11px] pl-5">{dispute.evidenceSummary}</p>
                      <div className="flex items-center gap-2 pl-5 font-mono text-[10px] text-slate-500">
                        <Hash className="w-3 h-3 text-slate-400" />
                        <span className="truncate">Evidence Hash: {dispute.evidenceHash}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Col: Parties & Blockchain Audit Links */}
                  <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4 space-y-3 flex flex-col justify-between">
                    <div className="space-y-2.5 text-xs">
                      <div>
                        <span className="text-slate-400 font-semibold block text-[11px]">Học viên khiếu nại:</span>
                        <span className="font-bold text-slate-800">{dispute.studentName}</span>
                        <div className="mt-0.5">
                          <EtherscanLink address={dispute.studentAddress} chainId={activeChainId} />
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-400 font-semibold block text-[11px]">Gia sư bị khiếu nại:</span>
                        <span className="font-bold text-slate-800">{dispute.tutorName}</span>
                        <div className="mt-0.5">
                          <EtherscanLink address={dispute.tutorAddress} chainId={activeChainId} />
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
                          {resolvingId === dispute.id ? 'Đang gửi tx...' : 'Bác bỏ khiếu nại (Trả tiền gia sư)'}
                        </button>
                        <button
                          onClick={() => handleResolve(dispute, true)}
                          disabled={resolvingId === dispute.id}
                          className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md hover:shadow transition-all disabled:opacity-50"
                        >
                          {resolvingId === dispute.id ? 'Đang gửi tx...' : 'Chấp thuận (Hoàn tiền học viên)'}
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

      {/* Create Dispute Modal for Student */}
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Mã Hợp Đồng (Agreement ID)</label>
                  <input
                    type="number"
                    value={agreementIdInput}
                    onChange={(e) => setAgreementIdInput(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-rose-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Mã Buổi Học (Session ID)</label>
                  <input
                    type="number"
                    value={sessionIdInput}
                    onChange={(e) => setSessionIdInput(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-rose-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Lý do khiếu nại chi tiết</label>
                <textarea
                  rows={3}
                  value={reasonInput}
                  onChange={(e) => setReasonInput(e.target.value)}
                  placeholder="Mô tả cụ thể sự việc (ví dụ: gia sư đến muộn 45 phút, giảng dạy sai nội dung cam kết...)"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-rose-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Đường dẫn bằng chứng / Ghi chú</label>
                <input
                  type="text"
                  value={evidenceTextInput}
                  onChange={(e) => setEvidenceTextInput(e.target.value)}
                  placeholder="Link Google Drive, S3 hình ảnh hoặc file log..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-rose-500"
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
                  disabled={isSubmitting}
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
    </div>
  );
}

export default DisputeManagementPanel;
