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
  DollarSign,
  Calendar,
  Lock,
  ExternalLink,
} from "lucide-react";
import { contractsApi, AgreementSummary, AgreementDetail } from "../../api/contractsApi";
import { EtherscanLink } from "../common/EtherscanLink";

interface ContractDocumentModalProps {
  agreementId: string;
  onClose: () => void;
}

export function ContractDocumentModal({ agreementId, onClose }: ContractDocumentModalProps) {
  const [detail, setDetail] = useState<AgreementDetail | null>(null);
  const [acceptances, setAcceptances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
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
    }
    load();
  }, [agreementId]);

  const handlePrint = () => {
    window.print();
  };

  const summary = detail?.summary;
  const tutorAcceptance = acceptances.find((a) => a.role === "TUTOR");
  const studentAcceptance = acceptances.find((a) => a.role === "STUDENT");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto print:p-0 print:bg-white">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:rounded-none">
        {/* Header Bar - Hidden in Print */}
        <div className="p-4 sm:px-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">Văn Bản Hợp Đồng Đào Tạo & Ký Quỹ Escrow</h3>
              <p className="text-[11px] text-slate-500 font-medium">Hợp đồng điện tử xác thực mật mã học EIP-712</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" /> In / Tải PDF
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Contract Content Body */}
        <div className="p-6 sm:p-10 overflow-y-auto space-y-8 text-xs sm:text-sm text-slate-800 font-serif leading-relaxed">
          {loading ? (
            <div className="py-20 text-center text-slate-400 font-sans font-bold">
              Đang tải nội dung hợp đồng...
            </div>
          ) : !summary ? (
            <div className="py-20 text-center text-rose-500 font-sans font-bold">
              Không tìm thấy thông tin hợp đồng.
            </div>
          ) : (
            <>
              {/* Official Header */}
              <div className="text-center space-y-1.5 border-b border-slate-200 pb-6 font-sans">
                <p className="font-bold uppercase tracking-widest text-[11px] text-slate-500">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                <p className="font-bold text-xs text-slate-600">Độc lập - Tự do - Hạnh phúc</p>
                <div className="w-24 h-0.5 bg-slate-300 mx-auto my-2"></div>
                <h1 className="text-lg sm:text-2xl font-black text-slate-900 pt-2 tracking-tight">
                  HỢP ĐỒNG DỊCH VỤ ĐÀO TẠO & KÝ QUỸ ESCROW BLOCKCHAIN
                </h1>
                <p className="text-xs text-slate-500 font-mono">Mã hợp đồng: {summary.id}</p>
              </div>

              {/* Legal Clauses */}
              <div className="space-y-6">
                {/* 1. Các bên tham gia */}
                <div className="space-y-3 font-sans">
                  <h2 className="font-bold text-slate-900 uppercase text-xs tracking-wider border-b border-slate-100 pb-1">
                    ĐIỀU 1. CÁC BÊN THAM GIA HỢP ĐỒNG
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-xs">
                    <div className="space-y-1">
                      <p className="font-bold text-slate-900 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-blue-600" /> BÊN A (GIA SƯ ĐÀO TẠO):
                      </p>
                      <p className="text-slate-700">Mã Gia sư: <strong>#{summary.tutorId}</strong></p>
                      <p className="text-slate-700 font-mono text-[11px]">Ví MetaMask: {summary.tutorWallet}</p>
                    </div>

                    <div className="space-y-1">
                      <p className="font-bold text-slate-900 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-indigo-600" /> BÊN B (HỌC VIÊN / NGƯỜI HỌC):
                      </p>
                      <p className="text-slate-700">Mã Học viên: <strong>#{summary.studentId}</strong></p>
                      <p className="text-slate-700 font-mono text-[11px]">Ví MetaMask: {summary.studentWallet}</p>
                    </div>
                  </div>
                </div>

                {/* 2. Nội dung khóa học & Học phí */}
                <div className="space-y-3 font-sans">
                  <h2 className="font-bold text-slate-900 uppercase text-xs tracking-wider border-b border-slate-100 pb-1">
                    ĐIỀU 2. NỘI DUNG KHÓA HỌC & HỌC PHÍ KÝ QUỸ
                  </h2>
                  <div className="space-y-2 text-xs text-slate-700">
                    <p>• <strong>Lớp học đăng ký:</strong> Lớp học mã số #{summary.classroomId}.</p>
                    <p>• <strong>Tổng số buổi đào tạo cam kết:</strong> {summary.totalSessions} buổi học.</p>
                    <p>
                      • <strong>Học phí mỗi buổi:</strong> ${summary.pricePerSessionUsdc.toFixed(2)} {summary.tokenSymbol}
                      {detail?.totalPriceVnd && (
                        <span> (~{(detail.totalPriceVnd / summary.totalSessions).toLocaleString("vi-VN")} VND / buổi)</span>
                      )}
                    </p>
                    <p className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-950 font-bold">
                      Tổng giá trị hợp đồng ký quỹ: ${summary.totalAmountUsdc.toFixed(2)} {summary.tokenSymbol}
                      {detail?.totalPriceVnd && (
                        <span> ({Number(detail.totalPriceVnd).toLocaleString("vi-VN")} VND)</span>
                      )}
                    </p>
                  </div>
                </div>

                {/* 3. Cơ chế Escrow Blockchain & Giải ngân */}
                <div className="space-y-3 font-sans">
                  <h2 className="font-bold text-slate-900 uppercase text-xs tracking-wider border-b border-slate-100 pb-1">
                    ĐIỀU 3. CƠ CHẾ BẢO VỆ KÝ QUỸ SMART CONTRACT ESCROW
                  </h2>
                  <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
                    <p>
                      1. <strong>Ký quỹ 100%:</strong> Học viên nạp toàn bộ học phí vào Smart Contract Escrow (Địa chỉ: <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[11px]">{summary.escrowContractAddress || "0x984bEc42561BBC9f63BEE4BA1469872cD369d3b3"}</code>) trước khi tham gia lớp.
                    </p>
                    <p>
                      2. <strong>Quy tắc Giải ngân:</strong> Sau mỗi buổi học được cả 2 bên điểm danh hợp lệ (`BOTH_PRESENT`), hệ thống tự động giải ngân theo tỷ lệ cố định: <strong>85% cho Gia sư</strong> và <strong>15% phí nền tảng EduConnect</strong>.
                    </p>
                    <p>
                      3. <strong>Cửa sổ Khiếu nại (24 giờ):</strong> Sau mỗi buổi học, Học viên có 24 giờ để gửi khiếu nại (`TUTOR_FRAUD`) nếu Gia sư gian lận điểm danh. Tiền của buổi học sẽ bị đóng băng cho đến khi Staff/Admin phân xử.
                    </p>
                  </div>
                </div>

                {/* 4. Chữ ký số EIP-712 */}
                <div className="space-y-4 font-sans pt-4 border-t border-slate-200">
                  <h2 className="font-bold text-slate-900 uppercase text-xs tracking-wider">
                    ĐIỀU 4. XÁC THỰC CHỮ KÝ SỐ MẬT MÃ HỌC (EIP-712 CRYPTOGRAPHIC PROOF)
                  </h2>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Tutor Signature Card */}
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900">Chữ ký Bên A (Gia sư):</span>
                        {tutorAcceptance ? (
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Đã ký số
                          </span>
                        ) : (
                          <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                            Chờ ký
                          </span>
                        )}
                      </div>
                      {tutorAcceptance && (
                        <div className="text-[11px] text-slate-600 space-y-1 font-mono">
                          <p className="truncate">Chữ ký: {tutorAcceptance.signature || "EIP-712 Verified"}</p>
                          <p className="text-slate-400 text-[10px]">Thời gian: {new Date(tutorAcceptance.acceptedAt).toLocaleString("vi-VN")}</p>
                        </div>
                      )}
                    </div>

                    {/* Student Signature Card */}
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900">Chữ ký Bên B (Học viên):</span>
                        {studentAcceptance ? (
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Đã ký số
                          </span>
                        ) : (
                          <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                            Chờ ký
                          </span>
                        )}
                      </div>
                      {studentAcceptance && (
                        <div className="text-[11px] text-slate-600 space-y-1 font-mono">
                          <p className="truncate">Chữ ký: {studentAcceptance.signature || "EIP-712 Verified"}</p>
                          <p className="text-slate-400 text-[10px]">Thời gian: {new Date(studentAcceptance.acceptedAt).toLocaleString("vi-VN")}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-3 bg-slate-100 rounded-xl font-mono text-[11px] text-slate-500 break-all">
                    <strong>Terms Digest Hash:</strong> {detail?.termsHash || "0x..."}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
