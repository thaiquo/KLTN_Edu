import React, { useState, useEffect, useMemo } from "react";
import {
  WalletCards,
  ArrowUpRight,
  TrendingUp,
  Lock,
  RotateCcw,
  RefreshCw,
  Search,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Layers,
  FileCheck,
  Building2,
  Info,
  ChevronLeft,
  ChevronRight,
  Check,
  Filter
} from "lucide-react";
import {
  contractsApi,
  AdminFinancialOverview,
  AdminSettlementDetail,
  BlockchainTxDto,
  PagedResponse
} from "../../api/contractsApi";
import { EtherscanLink } from "../../components/common/EtherscanLink";
import { DEFAULT_CHAIN_ID } from "../../web3/web3Config";

export function AdminFinanceMonitoring() {
  const [overview, setOverview] = useState<AdminFinancialOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);

  // Tabs
  const [activeTab, setActiveTab] = useState<"settlements" | "transactions">("settlements");

  // Settlements Tab State
  const [settlements, setSettlements] = useState<AdminSettlementDetail[]>([]);
  const [settlementTotal, setSettlementTotal] = useState(0);
  const [settlementPage, setSettlementPage] = useState(0);
  const [settlementPageSize] = useState(15);
  const [settlementStatusFilter, setSettlementStatusFilter] = useState<string>("ALL");
  const [settlementSearch, setSettlementSearch] = useState("");
  const [settlementLoading, setSettlementLoading] = useState(false);

  // Transactions Tab State
  const [transactions, setTransactions] = useState<BlockchainTxDto[]>([]);
  const [txTotal, setTxTotal] = useState(0);
  const [txPage, setTxPage] = useState(0);
  const [txPageSize] = useState(15);
  const [txLoading, setTxLoading] = useState(false);
  const [txSearch, setTxSearch] = useState("");

  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchOverview = async () => {
    try {
      setOverviewLoading(true);
      const data = await contractsApi.getAdminFinancialOverview();
      setOverview(data);
    } catch (err: any) {
      console.error("Failed to load admin financial overview", err);
      setErrorMsg("Không thể tải thống kê tài chính: " + (err.message || "Lỗi kết nối"));
    } finally {
      setOverviewLoading(false);
    }
  };

  const fetchSettlements = async () => {
    try {
      setSettlementLoading(true);
      const res = await contractsApi.listAdminSettlements({
        status: settlementStatusFilter !== "ALL" ? settlementStatusFilter : undefined,
        page: settlementPage,
        size: settlementPageSize
      });
      setSettlements(res.content || []);
      setSettlementTotal(res.totalElements || 0);
    } catch (err: any) {
      console.error("Failed to load admin settlements", err);
    } finally {
      setSettlementLoading(false);
    }
  };

  const fetchTransactions = async () => {
    try {
      setTxLoading(true);
      const res = await contractsApi.listAllTransactions({
        page: txPage,
        size: txPageSize
      });
      setTransactions(res.content || []);
      setTxTotal(res.totalElements || 0);
    } catch (err: any) {
      console.error("Failed to load admin blockchain transactions", err);
    } finally {
      setTxLoading(false);
    }
  };

  const handleRefreshAll = async () => {
    setRefreshing(true);
    setErrorMsg(null);
    await Promise.all([
      fetchOverview(),
      activeTab === "settlements" ? fetchSettlements() : fetchTransactions()
    ]);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  useEffect(() => {
    if (activeTab === "settlements") {
      fetchSettlements();
    } else {
      fetchTransactions();
    }
  }, [activeTab, settlementPage, settlementStatusFilter, txPage]);

  // Filtered settlements by local search
  const filteredSettlements = useMemo(() => {
    if (!settlementSearch.trim()) return settlements;
    const term = settlementSearch.toLowerCase().trim();
    return settlements.filter(s =>
      (s.className && s.className.toLowerCase().includes(term)) ||
      (s.studentName && s.studentName.toLowerCase().includes(term)) ||
      (s.tutorName && s.tutorName.toLowerCase().includes(term)) ||
      (s.agreementId && s.agreementId.toLowerCase().includes(term)) ||
      (s.proposeTxHash && s.proposeTxHash.toLowerCase().includes(term)) ||
      (s.finalizeTxHash && s.finalizeTxHash.toLowerCase().includes(term))
    );
  }, [settlements, settlementSearch]);

  // Filtered transactions by local search
  const filteredTransactions = useMemo(() => {
    if (!txSearch.trim()) return transactions;
    const term = txSearch.toLowerCase().trim();
    return transactions.filter(t =>
      (t.action && t.action.toLowerCase().includes(term)) ||
      (t.transactionHash && t.transactionHash.toLowerCase().includes(term)) ||
      (t.status && t.status.toLowerCase().includes(term))
    );
  }, [transactions, txSearch]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "SETTLED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Đã giải ngân
          </span>
        );
      case "PROPOSED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            Chờ 24h
          </span>
        );
      case "DISPUTED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            Khiếu nại
          </span>
        );
      case "REFUNDED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-300">
            <RotateCcw className="w-3.5 h-3.5 text-purple-600" />
            Đã hoàn tiền
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
            {status}
          </span>
        );
    }
  };

  const getTxActionBadge = (action: string) => {
    let colorClass = "bg-blue-100 text-blue-800 border-blue-200";
    if (action.includes("FINALIZE")) {
      colorClass = "bg-emerald-100 text-emerald-800 border-emerald-300 font-bold";
    } else if (action.includes("PROPOSE")) {
      colorClass = "bg-amber-100 text-amber-800 border-amber-300";
    } else if (action.includes("DISPUTE")) {
      colorClass = "bg-rose-100 text-rose-800 border-rose-300";
    } else if (action.includes("DEPOSIT")) {
      colorClass = "bg-indigo-100 text-indigo-800 border-indigo-300";
    }
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono border ${colorClass}`}>
        {action}
      </span>
    );
  };

  const formatOutcome = (outcome: string) => {
    switch (outcome) {
      case "BOTH_PRESENT":
        return <span className="text-emerald-700 font-medium">Học đầy đủ (Gia sư 85%)</span>;
      case "STUDENT_ABSENT_TUTOR_PRESENT":
        return <span className="text-amber-700 font-medium">HV vắng có báo (Gia sư 85%)</span>;
      case "TUTOR_ABSENT":
        return <span className="text-rose-700 font-medium">Gia sư vắng (Hoàn 100% HV)</span>;
      default:
        return <span>{outcome}</span>;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 rounded-2xl text-white shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
              Admin Financial & Cashflow Center
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
              Ethereum Sepolia Testnet
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Quản trị Tài chính & Dòng tiền Ký quỹ Blockchain
          </h1>
          <p className="text-slate-300 text-sm mt-1">
            Theo dõi tổng tiền nạp ký quỹ, phân bổ giải ngân gia sư (85%), doanh thu nền tảng (15%) và minh chứng giao dịch on-chain minh bạch.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={handleRefreshAll}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium transition backdrop-blur-sm border border-white/10"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            <span>Làm mới</span>
          </button>

          {overview?.escrowContractAddress && (
            <a
              href={`https://sepolia.etherscan.io/address/${overview.escrowContractAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/30 transition"
            >
              <span>Xem Master Contract</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Overview Cards (5 Metric KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Escrow */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tổng tiền ký quỹ</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-900">
              {overviewLoading ? "..." : (overview?.totalEscrowFundedUsdc.toFixed(2) ?? "0.00")}
            </span>
            <span className="ml-1 text-xs font-bold text-blue-600">USDC</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Đã nạp vào Smart Contract</p>
        </div>

        {/* Tutor Paid (85%) */}
        <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm hover:shadow-md transition bg-gradient-to-br from-white to-emerald-50/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Đã giải ngân Gia sư (85%)</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-emerald-700">
              {overviewLoading ? "..." : (overview?.totalTutorPaidUsdc.toFixed(2) ?? "0.00")}
            </span>
            <span className="ml-1 text-xs font-bold text-emerald-600">USDC</span>
          </div>
          <p className="mt-1 text-xs text-emerald-600">Chuyển trực tiếp về ví gia sư</p>
        </div>

        {/* Platform Fee (15%) */}
        <div className="bg-white p-5 rounded-2xl border border-indigo-100 shadow-sm hover:shadow-md transition bg-gradient-to-br from-white to-indigo-50/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-800 uppercase tracking-wider">Doanh thu Nền tảng (15%)</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-indigo-700">
              {overviewLoading ? "..." : (overview?.totalPlatformFeeUsdc.toFixed(2) ?? "0.00")}
            </span>
            <span className="ml-1 text-xs font-bold text-indigo-600">USDC</span>
          </div>
          <p className="mt-1 text-xs text-indigo-600">Phí hệ thống EduConnect</p>
        </div>

        {/* Locked Escrow Liability */}
        <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-sm hover:shadow-md transition bg-gradient-to-br from-white to-amber-50/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Ký quỹ đang khóa</span>
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-amber-700">
              {overviewLoading ? "..." : (overview?.totalEscrowLockedUsdc.toFixed(2) ?? "0.00")}
            </span>
            <span className="ml-1 text-xs font-bold text-amber-600">USDC</span>
          </div>
          <p className="mt-1 text-xs text-amber-600">Khóa an toàn cho các buổi tiếp</p>
        </div>

        {/* Student Refund */}
        <div className="bg-white p-5 rounded-2xl border border-purple-100 shadow-sm hover:shadow-md transition bg-gradient-to-br from-white to-purple-50/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-800 uppercase tracking-wider">Hoàn tiền Học viên</span>
            <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
              <RotateCcw className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-purple-700">
              {overviewLoading ? "..." : (overview?.totalStudentRefundedUsdc.toFixed(2) ?? "0.00")}
            </span>
            <span className="ml-1 text-xs font-bold text-purple-600">USDC</span>
          </div>
          <p className="mt-1 text-xs text-purple-600">Xử lý theo phán quyết khiếu nại</p>
        </div>
      </div>

      {/* Operational Highlights & Smart Contract Addresses Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs text-slate-600">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span>Hợp đồng hoạt động: <strong className="text-slate-900">{overview?.totalActiveAgreements ?? 0}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Buổi đã giải ngân: <strong className="text-slate-900">{overview?.totalSettledSessions ?? 0}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>Buổi chờ 24h: <strong className="text-slate-900">{overview?.totalPendingSessions ?? 0}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span>Buổi khiếu nại: <strong className="text-slate-900">{overview?.totalDisputedSessions ?? 0}</strong></span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 w-full md:w-auto">
          {overview?.platformWallet && (
            <div className="flex items-center gap-1.5 font-mono">
              <span className="text-slate-400">Ví Treasury:</span>
              <EtherscanLink address={overview.platformWallet} chainId={DEFAULT_CHAIN_ID} truncateLength={4} />
            </div>
          )}
          {overview?.escrowContractAddress && (
            <div className="flex items-center gap-1.5 font-mono">
              <span className="text-slate-400">Escrow Contract:</span>
              <EtherscanLink address={overview.escrowContractAddress} chainId={DEFAULT_CHAIN_ID} truncateLength={4} />
            </div>
          )}
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50/50 px-6 pt-3 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("settlements")}
              className={`flex items-center gap-2 px-5 py-3 border-b-2 font-bold text-sm transition ${
                activeTab === "settlements"
                  ? "border-indigo-600 text-indigo-600 bg-white rounded-t-xl"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <WalletCards className="w-4 h-4" />
              <span>Quyết toán & Dòng tiền Từng Buổi</span>
              <span className="px-2 py-0.5 rounded-full text-xs bg-slate-200 text-slate-700 font-semibold">
                {settlementTotal}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("transactions")}
              className={`flex items-center gap-2 px-5 py-3 border-b-2 font-bold text-sm transition ${
                activeTab === "transactions"
                  ? "border-indigo-600 text-indigo-600 bg-white rounded-t-xl"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Nhật ký Giao dịch On-chain</span>
              <span className="px-2 py-0.5 rounded-full text-xs bg-slate-200 text-slate-700 font-semibold">
                {txTotal}
              </span>
            </button>
          </div>
        </div>

        {/* Tab 1: Settlements & Cashflow Breakdown Table */}
        {activeTab === "settlements" && (
          <div className="p-6 space-y-4">
            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">Bộ lọc:</span>
                {(["ALL", "SETTLED", "PROPOSED", "DISPUTED", "REFUNDED"] as const).map(st => (
                  <button
                    key={st}
                    onClick={() => {
                      setSettlementStatusFilter(st);
                      setSettlementPage(0);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      settlementStatusFilter === st
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {st === "ALL" ? "Tất cả" : st === "SETTLED" ? "Đã tất toán" : st === "PROPOSED" ? "Đang chờ 24h" : st === "DISPUTED" ? "Khiếu nại" : "Hoàn tiền"}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm theo lớp, học viên, tx..."
                  value={settlementSearch}
                  onChange={e => setSettlementSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Lớp học / Hợp đồng</th>
                    <th className="px-4 py-3">Buổi</th>
                    <th className="px-4 py-3">Bên liên quan</th>
                    <th className="px-4 py-3">Kết quả</th>
                    <th className="px-4 py-3 text-right">Tổng tiền</th>
                    <th className="px-4 py-3 text-right">Gia sư nhận (85%)</th>
                    <th className="px-4 py-3 text-right">EduConnect (15%)</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3">Minh chứng On-chain (Tx Proofs)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {settlementLoading ? (
                    <tr>
                      <td colSpan={9} className="text-center py-12 text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                        Đang tải danh sách quyết toán...
                      </td>
                    </tr>
                  ) : filteredSettlements.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-12 text-slate-400">
                        Không tìm thấy phiên quyết toán nào phù hợp.
                      </td>
                    </tr>
                  ) : (
                    filteredSettlements.map(s => (
                      <tr key={s.id} className="hover:bg-slate-50/80 transition">
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">{s.className || `Lớp #${s.classroomId}`}</div>
                          <div className="font-mono text-[10px] text-slate-400 mt-0.5">
                            ID: {s.agreementId.slice(0, 8)}...
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-bold text-slate-900 px-2 py-1 bg-slate-100 rounded-md">
                            #{s.sessionId}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-slate-800">
                            <strong>HV:</strong> {s.studentName || `ID ${s.studentId}`}
                          </div>
                          <div className="text-slate-500 text-[11px] mt-0.5">
                            <strong>GS:</strong> {s.tutorName || `ID ${s.tutorId}`}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {formatOutcome(s.outcome)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900">
                          {s.amountUsdc.toFixed(2)} USDC
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-600 bg-emerald-50/40">
                          +{s.tutorAmountUsdc.toFixed(2)} USDC
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-indigo-600 bg-indigo-50/40">
                          +{s.platformAmountUsdc.toFixed(2)} USDC
                        </td>
                        <td className="px-4 py-3">
                          {getStatusBadge(s.status)}
                          {s.status === "PROPOSED" && s.disputeDeadline && (
                            <div className="text-[10px] text-amber-700 mt-1 font-mono">
                              Hạn: {new Date(s.disputeDeadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} {new Date(s.disputeDeadline).toLocaleDateString()}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            {s.proposeTxHash ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-slate-400 font-semibold uppercase">Đề xuất:</span>
                                <EtherscanLink
                                  txHash={s.proposeTxHash}
                                  chainId={DEFAULT_CHAIN_ID}
                                  label="Propose Tx"
                                  className="text-amber-700 bg-amber-50 hover:bg-amber-100"
                                />
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-300">Chưa có propose tx</span>
                            )}

                            {s.finalizeTxHash ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-slate-400 font-semibold uppercase">Giải ngân:</span>
                                <EtherscanLink
                                  txHash={s.finalizeTxHash}
                                  chainId={DEFAULT_CHAIN_ID}
                                  label="Finalize Tx"
                                  className="text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                                />
                              </div>
                            ) : s.status === "SETTLED" ? (
                              <span className="text-[10px] text-emerald-600">Đã tất toán</span>
                            ) : (
                              <span className="text-[10px] text-slate-300">Chờ giải ngân</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-500">
                Hiển thị {filteredSettlements.length} trên tổng số {settlementTotal} bản ghi
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={settlementPage === 0 || settlementLoading}
                  onClick={() => setSettlementPage(p => Math.max(0, p - 1))}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Trước
                </button>
                <span className="text-xs font-bold text-slate-700 px-2">
                  Trang {settlementPage + 1}
                </span>
                <button
                  disabled={(settlementPage + 1) * settlementPageSize >= settlementTotal || settlementLoading}
                  onClick={() => setSettlementPage(p => p + 1)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  Sau
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: System Blockchain Audit Log */}
        {activeTab === "transactions" && (
          <div className="p-6 space-y-4">
            {/* Search Bar */}
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs text-slate-500">
                Nhật ký tất cả các giao dịch được hệ thống gửi lên mạng Ethereum Sepolia Testnet.
              </span>
              <div className="relative w-72">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm tx hash, action..."
                  value={txSearch}
                  onChange={e => setTxSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Hành động Smart Contract</th>
                    <th className="px-4 py-3">Transaction Hash (Click để xác minh)</th>
                    <th className="px-4 py-3">Block Number</th>
                    <th className="px-4 py-3">Biên lai On-chain</th>
                    <th className="px-4 py-3">Trạng thái Hệ thống</th>
                    <th className="px-4 py-3">Thời gian ghi nhận</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {txLoading ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-slate-400 font-sans">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                        Đang tải nhật ký giao dịch blockchain...
                      </td>
                    </tr>
                  ) : filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-slate-400 font-sans">
                        Không tìm thấy giao dịch blockchain nào.
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map(tx => (
                      <tr key={tx.id} className="hover:bg-slate-50/80 transition">
                        <td className="px-4 py-3">
                          {getTxActionBadge(tx.action)}
                        </td>
                        <td className="px-4 py-3">
                          {tx.transactionHash ? (
                            <EtherscanLink
                              txHash={tx.transactionHash}
                              chainId={DEFAULT_CHAIN_ID}
                              truncateLength={8}
                              className="text-indigo-600 font-bold"
                            />
                          ) : (
                            <span className="text-slate-300">Chưa cấp hash</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-800">
                          {tx.blockNumber ? `#${tx.blockNumber}` : "-"}
                        </td>
                        <td className="px-4 py-3">
                          {tx.receiptStatus === 1 ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-sans font-semibold">
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              Thành công
                            </span>
                          ) : tx.receiptStatus === 0 ? (
                            <span className="text-rose-600 font-sans font-semibold">Thất bại</span>
                          ) : (
                            <span className="text-amber-600 font-sans">Đang chờ xác nhận</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-sans">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            tx.status === "CONFIRMED" ? "bg-emerald-100 text-emerald-800" :
                            tx.status === "FAILED" ? "bg-rose-100 text-rose-800" :
                            "bg-amber-100 text-amber-800"
                          }`}>
                            {tx.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 font-sans text-[11px]">
                          {tx.createdAt ? new Date(tx.createdAt).toLocaleString() : "-"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-500">
                Hiển thị {filteredTransactions.length} trên tổng số {txTotal} giao dịch
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={txPage === 0 || txLoading}
                  onClick={() => setTxPage(p => Math.max(0, p - 1))}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Trước
                </button>
                <span className="text-xs font-bold text-slate-700 px-2">
                  Trang {txPage + 1}
                </span>
                <button
                  disabled={(txPage + 1) * txPageSize >= txTotal || txLoading}
                  onClick={() => setTxPage(p => p + 1)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  Sau
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminFinanceMonitoring;
