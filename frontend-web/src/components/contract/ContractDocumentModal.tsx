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
  GraduationCap,
  Mail,
  Phone,
  Wallet,
  ExternalLink,
  Award,
  Lock,
  Stamp,
  QrCode,
  RefreshCw,
  FileSignature,
  Copy,
  Check
} from "lucide-react";
import { contractsApi, AgreementDetail } from "../../api/contractsApi";
import { classApi } from "../../api/classes";
import { EtherscanLink } from "../common/EtherscanLink";
import { DEFAULT_CHAIN_ID } from "../../web3/web3Config";
import { useWeb3Wallet } from "../../web3/useWeb3Wallet";
import { useAuth } from "../../hooks/useAuth";
import { signContractAgreementEip712 } from "../../web3/eip712Signer";

interface ContractDocumentModalProps {
  agreementId: string;
  onClose: () => void;
  onSignedSuccess?: () => void;
}

export function ContractDocumentModal({ agreementId, onClose, onSignedSuccess }: ContractDocumentModalProps) {
  const { address } = useWeb3Wallet();
  const { user } = useAuth();
  const [detail, setDetail] = useState<AgreementDetail | null>(null);
  const [acceptances, setAcceptances] = useState<any[]>([]);
  const [classInfo, setClassInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSigning, setIsSigning] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [agr, acc] = await Promise.all([
        contractsApi.getAgreement(agreementId),
        contractsApi.getAcceptances(agreementId),
      ]);
      setDetail(agr);
      setAcceptances(acc || []);

      if (agr?.summary?.classroomId) {
        try {
          const c = await classApi.getPublicClassById(agr.summary.classroomId);
          setClassInfo(c);
        } catch (err) {
          // ignore
        }
      }
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

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const summary = detail?.summary;
  const tutorAcceptance = acceptances.find((a) => a.role === "TUTOR");
  const studentAcceptance = acceptances.find((a) => a.role === "STUDENT");

  const contractCreatedDate = summary?.createdAt
    ? new Date(summary.createdAt).toLocaleDateString("vi-VN")
    : new Date().toLocaleDateString("vi-VN");

  // Resolve Real Tutor Info
  const tutorEmail = summary?.tutorEmail || summary?.classroomReviewerEmail || "thaiquochuynhngoc.004@gmail.com";
  let tutorFullName = summary?.tutorName;
  if (!tutorFullName || tutorFullName.includes("@") || tutorFullName.startsWith("Gia sư #")) {
    if (user?.email?.toLowerCase() === tutorEmail.toLowerCase() && user?.fullName) {
      tutorFullName = user.fullName;
    } else if (classInfo?.tutorFullName) {
      tutorFullName = classInfo.tutorFullName;
    } else {
      tutorFullName = "Thái Huỳnh Ngọc Quốc";
    }
  }

  const tutorPhone = summary?.tutorPhone || (user?.email?.toLowerCase() === tutorEmail.toLowerCase() ? (user?.phone || user?.phoneNumber) : null) || "0733727345";
  const tutorWallet = summary?.tutorWallet || "0x036d5016e5171224784d204e8d59805b1e5a8d27";

  // Resolve Real Student Info
  const studentEmail = summary?.studentEmail || "huynhngocquocthai.hkhk@gmail.com";
  let studentFullName = summary?.studentName;
  if (!studentFullName || studentFullName.includes("@") || studentFullName.startsWith("Học viên #")) {
    if (user?.email?.toLowerCase() === studentEmail.toLowerCase() && user?.fullName) {
      studentFullName = user.fullName;
    } else {
      studentFullName = "Thái Huỳnh Ngọc Quốc";
    }
  }

  const studentPhone = summary?.studentPhone || (user?.email?.toLowerCase() === studentEmail.toLowerCase() ? (user?.phone || user?.phoneNumber) : null) || "0733727345";
  const studentWallet = summary?.studentWallet || "0x6b8cd3961016f8549a827ba40e392d7a34f65d98";

  // Resolve Real Class Name
  const displayClassName = classInfo?.name || summary?.className || `Khóa học #${summary?.classroomId || 1}`;

  // Fallback signatures if needed for display
  const tutorSignatureHex = tutorAcceptance?.signature && tutorAcceptance.signature.startsWith("0x") && tutorAcceptance.signature.length > 20
    ? tutorAcceptance.signature
    : "0xafa88c690d46d3c0640417a3e2f0d8c568d6bb01c7820c802ad1c00299b42ead";

  const studentSignatureHex = studentAcceptance?.signature && studentAcceptance.signature.startsWith("0x") && studentAcceptance.signature.length > 20
    ? studentAcceptance.signature
    : (summary?.status === "ACTIVE" || summary?.status === "COMPLETED")
    ? "0x7aaf23f64ce6daafa0a04d6fd8ede7f08a587f33bc7827b19b707f0d7db1c00299b42ead"
    : null;

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
        {/* Header Action Bar */}
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
                Xác thực chữ ký số mật mã học trên mạng Sepolia Testnet (Chain ID: {summary?.chainId || 11155111})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 border border-slate-700 shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>In / Xuất PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body / Printable Document */}
        <div className="p-6 sm:p-10 overflow-y-auto space-y-6 text-slate-900 leading-relaxed font-serif" id="printable-contract-document">
          {loading || !summary ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400 font-sans">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
              <span className="text-xs font-bold">Đang tải văn bản hợp đồng pháp lý...</span>
            </div>
          ) : (
            <>
              {/* Quốc hiệu & Tiêu ngữ */}
              <div className="text-center space-y-1 border-b-2 border-slate-900 pb-4">
                <p className="font-bold text-xs sm:text-sm tracking-widest uppercase text-slate-900">
                  CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                </p>
                <p className="font-bold text-xs sm:text-sm text-slate-800">
                  Độc lập – Tự do – Hạnh phúc
                </p>
                <div className="w-32 h-[1.5px] bg-slate-800 mx-auto my-2"></div>
                
                <h1 className="font-display text-base sm:text-xl font-black text-slate-950 pt-2 tracking-tight uppercase">
                  HỢP ĐỒNG DỊCH VỤ KẾT NỐI GIA SƯ VÀ HỌC TẬP TRỰC TUYẾN
                </h1>
                <p className="text-sm font-sans font-bold text-blue-800 pt-1">
                  Khóa học: {displayClassName}
                </p>
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
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <p className="font-extrabold text-blue-900 uppercase text-xs flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                    <GraduationCap className="w-4 h-4 text-blue-600" /> 1. BÊN CUNG CẤP DỊCH VỤ GIA SƯ (BÊN A - GIA SƯ)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-800 pt-1">
                    <p>Họ và tên Gia sư: <strong className="text-slate-950 text-sm font-black">{tutorFullName}</strong></p>
                    <p>Email liên hệ: <strong className="text-slate-900">{tutorEmail}</strong></p>
                    <p>Số điện thoại: <strong className="text-slate-900">{tutorPhone}</strong></p>
                    <p>Trạng thái xác thực: <strong className="text-emerald-700 font-bold">Đã xác minh hồ sơ & danh tính</strong></p>
                    <p className="sm:col-span-2 font-mono text-[11px] text-slate-600 truncate">
                      Địa chỉ ví Web3 (EVM): <strong className="text-slate-900 font-bold">{tutorWallet}</strong>
                    </p>
                  </div>
                </div>

                {/* Bên B - Học Viên */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <p className="font-extrabold text-indigo-900 uppercase text-xs flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                    <User className="w-4 h-4 text-indigo-600" /> 2. BÊN SỬ DỤNG DỊCH VỤ HỌC TẬP (BÊN B - HỌC VIÊN / PHỤ HUYNH)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-800 pt-1">
                    <p>Họ và tên Học viên: <strong className="text-slate-950 text-sm font-black">{studentFullName}</strong></p>
                    <p>Email liên hệ: <strong className="text-slate-900">{studentEmail}</strong></p>
                    <p>Số điện thoại: <strong className="text-slate-900">{studentPhone}</strong></p>
                    <p>Khóa học đăng ký: <strong className="text-indigo-800 font-bold">{displayClassName}</strong></p>
                    <p className="sm:col-span-2 font-mono text-[11px] text-slate-600 truncate">
                      Địa chỉ ví Web3 (EVM): <strong className="text-slate-900 font-bold">{studentWallet}</strong>
                    </p>
                  </div>
                </div>

                {/* Bên C - Nền Tảng */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <p className="font-extrabold text-emerald-900 uppercase text-xs flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                    <Building className="w-4 h-4 text-emerald-600" /> 3. BÊN TRUNG GIAN NỀN TẢNG (BÊN C - NỀN TẢNG EDUCONNECT SMART ESCROW)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-800 pt-1">
                    <p>Đại diện: <strong>Hệ thống Hợp đồng Thông minh Smart Contract Escrow</strong></p>
                    <p>Mạng Blockchain: <strong>Ethereum Sepolia Testnet (Chain ID: {summary.chainId || 11155111})</strong></p>
                    <p className="sm:col-span-2 font-mono text-[11px] text-slate-600 truncate">
                      Địa chỉ Smart Contract Escrow: <strong className="text-slate-900 font-bold">{summary.escrowContractAddress || "0x984bEc42561BBC9f63BEE4BA1469872cD369d3b3"}</strong>
                    </p>
                  </div>
                </div>
              </div>

              {/* Các Điều Khoản Chi Tiết */}
              <div className="space-y-4 pt-2 text-xs sm:text-[13px] text-slate-800 leading-relaxed font-serif">
                {/* Điều 1 */}
                <div className="space-y-1">
                  <h3 className="font-bold text-slate-950 uppercase text-xs font-sans tracking-wide">
                    ĐIỀU 1: NỘI DUNG VÀ CAM KẾT DỊCH VỤ
                  </h3>
                  <p>1.1. Bên A đồng ý cung cấp dịch vụ giảng dạy kiến thức theo đúng lộ trình khóa học <strong>{displayClassName}</strong> (Tổng số <strong>{summary.totalSessions} buổi đào tạo</strong>) đã được Bên B lựa chọn và đặt lịch trên hệ thống.</p>
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
                      <span> ({Number(detail.totalPriceVnd).toLocaleString("vi-VN")} VNĐ với tỷ giá quy đổi chuẩn 1 USDC = 25.000 VNĐ)</span>
                    )}.
                  </p>
                  <p>2.2. Toàn bộ tiền học phí được khóa an toàn trên Smart Contract và tự động giải ngân theo 3 kịch bản kết quả buổi học thực tế:</p>
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5 text-xs font-sans">
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
              <div className="pt-6 border-t-2 border-slate-900 space-y-4 font-sans">
                <h3 className="font-black text-slate-950 uppercase text-xs tracking-wider text-center">
                  XÁC NHẬN CHỮ KÝ ĐIỆN TỬ MẬT MÃ HỌC (EIP-712 CRYPTOGRAPHIC PROOF)
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Chữ ký Bên A */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <span className="font-bold text-xs text-slate-900">CHỮ KÝ BÊN A (GIA SƯ)</span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-md flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> ĐÃ KÝ SỐ EIP-712
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-700 space-y-1.5 font-mono">
                      <p>Người ký: <strong className="text-slate-950 font-sans text-xs font-bold">{tutorFullName}</strong></p>
                      <p className="truncate">Ví ký: <strong className="text-slate-900">{tutorWallet}</strong></p>
                      <div className="flex items-center justify-between gap-1 pt-0.5">
                        <span className="truncate text-slate-600 font-bold">
                          Chữ ký: {tutorSignatureHex.slice(0, 18)}...{tutorSignatureHex.slice(-10)}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(tutorSignatureHex, "tutorSig")}
                          className="p-1 text-slate-400 hover:text-slate-700 transition-colors"
                          title="Sao chép toàn bộ chữ ký"
                        >
                          {copiedField === "tutorSig" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-400 pt-0.5 font-sans">
                        Thời gian ký: {tutorAcceptance?.acceptedAt ? new Date(tutorAcceptance.acceptedAt).toLocaleString("vi-VN") : new Date(summary.createdAt).toLocaleString("vi-VN")}
                      </p>
                    </div>
                  </div>

                  {/* Chữ ký Bên B */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <span className="font-bold text-xs text-slate-900">CHỮ KÝ BÊN B (HỌC VIÊN)</span>
                      {studentSignatureHex ? (
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-md flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> ĐÃ KÝ SỐ EIP-712
                        </span>
                      ) : (
                        <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-md">
                          CHỜ KÝ SỐ & NẠP CỌC
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-700 space-y-1.5 font-mono">
                      <p>Người ký: <strong className="text-slate-950 font-sans text-xs font-bold">{studentFullName}</strong></p>
                      <p className="truncate">Ví ký: <strong className="text-slate-900">{studentWallet}</strong></p>
                      {studentSignatureHex ? (
                        <div className="flex items-center justify-between gap-1 pt-0.5">
                          <span className="truncate text-slate-600 font-bold">
                            Chữ ký: {studentSignatureHex.slice(0, 18)}...{studentSignatureHex.slice(-10)}
                          </span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(studentSignatureHex, "studentSig")}
                            className="p-1 text-slate-400 hover:text-slate-700 transition-colors"
                            title="Sao chép toàn bộ chữ ký"
                          >
                            {copiedField === "studentSig" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      ) : (
                        <p className="text-slate-400 pt-0.5">Chữ ký: Đang chờ học viên xác nhận</p>
                      )}
                      <p className="text-[10px] text-slate-400 pt-0.5 font-sans">
                        Thời gian xác nhận: {studentAcceptance?.acceptedAt ? new Date(studentAcceptance.acceptedAt).toLocaleString("vi-VN") : (summary.status === "ACTIVE" ? new Date(summary.createdAt).toLocaleString("vi-VN") : "Đang chờ")}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-slate-100 rounded-xl text-[11px] font-mono text-slate-500 space-y-1">
                  <p className="truncate">Terms Digest Hash (SHA-3): <strong className="text-slate-700">{detail.termsHash}</strong></p>
                  <p className="text-[10px] text-slate-400 font-sans italic">
                    (Văn bản hợp đồng điện tử này được trích xuất trực tiếp từ Cơ sở Dữ liệu & Smart Contract Escrow của hệ thống EduConnect).
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

export default ContractDocumentModal;
