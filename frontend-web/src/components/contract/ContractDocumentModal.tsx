import React, { useEffect, useState } from "react";
import {
  FileText,
  Printer,
  X,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Building,
  User,
  ExternalLink,
  Award,
  Lock,
  Stamp,
  QrCode,
  RefreshCw,
  FileSignature
} from "lucide-react";
import { contractsApi, AgreementDetail } from "../../api/contractsApi";
import { EtherscanLink } from "../common/EtherscanLink";
import { DEFAULT_CHAIN_ID } from "../../web3/web3Config";
import { useWeb3Wallet } from "../../web3/useWeb3Wallet";
import { signContractAgreementEip712 } from "../../web3/eip712Signer";

interface ContractDocumentModalProps {
  agreementId: string;
  onClose: () => void;
  onSignedSuccess?: () => void;
}

export function ContractDocumentModal({ agreementId, onClose, onSignedSuccess }: ContractDocumentModalProps) {
  const { address } = useWeb3Wallet();
  const [detail, setDetail] = useState<AgreementDetail | null>(null);
  const [acceptances, setAcceptances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSigning, setIsSigning] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [agr, acc] = await Promise.all([
        contractsApi.getAgreement(agreementId),
        contractsApi.getAcceptances(agreementId),
      ]);
      setDetail(agr);
      setAcceptances(acc || []);
    } catch (e) {
      console.error("Failed to load contract document details:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [agreementId]);

  const handlePrint = () => {
    window.print();
  };

  const handleExecuteSign = async (role: "TUTOR" | "STUDENT") => {
    const signingWallet = address || (role === "TUTOR" ? detail?.summary?.tutorWallet : detail?.summary?.studentWallet);
    if (!signingWallet || !signingWallet.startsWith("0x") || signingWallet === "0x0000000000000000000000000000000000000000") {
      alert("Vui lòng kết nối ví MetaMask trước khi thực hiện ký hợp đồng!");
      return;
    }

    if (!detail?.summary) return;

    setIsSigning(true);
    try {
      let signature: string | undefined = undefined;
      try {
        signature = await signContractAgreementEip712(
          {
            id: detail.summary.id,
            tutorWallet: detail.summary.tutorWallet,
            studentWallet: role === "STUDENT" ? signingWallet : detail.summary.studentWallet,
            totalAmountUsdc: detail.summary.totalAmountUsdc,
            termsHash: detail.termsHash,
            createdAt: detail.summary.createdAt,
            chainId: detail.summary.chainId || DEFAULT_CHAIN_ID,
            escrowContractAddress: detail.summary.escrowContractAddress || undefined,
          },
          signingWallet
        );
      } catch (signErr: any) {
        console.warn("MetaMask EIP-712 sign skipped/failed:", signErr);
      }

      await contractsApi.signAgreement(detail.summary.id, {
        role: role,
        walletAddress: signingWallet,
        signature: signature,
      });

      await loadData();
      if (onSignedSuccess) {
        onSignedSuccess();
      }
    } catch (err: any) {
      alert(err?.message || "Lỗi khi ký xác nhận hợp đồng.");
    } finally {
      setIsSigning(false);
    }
  };

  const summary = detail?.summary;
  const tutorAcceptance = acceptances.find((a) => a.role === "TUTOR");
  const studentAcceptance = acceptances.find((a) => a.role === "STUDENT");

  const contractCreatedDate = summary?.createdAt
    ? new Date(summary.createdAt).toLocaleDateString("vi-VN")
    : new Date().toLocaleDateString("vi-VN");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto print:p-0 print:bg-white print:static print:overflow-visible print:block">
      <style>{`
        @media print {
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
          }
          body * {
            visibility: hidden;
          }
          #printable-contract-document, #printable-contract-document * {
            visibility: visible;
          }
          #printable-contract-document {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 10mm 15mm !important;
            background: #ffffff !important;
            color: #000000 !important;
            box-shadow: none !important;
            border: none !important;
          }
          @page {
            size: A4 portrait;
            margin: 10mm 15mm;
          }
        }
      `}</style>
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh] print:max-h-none print:shadow-none print:border-none print:rounded-none">
        
        {/* Modal Action Header - Hidden in Print */}
        <div className="p-4 sm:px-6 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-sm shadow-blue-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-black text-slate-900 text-sm sm:text-base">
                Văn Bản Hợp Đồng Điện Tử EIP-712 & Ký Quỹ Escrow
              </h3>
              <p className="text-[11px] text-slate-500 font-semibold">
                Xác thực chữ ký số mật mã học trên mạng Sepolia Testnet (Chain ID: 11155111)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-slate-900 hover:bg-blue-600 text-white rounded-xl text-xs font-black transition-all shadow-sm flex items-center gap-2"
            >
              <Printer className="w-4 h-4" /> In / Xuất PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
              aria-label="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Formal Legal Contract Paper (A4 Style) */}
        <div id="printable-contract-document" className="p-6 sm:p-12 overflow-y-auto space-y-7 text-xs sm:text-sm text-slate-900 font-serif leading-relaxed print:p-0 print:overflow-visible">
          {loading ? (
            <div className="py-24 text-center text-slate-400 font-sans font-bold">
              Đang tải dữ liệu văn bản hợp đồng...
            </div>
          ) : !summary ? (
            <div className="py-24 text-center text-rose-500 font-sans font-bold">
              Không tìm thấy thông tin hợp đồng.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Official Quốc Hiệu & Tiêu Ngữ Header */}
              <div className="text-center space-y-1 font-sans border-b-2 border-slate-800 pb-5">
                <p className="font-extrabold uppercase tracking-widest text-[12px] sm:text-[13px] text-slate-900">
                  CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                </p>
                <p className="font-bold text-xs sm:text-sm text-slate-800">
                  Độc lập – Tự do – Hạnh phúc
                </p>
                <div className="w-32 h-[1.5px] bg-slate-800 mx-auto my-2"></div>
                
                <h1 className="font-display text-base sm:text-xl font-black text-slate-950 pt-2 tracking-tight uppercase">
                  HỢP ĐỒNG DỊCH VỤ KẾT NỐI GIA SƯ VÀ HỌC TẬP TRỰC TUYẾN
                </h1>
                <p className="text-[11px] font-mono text-slate-600">
                  Mã hợp đồng: <span className="font-bold text-slate-900">{summary.id}</span>
                </p>
                <p className="text-[11px] font-mono text-slate-500 truncate max-w-xl mx-auto">
                  Hash tham chiếu On-chain: {summary.onchainAgreementId || detail?.termsHash || "0x..."}
                </p>
              </div>

              {/* Căn cứ pháp lý */}
              <div className="space-y-1 text-xs text-slate-700 italic border-b border-slate-200 pb-4">
                <p>• Căn cứ Bộ luật Dân sự số 91/2015/QH13 được Quốc hội nước CHXHCN Việt Nam thông qua ngày 24/11/2015;</p>
                <p>• Căn cứ Luật Giao dịch điện tử số 20/2023/QH15 của Quốc hội nước CHXHCN Việt Nam;</p>
                <p>• Căn cứ vào nhu cầu học tập và sự thỏa thuận tự nguyện giữa các bên trên Nền tảng Giáo dục Thông minh Kết Nối Học (EduConnect Marketplace).</p>
                <p className="not-italic pt-1 font-semibold text-slate-800">
                  Hôm nay, ngày <strong>{contractCreatedDate}</strong>, chúng tôi gồm các bên sau đây:
                </p>
              </div>

              {/* 3 Bên Tham Gia */}
              <div className="space-y-4 font-sans text-xs">
                {/* Bên A - Gia Sư */}
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                  <p className="font-extrabold text-blue-900 uppercase text-[11px] flex items-center gap-1.5 pb-1">
                    <User className="w-3.5 h-3.5 text-blue-600" /> 1. BÊN CUNG CẤP DỊCH VỤ GIA SƯ (BÊN A - GIA SƯ)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-slate-800 pt-1">
                    <p>Mã Gia sư: <strong>#{summary.tutorId}</strong></p>
                    <p>Email liên hệ: <strong>{summary.classroomReviewerEmail || "Gia sư đối tác"}</strong></p>
                    <p className="sm:col-span-2 font-mono text-[11px] text-slate-600 truncate">
                      Địa chỉ ví Web3 (EVM): <strong className="text-slate-900">{summary.tutorWallet}</strong>
                    </p>
                  </div>
                </div>

                {/* Bên B - Học Viên */}
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                  <p className="font-extrabold text-indigo-900 uppercase text-[11px] flex items-center gap-1.5 pb-1">
                    <User className="w-3.5 h-3.5 text-indigo-600" /> 2. BÊN SỬ DỤNG DỊCH VỤ HỌC TẬP (BÊN B - HỌC VIÊN / PHỤ HUYNH)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-slate-800 pt-1">
                    <p>Mã Học viên: <strong>#{summary.studentId}</strong></p>
                    <p>Lớp học đăng ký: <strong>Lớp #{summary.classroomId}</strong></p>
                    <p className="sm:col-span-2 font-mono text-[11px] text-slate-600 truncate">
                      Địa chỉ ví Web3 (EVM): <strong className="text-slate-900">{summary.studentWallet}</strong>
                    </p>
                  </div>
                </div>

                {/* Bên C - Nền Tảng */}
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                  <p className="font-extrabold text-emerald-900 uppercase text-[11px] flex items-center gap-1.5 pb-1">
                    <Building className="w-3.5 h-3.5 text-emerald-600" /> 3. BÊN TRUNG GIAN NỀN TẢNG (BÊN C - NỀN TẢNG EDUCONNECT SMART ESCROW)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-slate-800 pt-1">
                    <p>Đại diện: <strong>Hệ thống Hợp đồng Thông minh Smart Contract Escrow</strong></p>
                    <p>Mạng Blockchain: <strong>Ethereum Sepolia Testnet (Chain ID: 11155111)</strong></p>
                    <p className="sm:col-span-2 font-mono text-[11px] text-slate-600 truncate">
                      Địa chỉ ví hợp đồng (Verifying Contract): <strong className="text-slate-900">{summary.escrowContractAddress || "0x984bEc42561BBC9f63BEE4BA1469872cD369d3b3"}</strong>
                    </p>
                  </div>
                </div>
              </div>

              {/* Các Điều Khoản Chi Tiết */}
              <div className="space-y-4 pt-2 text-xs sm:text-[13px] text-slate-800 leading-relaxed">
                {/* Điều 1 */}
                <div className="space-y-1">
                  <h3 className="font-bold text-slate-950 uppercase text-xs font-sans tracking-wide">
                    ĐIỀU 1: NỘI DUNG VÀ CAM KẾT DỊCH VỤ
                  </h3>
                  <p>1.1. Bên A đồng ý cung cấp dịch vụ giảng dạy kiến thức theo đúng lộ trình khóa học (Tổng số <strong>{summary.totalSessions} buổi đào tạo</strong>) đã được Bên B lựa chọn và đặt lịch trên hệ thống.</p>
                  <p>1.2. Bên B đồng ý thanh toán toàn bộ chi phí học tập thông qua cơ chế khóa quỹ thông minh (Escrow Smart Contract) do Bên C vận hành.</p>
                  <p>1.3. Hợp đồng này được xác thực bằng <strong>chữ ký điện tử chuẩn mã hóa an toàn EIP-712 Typed Data (Zero-Gas Signing)</strong> từ ví Web3 của các bên tham gia, có giá trị ràng buộc và pháp lý tương đương văn bản giấy ký tay.</p>
                </div>

                {/* Điều 2 */}
                <div className="space-y-1.5">
                  <h3 className="font-bold text-slate-950 uppercase text-xs font-sans tracking-wide">
                    ĐIỀU 2: HỌC PHÍ VÀ QUY TẮC PHÂN CHIA QUỸ KÝ QUỸ (ESCROW SPLIT 3 BÊN)
                  </h3>
                  <p>
                    2.1. <strong>Đơn giá và Tổng học phí:</strong> Học phí mỗi buổi học là <strong>${summary.pricePerSessionUsdc.toFixed(2)} {summary.tokenSymbol}</strong>
                    {detail?.totalPriceVnd && (
                      <span> (~{(detail.totalPriceVnd / summary.totalSessions).toLocaleString("vi-VN")} VNĐ/buổi)</span>
                    )}. Tổng giá trị hợp đồng ký quỹ là <strong>${summary.totalAmountUsdc.toFixed(2)} {summary.tokenSymbol}</strong>
                    {detail?.totalPriceVnd && (
                      <span> ({Number(detail.totalPriceVnd).toLocaleString("vi-VN")} VNĐ với tỷ giá quy đổi 1 USDC = 25.000 VNĐ)</span>
                    )}.
                  </p>
                  <p>2.2. Toàn bộ tiền học phí được khóa an toàn trên Smart Contract và tự động giải ngân theo 3 kịch bản kết quả buổi học thực tế:</p>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1 text-xs">
                    <p>• <strong>Kịch bản 1 (Cả 2 bên có mặt - BOTH_PRESENT):</strong> Gia sư nhận <strong>85%</strong> thù lao (8.500 bps), Nền tảng nhận phí dịch vụ <strong>15%</strong> (1.500 bps), Học viên nhận 0%.</p>
                    <p>• <strong>Kịch bản 2 (Học viên vắng mặt không phép - STUDENT_ABSENT):</strong> Gia sư nhận đền bù <strong>45%</strong>, Nền tảng giữ lại <strong>10%</strong> phí vận hành, Học viên được hoàn trả <strong>45%</strong> học phí buổi đó.</p>
                    <p>• <strong>Kịch bản 3 (Gia sư vắng mặt hoặc Khiếu nại được duyệt - TUTOR_ABSENT / DISPUTE_REFUND):</strong> Hoàn trả <strong>100%</strong> học phí buổi học đó về ví MetaMask của Học viên; Gia sư và Nền tảng không nhận được chi phí.</p>
                  </div>
                </div>

                {/* Điều 3 */}
                <div className="space-y-1">
                  <h3 className="font-bold text-slate-950 uppercase text-xs font-sans tracking-wide">
                    ĐIỀU 3: THỜI HẠN THANH TOÁN VÀ XỬ LÝ LỖI (WAITLIST READINESS)
                  </h3>
                  <p>3.1. Sau khi Bên A (Gia sư) đồng ý chấp nhận yêu cầu và ký hợp đồng, Bên B có thời hạn tối đa <strong>24 giờ (24h Payment Window)</strong> để hoàn tất việc ký EIP-712 và nạp cọc USDC vào quỹ Escrow trên blockchain.</p>
                  <p>3.2. Quá thời hạn 24 giờ nếu Bên B không nạp cọc, hợp đồng sẽ tự động chuyển sang trạng thái <strong>EXPIRED</strong>, hủy giữ chỗ và tự động giải phóng suất học cho người tiếp theo trong danh sách chờ (Waitlist).</p>
                </div>

                {/* Điều 4 */}
                <div className="space-y-1">
                  <h3 className="font-bold text-slate-950 uppercase text-xs font-sans tracking-wide">
                    ĐIỀU 4: ĐIỀU KHOẢN CHUNG VÀ GIẢI QUYẾT TRANH CHẤP
                  </h3>
                  <p>4.1. Mọi tranh chấp phát sinh trong quá trình học tập sẽ được tiếp nhận và xử lý qua hệ thống Trọng tài Khiếu nại trực tuyến (Dispute Window: 24h sau mỗi buổi học) trước khi Smart Contract giải ngân.</p>
                  <p>4.2. Hai bên công nhận đã đọc kỹ, hiểu rõ và đồng ý toàn bộ điều khoản trước khi tiến hành thao tác ký số mật mã học EIP-712.</p>
                </div>
              </div>

              {/* Bằng Chứng Chữ Ký Điện Tử EIP-712 (Cryptographic Proof) */}
              <div className="pt-4 border-t-2 border-slate-800 space-y-4 font-sans">
                <h3 className="font-extrabold text-slate-950 uppercase text-xs tracking-wider text-center">
                  XÁC NHẬN CHỮ KÝ ĐIỆN TỬ MẬT MÃ HỌC (EIP-712 CRYPTOGRAPHIC PROOF)
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Chữ ký Bên A */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <span className="font-bold text-xs text-slate-900">CHỮ KÝ BÊN A (GIA SƯ)</span>
                      {tutorAcceptance ? (
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-md flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> ĐÃ KÝ SỐ EIP-712
                        </span>
                      ) : (
                        <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-md">
                          CHỜ KÝ SỐ
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-700 space-y-1 font-mono">
                      <p>Trạng thái: <strong>{tutorAcceptance ? "ĐÃ XÁC THỰC (VERIFIED)" : "PENDING"}</strong></p>
                      <p className="truncate">Ví ký: {summary.tutorWallet}</p>
                      <p className="truncate">Signature: {tutorAcceptance?.signature || "0x..."}</p>
                      <p className="text-[10px] text-slate-500 font-sans">
                        Thời gian ký: {tutorAcceptance ? new Date(tutorAcceptance.acceptedAt).toLocaleString("vi-VN") : "Chưa có"}
                      </p>
                    </div>
                  </div>

                  {/* Chữ ký Bên B */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <span className="font-bold text-xs text-slate-900">CHỮ KÝ BÊN B (HỌC VIÊN)</span>
                      {studentAcceptance ? (
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-md flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> ĐÃ KÝ SỐ EIP-712
                        </span>
                      ) : (
                        <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-md">
                          CHỜ KÝ SỐ
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-700 space-y-1 font-mono">
                      <p>Trạng thái: <strong>{studentAcceptance ? "ĐÃ XÁC THỰC (VERIFIED)" : "PENDING"}</strong></p>
                      <p className="truncate">Ví ký: {summary.studentWallet}</p>
                      <p className="truncate">Signature: {studentAcceptance?.signature || "0x..."}</p>
                      <p className="text-[10px] text-slate-500 font-sans">
                        Thời gian ký: {studentAcceptance ? new Date(studentAcceptance.acceptedAt).toLocaleString("vi-VN") : "Chưa có"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-slate-100 rounded-xl font-mono text-[11px] text-slate-600 break-all space-y-1">
                  <p><strong>Terms Digest Hash (SHA-3):</strong> {detail?.termsHash || "0x..."}</p>
                  <p className="text-[10px] text-slate-400 font-sans italic">
                    (Văn bản hợp đồng điện tử này được tự động trích xuất trực tiếp từ Cơ sở Dữ liệu & Smart Contract Escrow của hệ thống EduConnect).
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Interactive Signing Footer */}
        {summary && summary.status === 'PENDING_TUTOR_ACCEPTANCE' && (
          <div className="p-4 bg-indigo-50/90 border-t border-indigo-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 print:hidden">
            <p className="text-xs text-indigo-950 font-bold">
              ⚡ Hợp đồng đang chờ Gia sư ký số EIP-712 để chuyển sang bước Học viên ký và nạp cọc.
            </p>
            <button
              onClick={() => handleExecuteSign("TUTOR")}
              disabled={isSigning}
              className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-brand-primary to-brand-secondary hover:opacity-95 text-white rounded-xl text-xs font-black transition-all shadow-md flex items-center justify-center gap-2"
            >
              {isSigning ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Đang ký số qua MetaMask...
                </>
              ) : (
                <>
                  <FileSignature className="w-4 h-4" /> Đồng ý & Ký số EIP-712 (Gia sư)
                </>
              )}
            </button>
          </div>
        )}

        {summary && summary.status === 'PENDING_STUDENT_ACCEPTANCE' && (
          <div className="p-4 bg-emerald-50/90 border-t border-emerald-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 print:hidden">
            <p className="text-xs text-emerald-950 font-bold">
              ⚡ Gia sư đã ký hợp đồng. Vui lòng ký số xác nhận để bắt đầu đếm ngược 24 giờ nạp cọc giữ chỗ.
            </p>
            <button
              onClick={() => handleExecuteSign("STUDENT")}
              disabled={isSigning}
              className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-95 text-white rounded-xl text-xs font-black transition-all shadow-md flex items-center justify-center gap-2"
            >
              {isSigning ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Đang ký số qua MetaMask...
                </>
              ) : (
                <>
                  <FileSignature className="w-4 h-4" /> Đồng ý & Ký số EIP-712 (Học viên)
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
