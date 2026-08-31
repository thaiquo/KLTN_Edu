import React, { useState, useEffect } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  CircleDollarSign,
  Copy,
  ExternalLink,
  Flame,
  Globe2,
  HelpCircle,
  History,
  Layers,
  LogOut,
  Network,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wallet,
  WalletCards,
} from "lucide-react";
import { EtherscanLink } from "../../components/common/EtherscanLink";
import { useWeb3Wallet } from "../../web3/useWeb3Wallet";
import { DEFAULT_CHAIN_ID, SUPPORTED_CHAINS, getContractAddresses } from "../../web3/web3Config";
import { apiRequest } from "../../api/client";
import { userApi } from "../../api/user";

interface MyWalletViewProps {
  activeRole?: "student" | "tutor" | string;
  userEmail?: string;
}

export function MyWalletView({ activeRole = "student", userEmail }: MyWalletViewProps) {
  const {
    address,
    chainId,
    isConnected,
    isConnecting,
    error,
    ethBalance,
    usdcBalance,
    connectWallet,
    openWeb3Modal,
    disconnectWallet,
    switchNetwork,
    refreshBalances,
  } = useWeb3Wallet();

  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"ALL" | "FUND" | "SETTLE" | "REFUND">("ALL");
  const [agreements, setAgreements] = useState<any[]>([]);
  const [loadingAgreements, setLoadingAgreements] = useState(false);

  // Profile Wallet State
  const [profileWallet, setProfileWallet] = useState<string | null>(null);
  const [savingProfileWallet, setSavingProfileWallet] = useState(false);
  const [walletSaveSuccess, setWalletSaveSuccess] = useState<string | null>(null);
  const [walletSaveError, setWalletSaveError] = useState<string | null>(null);

  const isTutor = activeRole === "tutor";
  const activeChain = chainId ? SUPPORTED_CHAINS[chainId] : SUPPORTED_CHAINS[DEFAULT_CHAIN_ID];
  const contracts = getContractAddresses(chainId || DEFAULT_CHAIN_ID);

  // Fetch Profile to read linked wallet_address
  useEffect(() => {
    async function fetchUserProfile() {
      try {
        const profile: any = await userApi.getMe();
        if (profile?.walletAddress) {
          setProfileWallet(profile.walletAddress);
        }
      } catch (err) {
        console.warn("Could not load user profile wallet:", err);
      }
    }
    fetchUserProfile();
  }, []);

  // Fetch Escrow Contracts for User to build Financial Overview
  useEffect(() => {
    async function fetchUserAgreements() {
      if (!userEmail) return;
      setLoadingAgreements(true);
      try {
        const data: any = await apiRequest("/api/contracts/agreements?page=0&size=50").catch(() => null);
        setAgreements(data?.content || (Array.isArray(data) ? data : []));
      } catch (err) {
        console.warn("Could not load agreements for wallet overview:", err);
      } finally {
        setLoadingAgreements(false);
      }
    }
    fetchUserAgreements();
  }, [userEmail]);

  async function handleSaveDefaultWallet() {
    if (!address) return;
    setSavingProfileWallet(true);
    setWalletSaveSuccess(null);
    setWalletSaveError(null);
    try {
      const res: any = await userApi.updateWallet(address);
      setProfileWallet(res?.walletAddress || address);
      setWalletSaveSuccess("Đã lưu địa chỉ ví này làm ví mặc định cho hồ sơ thành công!");
      setTimeout(() => setWalletSaveSuccess(null), 4000);
    } catch (err: any) {
      setWalletSaveError(err?.message || "Không thể lưu ví mặc định.");
    } finally {
      setSavingProfileWallet(false);
    }
  }

  async function handleUnlinkWallet() {
    setSavingProfileWallet(true);
    setWalletSaveSuccess(null);
    setWalletSaveError(null);
    try {
      await userApi.updateWallet(null);
      setProfileWallet(null);
      setWalletSaveSuccess("Đã gỡ liên kết ví mặc định khỏi hồ sơ.");
      setTimeout(() => setWalletSaveSuccess(null), 4000);
    } catch (err: any) {
      setWalletSaveError(err?.message || "Không thể gỡ liên kết ví.");
    } finally {
      setSavingProfileWallet(false);
    }
  }

  async function copyAddress() {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refreshBalances();
    } finally {
      setRefreshing(false);
    }
  }

  // Calculate statistics from agreements
  const totalEscrowDeposited = agreements
    .filter((a) => a.onchainFunded)
    .reduce((acc, curr) => acc + (Number(curr.totalAmount) || 0), 0);

  const escrowHoldingAmount = agreements
    .filter((a) => a.onchainFunded && a.status !== "COMPLETED" && a.status !== "REFUNDED")
    .reduce((acc, curr) => acc + (Number(curr.remainingDeposit || curr.totalAmount) || 0), 0);

  const totalDisbursedAmount = agreements
    .filter((a) => a.status === "COMPLETED" || (a.settledSessions > 0))
    .reduce((acc, curr) => acc + (Number(curr.totalAmount || 0) - Number(curr.remainingDeposit || 0)), 0);

  return (
    <section className="mx-auto max-w-6xl pb-16 font-sans text-slate-800 space-y-8 select-none">
      {/* 1. Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 sm:p-8 text-white shadow-2xl border border-slate-800/80">
        {/* Background ambient glow circles */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/3 h-64 w-64 rounded-full bg-emerald-500/15 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-black text-blue-200 backdrop-blur-md border border-white/10">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                <span>Web3 Wallet Dashboard</span>
              </span>
              <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider backdrop-blur-md border ${
                isTutor ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" : "bg-sky-500/20 text-sky-300 border-sky-500/30"
              }`}>
                {isTutor ? "Gia sư" : "Học viên"}
              </span>
            </div>

            <h1 className="font-display text-2xl font-black tracking-tight sm:text-3xl text-white">
              Ví Blockchain của tôi
            </h1>
            <p className="max-w-xl text-xs sm:text-sm font-medium text-slate-300/80 leading-relaxed">
              Quản lý tài khoản ví Web3, số dư mã thông báo ETH / USDC và theo dõi các giao dịch Hợp đồng Ký quỹ (Escrow) thời gian thực.
            </p>
          </div>

          {/* Connected Info or Connect Trigger */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {!isConnected ? (
              <button
                type="button"
                onClick={openWeb3Modal}
                disabled={isConnecting}
                className="inline-flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-blue-500/25 hover:from-blue-600 hover:to-indigo-700 hover:shadow-xl active:scale-95 transition-all disabled:opacity-50"
              >
                {isConnecting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <WalletCards className="h-4 w-4" />}
                <span>{isConnecting ? "Đang kết nối..." : "Kết nối ví Web3 / Web3Modal"}</span>
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/10 p-2.5 px-4 backdrop-blur-md border border-white/10">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                    </div>
                    <span className="font-mono text-xs font-bold tracking-tight text-slate-100 truncate">
                      {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ""}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={copyAddress}
                      title="Sao chép địa chỉ ví"
                      className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={handleRefresh}
                      disabled={refreshing}
                      title="Làm mới số dư"
                      className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin text-blue-400" : ""}`} />
                    </button>
                    <button
                      type="button"
                      onClick={disconnectWallet}
                      title="Ngắt kết nối"
                      className="p-1.5 rounded-lg text-rose-300 hover:text-rose-100 hover:bg-rose-500/20 transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] font-bold text-slate-300 px-1">
                  <span className="flex items-center gap-1">
                    <Globe2 className="h-3.5 w-3.5 text-blue-400" />
                    {activeChain ? activeChain.name : `Chain ${chainId}`}
                  </span>
                  <EtherscanLink
                    address={address || undefined}
                    chainId={chainId || DEFAULT_CHAIN_ID}
                    label="Xem trên Etherscan"
                    className="text-blue-300 hover:text-white underline decoration-blue-400/50"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-800 shadow-sm animate-fade-in">
          <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {walletSaveSuccess && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-800 shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{walletSaveSuccess}</span>
          </div>
          <button type="button" onClick={() => setWalletSaveSuccess(null)} className="text-emerald-700 hover:underline">
            Đóng
          </button>
        </div>
      )}

      {walletSaveError && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-800 shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>{walletSaveError}</span>
          </div>
          <button type="button" onClick={() => setWalletSaveError(null)} className="text-rose-700 hover:underline">
            Đóng
          </button>
        </div>
      )}

      {/* 2. Default Profile Wallet Management Card */}
      <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm hover:shadow-md transition-all space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-blue-600 border border-blue-100">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-display text-base font-black text-slate-900">
                Ví Mặc Định Trong Hồ Sơ (Default Profile Wallet)
              </h3>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">
                Dùng tự động điền khi tạo/ký hợp đồng mới. Lịch sử các hợp đồng cũ vẫn bảo lưu ví ban đầu.
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {isConnected && address && (
              (!profileWallet || profileWallet.toLowerCase() !== address.toLowerCase()) ? (
                <button
                  type="button"
                  onClick={handleSaveDefaultWallet}
                  disabled={savingProfileWallet}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-display font-black shadow-sm transition-all disabled:opacity-50"
                >
                  {savingProfileWallet ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  <span>{profileWallet ? "Cập nhật ví MetaMask này làm mặc định" : "Lưu ví này làm mặc định"}</span>
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span>MetaMask đã khớp với ví hồ sơ</span>
                </span>
              )
            )}

            {profileWallet && (
              <button
                type="button"
                onClick={handleUnlinkWallet}
                disabled={savingProfileWallet}
                className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
              >
                Gỡ liên kết
              </button>
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Địa chỉ ví mặc định:
            </span>
            {profileWallet ? (
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-slate-800 text-sm">{profileWallet}</span>
                <EtherscanLink address={profileWallet} chainId={chainId || DEFAULT_CHAIN_ID} />
              </div>
            ) : (
              <span className="text-slate-400 italic font-semibold">Chưa có ví mặc định. Hãy kết nối MetaMask và bấm "Lưu ví này làm mặc định".</span>
            )}
          </div>

          {isConnected && address && profileWallet && profileWallet.toLowerCase() !== address.toLowerCase() && (
            <div className="flex items-center gap-1.5 p-2 px-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 font-bold text-[11px]">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
              <span>Ví MetaMask đang kết nối ({address.slice(0, 6)}...{address.slice(-4)}) khác ví mặc định hồ sơ.</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Wallet Balances Grid */}
      <div className="grid gap-5 sm:grid-cols-2">
        {/* ETH Balance Card */}
        <div className="group relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Phí Gas Native Token
              </span>
              <h3 className="font-display text-lg font-black text-slate-800">Số dư Ethereum (ETH)</h3>
            </div>
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-tr from-indigo-500 to-blue-600 text-white shadow-md shadow-indigo-500/20">
              <span className="font-mono text-xl font-bold">Ξ</span>
            </div>
          </div>

          <div className="mt-6 flex items-baseline gap-2">
            <span className="font-mono text-3xl font-black tracking-tight text-slate-900">
              {ethBalance}
            </span>
            <span className="font-mono text-sm font-extrabold text-indigo-600">ETH</span>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs font-semibold text-slate-500">
            <span className="flex items-center gap-1 text-[11px]">
              <Flame className="h-3.5 w-3.5 text-amber-500" />
              Dùng thanh toán Gas giao dịch
            </span>
            <a
              href="https://faucet.quicknode.com/drip"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline"
            >
              <span>Nhận Faucet ETH</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        {/* USDC Balance Card */}
        <div className="group relative overflow-hidden rounded-3xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/40 via-white to-teal-50/20 p-6 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
                Học phí Stablecoin (ERC-20)
              </span>
              <h3 className="font-display text-lg font-black text-slate-800">Số dư USD Coin (USDC)</h3>
            </div>
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20">
              <CircleDollarSign className="h-6 w-6" />
            </div>
          </div>

          <div className="mt-6 flex items-baseline gap-2">
            <span className="font-mono text-3xl font-black tracking-tight text-emerald-900">
              {usdcBalance}
            </span>
            <span className="font-mono text-sm font-extrabold text-emerald-600">USDC</span>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-emerald-100 pt-3 text-xs font-semibold text-slate-600">
            <span className="font-mono text-[11px] text-slate-400">
              Circle Sepolia USDC: {contracts.usdc ? `${contracts.usdc.slice(0, 6)}...${contracts.usdc.slice(-4)}` : "N/A"}
            </span>
            <a
              href="https://faucet.circle.com/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:text-emerald-900 hover:underline bg-emerald-100/60 px-2.5 py-1 rounded-lg transition-colors"
            >
              <span>Circle Faucet USDC</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>

      {/* 3. Income / Financial Escrow Summary */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h3 className="font-display text-lg font-black text-slate-800 flex items-center gap-2">
              <Layers className="h-5 w-5 text-brand-primary" />
              <span>Tổng quan Tài chính & Hợp đồng Escrow</span>
            </h3>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              {isTutor
                ? "Tổng hợp thu nhập đã nhận và số tiền học phí đang ký quỹ tạm giữ."
                : "Tổng hợp tiền học phí đã nạp cọc vào Hợp đồng thông minh Escrow."}
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {isTutor ? (
            <>
              <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-4 space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
                  Tổng thu nhập đã giải ngân
                </span>
                <p className="font-mono text-2xl font-black text-emerald-900">
                  {totalDisbursedAmount.toLocaleString("vi-VN")} USDC
                </p>
                <p className="text-[11px] font-bold text-emerald-600">Đã chuyển về ví thành công</p>
              </div>

              <div className="rounded-2xl border border-amber-200/80 bg-amber-50/50 p-4 space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-700">
                  Thu nhập tạm giữ (Escrow)
                </span>
                <p className="font-mono text-2xl font-black text-amber-900">
                  {escrowHoldingAmount.toLocaleString("vi-VN")} USDC
                </p>
                <p className="text-[11px] font-bold text-amber-600">Sẽ giải ngân theo từng buổi học</p>
              </div>

              <div className="rounded-2xl border border-blue-200/80 bg-blue-50/50 p-4 space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-700">
                  Tổng Hợp đồng Escrow
                </span>
                <p className="font-mono text-2xl font-black text-blue-900">
                  {agreements.length} Hợp đồng
                </p>
                <p className="text-[11px] font-bold text-blue-600">Lớp học có ký quỹ Smart Contract</p>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-2xl border border-blue-200/80 bg-blue-50/50 p-4 space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-700">
                  Tổng tiền cọc học phí nạp vào
                </span>
                <p className="font-mono text-2xl font-black text-blue-900">
                  {totalEscrowDeposited.toLocaleString("vi-VN")} USDC
                </p>
                <p className="text-[11px] font-bold text-blue-600">Được bảo vệ bởi Escrow Smart Contract</p>
              </div>

              <div className="rounded-2xl border border-amber-200/80 bg-amber-50/50 p-4 space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-700">
                  Tiền cọc đang giữ
                </span>
                <p className="font-mono text-2xl font-black text-amber-900">
                  {escrowHoldingAmount.toLocaleString("vi-VN")} USDC
                </p>
                <p className="text-[11px] font-bold text-amber-600">Cho các buổi học sắp tới</p>
              </div>

              <div className="rounded-2xl border border-purple-200/80 bg-purple-50/50 p-4 space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-purple-700">
                  Số lượng Hợp đồng Escrow
                </span>
                <p className="font-mono text-2xl font-black text-purple-900">
                  {agreements.length} Lớp học
                </p>
                <p className="text-[11px] font-bold text-purple-600">Đã đăng ký giao dịch Blockchain</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 4. Transaction Audit & Escrow History Table */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h3 className="font-display text-lg font-black text-slate-800 flex items-center gap-2">
              <History className="h-5 w-5 text-brand-primary" />
              <span>Lịch sử Giao dịch & Nhật ký Escrow</span>
            </h3>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              Danh sách ghi nhận nạp cọc, giải ngân buổi học và duyệt hợp đồng trên Blockchain.
            </p>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 text-xs font-bold">
            <button
              onClick={() => setActiveTab("ALL")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === "ALL" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Tất cả
            </button>
            <button
              onClick={() => setActiveTab("FUND")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === "FUND" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Nạp cọc
            </button>
            <button
              onClick={() => setActiveTab("SETTLE")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === "SETTLE" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Giải ngân
            </button>
          </div>
        </div>

        {loadingAgreements ? (
          <div className="py-12 text-center text-xs font-bold text-slate-400 flex items-center justify-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin text-brand-primary" />
            <span>Đang tải lịch sử hợp đồng Escrow...</span>
          </div>
        ) : agreements.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">
              <History className="h-6 w-6" />
            </div>
            <p className="text-sm font-extrabold text-slate-700">Chưa có giao dịch Blockchain nào</p>
            <p className="text-xs font-medium text-slate-400 max-w-sm mx-auto">
              Khi học viên thực hiện nạp cọc học phí hoặc buổi học được xác nhận hoàn tất, lịch sử giao dịch sẽ tự động lưu lại ở đây.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-semibold">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <th className="pb-3">Hợp đồng / Lớp học</th>
                  <th className="pb-3">Trạng thái Escrow</th>
                  <th className="pb-3">Số tiền</th>
                  <th className="pb-3">Thời gian</th>
                  <th className="pb-3 text-right">Chi tiết Tx</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {agreements.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 pr-3">
                      <p className="font-bold text-slate-800 text-xs">Mã Hợp đồng #{item.id}</p>
                      <p className="text-[11px] text-slate-400">Lớp: {item.className || `Lớp học ID #${item.classroomId}`}</p>
                    </td>
                    <td className="py-3.5 pr-3">
                      {item.onchainFunded ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-black uppercase text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="h-3 w-3" /> Đã nạp cọc Smart Contract
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-black uppercase text-amber-700 border border-amber-200">
                          Chờ nạp cọc
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 pr-3 font-mono font-bold text-emerald-700 text-sm">
                      {Number(item.totalAmount).toLocaleString("vi-VN")} USDC
                    </td>
                    <td className="py-3.5 pr-3 text-slate-500 font-mono text-[11px]">
                      {item.createdAt ? new Date(item.createdAt).toLocaleString("vi-VN") : "N/A"}
                    </td>
                    <td className="py-3.5 text-right font-mono">
                      {item.fundedTxHash ? (
                        <EtherscanLink
                          txHash={item.fundedTxHash}
                          chainId={chainId || DEFAULT_CHAIN_ID}
                          label={`${item.fundedTxHash.slice(0, 6)}...${item.fundedTxHash.slice(-4)}`}
                          className="text-blue-600 hover:text-blue-800 underline font-bold"
                        />
                      ) : (
                        <span className="text-slate-300">Chưa có Tx</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </section>
  );
}

export default MyWalletView;
