import React, { useEffect, useState } from "react";
import { Building, Check, CheckCircle2, Copy, Download, FileSignature, FileText, GraduationCap, Printer, RefreshCw, User, X, AlertTriangle, Clock } from "lucide-react";
import { ContractDocumentParty, ContractDocumentView, ContractSignatureProof, contractsApi } from "../../api/contractsApi";
import { useAuth } from "../../hooks/useAuth";
import { useWeb3Wallet } from "../../web3/useWeb3Wallet";
import { signContractAgreementEip712 } from "../../web3/eip712Signer";
import { DEFAULT_CHAIN_ID } from "../../web3/web3Config";

interface ContractDocumentModalProps {
  agreementId: string;
  onClose: () => void;
  onSignedSuccess?: () => void;
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

function SignatureCard({
  title,
  party,
  proof,
  copiedField,
  onCopy,
  canSign,
  onSign,
  signing,
  signLabel
}: {
  title: string;
  party: ContractDocumentParty;
  proof: ContractSignatureProof;
  copiedField: string | null;
  onCopy: (text: string, fieldName: string) => void;
  canSign?: boolean;
  onSign?: () => void;
  signing?: boolean;
  signLabel?: string;
}) {
  const copyField = `${proof.role.toLowerCase()}Sig`;
  const signerWallet = proof.walletAddress || party.walletAddress;

  return (
    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 flex flex-col justify-between">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2">
          <span className="font-bold text-xs text-slate-900">{title}</span>
          {proof.signed ? (
            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-md flex items-center gap-1 whitespace-nowrap">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> ĐÃ KÝ SỐ EIP-712
            </span>
          ) : (
            <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-md whitespace-nowrap">
              CHƯA KÝ XÁC NHẬN
            </span>
          )}
        </div>
        <div className="text-[11px] text-slate-700 space-y-1.5 font-mono">
          <p>Người ký: <strong className="text-slate-950 font-sans text-xs font-bold">{displayValue(party.fullName)}</strong></p>
          <p className="truncate">Ví ký: <strong className="text-slate-900">{displayValue(signerWallet)}</strong></p>
          {proof.signature ? (
            <div className="flex items-center justify-between gap-1 pt-0.5">
              <span className="truncate text-slate-600 font-bold">Chữ ký: {proof.signature.slice(0, 18)}...{proof.signature.slice(-10)}</span>
              <button type="button" onClick={() => onCopy(proof.signature!, copyField)} className="p-1 text-slate-400 hover:text-slate-700 transition-colors print:hidden" title="Sao chép toàn bộ chữ ký">
                {copiedField === copyField ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          ) : (
            <p className="text-slate-400 pt-0.5">Chữ ký: {proof.signed ? "Đã ký số xác thực" : "Đang chờ ký xác nhận"}</p>
          )}
          <p className="text-[10px] text-slate-400 pt-0.5 font-sans">Thời gian ký: {formatDate(proof.acceptedAt, true)}</p>
        </div>
      </div>

      {canSign && !proof.signed && onSign && (
        <button
          type="button"
          onClick={onSign}
          disabled={signing}
          className="mt-3 w-full py-2 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 disabled:opacity-50 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-sm transition-all print:hidden"
        >
          {signing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileSignature className="w-3.5 h-3.5" />}
          <span>{signLabel || "Ký số EIP-712 bằng MetaMask"}</span>
        </button>
      )}
    </div>
  );
}

export function ContractDocumentModal({ agreementId, onClose, onSignedSuccess }: ContractDocumentModalProps) {
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
      const data = await contractsApi.getContractDocument(agreementId, {
        userId: user?.id,
        role: activeRole,
        email: user?.email,
      });
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
    const signingWallet = address || contractPartyWallet;

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
        role: targetRole,
        walletAddress: signingWallet,
        signature: signature,
        userEmail: user?.email,
      });

      window.dispatchEvent(new CustomEvent('contract-state-updated', {
        detail: { agreementId, action: 'signed', role: targetRole }
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
        await contractsApi.finalizeContractDocument(agreementId).catch(() => null);
        const blob = await contractsApi.getContractDocumentFile(agreementId, format);
        const url = URL.createObjectURL(blob);
        const a = window.document.createElement("a");
        a.href = url;
        a.download = `educonnect-contract-${agreementId.slice(0, 8)}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
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
            URL.revokeObjectURL(url);
          } else {
            alert("Bản Word chính thức sẽ hoàn thiện sau khi cả 2 bên hoàn tất ký số EIP-712.");
          }
        }
      }
    } catch (err) {
      console.error("Download failed, falling back to print:", err);
      if (format === "pdf") window.print();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto print:p-0 print:bg-white print:static print:overflow-visible print:block">
      <style>{`
        @media print {
          body { background-color: #fff !important; color: #000 !important; }
          body * { visibility: hidden; }
          #printable-contract-document, #printable-contract-document * { visibility: visible; }
          #printable-contract-document { position: absolute; left: 0; top: 0; width: 100% !important; max-width: 100% !important; margin: 0 !important; padding: 10mm 15mm !important; background: #fff !important; color: #000 !important; box-shadow: none !important; border: none !important; }
          @page { size: A4 portrait; margin: 10mm 15mm; }
        }
      `}</style>
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh] print:max-h-none print:shadow-none print:border-none print:rounded-none">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <FileSignature className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display font-black text-sm sm:text-base tracking-tight">
                Văn Bản Hợp Đồng Điện Tử EIP-712 & Ký Quỹ Escrow
              </h2>
              <p className="text-[11px] text-slate-400 font-semibold">
                Dữ liệu hợp đồng #{agreementId.slice(0, 8)} từ Contract Service
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleDownload("docx")}
              disabled={!document || downloading}
              className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-40 text-white text-xs font-black rounded-xl transition-all flex items-center gap-1.5 shadow-md border border-blue-400/40"
              title="Tải tệp văn bản Microsoft Word (.docx)"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Tải Bản Word (.docx)</span>
            </button>
            <button
              type="button"
              onClick={() => void handleDownload("pdf")}
              disabled={!document || downloading}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 border border-slate-700 shadow-xs"
              title="In hoặc tải tệp PDF"
            >
              {downloading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
              <span>{document?.tutorSignature.signed && document?.studentSignature.signed ? "Tải File PDF Gốc" : "In / Xuất PDF"}</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6 sm:p-10 overflow-y-auto space-y-6 text-slate-900 leading-relaxed font-serif" id="printable-contract-document">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400 font-sans">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
              <span className="text-xs font-bold">Đang tải dữ liệu hợp đồng...</span>
            </div>
          ) : error || !document ? (
            <div className="py-16 flex flex-col items-center justify-center gap-4 text-center font-sans">
              <p className="text-sm font-bold text-red-700">{error || "Không tìm thấy hợp đồng."}</p>
              <button
                onClick={() => void loadData()}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-sm hover:bg-blue-700 transition-all"
              >
                Tải lại
              </button>
            </div>
          ) : (
            <>
              {/* Call to Action Banner for Signers */}
              {isStudentUser && !document.studentSignature.signed && (
                <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 font-sans print:hidden shadow-xs">
                  <div className="space-y-0.5">
                    <span className="font-black text-amber-950 text-xs flex items-center gap-1.5 uppercase tracking-wide">
                      <Clock className="w-4 h-4 text-amber-600" /> Bạn là Học viên của hợp đồng này (Chưa ký xác nhận)
                    </span>
                    <p className="text-[11px] text-amber-800 font-medium">
                      Vui lòng đọc kỹ các điều khoản bên dưới và bấm nút Ký số bằng MetaMask để hoàn tất thủ tục và mở cổng nạp cọc Escrow.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleSign("STUDENT")}
                    disabled={signing}
                    className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 disabled:opacity-50 text-white text-xs font-black rounded-xl transition-all shadow-md flex items-center gap-1.5 shrink-0"
                  >
                    {signing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileSignature className="w-4 h-4" />}
                    <span>Ký Số EIP-712 (MetaMask)</span>
                  </button>
                </div>
              )}

              {isTutorUser && !document.tutorSignature.signed && (
                <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 font-sans print:hidden shadow-xs">
                  <div className="space-y-0.5">
                    <span className="font-black text-amber-950 text-xs flex items-center gap-1.5 uppercase tracking-wide">
                      <Clock className="w-4 h-4 text-amber-600" /> Bạn là Gia sư của hợp đồng này (Chưa ký xác nhận)
                    </span>
                    <p className="text-[11px] text-amber-800 font-medium">
                      Ký số hợp đồng để gửi thông báo xác nhận tới Học viên.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleSign("TUTOR")}
                    disabled={signing}
                    className="px-5 py-2.5 bg-gradient-to-r from-brand-primary to-brand-secondary hover:opacity-90 disabled:opacity-50 text-white text-xs font-black rounded-xl transition-all shadow-md flex items-center gap-1.5 shrink-0"
                  >
                    {signing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileSignature className="w-4 h-4" />}
                    <span>Ký Hợp Đồng (Gia Sư)</span>
                  </button>
                </div>
              )}

              {/* Title Section */}
              <div className="text-center space-y-1 border-b-2 border-slate-900 pb-4">
                <p className="font-bold text-xs sm:text-sm tracking-widest uppercase">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                <p className="font-bold text-xs sm:text-sm text-slate-800">Độc lập – Tự do – Hạnh phúc</p>
                <div className="w-32 h-[1.5px] bg-slate-800 mx-auto my-2" />
                <h1 className="font-display text-base sm:text-xl font-black pt-2 tracking-tight uppercase">
                  HỢP ĐỒNG DỊCH VỤ KẾT NỐI GIA SƯ VÀ HỌC TẬP TRỰC TUYẾN
                </h1>
                <p className="text-sm font-sans font-bold text-blue-800 pt-1">
                  Khóa học: {displayValue(document.className)}
                </p>
                <p className="text-[11px] font-mono text-slate-600">
                  Mã hợp đồng: <span className="font-bold text-slate-900">{document.agreementId}</span>
                </p>
                <p className="text-[11px] font-mono text-slate-500 truncate max-w-xl mx-auto">
                  Hash tham chiếu On-chain: {displayValue(document.onchainAgreementId)}
                </p>
              </div>

              {/* Legal Basis */}
              <div className="space-y-1 text-xs text-slate-700 italic border-b border-slate-200 pb-4">
                <p>• Căn cứ Bộ luật Dân sự số 91/2015/QH13 được Quốc hội nước CHXHCN Việt Nam thông qua ngày 24/11/2015;</p>
                <p>• Căn cứ Luật Giao dịch điện tử số 20/2023/QH15 về tính pháp lý của chữ ký điện tử EIP-712;</p>
                <p>• Căn cứ nhu cầu học tập và thỏa thuận tự nguyện giữa các bên trên nền tảng giáo dục thông minh EduConnect.</p>
                <p className="not-italic pt-1 font-semibold text-slate-800 font-sans">
                  Hợp đồng được khởi tạo ngày <strong>{formatDate(document.createdAt)}</strong>, gồm các bên:
                </p>
              </div>

              {/* Parties */}
              <div className="space-y-4 font-sans text-xs">
                <PartySection kind="tutor" party={document.tutor} />
                <PartySection kind="student" party={document.student} />
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1.5 text-slate-800">
                  <p className="font-extrabold uppercase text-xs text-slate-900 flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                    <Building className="w-4 h-4 text-slate-600" /> 3. ĐƠN VỊ BẢO CHỨNG VÀ VẬN HÀNH NỀN TẢNG (BÊN C - EDUCONNECT)
                  </p>
                  <p>Mạng Blockchain: <strong>{blockchainNetwork(document.platform.chainId)}</strong></p>
                  <p className="font-mono text-[11px] text-slate-600 truncate">Hợp đồng Escrow: <strong>{displayValue(document.platform.escrowContractAddress)}</strong></p>
                  <p className="font-mono text-[11px] text-slate-600 truncate">Token Ký quỹ: <strong>{displayValue(document.platform.tokenAddress)} ({document.financialTerms.tokenSymbol})</strong></p>
                </div>
              </div>

              {/* Clauses */}
              <div className="space-y-4 text-xs font-serif leading-relaxed border-t border-slate-200 pt-4">
                <Clause title="ĐIỀU 1: ĐỐI TƯỢNG HỢP ĐỒNG VÀ NỘI DUNG KHÓA HỌC">
                  <p>1.1. Bên A nhận cung cấp dịch vụ giảng dạy môn học <strong>{displayValue(document.className)}</strong> cho Bên B theo đúng chương trình, tiến độ và thời lượng đã thỏa thuận.</p>
                  <p>1.2. Hình thức học: <strong>{displayValue(document.learningTerms.learningMode)}</strong>. Nền tảng: <strong>{displayValue(document.learningTerms.meetingPlatform)}</strong>. Link / Địa chỉ học: <strong className="break-all">{displayValue(document.learningTerms.meetingLink || document.learningTerms.learningAddress)}</strong>.</p>
                  <p>1.3. Thời gian khóa học: từ ngày <strong>{formatDate(document.learningTerms.startDate)}</strong> đến ngày <strong>{formatDate(document.learningTerms.endDate)}</strong>. Thời lượng mỗi buổi học: <strong>{displayValue(document.learningTerms.durationPerSessionMinutes)} phút</strong>.</p>
                  {document.learningTerms.schedules && document.learningTerms.schedules.length > 0 && (
                    <div className="pl-4 border-l-2 border-slate-300 space-y-0.5 pt-1 text-[11px]">
                      <p className="font-bold">Lịch học cố định hàng tuần:</p>
                      {document.learningTerms.schedules.map((s, idx) => (
                        <p key={idx}>- Thứ {s.dayOfWeek === 8 ? "Chủ Nhật" : s.dayOfWeek}: {s.startTime} đến {s.endTime}</p>
                      ))}
                    </div>
                  )}
                </Clause>

                <Clause title="ĐIỀU 2: HỌC PHÍ, BẢO CHỨNG ESCROW VÀ CƠ CHẾ GIẢI NGÂN">
                  <p>2.1. Tổng học phí toàn bộ khóa học ({document.financialTerms.totalSessions} buổi): <strong>${formatDecimal(document.financialTerms.totalAmountUsdc)} {document.financialTerms.tokenSymbol}</strong> (Tương đương: <strong>{formatDecimal(document.financialTerms.totalPriceVnd, 0)} VNĐ</strong>).</p>
                  <p>2.2. Đơn giá mỗi buổi học: <strong>${formatDecimal(document.financialTerms.pricePerSessionUsdc)} {document.financialTerms.tokenSymbol}</strong> (~{formatDecimal(document.financialTerms.pricePerSessionVnd, 0)} VNĐ / buổi).</p>
                  <p>2.3. Cơ chế Escrow: 100% học phí được nạp vào Smart Contract Escrow trước khi bắt đầu buổi học đầu tiên. Sau khi mỗi buổi học hoàn thành và được điểm danh hợp lệ, hệ thống tự động giải ngân cho Bên A và thu phí nền tảng cho Bên C.</p>
                </Clause>

                <Clause title="ĐIỀU 3: QUYỀN VÀ NGHĨA VỤ CỦA BÊN A (GIA SƯ)">
                  <p>3.1. Thực hiện công tác giảng dạy đầy đủ, đúng giờ, chuẩn bị giáo án và đảm bảo chất lượng truyền tải kiến thức.</p>
                  <p>3.2. Được nhận thù lao tự động qua ví Web3 ngay sau khi hoàn thành từng buổi học được điểm danh xác nhận.</p>
                  <p>3.3. Tôn trọng học viên, không tự ý hủy buổi học mà không thông báo trước ít nhất 24 giờ.</p>
                </Clause>

                <Clause title="ĐIỀU 4: QUYỀN VÀ NGHĨA VỤ CỦA BÊN B (HỌC VIÊN)">
                  <p>4.1. Tham gia học tập nghiêm túc, đúng giờ, chuẩn bị thiết bị và đường truyền internet ổn định.</p>
                  <p>4.2. Hoàn tất nạp tiền cọc ký quỹ vào Smart Contract Escrow đúng thời hạn 24 giờ kể từ khi hai bên ký hợp đồng.</p>
                  <p>4.3. Được hoàn lại 100% số tiền cọc còn lại trong Smart Contract đối với các buổi học chưa diễn ra nếu Bên A vi phạm cam kết hoặc hai bên đồng thuận chấm dứt hợp đồng hợp lệ.</p>
                </Clause>

                <Clause title="ĐIỀU 5: TRÁCH NHIỆM BẢO CHỨNG CỦA BÊN C (NỀN TẢNG EDUCONNECT)">
                  <p>5.1. Cung cấp hạ tầng lớp học trực tuyến và Smart Contract Escrow vận hành công khai, minh bạch trên mạng Blockchain.</p>
                  <p>5.2. Đóng vai trò Trọng tài độc lập hỗ trợ giải quyết khiếu nại, tranh chấp phát sinh giữa Bên A và Bên B dựa trên chứng cứ nhật ký lớp học.</p>
                </Clause>

                <Clause title="ĐIỀU 6: CƠ CHẾ HỦY LỚP, KHIẾU NẠI VÀ BỒI THƯỜNG">
                  <p>6.1. Mỗi bên có quyền mở khiếu nại trong vòng 24 giờ sau khi kết thúc buổi học nếu phát sinh sự cố chất lượng hoặc vắng mặt.</p>
                  <p>6.2. Trường hợp Bên A nghỉ không lý do hoặc vi phạm nghiêm trọng, tiền cọc các buổi chưa học sẽ tự động trả về cho Bên B.</p>
                </Clause>

                <Clause title="ĐIỀU 7: TÍNH PHÁP LÝ CỦA CHỮ KÝ ĐIỆN TỬ EIP-712">
                  <p>7.1. Chữ ký điện tử EIP-712 được tạo bởi ví Web3 đại diện cho ý chí tự nguyện của các bên, có giá trị pháp lý ràng buộc theo Luật Giao dịch điện tử số 20/2023/QH15.</p>
                  <p>7.2. Bằng chứng chữ ký và chuỗi băm Terms Hash ({document.termsHash}) được lưu trữ cố định trên Blockchain Sepolia làm đối chứng không thể thay đổi.</p>
                </Clause>

                <Clause title="ĐIỀU 8: ĐIỀU KHOẢN THI HÀNH VÀ HIỆU LỰC HỢP ĐỒNG">
                  <p>8.1. Hợp đồng phiên bản {document.contractVersion} này có hiệu lực chính thức kể từ thời điểm cả Bên A và Bên B hoàn tất ký số EIP-712.</p>
                  <p>8.2. Mọi chỉnh sửa, bổ sung điều khoản hợp đồng phải được thực hiện thông qua phụ lục điện tử trên hệ thống EduConnect.</p>
                </Clause>
              </div>

              {/* Cryptographic Signature Cards */}
              <div className="pt-6 border-t-2 border-slate-900 space-y-4 font-sans">
                <h3 className="font-black text-slate-950 uppercase text-xs tracking-wider text-center">
                  XÁC NHẬN CHỮ KÝ ĐIỆN TỬ (EIP-712 CRYPTOGRAPHIC PROOF)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <SignatureCard
                    title="CHỮ KÝ BÊN A (GIA SƯ)"
                    party={document.tutor}
                    proof={document.tutorSignature}
                    copiedField={copiedField}
                    onCopy={copyToClipboard}
                    canSign={isTutorUser}
                    onSign={() => void handleSign("TUTOR")}
                    signing={signing}
                    signLabel="Ký số EIP-712 (Gia sư)"
                  />
                  <SignatureCard
                    title="CHỮ KÝ BÊN B (HỌC VIÊN)"
                    party={document.student}
                    proof={document.studentSignature}
                    copiedField={copiedField}
                    onCopy={copyToClipboard}
                    canSign={isStudentUser}
                    onSign={() => void handleSign("STUDENT")}
                    signing={signing}
                    signLabel="Ký số EIP-712 (Học viên)"
                  />
                </div>
                <div className="p-3 bg-slate-100 rounded-xl text-[11px] font-mono text-slate-500 space-y-1">
                  <p className="break-all">Terms Hash: <strong className="text-slate-700">{document.termsHash}</strong></p>
                  <p>Phiên bản hợp đồng: <strong>{document.contractVersion}</strong></p>
                  <p className="text-[10px] text-slate-400 font-sans italic">
                    Dữ liệu được đọc từ contract_agreement và contract_acceptance của đúng mã hợp đồng; trường còn thiếu hiển thị “Chưa cập nhật”.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PartySection({ kind, party }: { kind: "tutor" | "student"; party: ContractDocumentParty }) {
  const tutor = kind === "tutor";
  return (
    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
      <p className={`font-extrabold uppercase text-xs flex items-center gap-1.5 border-b border-slate-200 pb-1.5 ${tutor ? "text-blue-900" : "text-indigo-900"}`}>
        {tutor ? <GraduationCap className="w-4 h-4 text-blue-600" /> : <User className="w-4 h-4 text-indigo-600" />}
        {tutor ? "1. BÊN CUNG CẤP DỊCH VỤ (BÊN A - GIA SƯ)" : "2. BÊN SỬ DỤNG DỊCH VỤ (BÊN B - HỌC VIÊN)"}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-800 pt-1">
        <p>Họ và tên: <strong className="text-slate-950 text-sm font-black">{displayValue(party.fullName)}</strong></p>
        <p>Email: <strong>{displayValue(party.email)}</strong></p>
        <p>Số điện thoại: <strong>{displayValue(party.phone)}</strong></p>
        <p className="sm:col-span-2 font-mono text-[11px] text-slate-600 truncate">Ví Web3: <strong>{displayValue(party.walletAddress)}</strong></p>
      </div>
    </div>
  );
}

function Clause({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="space-y-1"><h3 className="font-bold text-slate-950 uppercase text-xs font-sans tracking-wide">{title}</h3>{children}</div>;
}

export default ContractDocumentModal;
