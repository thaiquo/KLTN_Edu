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
import { contractsApi, AgreementSummary } from "../../api/contractsApi";
import { useAuth } from "../../hooks/useAuth";
import { signContractAgreementEip712 } from "../../web3/eip712Signer";
import { ContractDocumentModal } from "../../components/contract/ContractDocumentModal";

interface EnrollmentRequestItem {
  id: number;
  classRoomId: number;
  className: string;
  tutorEmail: string;
  studentId?: number;
  studentEmail: string;
  studentName?: string;
  studentPhone?: string;
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

  const [agreementsMap, setAgreementsMap] = useState<Record<string, AgreementSummary>>({});
  const [selectedDocAgreementId, setSelectedDocAgreementId] = useState<string | null>(null);

  // Reject Modal state
  const [rejectModalReq, setRejectModalReq] = useState<EnrollmentRequestItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Initiate Contract Modal state
  const [contractModalReq, setContractModalReq] = useState<EnrollmentRequestItem | null>(null);
  const [pricePerSession, setPricePerSession] = useState(0);
  const [totalSessions, setTotalSessions] = useState(0);
  const [isSigningContract, setIsSigningContract] = useState(false);
  const [contractModalTab, setContractModalTab] = useState<"SUMMARY" | "FULL_TEXT">("SUMMARY");
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const [data, agreementsRes] = await Promise.all([
        classApi.getAllTutorRequests(),
        contractsApi.listAgreements({ role: "TUTOR", email: user?.email, size: 100 }).catch(() => null),
      ]);
      setRequests(Array.isArray(data) ? data : []);

      const agrList: AgreementSummary[] = agreementsRes?.content || (Array.isArray(agreementsRes) ? agreementsRes : []);
      const map: Record<string, AgreementSummary> = {};
      agrList.forEach((a) => {
        if (a.classroomId && a.studentEmail) {
          map[`${a.classroomId}_${a.studentEmail.toLowerCase()}`] = a;
        }
      });
      setAgreementsMap(map);
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
    try {
      const classDetail = await classApi.getClassById(req.classRoomId);
      const price = Number(classDetail?.pricePerSession);
      const totalSessionsFromChapters = Array.isArray(classDetail?.chapters)
        ? classDetail.chapters.reduce((sum: number, ch: any) => sum + (Number(ch.sessionCount) || 0), 0)
        : 0;
      const sessions = Number(classDetail?.totalSessions) || totalSessionsFromChapters;
      if (!Number.isFinite(price) || price <= 0 || sessions <= 0) {
        throw new Error("Lớp học chưa có đơn giá hoặc tổng số buổi hợp lệ.");
      }
      setPricePerSession(price);
      setTotalSessions(sessions);
      setContractModalReq(req);
      setContractModalTab("SUMMARY");
      setAgreedToTerms(false);
    } catch (err: any) {
      setContractModalReq(null);
      setActionMsg({ text: err?.message || "Không thể tải dữ liệu thật của lớp học.", tone: "error" });
    }
  };

  const handleConfirmInitiateContract = async () => {
    if (!contractModalReq) return;
    if (!contractModalReq.studentId || !contractModalReq.studentName || !contractModalReq.studentPhone) {
      setActionMsg({
        text: "Yêu cầu cũ đang thiếu ID, họ tên hoặc số điện thoại học viên. Học viên cần gửi lại yêu cầu sau khi cập nhật hồ sơ.",
        tone: "error",
      });
      return;
    }
    if (!user?.id || !user?.fullName || !user?.email) {
      setActionMsg({ text: "Hồ sơ gia sư chưa đầy đủ. Vui lòng cập nhật trước khi tạo hợp đồng.", tone: "error" });
      return;
    }
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
        className: contractModalReq.className,
        studentId: contractModalReq.studentId,
        studentName: contractModalReq.studentName,
        studentEmail: contractModalReq.studentEmail,
        studentPhone: contractModalReq.studentPhone,
        tutorId: user.id,
        tutorName: user.fullName,
        tutorEmail: user?.email,
        tutorPhone: user?.phone || (user as any)?.phoneNumber || "",
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

            const matchingAgr = agreementsMap[`${req.classRoomId}_${(req.studentEmail || "").toLowerCase()}`];
            const isContractActive = matchingAgr?.status === "ACTIVE" || Boolean(matchingAgr?.onchainFunded);
            const isContractWaitingPayment = matchingAgr?.status === "WAITING_PAYMENT";
            const isContractPendingStudent = matchingAgr?.status === "PENDING_STUDENT_ACCEPTANCE";

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
                    {isPending && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                        CHỜ DUYỆT
                      </span>
                    )}
                    {isAccepted && (
                      isContractActive ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> ĐÃ THAM GIA LỚP HỌC (ĐÃ NẠP CỌC ESCROW)
                        </span>
                      ) : isContractWaitingPayment ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-100 text-orange-800 border border-orange-200 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-orange-600" /> CHỜ HỌC VIÊN NẠP CỌC ESCROW
                        </span>
                      ) : isContractPendingStudent ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-200 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-600" /> CHỜ HỌC VIÊN KÝ SỐ EIP-712
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-800 border border-indigo-200">
                          ĐÃ DUYỆT YÊU CẦU
                        </span>
                      )
                    )}
                    {isRejected && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200">
                        ĐÃ TỪ CHỐI
                      </span>
                    )}
                  </div>

                  {/* Class details badge & Escrow progress note */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 font-semibold">
                    <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-800 px-2.5 py-1 rounded-lg border border-indigo-100">
                      <BookOpen className="w-3.5 h-3.5" /> Lớp: <strong>{req.className}</strong>
                    </span>
                    <span className="inline-flex items-center gap-1 text-slate-400 text-[11px]">
                      <Clock className="w-3.5 h-3.5" /> Ngày gửi: {new Date(req.createdAt).toLocaleDateString("vi-VN")}
                    </span>
                    {isAccepted && (
                      isContractActive ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-900 border border-emerald-200 px-2.5 py-0.5 rounded-lg text-[11px] font-bold">
                          <ShieldCheck className="w-3 h-3 text-emerald-600" /> Đã ký quỹ Smart Contract Escrow • Học viên chính thức có tên trong lớp học
                        </span>
                      ) : isContractWaitingPayment ? (
                        <span className="inline-flex items-center gap-1 bg-orange-50 text-orange-900 border border-orange-200 px-2.5 py-0.5 rounded-lg text-[11px] font-bold">
                          <Clock className="w-3 h-3 text-orange-600" /> Học viên đã ký số • Đang chờ thanh toán nạp cọc MetaMask
                        </span>
                      ) : isContractPendingStudent ? (
                        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-200 px-2.5 py-0.5 rounded-lg text-[11px] font-bold">
                          <Clock className="w-3 h-3 text-amber-600" /> Đã tạo HĐ Escrow • Đang chờ học viên ký số xác nhận
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-900 border border-indigo-200 px-2.5 py-0.5 rounded-lg text-[11px] font-bold">
                          <Clock className="w-3 h-3 text-indigo-600" /> Đã tạo Hợp đồng Escrow
                        </span>
                      )
                    )}
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
                    <div className="flex flex-wrap items-center gap-2">
                      {matchingAgr && (
                        <button
                          type="button"
                          onClick={() => setSelectedDocAgreementId(matchingAgr.id)}
                          className="px-3.5 py-1.5 bg-white border border-blue-200 hover:bg-blue-50 text-blue-800 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5"
                        >
                          <FileText className="w-3.5 h-3.5 text-blue-600" />
                          <span>Xem Hợp đồng EIP-712</span>
                        </button>
                      )}

                      {onNavigate && (
                        <button
                          type="button"
                          onClick={() => onNavigate("contracts")}
                          className="px-3.5 py-1.5 bg-gradient-to-r from-brand-primary to-brand-secondary hover:opacity-95 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                        >
                          <FileSignature className="w-3.5 h-3.5" />
                          <span>Quản lý Hợp đồng Escrow</span>
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
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 flex flex-col max-h-[94vh] animate-in fade-in">
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
                    Toàn bộ thông tin được tự động đồng bộ từ lớp học. Đọc kỹ 8 Điều khoản trước khi bấm Ký số.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors flex items-center gap-1.5 border border-slate-200"
                  title="In hoặc Lưu bản thảo PDF"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>In / Bản thảo PDF</span>
                </button>
                <button
                  onClick={() => setContractModalReq(null)}
                  className="w-8 h-8 rounded-full bg-slate-200/60 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors font-bold text-sm"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Tabs Bar */}
            <div className="px-6 pt-3 bg-slate-100/60 border-b border-slate-200 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setContractModalTab("SUMMARY")}
                className={`px-4 py-2 text-xs font-extrabold rounded-t-xl border-b-2 transition-all ${
                  contractModalTab === "SUMMARY"
                    ? "bg-white text-indigo-900 border-indigo-600 shadow-xs"
                    : "text-slate-500 hover:text-slate-900 border-transparent"
                }`}
              >
                📌 Tóm tắt Thỏa thuận & Thông số
              </button>
              <button
                type="button"
                onClick={() => setContractModalTab("FULL_TEXT")}
                className={`px-4 py-2 text-xs font-extrabold rounded-t-xl border-b-2 transition-all flex items-center gap-1.5 ${
                  contractModalTab === "FULL_TEXT"
                    ? "bg-white text-indigo-900 border-indigo-600 shadow-xs"
                    : "text-slate-500 hover:text-slate-900 border-transparent"
                }`}
              >
                📜 Toàn văn Điều khoản Hợp đồng (Đầy đủ 8 Điều)
                <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded-md">Văn bản pháp lý</span>
              </button>
            </div>

            {/* Modal Document Body */}
            <div className="p-5 sm:p-8 overflow-y-auto space-y-6 text-slate-800 text-xs sm:text-sm font-sans leading-relaxed bg-slate-50/40">
              {contractModalTab === "SUMMARY" ? (
                <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200/90 shadow-xs space-y-6">
                  {/* Formal Header */}
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

                  {/* Thông số khóa học */}
                  <div className="space-y-4 pt-2">
                    <h4 className="font-black text-slate-900 text-xs uppercase tracking-wider text-brand-primary">
                      2. THÔNG SỐ KHÓA HỌC & ĐIỀU KHOẢN GIẢI NGÂN
                    </h4>

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

                    <div className="bg-amber-50/70 border border-amber-200/80 p-3.5 rounded-xl text-xs space-y-1.5 text-amber-950">
                      <p className="font-bold flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Cơ chế Bảo chứng & Giải ngân 3 bên (Smart Contract Escrow):
                      </p>
                      <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-900">
                        <li><strong>100% học phí</strong> được nạp và khóa an toàn trong Smart Contract trước buổi học đầu tiên.</li>
                        <li>Sau mỗi buổi học điểm danh thành công: Giải ngân tự động <strong>85% cho Gia sư</strong> và <strong>15% phí nền tảng</strong>.</li>
                        <li>Học viên có <strong>24 giờ</strong> sau khi ký để nạp cọc giữ chỗ. Nếu quá hạn hợp đồng tự động giải phóng.</li>
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
              ) : (
                /* Full Legal Text View (8 Full Vietnamese Legal Clauses) */
                <div className="bg-white p-6 sm:p-10 rounded-2xl border border-slate-200/90 shadow-xs space-y-6 text-slate-900 font-serif leading-relaxed text-xs sm:text-sm">
                  <div className="text-center space-y-1 border-b-2 border-slate-900 pb-4">
                    <p className="font-bold text-xs sm:text-sm tracking-widest uppercase">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                    <p className="font-bold text-xs sm:text-sm text-slate-800">Độc lập – Tự do – Hạnh phúc</p>
                    <div className="w-32 h-[1.5px] bg-slate-800 mx-auto my-2" />
                    <h2 className="font-display text-base sm:text-xl font-black pt-2 tracking-tight uppercase">
                      HỢP ĐỒNG DỊCH VỤ KẾT NỐI GIA SƯ VÀ HỌC TẬP TRỰC TUYẾN
                    </h2>
                    <p className="text-xs font-sans font-bold text-indigo-800 pt-1">Lớp học: {contractModalReq.className}</p>
                    <p className="text-[11px] font-mono text-slate-500">Mã dự thảo: EDUCONNECT-DRAFT-{contractModalReq.id}</p>
                  </div>

                  <div className="space-y-1 text-xs text-slate-700 italic border-b border-slate-200 pb-4">
                    <p>• Căn cứ Bộ luật Dân sự số 91/2015/QH13 được Quốc hội nước CHXHCN Việt Nam thông qua ngày 24/11/2015;</p>
                    <p>• Căn cứ Luật Giao dịch điện tử số 20/2023/QH15 về tính pháp lý của chữ ký điện tử EIP-712;</p>
                    <p>• Căn cứ vào nhu cầu thỏa thuận tự nguyện giữa các bên tham gia trên nền tảng giáo dục thông minh EduConnect.</p>
                  </div>

                  <div className="space-y-4 font-sans text-xs">
                    <div className="space-y-2">
                      <h4 className="font-bold text-slate-950 uppercase">ĐIỀU 1: ĐỐI TƯỢNG HỌC TẬP VÀ PHẠM VI GIẢNG DẠY</h4>
                      <p>1.1. Bên A nhận cung cấp dịch vụ giảng dạy trực tuyến cho Bên B theo đúng chương trình môn học <strong>{contractModalReq.className}</strong>.</p>
                      <p>1.2. Tổng số buổi học theo thỏa thuận là <strong>{totalSessions} buổi</strong>, học phí đơn giá <strong>{pricePerSession.toLocaleString("vi-VN")} VNĐ / buổi</strong>.</p>
                      <p>1.3. Hình thức học tập: Trực tuyến (Online) thông qua phòng học tích hợp trên nền tảng EduConnect.</p>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-bold text-slate-950 uppercase">ĐIỀU 2: HỌC PHÍ, BẢO CHỨNG ESCROW VÀ LỊCH GIẢI NGÂN</h4>
                      <p>2.1. 100% Học phí tổng cộng <strong>{(pricePerSession * totalSessions).toLocaleString("vi-VN")} VNĐ</strong> (~{((pricePerSession * totalSessions) / 25000).toFixed(2)} USDC) được nạp và khóa an toàn trong Smart Contract Escrow của Bên C trước buổi học đầu tiên.</p>
                      <p>2.2. Sau mỗi buổi học hoàn thành và được ghi nhận điểm danh thành công trên hệ thống, Smart Contract sẽ tự động giải ngân 85% thù lao cho Bên A (Gia sư) và 15% phí dịch vụ duy trì hệ thống cho Bên C.</p>
                      <p>2.3. Bên B có trách nhiệm nạp tiền cọc ký quỹ vào Smart Contract trong vòng 24 giờ kể từ khi hai bên hoàn tất ký số. Quá thời hạn trên, hợp đồng tự động hủy bỏ.</p>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-bold text-slate-950 uppercase">ĐIỀU 3: QUYỀN VÀ NGHĨA VỤ CỦA BÊN A (GIA SƯ)</h4>
                      <p>3.1. Thực hiện công tác giảng dạy đầy đủ, đúng giờ, chuẩn bị giáo án và đảm bảo chất lượng truyền tải kiến thức theo đúng cam kết.</p>
                      <p>3.2. Được nhận thù lao tự động qua ví Web3 ngay sau khi hoàn thành từng buổi học được điểm danh xác nhận.</p>
                      <p>3.3. Tôn trọng học viên, không tự ý hủy buổi học mà không thông báo trước ít nhất 24 giờ.</p>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-bold text-slate-950 uppercase">ĐIỀU 4: QUYỀN VÀ NGHĨA VỤ CỦA BÊN B (HỌC VIÊN)</h4>
                      <p>4.1. Tham gia học tập nghiêm túc, đúng giờ, chuẩn bị thiết bị và đường truyền internet ổn định.</p>
                      <p>4.2. Hoàn tất nạp tiền cọc ký quỹ vào Smart Contract Escrow đúng thời hạn 24 giờ kể từ khi hai bên ký hợp đồng.</p>
                      <p>4.3. Được hoàn lại 100% số tiền cọc còn lại trong Smart Contract đối với các buổi học chưa diễn ra nếu Bên A vi phạm cam kết hoặc hai bên đồng thuận chấm dứt hợp đồng hợp lệ.</p>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-bold text-slate-950 uppercase">ĐIỀU 5: TRÁCH NHIỆM BẢO CHỨNG CỦA BÊN C (NỀN TẢNG EDUCONNECT)</h4>
                      <p>5.1. Cung cấp hạ tầng lớp học trực tuyến và Smart Contract Escrow vận hành công khai, minh bạch trên mạng Blockchain.</p>
                      <p>5.2. Đóng vai trò Trọng tài độc lập hỗ trợ giải quyết khiếu nại, tranh chấp phát sinh giữa Bên A và Bên B dựa trên chứng cứ nhật ký lớp học.</p>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-bold text-slate-950 uppercase">ĐIỀU 6: CƠ CHẾ HỦY LỚP, KHIẾU NẠI VÀ BỒI THƯỜNG</h4>
                      <p>6.1. Mỗi bên có quyền mở khiếu nại trong vòng 24 giờ sau khi kết thúc buổi học nếu phát sinh sự cố chất lượng hoặc vắng mặt.</p>
                      <p>6.2. Trường hợp Bên A nghỉ không lý do hoặc vi phạm nghiêm trọng, tiền cọc các buổi chưa học sẽ tự động trả về cho Bên B.</p>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-bold text-slate-950 uppercase">ĐIỀU 7: TÍNH PHÁP LÝ CỦA CHỮ KÝ ĐIỆN TỬ EIP-712</h4>
                      <p>7.1. Chữ ký điện tử EIP-712 được tạo bởi ví Web3 đại diện cho ý chí tự nguyện của các bên, có giá trị pháp lý ràng buộc theo Luật Giao dịch điện tử số 20/2023/QH15.</p>
                      <p>7.2. Bằng chứng chữ ký và chuỗi băm Terms Hash được lưu trữ cố định trên Blockchain Sepolia làm đối chứng không thể thay đổi.</p>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-bold text-slate-950 uppercase">ĐIỀU 8: ĐIỀU KHOẢN THI HÀNH VÀ HIỆU LỰC HỢP ĐỒNG</h4>
                      <p>8.1. Hợp đồng này có hiệu lực chính thức kể từ thời điểm cả Bên A và Bên B hoàn tất ký số EIP-712.</p>
                      <p>8.2. Mọi chỉnh sửa, bổ sung điều khoản hợp đồng phải được thực hiện thông qua phụ lục điện tử trên hệ thống EduConnect.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 sm:p-5 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white rounded-b-3xl">
              <label className="flex items-center gap-2.5 text-xs font-bold text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="w-4 h-4 rounded text-brand-primary border-slate-300 focus:ring-brand-primary shrink-0"
                />
                <span>Tôi đã đọc kỹ, hiểu rõ và đồng ý với toàn bộ 8 Điều khoản & Quy định của Hợp đồng dịch vụ.</span>
              </label>

              <div className="flex items-center justify-end gap-3 shrink-0">
                <button
                  onClick={() => setContractModalReq(null)}
                  disabled={isSigningContract}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={handleConfirmInitiateContract}
                  disabled={!agreedToTerms || isSigningContract || actionLoadingId === contractModalReq.id}
                  className={`px-6 py-2.5 text-white rounded-xl text-xs font-black transition-all shadow-md flex items-center gap-2 ${
                    !agreedToTerms || isSigningContract || actionLoadingId === contractModalReq.id
                      ? "bg-slate-300 text-slate-500 cursor-not-allowed shadow-none"
                      : "bg-gradient-to-r from-brand-primary to-brand-secondary hover:opacity-95 shadow-indigo-500/20"
                  }`}
                  title={!agreedToTerms ? "Vui lòng tích chọn xác nhận đã đọc điều khoản trước khi ký" : undefined}
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
        </div>
      )}

      {selectedDocAgreementId && (
        <ContractDocumentModal
          agreementId={selectedDocAgreementId}
          onClose={() => setSelectedDocAgreementId(null)}
        />
      )}
    </div>
  );
}
