import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Coins,
  ArrowRight,
  Lock,
  ExternalLink,
  X,
  RefreshCw,
  Sparkles,
  Info
} from 'lucide-react';
import { useWeb3Wallet } from '../../web3/useWeb3Wallet';
import { EscrowContractService } from '../../web3/escrowContractService';
import { EtherscanLink } from '../common/EtherscanLink';
import { DEFAULT_CHAIN_ID } from '../../web3/web3Config';
import { ethers } from 'ethers';

export interface AgreementPaymentDetails {
  agreementId: number | string;
  onchainAgreementId: number | string;
  classTitle: string;
  tutorName: string;
  tutorAddress: string;
  studentAddress?: string;
  totalSessions: number;
  pricePerSession: number;
  totalAmount: number; // in USDC (e.g. 100)
  platformFeePercent?: number; // e.g. 5%
}

interface EscrowPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  agreement: AgreementPaymentDetails;
  onPaymentSuccess?: (txHash: string) => void;
}

type PaymentStep = 'REVIEW' | 'APPROVING' | 'FUNDING' | 'SUCCESS' | 'ERROR';

export function EscrowPaymentModal({
  isOpen,
  onClose,
  agreement,
  onPaymentSuccess,
}: EscrowPaymentModalProps) {
  const {
    address,
    chainId,
    isConnected,
    signer,
    usdcBalance,
    connectWallet,
    switchNetwork,
    refreshBalances,
  } = useWeb3Wallet();

  const [currentStep, setCurrentStep] = useState<PaymentStep>('REVIEW');
  const [allowance, setAllowance] = useState<bigint>(0n);
  const [isCheckingAllowance, setIsCheckingAllowance] = useState(false);
  const [approvalTxHash, setApprovalTxHash] = useState<string | null>(null);
  const [fundingTxHash, setFundingTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const activeChainId = chainId || DEFAULT_CHAIN_ID;
  const escrowService = new EscrowContractService(activeChainId);

  // Convert human USDC amount to 6 decimals units
  const totalAmountUnits = ethers.parseUnits(
    agreement.totalAmount.toString(),
    6
  );

  // Check allowance when modal opens or address/chain changes
  useEffect(() => {
    async function checkAllowance() {
      if (isOpen && address && signer) {
        try {
          setIsCheckingAllowance(true);
          const currentAllowance = await escrowService.getUsdcAllowance(signer, address);
          setAllowance(currentAllowance);
        } catch (err: any) {
          console.warn('Error checking allowance:', err?.message || err);
        } finally {
          setIsCheckingAllowance(false);
        }
      }
    }

    if (isOpen) {
      setCurrentStep('REVIEW');
      setApprovalTxHash(null);
      setFundingTxHash(null);
      setErrorMessage(null);
      setIsProcessing(false);
      checkAllowance();
    }
  }, [isOpen, address, signer, activeChainId]);

  if (!isOpen) return null;

  const hasEnoughAllowance = allowance >= totalAmountUnits;
  const userHasEnoughBalance = parseFloat(usdcBalance) >= agreement.totalAmount;

  // Step 1: Approve USDC spending
  const handleApproveUsdc = async () => {
    if (!signer || !address) {
      await connectWallet();
      return;
    }

    try {
      setIsProcessing(true);
      setCurrentStep('APPROVING');
      setErrorMessage(null);

      // Approve slightly higher or exact amount
      const tx = await escrowService.approveUsdc(signer, totalAmountUnits);
      setApprovalTxHash(tx.hash);

      // Wait for transaction confirmation
      const receipt = await tx.wait(1);
      if (receipt && receipt.status === 1) {
        setAllowance(totalAmountUnits);
        setCurrentStep('REVIEW'); // Ready to fund
      } else {
        throw new Error('Giao dịch Approve thất bại trên blockchain.');
      }
    } catch (err: any) {
      console.error('Approve failed:', err);
      setCurrentStep('ERROR');
      setErrorMessage(err?.reason || err?.message || 'Không thể phê duyệt (Approve) USDC.');
    } finally {
      setIsProcessing(false);
      refreshBalances();
    }
  };

  // Step 2: Fund Escrow Contract
  const handleFundEscrow = async () => {
    if (!signer || !address) {
      await connectWallet();
      return;
    }

    try {
      setIsProcessing(true);
      setCurrentStep('FUNDING');
      setErrorMessage(null);

      const tx = await escrowService.fundAgreement(signer, agreement.onchainAgreementId);
      setFundingTxHash(tx.hash);

      const receipt = await tx.wait(1);
      if (receipt && receipt.status === 1) {
        setCurrentStep('SUCCESS');
        refreshBalances();
        if (onPaymentSuccess) {
          onPaymentSuccess(tx.hash);
        }
      } else {
        throw new Error('Giao dịch Ký quỹ Escrow thất bại.');
      }
    } catch (err: any) {
      console.error('Funding failed:', err);
      setCurrentStep('ERROR');
      setErrorMessage(err?.reason || err?.message || 'Lỗi khi thực hiện ký quỹ vào Smart Contract.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/20">
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-display font-black text-lg text-white">
                Ký Quỹ Khóa Học (Smart Contract Escrow)
              </h3>
              <p className="text-xs text-blue-100/70 font-semibold">
                Bảo vệ 100% tài chính bằng Hợp đồng thông minh
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="text-white/70 hover:text-white p-1 rounded-xl hover:bg-white/10 transition-colors disabled:opacity-30"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* Agreement Overview Card */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-2.5">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Khóa học</span>
                <h4 className="font-bold text-slate-900 text-sm">{agreement.classTitle}</h4>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 text-[11px] font-extrabold">
                ID #{agreement.onchainAgreementId}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400 font-semibold block">Gia sư phụ trách:</span>
                <span className="font-bold text-slate-800">{agreement.tutorName}</span>
                <div className="mt-0.5">
                  <EtherscanLink
                    address={agreement.tutorAddress}
                    chainId={activeChainId}
                    truncateLength={4}
                  />
                </div>
              </div>
              <div>
                <span className="text-slate-400 font-semibold block">Số buổi học:</span>
                <span className="font-bold text-slate-800">{agreement.totalSessions} buổi</span>
                <span className="text-slate-400 block text-[11px]">
                  (${agreement.pricePerSession} USDC / buổi)
                </span>
              </div>
            </div>

            <div className="border-t border-slate-200/60 pt-2.5 flex items-center justify-between">
              <span className="font-bold text-slate-700 text-xs">Tổng số tiền ký quỹ:</span>
              <div className="text-right">
                <span className="text-lg font-black text-emerald-600 font-mono">
                  ${agreement.totalAmount.toLocaleString()} USDC
                </span>
                <span className="text-[11px] text-slate-400 block">
                  (Phí nền tảng: {agreement.platformFeePercent || 5}%)
                </span>
              </div>
            </div>
          </div>

          {/* Web3 Wallet Status Check */}
          {!isConnected ? (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-amber-600 mx-auto" />
              <div>
                <p className="font-bold text-sm text-amber-900">Chưa kết nối ví Web3</p>
                <p className="text-xs text-amber-700">
                  Bạn cần kết nối ví (MetaMask, Rabby hoặc WalletConnect) để thực hiện ký quỹ.
                </p>
              </div>
              <button
                onClick={connectWallet}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-display font-black rounded-xl shadow-sm hover:shadow transition-all"
              >
                Kết nối ví ngay
              </button>
            </div>
          ) : !userHasEnoughBalance ? (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-xs text-red-900">Số dư USDC không đủ</p>
                <p className="text-xs text-red-700 mt-0.5">
                  Ví của bạn hiện có <strong>${usdcBalance} USDC</strong>, cần tối thiểu{' '}
                  <strong>${agreement.totalAmount} USDC</strong> để hoàn tất ký quỹ.
                </p>
              </div>
            </div>
          ) : null}

          {/* Progress / Step Indicators */}
          <div className="grid grid-cols-2 gap-3">
            {/* Step 1: Approve */}
            <div
              className={`p-3 rounded-2xl border transition-all ${
                hasEnoughAllowance
                  ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                  : currentStep === 'APPROVING'
                  ? 'bg-blue-50 border-blue-300 text-blue-900 ring-2 ring-blue-500/20'
                  : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-black uppercase tracking-wider">
                  Bước 1: Phê duyệt (Approve)
                </span>
                {hasEnoughAllowance ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Coins className="w-4 h-4 text-slate-400" />
                )}
              </div>
              <p className="text-[11px] leading-tight text-slate-500">
                {hasEnoughAllowance
                  ? 'Đã cấp quyền chi tiêu USDC thành công.'
                  : 'Cho phép Smart Contract rút đúng số tiền học phí.'}
              </p>
              {approvalTxHash && (
                <div className="mt-2">
                  <EtherscanLink txHash={approvalTxHash} chainId={activeChainId} label="Xem Tx Approve" />
                </div>
              )}
            </div>

            {/* Step 2: Fund Escrow */}
            <div
              className={`p-3 rounded-2xl border transition-all ${
                currentStep === 'SUCCESS'
                  ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                  : currentStep === 'FUNDING'
                  ? 'bg-blue-50 border-blue-300 text-blue-900 ring-2 ring-blue-500/20'
                  : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-black uppercase tracking-wider">
                  Bước 2: Ký quỹ (Deposit)
                </span>
                {currentStep === 'SUCCESS' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Lock className="w-4 h-4 text-slate-400" />
                )}
              </div>
              <p className="text-[11px] leading-tight text-slate-500">
                {currentStep === 'SUCCESS'
                  ? 'Khóa học đã được ký quỹ an toàn!'
                  : 'Khóa tiền vào Smart Contract cho đến khi hoàn thành buổi học.'}
              </p>
              {fundingTxHash && (
                <div className="mt-2">
                  <EtherscanLink txHash={fundingTxHash} chainId={activeChainId} label="Xem Tx Ký quỹ" />
                </div>
              )}
            </div>
          </div>

          {/* Error Notice */}
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Giao dịch không thành công</p>
                <p className="text-[11px] mt-0.5 break-words">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Success Banner */}
          {currentStep === 'SUCCESS' && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-2">
              <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                <Sparkles className="w-5 h-5" />
              </div>
              <h4 className="font-display font-black text-emerald-900 text-sm">
                Ký Quỹ Thành Công Vào Smart Contract!
              </h4>
              <p className="text-xs text-emerald-700 max-w-sm mx-auto">
                Hợp đồng #{agreement.onchainAgreementId} đã chuyển sang trạng thái <strong>FUNDED</strong>.
                Học viên và gia sư có thể bắt đầu các buổi học ngay lập tức.
              </p>
            </div>
          )}

          {/* Safety Guarantee Info */}
          <div className="flex items-start gap-2 bg-blue-50/60 border border-blue-100 rounded-xl p-3 text-[11px] text-blue-900">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <strong>Cơ chế bảo vệ học viên:</strong> Tiền được giữ an toàn trên hợp đồng thông minh. Tiền chỉ được giải ngân cho gia sư sau khi từng buổi học diễn ra đúng cam kết và vượt qua khung giờ khiếu nại (24h).
            </div>
          </div>
        </div>

        {/* Modal Footer / Action Buttons */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex items-center justify-between">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 transition-colors disabled:opacity-40"
          >
            {currentStep === 'SUCCESS' ? 'Đóng' : 'Hủy bỏ'}
          </button>

          <div className="flex items-center gap-3">
            {!hasEnoughAllowance ? (
              <button
                onClick={handleApproveUsdc}
                disabled={!isConnected || !userHasEnoughBalance || isProcessing}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-display font-black rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50"
              >
                {isProcessing && currentStep === 'APPROVING' ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Coins className="w-4 h-4" />
                )}
                <span>1. Phê duyệt USDC</span>
              </button>
            ) : currentStep !== 'SUCCESS' ? (
              <button
                onClick={handleFundEscrow}
                disabled={!isConnected || !userHasEnoughBalance || isProcessing}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-display font-black rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50"
              >
                {isProcessing && currentStep === 'FUNDING' ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Lock className="w-4 h-4" />
                )}
                <span>2. Ký quỹ ${agreement.totalAmount} USDC</span>
              </button>
            ) : (
              <button
                onClick={onClose}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-display font-black rounded-xl shadow-md transition-all"
              >
                Hoàn tất
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default EscrowPaymentModal;
