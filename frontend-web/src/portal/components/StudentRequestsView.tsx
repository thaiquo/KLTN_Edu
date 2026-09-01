import React, { useState, useEffect, useMemo } from "react";
import {
  Users,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  FileSignature,
  Wallet,
  AlertTriangle,
  ArrowRight,
  Filter,
  RefreshCw,
  Calendar,
  DollarSign,
  Sparkles,
  BookOpen,
  MessageSquare,
  FileText,
  Building,
  ShieldCheck,
  Printer
} from "lucide-react";
import { classApi } from "../../api/classes";
import { contractsApi } from "../../api/contractsApi";
import { useAuth } from "../../hooks/useAuth";
import { signContractAgreementEip712 } from "../../web3/eip712Signer";

interface EnrollmentRequestItem {
  id: number;
  classRoomId: number;
  className: string;
  tutorEmail: string;
  studentEmail: string;
  studentName?: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED";
  joinKey?: string;
  note?: string;
  rejectReason?: string;
  createdAt: string;
  updatedAt?: string;
}

interface StudentRequestsViewProps {
  onNavigate?: (tab: string) => void;
}

export function StudentRequestsView({ onNavigate }: StudentRequestsViewProps) {
  const { user } = useAuth();
  const [requests, setRequests] = useState<EnrollmentRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedClassId, setSelectedClassId] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [actionMsg, setActionMsg] = useState<{ text: string; tone: "success" | "error" } | null>(null);

  // Reject Modal state
  const [rejectModalReq, setRejectModalReq] = useState<EnrollmentRequestItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Initiate Contract Modal state
  const [contractModalReq, setContractModalReq] = useState<EnrollmentRequestItem | null>(null);
  const [pricePerSession, setPricePerSession] = useState(250000);
  const [totalSessions, setTotalSessions] = useState(10);
  const [isSigningContract, setIsSigningContract] = useState(false);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const data = await classApi.getAllTutorRequests();
      setRequests(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error("Failed to load tutor requests:", err);
      // Fallback empty list
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();

    const handleRealtime = (e: Event) => {
      fetchRequests();
    };

    window.addEventListener("realtime:event", handleRealtime);
    return () => window.removeEventListener("realtime:event", handleRealtime);
  }, []);

  // Distinct classrooms list for filtering
  const distinctClasses = useMemo(() => {
    const map = new Map<number, string>();
    requests.forEach((r) => {
      if (r.classRoomId && r.className) {
        map.set(r.classRoomId, r.className);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [requests]);

  // Filtered requests
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      if (selectedClassId !== "ALL" && String(r.classRoomId) !== selectedClassId) return false;
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchName = (r.studentName || "").toLowerCase().includes(query);
        const matchEmail = (r.studentEmail || "").toLowerCase().includes(query);
        const matchClass = (r.className || "").toLowerCase().includes(query);
        const matchNote = (r.note || "").toLowerCase().includes(query);
        if (!matchName && !matchEmail && !matchClass && !matchNote) return false;
      }
      return true;
    });
  }, [requests, statusFilter, selectedClassId, searchTerm]);

  // KPI stats
  const stats = useMemo(() => {
    return {
      total: requests.length,
      pending: requests.filter((r) => r.status === "PENDING").length,
      accepted: requests.filter((r) => r.status === "ACCEPTED").length,
      rejected: requests.filter((r) => r.status === "REJECTED").length,
    };
  }, [requests]);

  const handleOpenReject = (req: EnrollmentRequestItem) => {
    setRejectModalReq(req);
    setRejectReason("");
  };

  const handleConfirmReject = async () => {
    if (!rejectModalReq) return;
    setActionLoadingId(rejectModalReq.id);
    try {
      await classApi.rejectEnrollmentRequest(rejectModalReq.id, rejectReason.trim());
      setActionMsg({ text: `Đã từ chối yêu cầu của ${rejectModalReq.studentName || rejectModalReq.studentEmail}.`, tone: "success" });
      setRejectModalReq(null);
      await fetchRequests();
    } catch (err: any) {
      setActionMsg({ text: err?.message || "Không thể từ chối yêu cầu.", tone: "error" });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleOpenContractModal = async (req: EnrollmentRequestItem) => {
    setContractModalReq(req);
    try {
      const classDetail = await classApi.getClassById(req.classRoomId);
      const price = Number(classDetail?.pricePerSession) || 250000;
      const totalSessionsFromChapters = Array.isArray(classDetail?.chapters)
        ? classDetail.chapters.reduce((sum: number, ch: any) => sum + (Number(ch.sessionCount) || 0), 0)
        : 0;
      const sessions = classDetail?.totalSessions || totalSessionsFromChapters || 10;
      setPricePerSession(price);
      setTotalSessions(sessions);
    } catch {
      setPricePerSession(250000);
      setTotalSessions(10);
    }
  };

  const handleConfirmInitiateContract = async () => {
    if (!contractModalReq) return;
    const tutorWallet = user?.walletAddress;
    if (!tutorWallet || !tutorWallet.startsWith("0x")) {
      alert("Bạn chưa liên kết Ví MetaMask trên hồ sơ Gia sư. Vui lòng vào 'Ví của tôi' để liên kết ví trước khi ký hợp đồng!");
      return;
    }

    const defaultStudentWallet = "0x0000000000000000000000000000000000000000";

    setActionLoadingId(contractModalReq.id);
    setIsSigningContract(true);
    try {
      // 1. Accept enrollment request in learning-service
      await classApi.acceptEnrollmentRequest(contractModalReq.id);

      // 2. Auto-Initiate Contract Agreement in contract-service with classroom data
      const agreementDetail = await contractsApi.initiateAgreement({
        classroomId: contractModalReq.classRoomId,
        studentEmail: contractModalReq.studentEmail,
        tutorEmail: user?.email,
        studentWallet: defaultStudentWallet,
        tutorWallet: tutorWallet,
        pricePerSessionVnd: pricePerSession,
        totalSessions: totalSessions,
        classroomReviewerEmail: user?.email,
      });

      // 3. Prompt MetaMask for EIP-712 Gasless Signing
      let tutorSignature: string | undefined = undefined;
      if (agreementDetail?.summary?.id) {
        try {
          tutorSignature = await signContractAgreementEip712(
            {
              id: agreementDetail.summary.id,
              tutorWallet: tutorWallet,
              studentWallet: defaultStudentWallet,
              totalAmountUsdc: agreementDetail.summary.totalAmountUsdc,
              termsHash: agreementDetail.termsHash,
              createdAt: agreementDetail.summary.createdAt,
              chainId: agreementDetail.summary.chainId || 11155111,
              escrowContractAddress: agreementDetail.summary.escrowContractAddress || undefined,
            },
            tutorWallet
          );
        } catch (signErr: any) {
          console.warn("MetaMask EIP-712 sign skipped/failed:", signErr);
        }

        // 4. Submit signature to contract-service
        await contractsApi.signAgreement(agreementDetail.summary.id, {
          role: "TUTOR",
          walletAddress: tutorWallet,
          signature: tutorSignature,
          userEmail: user?.email,
          studentEmail: contractModalReq.studentEmail,
        });
      }

      setActionMsg({
        text: `Đã duyệt yêu cầu & Ký số EIP-712 hợp đồng Escrow thành công! Đã gửi thông báo Realtime & Email mời học viên ${contractModalReq.studentName || contractModalReq.studentEmail} vào ký xác nhận trong 24 giờ.`,
        tone: "success",
      });

      setContractModalReq(null);
      await fetchRequests();
    } catch (err: any) {
      setActionMsg({ text: err?.message || "Lỗi khi ký và phát hành hợp đồng Escrow.", tone: "error" });
    } finally {
      setActionLoadingId(null);
      setIsSigningContract(false);
    }
  };

  return (
    <div className="space-y-6 font-sans select-none max-w-6xl mx-auto pb-12">
      {/* Title & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Users className="w-7 h-7 text-brand-primary" /> Yêu cầu của Học viên (Student Requests)
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-1">
            Quản lý tập trung toàn bộ yêu cầu tham gia các lớp học của bạn và khởi tạo hợp đồng Escrow Blockchain.
          </p>
        </div>

        <button
          onClick={fetchRequests}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-xs shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Làm mới
        </button>
      </div>

      {/* Tutor Wallet Warning Banner if not linked */}
      {(!user?.walletAddress || !user.walletAddress.startsWith("0x")) && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-amber-900 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <p className="font-bold">Bạn chưa liên kết Ví Blockchain trên hồ sơ Gia sư</p>
            <p className="mt-0.5 text-amber-800 font-medium leading-relaxed">
              Để khởi tạo Hợp đồng Escrow và nhận học phí giải ngân tự động về ví cá nhân, vui lòng liên kết địa chỉ ví MetaMask trong mục <strong>Ví của tôi</strong>.
            </p>
          </div>
          {onNavigate && (
            <button
              onClick={() => onNavigate("wallet")}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors shrink-0 flex items-center gap-1.5 shadow-xs"
            >
              <Wallet className="w-3.5 h-3.5" /> Đến Ví của tôi
            </button>
          )}
        </div>
      )}

      {/* Action Notification Alert */}
      {actionMsg && (
        <div
          className={`p-4 rounded-2xl text-xs font-bold flex items-center justify-between border ${
            actionMsg.tone === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-rose-50 border-rose-200 text-rose-900"
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMsg.tone === "success" ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <XCircle className="w-4 h-4 text-rose-600" />}
            <span>{actionMsg.text}</span>
          </div>
          <button onClick={() => setActionMsg(null)} className="text-slate-400 hover:text-slate-600 text-sm font-black">×</button>
        </div>
      )}

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Tổng số yêu cầu</span>
          <span className="text-2xl font-black text-slate-900 mt-1 block">{stats.total}</span>
        </div>

        <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200/80 shadow-xs">
          <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span> Chờ xử lý
          </span>
          <span className="text-2xl font-black text-amber-900 mt-1 block">{stats.pending}</span>
        </div>

        <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200/80 shadow-xs">
          <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">Đã chấp nhận</span>
          <span className="text-2xl font-black text-emerald-900 mt-1 block">{stats.accepted}</span>
        </div>

        <div className="bg-rose-50/60 p-4 rounded-2xl border border-rose-200/80 shadow-xs">
          <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider block">Đã từ chối</span>
          <span className="text-2xl font-black text-rose-900 mt-1 block">{stats.rejected}</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
            {[
              { id: "ALL", label: "Tất cả" },
              { id: "PENDING", label: `Chờ duyệt (${stats.pending})` },
              { id: "ACCEPTED", label: "Đã duyệt" },
              { id: "REJECTED", label: "Từ chối" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  statusFilter === tab.id
                    ? "bg-white text-brand-primary shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Classroom Selector */}
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-slate-400" />
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 outline-none focus:border-brand-primary"
            >
              <option value="ALL">Tất cả các lớp học</option>
              {distinctClasses.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo tên học viên, email, lời nhắn..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 font-medium outline-none focus:bg-white focus:border-brand-primary transition-all"
          />
        </div>
      </div>

      {/* Requests List */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center text-slate-400 text-xs font-bold">
            Đang tải danh sách yêu cầu...
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl border border-dashed border-slate-200 text-center text-slate-400 space-y-2">
            <Users className="w-10 h-10 mx-auto text-slate-300" />
            <p className="text-sm font-bold text-slate-600">Không tìm thấy yêu cầu nào</p>
            <p className="text-xs font-medium">Khi học viên đăng ký tham gia lớp học của bạn, yêu cầu sẽ hiển thị tại đây.</p>
          </div>
        ) : (
          filteredRequests.map((req) => {
            const displayName = req.studentName && req.studentName.toLowerCase() !== req.studentEmail.toLowerCase()
              ? req.studentName
              : "Học viên";

            const isPending = req.status === "PENDING";
            const isAccepted = req.status === "ACCEPTED";
            const isRejected = req.status === "REJECTED";

            return (
              <div
                key={req.id}
                className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-5"
              >
                {/* Left: Student & Class Info */}
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-black text-slate-900 text-sm font-display">{displayName}</span>
                    <span className="text-xs text-slate-500 font-medium">({req.studentEmail})</span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        isPending
                          ? "bg-amber-100 text-amber-800 border border-amber-200"
                          : isAccepted
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                          : isRejected
                          ? "bg-rose-100 text-rose-800 border border-rose-200"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {req.status}
                    </span>
                  </div>

                  {/* Class details badge */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 font-semibold">
                    <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-800 px-2.5 py-1 rounded-lg border border-indigo-100">
                      <BookOpen className="w-3.5 h-3.5" /> Lớp: <strong>{req.className}</strong>
                    </span>
                    <span className="inline-flex items-center gap-1 text-slate-400 text-[11px]">
                      <Clock className="w-3.5 h-3.5" /> Ngày gửi: {new Date(req.createdAt).toLocaleDateString("vi-VN")}
                    </span>
                  </div>

                  {/* Note from student */}
                  {req.note && (
                    <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-700 font-medium flex items-start gap-2">
                      <MessageSquare className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                      <span className="italic">"{req.note}"</span>
                    </div>
                  )}

                  {/* Reject reason if rejected */}
                  {isRejected && req.rejectReason && (
                    <p className="text-xs text-rose-600 font-semibold">Lý do từ chối: {req.rejectReason}</p>
                  )}
                </div>

                {/* Right: Actions */}
                <div className="flex flex-wrap items-center gap-2 shrink-0 w-full md:w-auto justify-end pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                  {isPending && (
                    <>
                      <button
                        onClick={() => handleOpenReject(req)}
                        disabled={actionLoadingId === req.id}
                        className="px-4 py-2 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-bold transition-all"
                      >
                        Từ chối
                      </button>

                      <button
                        onClick={() => handleOpenContractModal(req)}
                        disabled={actionLoadingId === req.id}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-brand-primary to-brand-secondary hover:opacity-95 text-white text-xs font-black transition-all shadow-md flex items-center gap-1.5"
                      >
                        <FileText className="w-3.5 h-3.5" /> Xem & Ký Hợp đồng
                      </button>
                    </>
                  )}

                  {isAccepted && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-emerald-700 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Đã duyệt vào lớp
                      </span>
                      {onNavigate && (
                        <button
                          onClick={() => onNavigate("contracts")}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors flex items-center gap-1"
                        >
                          <FileSignature className="w-3.5 h-3.5" /> Xem Hợp đồng Escrow
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Reject Reason Modal */}
      {rejectModalReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in">
            <h3 className="font-bold text-slate-900 text-base">Từ chối yêu cầu tham gia lớp</h3>
            <p className="text-xs text-slate-600">
              Bạn đang từ chối yêu cầu của học viên <strong>{rejectModalReq.studentName || rejectModalReq.studentEmail}</strong> cho lớp <strong>{rejectModalReq.className}</strong>.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Lý do từ chối (tùy chọn):</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Nhập lý do (ví dụ: Lớp đã đủ sĩ số, lịch học không phù hợp...)"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:bg-white focus:border-rose-400 h-24 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setRejectModalReq(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={actionLoadingId === rejectModalReq.id}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                Xác nhận từ chối
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Official Vietnamese Legal Contract Preview Modal (No manual inputs, 100% auto-filled) */}
      {contractModalReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] animate-in fade-in">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 rounded-t-3xl">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-brand-primary flex items-center justify-center border border-indigo-100 font-bold">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-sm sm:text-base tracking-tight font-display">
                    Xem trước Hợp đồng Dịch vụ & Ký số EIP-712
                  </h3>
                  <p className="text-[11px] text-slate-500 font-semibold">
                    Toàn bộ thông tin được tự động đồng bộ từ lớp học. Gia sư đọc điều khoản và ký xác thực bằng MetaMask.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setContractModalReq(null)}
                className="w-8 h-8 rounded-full bg-slate-200/60 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {/* Modal Document Body (Scrollable A4 Legal Contract Layout) */}
            <div className="p-5 sm:p-8 overflow-y-auto space-y-6 text-slate-800 text-xs sm:text-sm font-sans leading-relaxed bg-slate-50/40">
              <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200/90 shadow-xs space-y-6">
                {/* Formal Header: Quốc hiệu, Tiêu ngữ */}
                <div className="text-center space-y-1 pb-4 border-b border-slate-200">
                  <p className="font-black tracking-widest uppercase text-xs sm:text-sm text-slate-900">
                    CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                  </p>
                  <p className="font-bold text-xs sm:text-sm text-slate-700 underline decoration-1 underline-offset-4">
                    Độc lập – Tự do – Hạnh phúc
                  </p>
                  <div className="pt-3">
                    <h2 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight font-display">
                      HỢP ĐỒNG DỊCH VỤ KẾT NỐI GIA SƯ VÀ HỌC TẬP TRỰC TUYẾN
                    </h2>
                    <p className="text-[11px] text-indigo-700 font-bold">
                      (Bảo chứng tự động qua Smart Contract Escrow Blockchain)
                    </p>
                  </div>
                </div>

                {/* Căn cứ pháp lý */}
                <div className="text-[11px] sm:text-xs text-slate-500 italic space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p>• Căn cứ Bộ luật Dân sự số 91/2015/QH13 được Quốc hội nước CHXHCN Việt Nam thông qua ngày 24/11/2015;</p>
                  <p>• Căn cứ Luật Giao dịch điện tử số 20/2023/QH15 về tính pháp lý của chữ ký điện tử EIP-712;</p>
                  <p>• Căn cứ vào nhu cầu thỏa thuận tự nguyện giữa các bên tham gia trên nền tảng giáo dục thông minh EduConnect.</p>
                </div>

                {/* Các Bên Tham Gia */}
                <div className="space-y-4 pt-2">
                  <h4 className="font-black text-slate-900 text-xs uppercase tracking-wider text-brand-primary">
                    1. CÁC BÊN THAM GIA HỢP ĐỒNG
                  </h4>

                  {/* Bên A: Gia Sư */}
                  <div className="p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-1.5">
                    <p className="font-black text-indigo-950 flex items-center gap-1.5">
                      <Building className="w-3.5 h-3.5 text-indigo-600" /> BÊN CUNG CẤP DỊCH VỤ GIA SƯ (BÊN A - GIA SƯ):
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700 pt-1">
                      <div>Họ và tên: <strong className="text-slate-900">{user?.fullName || "Gia sư EduConnect"}</strong></div>
                      <div>Email: <strong className="text-slate-900">{user?.email}</strong></div>
                      <div className="sm:col-span-2 flex items-center gap-1.5">
                        <span>Địa chỉ ví Web3 (EVM):</span>
                        <code className="font-mono text-[11px] bg-white px-2 py-0.5 rounded border border-indigo-200 text-indigo-900 font-bold">
                          {user?.walletAddress || "Chưa liên kết ví"}
                        </code>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-black">
                          ✓ ĐÃ XÁC THỰC
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Bên B: Học Viên */}
                  <div className="p-3.5 bg-emerald-50/50 border border-emerald-100 rounded-xl space-y-1.5">
                    <p className="font-black text-emerald-950 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-emerald-600" /> BÊN SỬ DỤNG DỊCH VỤ (BÊN B - HỌC VIÊN):
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700 pt-1">
                      <div>Họ và tên: <strong className="text-slate-900">{contractModalReq.studentName || contractModalReq.studentEmail}</strong></div>
                      <div>Email: <strong className="text-slate-900">{contractModalReq.studentEmail}</strong></div>
                      <div className="sm:col-span-2 text-[11px] text-slate-500 italic">
                        * Địa chỉ ví Web3 của Học viên sẽ được tự động liên kết và bảo chứng mật mã khi Học viên ký số EIP-712 trên MetaMask.
                      </div>
                    </div>
                  </div>

                  {/* Bên C: Nền tảng */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs text-slate-600">
                    <p className="font-bold text-slate-900 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-slate-600" /> ĐƠN VỊ TRUNG GIAN BẢO CHỨNG (BÊN C - EDUCONNECT SMART ESCROW):
                    </p>
                    <p>Hợp đồng thông minh Smart Contract: <code className="font-mono text-[11px] text-slate-800">0x984bEc42561BBC9f63BEE4BA1469872cD369d3b3</code> (Ethereum Sepolia Testnet).</p>
                  </div>
                </div>

                {/* Điều khoản hợp đồng */}
                <div className="space-y-4 pt-2">
                  <h4 className="font-black text-slate-900 text-xs uppercase tracking-wider text-brand-primary">
                    2. THÔNG SỐ KHÓA HỌC & ĐIỀU KHOẢN GIẢI NGÂN
                  </h4>

                  {/* Table summary */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                    <div className="grid grid-cols-2 sm:grid-cols-4 bg-slate-100 font-bold text-slate-700 p-2.5 border-b border-slate-200">
                      <div>Khóa học</div>
                      <div>Đơn giá / buổi</div>
                      <div>Tổng số buổi</div>
                      <div>Tổng giá trị ký quỹ</div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 p-2.5 font-bold text-slate-900 items-center gap-1">
                      <div className="text-indigo-800">{contractModalReq.className}</div>
                      <div>{pricePerSession.toLocaleString("vi-VN")} VND</div>
                      <div>{totalSessions} buổi</div>
                      <div className="text-brand-primary font-black">
                        {(pricePerSession * totalSessions).toLocaleString("vi-VN")} VND
                        <div className="text-[11px] text-slate-500 font-medium">
                          (~{((pricePerSession * totalSessions) / 25000).toFixed(2)} USDC)
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Escrow rules summary */}
                  <div className="bg-amber-50/70 border border-amber-200/80 p-3.5 rounded-xl text-xs space-y-1.5 text-amber-950">
                    <p className="font-bold flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Cơ chế Bảo chứng & Giải ngân 3 bên (Smart Contract Escrow):
                    </p>
                    <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-900">
                      <li><strong>100% học phí</strong> được nạp và khóa an toàn trong Smart Contract trước buổi học đầu tiên.</li>
                      <li>Sau mỗi buổi học điểm danh thành công: Giải ngân tự động <strong>85% cho Gia sư</strong> và <strong>15% phí nền tảng</strong>.</li>
                      <li>Học viên có <strong>24 giờ</strong> sau khi ký để nạp cọc giữ chỗ. Nếu quá hạn hợp đồng tự động giải phóng cho Waitlist.</li>
                    </ul>
                  </div>
                </div>

                {/* Digital Signatures Box */}
                <div className="pt-2 border-t border-slate-200 space-y-3">
                  <h4 className="font-black text-slate-900 text-xs uppercase tracking-wider text-brand-primary">
                    3. XÁC NHẬN CHỮ KÝ ĐIỆN TỬ (EIP-712 CRYPTOGRAPHIC SIGNATURE)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-indigo-50/60 border border-indigo-200 rounded-xl space-y-1">
                      <p className="font-bold text-indigo-900 flex items-center gap-1">
                        <FileSignature className="w-3.5 h-3.5 text-indigo-600" /> BÊN A (GIA SƯ)
                      </p>
                      <p className="text-slate-600">Ký số điện tử bằng ví MetaMask:</p>
                      <code className="font-mono text-[10px] block truncate bg-white p-1 rounded border border-indigo-100 font-bold text-indigo-900">
                        {user?.walletAddress || "0x..."}
                      </code>
                      <p className="text-[10px] text-indigo-700 font-bold pt-1">
                        👉 Sẵn sàng ký số EIP-712 khi bạn bấm xác nhận bên dưới (0 Gas Fee).
                      </p>
                    </div>

                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                      <p className="font-bold text-slate-800 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-500" /> BÊN B (HỌC VIÊN)
                      </p>
                      <p className="text-slate-600">Trạng thái xác nhận:</p>
                      <div className="text-[10px] bg-amber-100 text-amber-900 p-1.5 rounded font-bold">
                        ⏳ Hệ thống sẽ gửi thông báo Realtime & Email để Học viên ký xác nhận ngay sau khi Gia sư ký.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 sm:p-5 border-t border-slate-100 flex items-center justify-end gap-3 bg-white rounded-b-3xl">
              <button
                onClick={() => setContractModalReq(null)}
                disabled={isSigningContract}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleConfirmInitiateContract}
                disabled={isSigningContract || actionLoadingId === contractModalReq.id}
                className="px-6 py-2.5 bg-gradient-to-r from-brand-primary to-brand-secondary hover:opacity-95 text-white rounded-xl text-xs font-black transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
              >
                {isSigningContract ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Đang ký số qua MetaMask...
                  </>
                ) : (
                  <>
                    <FileSignature className="w-4 h-4" /> Đồng ý & Ký số EIP-712 (MetaMask)
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
