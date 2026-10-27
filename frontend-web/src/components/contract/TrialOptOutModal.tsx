import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Loader2,
  FileSignature,
  Wallet,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { AgreementSummary, TrialDetail, contractsApi } from '../../api/contractsApi';
import { signTerminationRequestEip712 } from '../../web3/eip712Signer';
import { useWeb3Wallet } from '../../web3/useWeb3Wallet';
import { DEFAULT_CHAIN_ID } from '../../web3/web3Config';
import { formatUnits } from 'ethers';

function formatUsdcUnits(value?: string): string {
  try {
    return Number(formatUnits(BigInt(value || '0'), 6)).toLocaleString('vi-VN', {
      maximumFractionDigits: 6,
    });
  } catch {
    return '0';
  }
}

export interface TrialOptOutModalProps {
  isOpen: boolean;
  onClose: () => void;
  agreement: AgreementSummary;
  trial: TrialDetail;
  onSuccess?: () => void;
}

export function TrialOptOutModal({
  isOpen,
  onClose,
  agreement,
  trial,
  onSuccess
}: TrialOptOutModalProps) {
  const { address, chainId, switchNetwork } = useWeb3Wallet();

  const [reason, setReason] = useState('Dừng trong giai đoạn trải nghiệm (Trial opt-out)');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Countdown timer derived from serverNow and trialDeadline
  const [timeLeftMs, setTimeLeftMs] = useState<number>(() => {
    const deadline = new Date(trial.trialDeadline).getTime();
    const serverNow = new Date(trial.serverNow).getTime();
    return Math.max(0, deadline - serverNow);
  });

  useEffect(() => {
    if (!isOpen) return;
    const deadline = new Date(trial.trialDeadline).getTime();
    const serverNow = new Date(trial.serverNow).getTime();
    const clientStart = Date.now();
    setTimeLeftMs(Math.max(0, deadline - serverNow));

    const interval = setInterval(() => {
      const elapsed = Date.now() - clientStart;
      const remaining = Math.max(0, deadline - (serverNow + elapsed));
      setTimeLeftMs(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, trial.trialDeadline, trial.serverNow]);

  const formatCountdown = (ms: number) => {
    if (ms <= 0) return 'Đã hết hạn';
    const totalSecs = Math.floor(ms / 1000);
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days} ngày ${hours % 24} giờ`;
    }
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const expectedWallet = (agreement.studentWallet || '').toLowerCase().trim();
  const currentWalletNormalized = (address || '').toLowerCase().trim();
  const isWalletMatched = expectedWallet && currentWalletNormalized === expectedWallet;
  const expectedChainId = agreement.chainId || DEFAULT_CHAIN_ID;
  const isChainMatched = chainId === expectedChainId;

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (timeLeftMs <= 0) {
      setError('Thời hạn dừng trong giai đoạn trải nghiệm đã kết thúc (TRIAL_WINDOW_CLOSED).');
      return;
    }

    if (!acceptedTerms) {
      setError('Vui lòng đánh dấu xác nhận bạn đã đọc và đồng ý trước khi ký.');
      return;
    }

    if (!address) {
      setError('Bạn chưa kết nối Ví MetaMask. Vui lòng kết nối ví trước khi tiếp tục.');
      return;
    }

    if (!isWalletMatched) {
      setError(
        `Ví MetaMask đang chọn (${address.slice(0, 6)}...${address.slice(-4)}) không khớp với ví đã ký hợp đồng (${expectedWallet.slice(0, 6)}...${expectedWallet.slice(-4)}).`
      );
      return;
    }

    if (!isChainMatched) {
      setError(`Vui lòng chuyển ví sang đúng mạng hợp đồng (Chain ID ${expectedChainId}).`);
      return;
    }

    try {
      setLoading(true);
      const signedReason = reason.trim() || 'Dừng trong giai đoạn trải nghiệm (Trial opt-out)';

      // Sign EIP-712 typed data
      const sigResult = await signTerminationRequestEip712(
        {
          agreementId: agreement.id,
          expectedWallet: agreement.studentWallet,
          reason: signedReason,
          wholeClass: false,
          chainId: agreement.chainId || DEFAULT_CHAIN_ID,
          escrowContractAddress: agreement.escrowContractAddress || undefined,
        },
        address
      );

      // Call trial opt-out API
      await contractsApi.trialOptOut(agreement.id, {
        reason: signedReason,
        signature: sigResult.signature,
        signerWallet: sigResult.signerWallet,
        requestedAtTimestamp: sigResult.requestedAt,
      });

      setSuccessMsg('Đã ghi nhận yêu cầu dừng học thành công! Hệ thống đang chuyển sang tiến trình quyết toán và hoàn cọc Escrow.');
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err?.message || 'Không thể gửi yêu cầu dừng trong giai đoạn trải nghiệm.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <div className="w-full max-w-xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-purple-400/20 text-purple-300 rounded-full border border-purple-400/30">
                Giai đoạn trải nghiệm Escrow
              </span>
              <span className="flex items-center gap-1 text-[11px] font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-400/30">
                <Clock className="w-3.5 h-3.5" />
                {formatCountdown(timeLeftMs)}
              </span>
            </div>
            <h3 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-purple-400 shrink-0" />
              <span>Dừng khóa học trong giai đoạn trải nghiệm</span>
            </h3>
            <p className="text-xs text-slate-300">
              {agreement.className || 'Khóa học'} &bull; Mã HĐ: {agreement.id.slice(0, 8)}...
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">

          {/* Trial Refund Estimation Breakdown */}
          <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-2xl space-y-3">
            <span className="text-xs font-black uppercase tracking-wider text-purple-950 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-purple-700" /> Phân bổ tài chính & Hoàn trả dự kiến
            </span>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-white rounded-xl border border-purple-100 shadow-2xs">
                <span className="text-[11px] text-slate-500 font-semibold block">Buổi trải nghiệm</span>
                <strong className="text-slate-800 text-sm font-bold block pt-0.5">
                  Buổi #{trial.trialSessionSequence || 1}
                </strong>
                <span className="text-[10px] text-slate-500 leading-tight block pt-1">
                  Được quyết toán theo điểm danh thực tế
                </span>
              </div>

              <div className="p-3 bg-white rounded-xl border border-purple-100 shadow-2xs">
                <span className="text-[11px] text-purple-700 font-semibold block">Hoàn cọc chưa sử dụng</span>
                <strong className="text-emerald-700 text-base font-black block pt-0.5">
                  {formatUsdcUnits(trial.estimatedUnusedRefundUnits)} {agreement.tokenSymbol}
                </strong>
                <span className="text-[10px] text-slate-500 leading-tight block pt-1">
                  100% học phí các buổi tương lai
                </span>
              </div>
            </div>

            <div className="text-[11px] text-purple-900 bg-purple-100/50 p-2.5 rounded-xl border border-purple-200/60 leading-relaxed font-medium">
              💡 <strong>Lưu ý về tiến độ hoàn tiền:</strong> Smart Contract Escrow sẽ thực hiện hoàn trả phần tiền chưa sử dụng về ví MetaMask của bạn ngay khi buổi trải nghiệm hoàn tất đối soát (cửa sổ giải quyết tranh chấp 24 giờ kết thúc).
            </div>
          </div>

          {/* Time Critical Warning */}
          <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-2xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <p className="font-bold text-amber-950">
                Hạn chót tiếp nhận: {new Date(trial.trialDeadline).toLocaleString('vi-VN')}
              </p>
              <p className="text-amber-800 text-[11px] leading-relaxed">
                Yêu cầu chỉ hợp lệ khi máy chủ nhận được chữ ký hoàn chỉnh trước deadline. Vui lòng ký trước ít nhất 2 phút để phòng ngừa độ trễ mạng hoặc tắc nghẽn RPC.
              </p>
            </div>
          </div>

          {/* Student reason / note */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800">
              Lý do hoặc phản hồi cho Gia sư (tùy chọn):
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="VD: Khung giờ học không còn phù hợp, muốn đổi lộ trình học khác..."
              className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>

          {/* Wallet check */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-bold flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5" /> Ví ký hợp đồng:
              </span>
              <span className="font-mono text-[11px] font-bold text-slate-800">
                {expectedWallet.slice(0, 8)}...{expectedWallet.slice(-6)}
              </span>
            </div>

            {!isWalletMatched && address && (
              <p className="text-rose-600 font-bold text-[11px] flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                Ví hiện tại ({address.slice(0, 6)}...{address.slice(-4)}) không khớp với ví hợp đồng.
              </p>
            )}

            {!isChainMatched && (
              <div className="flex items-center justify-between pt-1">
                <span className="text-amber-700 font-bold text-[11px]">Chưa đúng mạng (Chain {expectedChainId})</span>
                <button
                  type="button"
                  onClick={() => switchNetwork(expectedChainId)}
                  className="px-2.5 py-1 text-[10px] font-bold bg-amber-600 text-white rounded-lg hover:bg-amber-700"
                >
                  Chuyển mạng
                </button>
              </div>
            )}
          </div>

          {/* Checkbox confirmation */}
          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-0.5 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
            />
            <span className="text-xs text-slate-700 leading-relaxed font-medium">
              Tôi xác nhận dừng học trong giai đoạn trải nghiệm. Tôi hiểu rằng sau khi ký EIP-712 hợp lệ, các buổi học tương lai sẽ được hủy và quyết toán hoàn cọc sẽ được xử lý theo chính sách Escrow.
            </span>
          </label>

          {/* Error / Success Feedback */}
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-all"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={loading || timeLeftMs <= 0 || !acceptedTerms || !isWalletMatched || !isChainMatched}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 text-white text-xs font-black transition-all shadow-md flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang xử lý chữ ký...</span>
                </>
              ) : (
                <>
                  <FileSignature className="w-4 h-4" />
                  <span>Ký MetaMask Dừng học</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
