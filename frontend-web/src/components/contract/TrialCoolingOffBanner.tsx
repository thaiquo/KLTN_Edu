import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Clock,
  AlertTriangle,
  ChevronRight,
  CheckCircle2,
  Lock,
  ArrowRight,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { AgreementSummary, TrialDetail } from '../../api/contractsApi';
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

export interface TrialCoolingOffBannerProps {
  agreement: AgreementSummary;
  trial: TrialDetail;
  isStudent: boolean;
  activeTermination?: {
    status: string;
    itemStatus?: string;
    transactionHash?: string | null;
  };
  onOpenOptOut?: () => void;
  onRefresh?: () => void;
}

export function TrialCoolingOffBanner({
  agreement,
  trial,
  isStudent,
  activeTermination,
  onOpenOptOut,
  onRefresh
}: TrialCoolingOffBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  // Countdown timer derived from serverNow and trialDeadline
  const [timeLeftMs, setTimeLeftMs] = useState<number>(() => {
    const deadline = new Date(trial.trialDeadline).getTime();
    const serverNow = new Date(trial.serverNow).getTime();
    return Math.max(0, deadline - serverNow);
  });

  useEffect(() => {
    if (trial.trialStatus !== 'DECISION_OPEN') return;
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
        if (onRefresh) onRefresh();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [trial.trialStatus, trial.trialDeadline, trial.serverNow, onRefresh]);

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

  // Status: DECISION_OPEN
  if (trial.trialStatus === 'DECISION_OPEN' && !dismissed) {
    return (
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-purple-900/95 via-indigo-950 to-slate-900 text-white border-2 border-purple-500/40 shadow-xl space-y-3.5 animate-in fade-in">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/20 text-purple-300 border border-purple-400/30 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-400/20 text-purple-300 border border-purple-400/30">
                  Giai đoạn trải nghiệm Escrow
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-amber-300 bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-400/30">
                  <Clock className="w-3.5 h-3.5" />
                  Còn {formatCountdown(timeLeftMs)}
                </span>
              </div>
              <h4 className="font-extrabold text-sm sm:text-base text-white pt-0.5">
                Buổi trải nghiệm #{trial.trialSessionSequence || 1} đã hoàn thành
              </h4>
            </div>
          </div>

          {isStudent && trial.canOptOut && (
            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 pt-1 sm:pt-0">
              <button
                type="button"
                onClick={() => setDismissed(true)}
                className="px-3.5 py-2 text-xs font-bold text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                title="Đóng thông báo này. Bạn vẫn có quyền dừng học trước hạn chót."
              >
                Tiếp tục học
              </button>
              <button
                type="button"
                onClick={onOpenOptOut}
                className="flex-1 sm:flex-none px-4 py-2 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white text-xs font-black rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Dừng học & Hoàn cọc</span>
              </button>
            </div>
          )}
        </div>

        <p className="text-xs text-purple-200/90 leading-relaxed max-w-3xl font-medium">
          Bạn có thể đánh giá chất lượng buổi học đầu tiên và đưa ra quyết định trước khi buổi học kế tiếp bắt đầu ({new Date(trial.trialDeadline).toLocaleString('vi-VN')}). Nếu quyết định dừng học, học phí các buổi chưa học (ước tính <strong>{formatUsdcUnits(trial.estimatedUnusedRefundUnits)} {agreement.tokenSymbol}</strong>) sẽ được hoàn sau khi đối soát on-chain.
        </p>
      </div>
    );
  }

  // Status: OPT_OUT_PENDING (Refund progress tracker)
  if (trial.trialStatus === 'OPT_OUT_PENDING') {
    return (
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 text-white border-2 border-purple-500/40 shadow-xl space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-400/30 flex items-center justify-center shrink-0">
              <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-purple-400 block">
                Tiến trình hoàn cọc trải nghiệm
              </span>
              <h4 className="font-extrabold text-sm text-white">
                Đã tiếp nhận yêu cầu dừng học trong giai đoạn trải nghiệm
              </h4>
            </div>
          </div>
          <span className="text-xs font-bold text-amber-300 bg-amber-500/20 px-3 py-1 rounded-full border border-amber-400/30">
            Ước tính hoàn: {formatUsdcUnits(trial.estimatedUnusedRefundUnits)} {agreement.tokenSymbol}
          </span>
        </div>

        {/* 4-Step Refund Progress Tracker with dynamic state */}
        {(() => {
          const termStatus = activeTermination?.status;
          const itemStatus = activeTermination?.itemStatus;

          const isStep2Done = termStatus === 'APPROVED' || !!itemStatus;
          const isStep2Running = !isStep2Done && termStatus === 'HOLD_PENDING';

          const isStep3Done = itemStatus === 'BLOCKCHAIN_PENDING' || itemStatus === 'WAITING_REFUND_EVENT' || itemStatus === 'COMPLETED';
          const isStep3Running = !isStep3Done && (itemStatus === 'WAITING_SETTLEMENT' || isStep2Done);

          const isStep4Done = itemStatus === 'COMPLETED';
          const isStep4Running = !isStep4Done && (itemStatus === 'BLOCKCHAIN_PENDING' || itemStatus === 'WAITING_REFUND_EVENT');

          return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1 text-xs">
              {/* Step 1 */}
              <div className="p-2.5 bg-slate-800/80 rounded-xl border border-emerald-500/40 space-y-1">
                <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>1. Tiếp nhận yêu cầu</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">
                  Đã chốt cutoff Buổi #{trial.trialSessionSequence || 1}
                </p>
              </div>

              {/* Step 2 */}
              <div className={`p-2.5 bg-slate-800/80 rounded-xl border space-y-1 ${
                isStep2Done ? 'border-emerald-500/40' : isStep2Running ? 'border-amber-500/40' : 'border-slate-700 opacity-70'
              }`}>
                <div className={`flex items-center gap-1.5 font-bold text-[11px] ${
                  isStep2Done ? 'text-emerald-400' : isStep2Running ? 'text-amber-400' : 'text-slate-400'
                }`}>
                  {isStep2Done ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : isStep2Running ? <RefreshCw className="w-3.5 h-3.5 shrink-0 animate-spin" /> : <Lock className="w-3.5 h-3.5 shrink-0" />}
                  <span>2. Tạm dừng lịch học</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">
                  {isStep2Done ? `Đã dừng lịch từ Buổi #${(trial.trialSessionSequence || 1) + 1}` : isStep2Running ? 'Đang đồng bộ với Learning Service' : 'Chờ hoàn thành bước trước'}
                </p>
              </div>

              {/* Step 3 */}
              <div className={`p-2.5 bg-slate-800/80 rounded-xl border space-y-1 ${
                isStep3Done ? 'border-emerald-500/40' : isStep3Running ? 'border-amber-500/40' : 'border-slate-700 opacity-70'
              }`}>
                <div className={`flex items-center gap-1.5 font-bold text-[11px] ${
                  isStep3Done ? 'text-emerald-400' : isStep3Running ? 'text-amber-400' : 'text-slate-400'
                }`}>
                  {isStep3Done ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : isStep3Running ? <Clock className="w-3.5 h-3.5 shrink-0" /> : <Lock className="w-3.5 h-3.5 shrink-0" />}
                  <span>3. Quyết toán Buổi {trial.trialSessionSequence || 1}</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">
                  {isStep3Done ? `Đã quyết toán xong Buổi #${trial.trialSessionSequence || 1}` : isStep3Running ? 'Chờ cửa sổ khiếu nại 24h kết thúc' : 'Chờ hoàn thành bước trước'}
                </p>
              </div>

              {/* Step 4 */}
              <div className={`p-2.5 bg-slate-800/80 rounded-xl border space-y-1 ${
                isStep4Done ? 'border-emerald-500/40' : isStep4Running ? 'border-amber-500/40' : 'border-slate-700 opacity-70'
              }`}>
                <div className={`flex items-center gap-1.5 font-bold text-[11px] ${
                  isStep4Done ? 'text-emerald-400' : isStep4Running ? 'text-amber-400' : 'text-slate-400'
                }`}>
                  {isStep4Done ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : isStep4Running ? <RefreshCw className="w-3.5 h-3.5 shrink-0 animate-spin" /> : <Lock className="w-3.5 h-3.5 shrink-0" />}
                  <span>4. Hoàn cọc on-chain</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">
                  {isStep4Done ? 'Smart Contract đã hoàn tiền về ví' : isStep4Running ? (activeTermination?.transactionHash ? `Tx: ${activeTermination.transactionHash.slice(0, 10)}...` : 'Đang xử lý giao dịch hoàn tiền...') : 'Smart Contract chuyển USDC về ví'}
                </p>
              </div>
            </div>
          );
        })()}

        <p className="text-[11px] text-slate-300 leading-relaxed">
          ℹ️ <strong>Quy tắc giải ngân Escrow:</strong> Buổi học đầu tiên vẫn được thanh toán theo điểm danh; số tiền của các buổi chưa học sẽ được hoàn lại nguyên vẹn ngay sau khi buổi 1 hoàn tất đối soát on-chain.
        </p>
      </div>
    );
  }

  // System safety path: funding confirmation arrived after session 1 started.
  if (trial.trialStatus === 'LATE_FUNDING_RECOVERY') {
    return (
      <div className="p-4 sm:p-5 rounded-2xl bg-amber-950/80 text-white border-2 border-amber-500/40 shadow-xl space-y-2">
        <div className="flex items-center gap-2.5">
          <AlertTriangle className="w-5 h-5 text-amber-300 shrink-0" />
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 block">
              Đối soát ký quỹ trễ
            </span>
            <h4 className="font-extrabold text-sm text-white">
              Không kích hoạt buổi học — hệ thống đang hủy hợp đồng và hoàn toàn bộ cọc chưa sử dụng
            </h4>
          </div>
        </div>
        <p className="text-xs text-amber-100/90 leading-relaxed">
          Giao dịch được xác nhận sau khi Buổi 1 đã bắt đầu nên hệ thống đã chốt cutoff 0, không tạo quyền tham gia lớp và đưa hồ sơ vào pipeline hoàn tiền on-chain. Không cần gửi thêm yêu cầu dừng học.
        </p>
      </div>
    );
  }

  // Status: TERMINATED
  if (trial.trialStatus === 'TERMINATED') {
    return (
      <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs font-bold flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
        <span>Giai đoạn trải nghiệm đã kết thúc • Đã hoàn tất hoàn trả số tiền ký quỹ chưa sử dụng về ví MetaMask của Học viên.</span>
      </div>
    );
  }

  // Status: CONTINUED
  if (trial.trialStatus === 'CONTINUED') {
    return (
      <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-300 text-xs font-medium flex items-start gap-2">
        <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
        <span>
          Đã hết thời hạn dừng học thử tự động • Khóa học đang tiếp tục theo hợp đồng đã ký.
          Nếu phát sinh sự cố, Học viên vẫn có thể gửi <strong>yêu cầu chấm dứt thông thường</strong> để Staff/Admin xét duyệt; đây không còn là luồng dừng học thử tự động.
        </span>
      </div>
    );
  }

  return null;
}
