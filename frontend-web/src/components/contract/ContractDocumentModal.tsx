import React, { useEffect, useState } from "react";
import {
  Building,
  Check,
  CheckCircle2,
  Copy,
  FileSignature,
  FileText,
  GraduationCap,
  Printer,
  RefreshCw,
  User,
  X,
  AlertTriangle,
  Clock,
  ShieldCheck,
  CreditCard,
  ChevronRight,
  Ban
} from "lucide-react";
import {
  ContractDocumentParty,
  ContractDocumentView,
  ContractDocumentArtifact,
  ContractSignatureProof,
  contractsApi
} from "../../api/contractsApi";
import { useAuth } from "../../hooks/useAuth";
import { useWeb3Wallet } from "../../web3/useWeb3Wallet";
import { signContractAgreementEip712 } from "../../web3/eip712Signer";
import { DEFAULT_CHAIN_ID } from "../../web3/web3Config";

interface ContractDocumentModalProps {
  agreementId: string;
  onClose: () => void;
  onSignedSuccess?: () => void;
  onRequestPayment?: () => void;
}

const MISSING_VALUE = "Chưa cập nhật";

function displayValue(value: string | number | null | undefined): string {
  return value === null || value === undefined || String(value).trim() === "" ? MISSING_VALUE : String(value);
}

function formatDate(value: string | null | undefined, includeTime = false): string {
  if (!value) return MISSING_VALUE;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return MISSING_VALUE;
  return includeTime ? date.toLocaleString("vi-VN") : date.toLocaleDateString("vi-VN");
}

function formatDecimal(value: string | null | undefined, fractionDigits = 2): string {
  if (!value) return MISSING_VALUE;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return displayValue(value);
  return parsed.toLocaleString("vi-VN", { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits });
}

function blockchainNetwork(chainId: number | null): string {
  if (chainId === null) return MISSING_VALUE;
  if (chainId === 11155111) return `Ethereum Sepolia Testnet (Chain ID: ${chainId})`;
  return `Mạng EVM (Chain ID: ${chainId})`;
}

export function ContractDocumentModal({
  agreementId,
  onClose,
  onSignedSuccess,
  onRequestPayment
}: ContractDocumentModalProps) {
  const { user, activeRole } = useAuth();
  const { address } = useWeb3Wallet();

  const [document, setDocument] = useState<ContractDocumentView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await contractsApi.getContractDocument(agreementId);
      setDocument(data);
    } catch (loadError: any) {
      console.error("Failed to load contract document:", loadError);
      setDocument(null);
      setError(loadError?.message || "Không thể tải dữ liệu hợp đồng từ hệ thống. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [agreementId, user?.id, user?.email]);

  useEffect(() => {
    const previousOverflow = window.document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !signing && !downloading) onClose();
    };

    window.document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [downloading, onClose, signing]);

  const copyToClipboard = (text: string, fieldName: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    window.setTimeout(() => setCopiedField(null), 2000);
  };

  const isStudentUser = Boolean(
    activeRole === "student" ||
    (user?.email && document?.student?.email && user.email.toLowerCase() === document.student.email.toLowerCase())
  );

  const isTutorUser = Boolean(
    activeRole === "tutor" ||
    (user?.email && document?.tutor?.email && user.email.toLowerCase() === document.tutor.email.toLowerCase())
  );

  const handleSign = async (targetRole: "TUTOR" | "STUDENT") => {
    if (!document) return;
    const isStudent = targetRole === "STUDENT";
    const contractPartyWallet = isStudent ? document.student.walletAddress : document.tutor.walletAddress;
    const signingWallet = address;

    if (!signingWallet || !signingWallet.startsWith("0x") || signingWallet === "0x0000000000000000000000000000000000000000") {
      alert("Bạn chưa kết nối Ví Web3! Vui lòng kết nối MetaMask trước khi thực hiện ký hợp đồng.");
      return;
    }

    if (contractPartyWallet && contractPartyWallet.startsWith("0x") && signingWallet.toLowerCase() !== contractPartyWallet.toLowerCase()) {
      alert(
        `Ví MetaMask hiện tại (${signingWallet.slice(0, 6)}...${signingWallet.slice(-4)}) không khớp với ví đã đăng ký trong hợp đồng (${contractPartyWallet.slice(0, 6)}...${contractPartyWallet.slice(-4)}). Vui lòng chuyển sang đúng ví trong MetaMask.`
      );
      return;
    }

    setSigning(true);
    try {
      const agreementDetail = await contractsApi.getAgreement(agreementId);
      const studentWalletForSig = isStudent ? signingWallet : (document.student.walletAddress || "0x0000000000000000000000000000000000000000");
      const tutorWalletForSig = !isStudent ? signingWallet : (document.tutor.walletAddress || "0x0000000000000000000000000000000000000000");

      const signature = await signContractAgreementEip712(
        {
          id: agreementId,
          tutorWallet: tutorWalletForSig,
          studentWallet: studentWalletForSig,
          totalAmountUsdc: Number(document.financialTerms.totalAmountUsdc),
          termsHash: document.termsHash || agreementDetail.termsHash,
          createdAt: document.createdAt,
          chainId: document.platform.chainId || DEFAULT_CHAIN_ID,
          escrowContractAddress: document.platform.escrowContractAddress || undefined,
        },
        signingWallet
      );

      if (!signature) {
        throw new Error("Không nhận được chữ ký EIP-712 từ MetaMask.");
      }

      await contractsApi.signAgreement(agreementId, {
        walletAddress: signingWallet,
        signature: signature,
      });

      window.dispatchEvent(new CustomEvent("contract-state-updated", {
        detail: { agreementId, action: "signed", role: targetRole }
      }));

      await loadData();
      if (onSignedSuccess) {
        onSignedSuccess();
      }
    } catch (err: any) {
      alert(err?.message || "Không thể ký hợp đồng.");
    } finally {
      setSigning(false);
    }
  };

  const handleDownload = async (format: "pdf" | "docx") => {
    if (!document) return;
    setDownloading(true);
    try {
      if (document.tutorSignature.signed && document.studentSignature.signed) {
        let artifact = await contractsApi.getContractDocumentArtifact(agreementId).catch(() => null);
        const canFinalize = ["WAITING_PAYMENT", "PAYMENT_CONFIRMING", "ACTIVE", "COMPLETED"].includes(document.status);
        if (artifact?.status !== "READY" && canFinalize) {
          try {
            artifact = await contractsApi.finalizeContractDocument(agreementId);
          } catch (finalizeError: any) {
            // A PDF conversion failure may still leave a valid DOCX artifact available.
            artifact = finalizeError?.raw as ContractDocumentArtifact | null;
            if (!artifact) throw finalizeError;
          }
        }
        const canDownloadDocx = format === "docx" && artifact?.docxAvailable;
        if (artifact?.status === "READY" || canDownloadDocx) {
          const blob = await contractsApi.getContractDocumentFile(agreementId, format);
          const url = URL.createObjectURL(blob);
          const a = window.document.createElement("a");
          a.href = url;
          a.download = `educonnect-contract-${agreementId.slice(0, 8)}.${format}`;
          a.click();
          window.setTimeout(() => URL.revokeObjectURL(url), 1000);
          return;
        }

        if (format === "pdf") {
          // Keep an export route available while the official server-side PDF is being repaired.
          console.warn("Official contract PDF is unavailable; opening the print dialog instead.", artifact?.failureMessage);
          window.print();
          return;
        }
        if (artifact?.status !== "READY") {
          throw new Error(
            artifact?.failureMessage
              || "Tệp hợp đồng chính thức chưa sẵn sàng ở trạng thái hiện tại."
          );
        }
      } else {
        if (format === "pdf") {
          window.print();
        } else {
          const blob = await contractsApi.getContractDocumentFile(agreementId, format).catch(() => null);
          if (blob) {
            const url = URL.createObjectURL(blob);
            const a = window.document.createElement("a");
            a.href = url;
            a.download = `educonnect-contract-${agreementId.slice(0, 8)}.docx`;
            a.click();
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
          } else {
            alert("Bản Word chính thức sẽ hoàn thiện sau khi cả 2 bên hoàn tất ký số EIP-712.");
          }
        }
      }
    } catch (err: any) {
      console.error("Contract document download failed:", err);
      alert(err?.message || `Không thể tải tệp ${format.toUpperCase()} chính thức. Vui lòng thử lại sau.`);
    } finally {
      setDownloading(false);
    }
  };

  // Determine Lifecycle Stage
  const status = document?.status || "DRAFT";
  const tutorSigned = !!document?.tutorSignature?.signed;
  const studentSigned = !!document?.studentSignature?.signed;
  const bothSigned = tutorSigned && studentSigned;
  const isWaitingPayment = status === "WAITING_PAYMENT";
  const isPaymentConfirming = status === "PAYMENT_CONFIRMING";
  const isPreparingBlockchain = status === "PREPARING_BLOCKCHAIN";
  const isActive = status === "ACTIVE";
  const isCompleted = status === "COMPLETED";
  const isFunded = isActive || isCompleted;
  const isExpired = status === "EXPIRED";
  const isCancelled = status === "CANCELLED";
  const paymentWindowHours = document?.escrowPolicy.paymentWindowHours;
  const paymentWindowLabel = paymentWindowHours !== null && paymentWindowHours !== undefined
    ? `${paymentWindowHours} giờ`
    : "thời hạn quy định";
  const canTutorSign = isTutorUser && status === "PENDING_TUTOR_ACCEPTANCE" && !tutorSigned;
  const canStudentSign = isStudentUser
    && status === "PENDING_STUDENT_ACCEPTANCE"
    && tutorSigned
    && !studentSigned;

  // Primary Action Button calculation
  let primaryAction: { label: string; onClick: () => void; icon: any; colorCls: string } | null = null;
  if (!isExpired && !isCancelled) {
    if (canTutorSign) {
      primaryAction = {
        label: "Ký số EIP-712 (Gia sư)",
        onClick: () => void handleSign("TUTOR"),
        icon: FileSignature,
        colorCls: "from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/25",
      };
    } else if (canStudentSign) {
      primaryAction = {
        label: "Ký số EIP-712 (Học viên)",
        onClick: () => void handleSign("STUDENT"),
        icon: FileSignature,
        colorCls: "from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/25",
      };
    } else if (isStudentUser && isWaitingPayment) {
      primaryAction = {
        label: "Nạp cọc Escrow (USDC)",
        onClick: () => {
          if (onRequestPayment) {
            onRequestPayment();
          } else {
            alert("Vui lòng mở mục Quản lý Hợp đồng và bấm nút 'Nạp tiền Ký quỹ' để nạp cọc Escrow.");
          }
        },
        icon: CreditCard,
        colorCls: "from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-500/25",
      };
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center bg-slate-950/80 backdrop-blur-md overflow-y-auto print:p-0 print:bg-white print:static print:overflow-visible print:block select-text"
      role="dialog"
      aria-modal="true"
      aria-labelledby="contract-document-title"
    >
      <style>{`
        .contract-document-paper {
          font-family: "Times New Roman", Times, serif;
          font-size: 14px;
          line-height: 1.65;
          letter-spacing: 0;
          text-rendering: optimizeLegibility;
          -webkit-font-smoothing: antialiased;
          font-kerning: normal;
          word-break: normal;
          overflow-wrap: break-word;
        }
        .contract-document-paper p,
        .contract-document-paper h1,
        .contract-document-paper h3 {
          letter-spacing: 0;
        }
        .contract-document-paper .contract-body {
          text-align: left;
        }
        .contract-document-paper .contract-body p {
          text-align-last: left;
        }
        @media (min-width: 640px) {
          .contract-document-paper .contract-body {
            text-align: justify;
            text-justify: inter-word;
          }
        }
        @media print {
          body { background-color: #fff !important; color: #000 !important; }
          body * { visibility: hidden; }
          #printable-contract-document, #printable-contract-document * { visibility: visible; }
          #printable-contract-document {
            position: absolute;
            left: 0;
            top: 0;
            font-family: "Times New Roman", Times, serif !important;
            font-size: 12pt !important;
            line-height: 1.55 !important;
            width: 100% !important;
            max-width: 100% !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            color: #000 !important;
            box-shadow: none !important;
            border: none !important;
          }
          .page-break-avoid {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .contract-body {
            text-align: justify !important;
            text-justify: inter-word !important;
          }
          .contract-body p {
            text-align-last: left !important;
          }
          @page { size: A4 portrait; margin: 20mm 18mm 20mm 30mm; }
        }
      `}</style>

      {/* STICKY TOP CONTROL TOOLBAR */}
      <header className="sticky top-0 z-30 w-full bg-slate-900/95 border-b border-slate-800 text-white shadow-xl backdrop-blur-md print:hidden px-4 sm:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
        {/* Left Section: Contract Code & Status Tag */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
            <FileSignature className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 id="contract-document-title" className="font-display font-black text-sm text-white">
                Hợp Đồng Điện Tử EIP-712
              </h2>
              <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 font-bold">
                #{agreementId.slice(0, 8)}
              </span>

              {/* Status Badge */}
              {isActive && (
                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Đang hiệu lực (Active)
                </span>
              )}
              {isCompleted && (
                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Đã hoàn thành
                </span>
              )}
              {isWaitingPayment && (
                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  Chờ nạp cọc ({paymentWindowLabel})
                </span>
              )}
              {isPaymentConfirming && (
                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30 animate-pulse">
                  <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                  Đang xác nhận blockchain
                </span>
              )}
              {isPreparingBlockchain && (
                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Đang đăng ký hợp đồng on-chain
                </span>
              )}
              {!bothSigned && !isExpired && !isCancelled && (
                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/30">
                  <Clock className="w-3.5 h-3.5 text-purple-400" />
                  {!tutorSigned ? "Chờ Gia sư ký" : "Chờ Học viên ký"}
                </span>
              )}
              {isExpired && (
                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  Hết hạn nạp cọc
                </span>
              )}
              {isCancelled && (
                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-slate-500/15 text-slate-400 border border-slate-500/30">
                  <Ban className="w-3.5 h-3.5 text-slate-400" />
                  Đã hủy
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Center Section: Compact Lifecycle Stepper (Hidden on small mobile) */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-slate-950/60 rounded-xl border border-slate-800">
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-lg ${tutorSigned ? "text-emerald-400 font-bold" : "text-amber-400"}`}>
            {tutorSigned ? <Check className="w-3.5 h-3.5" /> : <span className="w-3.5 h-3.5 rounded-full bg-amber-400/20 text-center text-[10px] leading-3">1</span>}
            <span>1. Gia sư ký</span>
          </div>
          <ChevronRight className="w-3 h-3 text-slate-600" />
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-lg ${studentSigned ? "text-emerald-400 font-bold" : (tutorSigned ? "text-amber-400" : "text-slate-500")}`}>
            {studentSigned ? <Check className="w-3.5 h-3.5" /> : <span className="w-3.5 h-3.5 rounded-full bg-slate-700 text-center text-[10px] leading-3">2</span>}
            <span>2. Học viên ký</span>
          </div>
          <ChevronRight className="w-3 h-3 text-slate-600" />
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-lg ${isFunded ? "text-emerald-400 font-bold" : ((isWaitingPayment || isPaymentConfirming) ? "text-amber-400" : "text-slate-500")}`}>
            {isFunded ? <Check className="w-3.5 h-3.5" /> : <span className="w-3.5 h-3.5 rounded-full bg-slate-700 text-center text-[10px] leading-3">3</span>}
            <span>3. Nạp cọc Escrow</span>
          </div>
          <ChevronRight className="w-3 h-3 text-slate-600" />
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-lg ${isFunded ? "text-emerald-400 font-extrabold bg-emerald-500/10" : "text-slate-500"}`}>
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>4. Kích hoạt</span>
          </div>
        </div>

        {/* Right Section: Action Controls */}
        <div className="flex w-full sm:w-auto flex-wrap items-center justify-end gap-2 min-w-0">
          {/* Primary Action Button (Sign or Pay) */}
          {primaryAction && (
            <button
              type="button"
              onClick={primaryAction.onClick}
              disabled={signing}
              className={`min-w-0 px-4 py-2 bg-gradient-to-r ${primaryAction.colorCls} text-xs font-black rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 sm:shrink-0`}
            >
              {signing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <primaryAction.icon className="w-4 h-4" />}
              <span>{primaryAction.label}</span>
            </button>
          )}

          {/* Download Word */}
          <button
            type="button"
            onClick={() => void handleDownload("docx")}
            disabled={!document || downloading}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 hover:text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 border border-slate-700"
            title="Tải tệp Microsoft Word (.docx) được render từ poi-tl"
          >
            <FileText className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">Bản Word</span>
          </button>

          {/* Download PDF / Print */}
          <button
            type="button"
            onClick={() => void handleDownload("pdf")}
            disabled={!document || downloading}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 hover:text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 border border-slate-700"
            title="Tải tệp PDF từ Gotenberg hoặc in văn bản"
          >
            {downloading ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" /> : <Printer className="w-3.5 h-3.5 text-emerald-400" />}
            <span className="hidden sm:inline">{bothSigned ? "Tải PDF" : "In / Xuất PDF"}</span>
          </button>

          {/* Close Modal Button */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors ml-1"
            title="Đóng văn bản"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* WORKSPACE & A4 PAPER SHEET CONTAINER */}
      <main className="w-full flex-1 flex justify-center py-6 sm:py-10 px-2 sm:px-4">
        {loading ? (
          <div className="my-auto py-24 flex flex-col items-center justify-center gap-3 text-slate-400 font-sans">
            <RefreshCw className="w-10 h-10 animate-spin text-blue-500" />
            <span className="text-sm font-bold text-slate-300">Đang tải và đồng bộ dữ liệu hợp đồng điện tử...</span>
          </div>
        ) : error || !document ? (
          <div className="my-auto py-20 px-8 max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl text-center font-sans space-y-4">
            <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto" />
            <p className="text-sm font-bold text-rose-300">{error || "Không tìm thấy hợp đồng."}</p>
            <button
              onClick={() => void loadData()}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md transition-all"
            >
              Thử tải lại
            </button>
          </div>
        ) : (
          /* THE A4 PAPER SHEET (TỜ GIẤY A4 CHUẨN MỰC) */
          <div
            id="printable-contract-document"
            className="contract-document-paper relative w-full max-w-[794px] min-h-[1123px] bg-white text-slate-900 px-6 sm:px-[72px] py-10 sm:py-[76px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.4)] border border-slate-200/80 space-y-7"
          >
            {/* WATERMARK CHO TRẠNG THÁI EXPIRED / CANCELLED */}
            {isExpired && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden z-20 select-none">
                <div className="transform -rotate-45 text-rose-600/10 font-black text-6xl sm:text-8xl tracking-widest border-8 border-rose-600/10 px-12 py-4 rounded-3xl uppercase">
                  ĐÃ HẾT HẠN
                </div>
              </div>
            )}
            {isCancelled && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden z-20 select-none">
                <div className="transform -rotate-45 text-slate-400/10 font-black text-6xl sm:text-8xl tracking-widest border-8 border-slate-400/10 px-12 py-4 rounded-3xl uppercase">
                  ĐÃ HỦY BỎ
                </div>
              </div>
            )}

            {/* QUỐC HIỆU & TIÊU NGỮ (CHUẨN THỂ THỨC VĂN BẢN NGHỊ ĐỊNH 30/2020) */}
            <div className="text-center space-y-1 pb-3">
              <p className="font-bold text-xs sm:text-sm uppercase text-slate-900">
                CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
              </p>
              <p className="font-bold text-xs sm:text-sm text-slate-800">
                Độc lập – Tự do – Hạnh phúc
              </p>
              <div className="w-36 h-[1.5px] bg-slate-800 mx-auto my-2" />
            </div>

            {/* TIÊU ĐỀ HỢP ĐỒNG */}
            <div className="text-center space-y-1.5 border-b-2 border-slate-900 pb-5">
              <h1 className="text-base sm:text-xl font-bold uppercase text-slate-950 leading-snug">
                HỢP ĐỒNG DỊCH VỤ KẾT NỐI GIA SƯ VÀ HỌC VIÊN
              </h1>
              <p className="text-sm font-bold text-blue-900">
                Khóa học: {displayValue(document.className)}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-1 text-[11px] font-mono text-slate-600">
                <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  Mã HĐ: <strong className="text-slate-900">{document.agreementId}</strong>
                </span>
                {document.onchainAgreementId && (
                  <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200 max-w-xs break-all">
                    On-chain ID: <strong className="text-slate-900">{document.onchainAgreementId}</strong>
                  </span>
                )}
              </div>
            </div>

            {/* CĂN CỨ PHÁP LÝ */}
            <div className="contract-body space-y-1 text-[12px] sm:text-[13px] text-slate-700 italic border-b border-slate-200 pb-4">
              <p>• Căn cứ Bộ luật Dân sự số 91/2015/QH13 được Quốc hội nước CHXHCN Việt Nam thông qua ngày 24/11/2015;</p>
              <p>• Căn cứ Luật Giao dịch điện tử số 20/2023/QH15 về thông điệp dữ liệu và chữ ký điện tử;</p>
              <p>• Căn cứ thỏa thuận tự nguyện và cam kết bảo chứng ký quỹ thông minh trên nền tảng EduConnect.</p>
              <p className="not-italic pt-1 font-semibold text-slate-900">
                Hợp đồng điện tử được xác lập ngày <strong>{formatDate(document.createdAt)}</strong>, gồm các bên:
              </p>
            </div>

            {/* CÁC BÊN THAM GIA (BÊN A, BÊN B, BÊN C) */}
            <div className="space-y-4 text-xs page-break-avoid">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <PartyCard kind="tutor" party={document.tutor} />
                <PartyCard kind="student" party={document.student} />
              </div>

              {/* BÊN C: NỀN TẢNG EDUCONNECT */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5 text-slate-800">
                <p className="font-extrabold uppercase text-xs text-slate-900 flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                  <Building className="w-4 h-4 text-slate-600" />
                  3. ĐƠN VỊ BẢO CHỨNG VÀ TRỌNG TÀI ESCROW (BÊN C - NỀN TẢNG EDUCONNECT)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
                  <p>Mạng Blockchain: <strong>{blockchainNetwork(document.platform.chainId)}</strong></p>
                  <p>Tài sản Escrow: <strong>{document.financialTerms.tokenSymbol} (ERC-20 Token)</strong></p>
                  <p className="font-mono text-slate-600 break-all sm:col-span-2">
                    Địa chỉ Smart Contract Escrow: <strong>{displayValue(document.platform.escrowContractAddress)}</strong>
                  </p>
                </div>
              </div>
            </div>

            {/* NỘI DUNG CÁC ĐIỀU KHOẢN (ĐIỀU 1 -> ĐIỀU 8) */}
            <div className="contract-body space-y-5 pt-2">
              <Clause title="ĐIỀU 1: ĐỐI TƯỢNG HỢP ĐỒNG VÀ NỘI DUNG KHÓA HỌC">
                <p>1.1. Bên A nhận cung cấp dịch vụ giảng dạy môn học <strong>{displayValue(document.className)}</strong> cho Bên B theo đúng chương trình, nội dung và thời lượng thỏa thuận.</p>
                <p>1.2. Hình thức học: <strong>{displayValue(document.learningTerms.learningMode)}</strong>. Nền tảng/địa điểm kết nối: <strong>{displayValue(document.learningTerms.meetingPlatform)}</strong>. {document.learningTerms.learningAddress ? <>Địa điểm học: <strong>{document.learningTerms.learningAddress}</strong>.</> : <>Liên kết phòng học online được cung cấp theo quyền truy cập của từng buổi học.</>}</p>
                <p>1.3. Thời gian đào tạo: từ ngày <strong>{formatDate(document.learningTerms.courseStartDate)}</strong> đến ngày <strong>{formatDate(document.learningTerms.courseEndDate)}</strong>. Thời lượng mỗi buổi học: <strong>{displayValue(document.learningTerms.durationPerSessionMinutes)} phút</strong>.</p>
                {document.learningTerms.schedules && document.learningTerms.schedules.length > 0 && (
                  <div className="pl-4 border-l-2 border-slate-300 space-y-0.5 pt-1 text-xs">
                    <p className="font-bold text-slate-900">Lịch học cố định hàng tuần:</p>
                    {document.learningTerms.schedules.map((s, idx) => (
                      <p key={idx} className="text-slate-700">
                        - {Number(s.dayOfWeek) === 8 || Number(s.dayOfWeek) === 1 ? "Chủ Nhật" : `Thứ ${s.dayOfWeek}`}: từ {s.startTime} đến {s.endTime}
                      </p>
                    ))}
                  </div>
                )}
              </Clause>

              <Clause title="ĐIỀU 2: HỌC PHÍ, BẢO CHỨNG ESCROW VÀ CƠ CHẾ GIẢI NGÂN TỪNG BUỔI">
                <p>2.1. Tổng học phí trọn gói ({document.financialTerms.totalSessions} buổi học): <strong>${formatDecimal(document.financialTerms.totalAmountUsdc)} {document.financialTerms.tokenSymbol}</strong> (Quy đổi tham chiếu: <strong>{formatDecimal(document.financialTerms.totalPriceVnd, 0)} VNĐ</strong>).</p>
                <p>2.2. Đơn giá mỗi buổi học: <strong>${formatDecimal(document.financialTerms.pricePerSessionUsdc)} {document.financialTerms.tokenSymbol}</strong> (~{formatDecimal(document.financialTerms.pricePerSessionVnd, 0)} VNĐ/buổi).</p>
                <p>2.3. Cơ chế ký quỹ Escrow: 100% học phí phải được Bên B nạp bằng {document.financialTerms.tokenSymbol} vào Smart Contract Escrow trên mạng Sepolia trước khi lớp học được kích hoạt. Khoản ký quỹ chỉ được hệ thống ghi nhận sau khi sự kiện nạp tiền được xác nhận on-chain và được giải ngân hoặc hoàn lại theo kết quả từng buổi học.</p>
              </Clause>

              <Clause title="ĐIỀU 3: QUYỀN VÀ NGHĨA VỤ CỦA BÊN A (GIA SƯ)">
                <p>3.1. Giảng dạy tận tâm, đúng giờ, chuẩn bị giáo án bài tập chu đáo và phản hồi thắc mắc của học viên.</p>
                <p>3.2. Điểm danh độc lập trên hệ thống trong khung giờ học. Tuyệt đối không điểm danh hộ học viên.</p>
                <p>3.3. Với buổi học mà hai bên đều có mặt, Bên A nhận 85% học phí và Bên C nhận 15%. Các trường hợp vắng mặt được quyết toán theo chính sách Escrow của hợp đồng; tiền chỉ được chuyển sau khi hết cửa sổ khiếu nại và giao dịch quyết toán được xác nhận on-chain.</p>
              </Clause>

              <Clause title="ĐIỀU 4: QUYỀN VÀ NGHĨA VỤ CỦA BÊN B (HỌC VIÊN)">
                <p>4.1. Tham gia học tập nghiêm túc, đúng giờ, tự điểm danh vào đầu buổi học để mở liên kết lớp và tài liệu.</p>
                <p>4.2. Hoàn tất nạp tiền ký quỹ vào Smart Contract Escrow trong {paymentWindowLabel} kể từ khi hợp đồng được đăng ký on-chain{document.paymentDeadline ? `, chậm nhất vào ${formatDate(document.paymentDeadline, true)}` : ""}.</p>
                <p>4.3. Được gửi khiếu nại trong cửa sổ 24 giờ kể từ khi đề xuất quyết toán của buổi học được xác nhận on-chain. Phạm vi mở tranh chấp on-chain tuân theo phiên bản Smart Contract đang triển khai.</p>
              </Clause>

              <Clause title="ĐIỀU 5: TRÁCH NHIỆM BẢO CHỨNG CỦA BÊN C (NỀN TẢNG EDUCONNECT)">
                <p>5.1. Vận hành hạ tầng công nghệ, hỗ trợ lớp học online/offline và Smart Contract Escrow minh bạch trên Blockchain.</p>
                <p>5.2. Tiếp nhận bằng chứng và thực hiện quy trình phân xử khiếu nại theo quyền hạn Staff/Admin và quy tắc nghiệp vụ công bố trên hệ thống.</p>
              </Clause>

              <Clause title="ĐIỀU 6: CƠ CHẾ KHIẾU NẠI VÀ PHÂN XỬ TRANH CHẤP BUỔI HỌC">
                <p>6.1. Mỗi buổi học có cửa sổ khiếu nại 24 giờ kể từ khi đề xuất quyết toán được xác nhận on-chain.</p>
                <p>6.2. Khi giao dịch mở tranh chấp được xác nhận on-chain, khoản tiền của riêng buổi học đó được giữ lại cho đến khi Bên C hoàn tất phân xử dựa trên nhật ký và bằng chứng hợp lệ.</p>
              </Clause>

              <Clause title="ĐIỀU 7: TÍNH PHÁP LÝ CỦA CHỮ KÝ ĐIỆN TỬ EIP-712">
                <p>7.1. Chữ ký EIP-712 được tạo bởi ví Web3 của mỗi bên và được EduConnect kiểm tra bằng phương pháp khôi phục địa chỉ người ký. Giá trị pháp lý của chữ ký điện tử phụ thuộc vào thỏa thuận giữa các bên và việc đáp ứng các điều kiện của pháp luật áp dụng.</p>
                <p>7.2. Bằng chứng chữ ký được lưu trong hệ thống EduConnect. Chuỗi băm điều khoản (Terms Hash) được ghi vào Smart Contract khi hợp đồng đăng ký on-chain thành công, cho phép phát hiện thay đổi đối với bản điều khoản đã chốt.</p>
              </Clause>

              <Clause title="ĐIỀU 8: HIỆU LỰC VÀ ĐIỀU KHOẢN THI HÀNH">
                <p>8.1. Hợp đồng điện tử phiên bản {document.contractVersion} hoàn tất xác nhận giữa hai bên sau khi đủ hai chữ ký EIP-712. Lớp học chỉ được kích hoạt khi khoản ký quỹ được Smart Contract xác nhận thành công.</p>
                <p>8.2. Hai bên cam kết thực hiện đúng các điều khoản đã thỏa thuận.</p>
              </Clause>
            </div>

            {/* KHỐI KÝ TÊN VÀ CON DẤU ĐIỆN TỬ (LEGAL SIGNATURES & EIP-712 SEALS) */}
            <div className="pt-6 border-t-2 border-slate-900 page-break-avoid">
              <p className="text-center font-bold text-xs uppercase text-slate-800 pb-5">
                XÁC NHẬN CHỮ KÝ ĐIỆN TỬ GIỮA CÁC BÊN (EIP-712 CRYPTOGRAPHIC SIGNATURES)
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* BÊN A (GIA SƯ) */}
                <LegalSignatureBlock
                  title="ĐẠI DIỆN BÊN A (GIA SƯ)"
                  party={document.tutor}
                  proof={document.tutorSignature}
                  copiedField={copiedField}
                  onCopy={copyToClipboard}
                  canSign={canTutorSign}
                  onSign={() => void handleSign("TUTOR")}
                  signing={signing}
                />

                {/* BÊN B (HỌC VIÊN) */}
                <LegalSignatureBlock
                  title="ĐẠI DIỆN BÊN B (HỌC VIÊN)"
                  party={document.student}
                  proof={document.studentSignature}
                  copiedField={copiedField}
                  onCopy={copyToClipboard}
                  canSign={canStudentSign}
                  onSign={() => void handleSign("STUDENT")}
                  signing={signing}
                />
              </div>

              {/* BẢO CHỨNG MÃ BĂM VÀ ĐỐI CHỨNG HỆ THỐNG */}
              <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200 text-[11px] font-mono text-slate-600 space-y-1">
                <p className="break-all">
                  Bảo chứng Terms Hash: <strong className="text-slate-800">{document.termsHash}</strong>
                </p>
                <div className="flex flex-wrap items-center justify-between gap-2 text-slate-500 pt-0.5">
                  <span>Phiên bản: <strong>v{document.contractVersion}</strong></span>
                  <span className="italic text-[10px]">
                    {document.onchainAgreementId
                      ? "Terms Hash đã được gắn với mã hợp đồng on-chain trên Sepolia."
                      : "Terms Hash đang được lưu trong snapshot bất biến của EduConnect và chưa có mã hợp đồng on-chain."}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

/* KHỐI THÔNG TIN BÊN THAM GIA */
function PartyCard({ kind, party }: { kind: "tutor" | "student"; party: ContractDocumentParty }) {
  const isTutor = kind === "tutor";
  return (
    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5 text-slate-800">
      <p className={`font-bold uppercase text-xs flex items-center gap-1.5 border-b border-slate-200 pb-1.5 leading-snug ${isTutor ? "text-blue-900" : "text-indigo-900"}`}>
        {isTutor ? <GraduationCap className="w-4 h-4 text-blue-600" /> : <User className="w-4 h-4 text-indigo-600" />}
        {isTutor ? "1. BÊN CUNG CẤP DỊCH VỤ (BÊN A - GIA SƯ)" : "2. BÊN SỬ DỤNG DỊCH VỤ (BÊN B - HỌC VIÊN)"}
      </p>
      <div className="space-y-1 pt-1 text-[11px]">
        <p>Họ và tên: <strong className="text-slate-950 font-bold text-xs">{displayValue(party.fullName)}</strong></p>
        <p>Email: <strong>{displayValue(party.email)}</strong></p>
        <p>Số điện thoại: <strong>{displayValue(party.phone)}</strong></p>
        <p className="font-mono text-slate-600 break-all">
          Ví Web3: <strong>{displayValue(party.walletAddress)}</strong>
        </p>
      </div>
    </div>
  );
}

/* ĐIỀU KHOẢN HỢP ĐỒNG */
function Clause({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5 page-break-avoid">
      <h3 className="font-bold text-slate-950 uppercase text-[13px] sm:text-[14px] leading-snug">
        {title}
      </h3>
      <div className="space-y-1.5 text-slate-800 text-[13px] sm:text-[14px] leading-[1.65]">
        {children}
      </div>
    </div>
  );
}

/* KHỐI CHỮ KÝ VÀ CON DẤU PHÁP LÝ ĐIỆN TỬ */
function LegalSignatureBlock({
  title,
  party,
  proof,
  copiedField,
  onCopy,
  canSign,
  onSign,
  signing,
}: {
  title: string;
  party: ContractDocumentParty;
  proof: ContractSignatureProof;
  copiedField: string | null;
  onCopy: (text: string, fieldName: string) => void;
  canSign?: boolean;
  onSign?: () => void;
  signing?: boolean;
}) {
  const copyField = `${proof.role.toLowerCase()}Sig`;
  const signerWallet = proof.walletAddress || party.walletAddress;

  return (
    <div className="flex flex-col justify-between border border-slate-200 rounded-xl p-4 bg-slate-50/70 space-y-3">
      <div className="space-y-2">
        <p className="font-bold text-xs text-slate-900 text-center uppercase border-b border-slate-200 pb-2 leading-snug">
          {title}
        </p>

        {proof.signed ? (
          /* CON DẤU SỐ ĐIỆN TỬ ĐÃ XÁC THỰC (VERIFIED EIP-712 SEAL) */
          <div className="p-3 bg-emerald-50/80 border-2 border-emerald-500/40 rounded-xl space-y-1.5 shadow-xs">
            <div className="flex items-center justify-between gap-1">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 uppercase leading-tight">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                EIP-712 SIGNATURE VERIFIED
              </span>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                ĐÃ KIỂM TRA
              </span>
            </div>

            <div className="text-[11px] font-mono text-slate-700 space-y-1 pt-1">
              <p>
                Người ký: <strong className="text-slate-950 font-bold">{displayValue(party.fullName)}</strong>
              </p>
              <p className="break-all">
                Ví ký: <strong className="text-slate-900">{displayValue(signerWallet)}</strong>
              </p>
              {proof.signature && (
                <div className="flex items-center justify-between gap-1 pt-0.5">
                  <span className="text-slate-600 font-semibold text-[10px] print:hidden">
                    Chữ ký: {proof.signature.slice(0, 16)}...{proof.signature.slice(-8)}
                  </span>
                  <span className="hidden print:inline break-all text-slate-600 text-[9px]">
                    Chữ ký: {proof.signature}
                  </span>
                  <button
                    type="button"
                    onClick={() => onCopy(proof.signature!, copyField)}
                    className="p-1 text-slate-400 hover:text-slate-700 transition-colors print:hidden"
                    title="Sao chép toàn bộ chữ ký"
                  >
                    {copiedField === copyField ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              )}
              <p className="text-[10px] text-slate-500 pt-0.5">
                Thời gian: {formatDate(proof.acceptedAt, true)}
              </p>
            </div>
          </div>
        ) : (
          /* TRẠNG THÁI CHƯA KÝ */
          <div className="py-6 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center gap-1 text-slate-400">
            <span className="text-xs font-semibold italic text-slate-500">(Chưa ký xác nhận)</span>
            <p className="text-[11px] text-slate-400">{displayValue(party.fullName)}</p>
          </div>
        )}
      </div>

      {/* Nút ký nhanh nếu là tài khoản cần ký */}
      {canSign && !proof.signed && onSign && (
        <button
          type="button"
          onClick={onSign}
          disabled={signing}
          className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 disabled:opacity-50 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-md transition-all print:hidden"
        >
          {signing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileSignature className="w-4 h-4" />}
          <span>Ký số EIP-712 ngay</span>
        </button>
      )}
    </div>
  );
}

export default ContractDocumentModal;
