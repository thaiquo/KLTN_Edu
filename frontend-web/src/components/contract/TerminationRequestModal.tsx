import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  FileSignature,
  Wallet,
  CheckCircle2,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { AgreementSummary } from '../../api/contractsApi';
import { terminationsApi } from '../../api/terminationsApi';
import { signTerminationRequestEip712 } from '../../web3/eip712Signer';
import { useWeb3Wallet } from '../../web3/useWeb3Wallet';

export interface TerminationAgreementTarget {
  id: string;
  className?: string;
  classroomId?: number;
  studentWallet: string;
  tutorWallet: string;
  pricePerSessionUsdc?: number;
  settledSessions?: number;
  totalSessions?: number;
  remainingAmountUsdc?: number;
  totalAmountUsdc?: number;
  chainId?: number;
  escrowContractAddress?: string;
}

export interface TerminationRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  agreement: TerminationAgreementTarget | AgreementSummary;
  activeRole: string;
  defaultWholeClass?: boolean;
  lockWholeClass?: boolean;
  title?: string;
  description?: string;
  onSuccess?: () => void;
}

export function TerminationRequestModal({
  isOpen,
  onClose,
  agreement,
  activeRole,
  defaultWholeClass,
  lockWholeClass,
  title,
  description,
  onSuccess
}: TerminationRequestModalProps) {
  const { address } = useWeb3Wallet();

  const normalizedRole = (activeRole || '').toLowerCase();
  const isStudent = normalizedRole === 'student';
  const isTutor = normalizedRole === 'tutor';

  // Expected immutable wallet from contract agreement
  const expectedWallet = isStudent
    ? agreement.studentWallet
    : isTutor
    ? agreement.tutorWallet
    : agreement.studentWallet;

  const [wholeClass, setWholeClass] = useState(defaultWholeClass ?? (!isStudent));
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const currentWalletNormalized = address ? address.toLowerCase().trim() : '';
  const expectedWalletNormalized = expectedWallet ? expectedWallet.toLowerCase().trim() : '';
  const isWalletMatched = Boolean(
    currentWalletNormalized &&
    expectedWalletNormalized &&
    currentWalletNormalized === expectedWalletNormalized
  );

  const pricePerSession = agreement.pricePerSessionUsdc || 0;
  const settledSessions = agreement.settledSessions || 0;
  const totalSessions = agreement.totalSessions || 0;
  const remainingSessions = Math.max(0, totalSessions - settledSessions);
  const estimatedRefund = Number(agreement.remainingAmountUsdc ?? (remainingSessions * pricePerSession)).toFixed(2);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!reason.trim()) {
      setError('Vui lòng nêu rõ lý do và hoàn cảnh cần kết thúc hợp đồng.');
      return;
    }

    if (!address) {
      setError('Bạn chưa kết nối Ví Web3 MetaMask. Vui lòng kết nối ví trước.');
      return;
    }

    if (!expectedWallet || expectedWallet.trim() === '' || expectedWallet.toLowerCase() === '0x' + '0'.repeat(40)) {
      setError('Hợp đồng chưa liên kết địa chỉ ví blockchain hợp lệ.');
      return;
    }

    if (!isWalletMatched) {
      setError(
        `Ví MetaMask đang chọn (${address.slice(0, 6)}...${address.slice(-4)}) không khớp với ví đã ký hợp đồng/nạp cọc (${expectedWallet.slice(0, 6)}...${expectedWallet.slice(-4)}). Vui lòng chuyển sang đúng ví trên MetaMask.`
      );
      return;
    }

    try {
      setLoading(true);

      // 1. Sign EIP-712 typed data with MetaMask using user's private key
      const sigResult = await signTerminationRequestEip712(
        {
          agreementId: agreement.id,
          expectedWallet: expectedWallet,
          reason: reason.trim(),
          wholeClass: wholeClass,
          chainId: agreement.chainId,
          escrowContractAddress: agreement.escrowContractAddress,
        },
        address
      );

      // 2. Send payload to backend with signature verification
      await terminationsApi.request(
        agreement.id,
        wholeClass,
        reason.trim(),
        sigResult.signature,
        sigResult.signerWallet,
        sigResult.requestedAt
      );

      setSuccessMsg('Đã gửi yêu cầu kết thúc hợp đồng với chữ ký số xác thực thành công!');
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Termination request error:', err);
      setError(err?.message || 'Không thể gửi yêu cầu kết thúc hợp đồng.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-xl rounded-3xl bg-white shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-gradient-to-r from-amber-50/50 via-white to-rose-50/30">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-md shadow-amber-500/20">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display font-black text-lg text-slate-900">
                {title || (wholeClass ? "Đề Xuất Dừng Giảng Dạy & Hủy Cả Lớp" : "Yêu Cầu Kết Thúc Hợp Đồng")}
              </h3>
              <p className="text-xs font-semibold text-slate-500">
                {description || (wholeClass ? "Gia sư đề xuất dừng giảng dạy • Toàn bộ cọc chưa học sẽ được hoàn lại cho học viên" : "Xác thực chữ ký số bằng ví MetaMask • Bảo vệ quyền lợi tài chính")}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6 space-y-5">
          {/* Agreement Info Box */}
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Lớp học</span>
                <span className="font-bold text-slate-800 text-sm">
                  {agreement.className || `Lớp #${agreement.classroomId}`}
                </span>
                <span className="block text-xs text-slate-500 font-mono mt-0.5">Mã HĐ: #{agreement.id.slice(0, 8)}</span>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Tiến độ</span>
                <span className="font-black text-slate-800 text-sm">
                  {settledSessions} / {totalSessions} buổi
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200/60 text-xs">
              <div>
                <span className="text-slate-500 font-medium">Tổng giá trị ký quỹ:</span>
                <p className="font-bold text-slate-800">${Number(agreement.totalAmountUsdc || 0).toFixed(2)} USDC</p>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Dự kiến tiền hoàn:</span>
                <p className="font-black text-emerald-700 font-mono text-sm">${estimatedRefund} USDC</p>
              </div>
            </div>
          </div>

          {/* Wallet Verification Alert */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
              Xác thực ví Web3 người thực hiện
            </label>
            <div className="rounded-2xl border p-3.5 space-y-2 text-xs transition-colors bg-white">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium flex items-center gap-1.5">
                  <Wallet size={14} className="text-blue-600" /> Ví hợp đồng (đã nạp/ký):
                </span>
                <span className="font-mono font-bold text-slate-800">
                  {expectedWallet ? `${expectedWallet.slice(0, 8)}...${expectedWallet.slice(-6)}` : 'Chưa cập nhật'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium flex items-center gap-1.5">
                  <FileSignature size={14} className="text-indigo-600" /> Ví MetaMask hiện tại:
                </span>
                <span className="font-mono font-bold text-slate-800">
                  {address ? `${address.slice(0, 8)}...${address.slice(-6)}` : 'Chưa kết nối ví'}
                </span>
              </div>

              <div className="pt-2 border-t border-slate-100">
                {isWalletMatched ? (
                  <div className="flex items-center gap-2 text-emerald-700 font-bold bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                    <CheckCircle2 size={15} />
                    <span>Ví MetaMask trùng khớp hoàn toàn. Hợp lệ để ký xác nhận.</span>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 text-rose-700 font-bold bg-rose-50 px-3 py-2 rounded-xl border border-rose-200">
                    <XCircle size={15} className="shrink-0 mt-0.5" />
                    <span>
                      Ví đang kết nối không trùng khớp với ví đã ký hợp đồng. Bạn phải đổi sang đúng ví {expectedWallet.slice(0, 6)}...{expectedWallet.slice(-4)} trên MetaMask.
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <form id="termination-form" onSubmit={handleSubmit} className="space-y-4">
            {/* Scope Selection */}
            {lockWholeClass ? (
              <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-2xl text-xs text-amber-950 space-y-1">
                <span className="font-bold flex items-center gap-1.5 text-amber-900">
                  <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                  {wholeClass ? "Phạm vi: Dừng giảng dạy toàn bộ lớp học" : "Phạm vi: Một hợp đồng riêng lẻ của bạn"}
                </span>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  {wholeClass
                    ? "Đề xuất này áp dụng cho toàn bộ các học viên trong lớp. Toàn bộ tiền học phí chưa học của các học viên sẽ được Smart Contract Escrow hoàn lại trực tiếp về ví của từng học viên sau khi được Admin phê duyệt."
                    : "Yêu cầu kết thúc chỉ áp dụng cho hợp đồng cá nhân của bạn với gia sư."}
                </p>
              </div>
            ) : (
              !isStudent && (
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                    Phạm vi kết thúc
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setWholeClass(false)}
                      className={`p-3 rounded-2xl border text-left text-xs font-bold transition-all ${
                        !wholeClass
                          ? 'border-blue-500 bg-blue-50/50 text-blue-900 shadow-xs'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      Chỉ hợp đồng này
                      <span className="block font-normal text-[11px] text-slate-500 mt-0.5">
                        Áp dụng cho riêng học viên này
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setWholeClass(true)}
                      className={`p-3 rounded-2xl border text-left text-xs font-bold transition-all ${
                        wholeClass
                          ? 'border-rose-500 bg-rose-50/50 text-rose-900 shadow-xs'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      Toàn bộ lớp học
                      <span className="block font-normal text-[11px] text-slate-500 mt-0.5">
                        Áp dụng toàn bộ học viên trong lớp
                      </span>
                    </button>
                  </div>
                </div>
              )
            )}

            {/* Reason Input */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                Lý do kết thúc hợp đồng & giải trình <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                maxLength={5000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={loading}
                placeholder="Nêu rõ hoàn cảnh, lý do (sự cố bất khả kháng, sức khỏe, tai nạn, vi phạm thỏa thuận...) và tài liệu minh chứng kèm theo..."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all resize-none"
              />
              <p className="text-[11px] text-slate-400 text-right mt-1">{reason.length} / 5000 ký tự</p>
            </div>

            {/* Security Guarantee Notice */}
            <div className="rounded-2xl border border-amber-200/80 bg-amber-50/60 p-3.5 flex items-start gap-2.5 text-xs text-amber-900">
              <ShieldCheck className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
              <p className="leading-relaxed">
                Để đảm bảo an toàn tài sản, khi bấm gửi, <strong>MetaMask sẽ yêu cầu bạn ký điện tử EIP-712</strong> bằng Private Key. Không ai có thể giả mạo yêu cầu nếu không sở hữu ví của bạn. Thao tác hoàn toàn <strong>miễn phí gas</strong>.
              </p>
            </div>

            {error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span className="font-semibold">{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-700 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span className="font-semibold">{successMsg}</span>
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Hủy bỏ
          </button>
          <button
            type="submit"
            form="termination-form"
            disabled={loading || !isWalletMatched || !reason.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-rose-600 text-xs font-bold text-white shadow-md shadow-amber-600/20 hover:from-amber-700 hover:to-rose-700 disabled:opacity-50 transition-all cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Đang chờ ký MetaMask...</span>
              </>
            ) : (
              <>
                <FileSignature size={14} />
                <span>Ký xác nhận MetaMask & Gửi yêu cầu</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
