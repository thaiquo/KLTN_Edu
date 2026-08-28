import React, { useState } from "react";
import {
  AlertTriangle,
  Check,
  CircleDollarSign,
  Copy,
  LogOut,
  Network,
  RefreshCw,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { EtherscanLink } from "../../components/common/EtherscanLink";
import { useWeb3Wallet } from "../../web3/useWeb3Wallet";
import { DEFAULT_CHAIN_ID, SUPPORTED_CHAINS } from "../../web3/web3Config";

export function MyWalletView() {
  const {
    address,
    chainId,
    isConnected,
    isConnecting,
    error,
    ethBalance,
    usdcBalance,
    connectWallet,
    disconnectWallet,
    switchNetwork,
    refreshBalances,
  } = useWeb3Wallet();
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const activeChain = chainId ? SUPPORTED_CHAINS[chainId] : null;

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

  return (
    <section className="mx-auto max-w-5xl pb-12 font-sans">
      <div className="flex flex-col gap-4 border-b border-brand-border/30 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-widest text-brand-secondary">Tài khoản Web3</p>
          <h2 className="mt-1 font-display text-3xl font-black text-brand-text">Ví của tôi</h2>
          <p className="mt-2 text-sm font-semibold text-brand-text-variant/70">
            Quản lý ví dùng cho hợp đồng và ký quỹ học tập.
          </p>
        </div>
        {isConnected && (
          <div className="inline-flex items-center gap-2 text-xs font-extrabold text-emerald-700">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            Đã kết nối
          </div>
        )}
      </div>

      {!isConnected ? (
        <div className="mt-8 grid min-h-80 place-items-center border border-brand-border/30 bg-white px-6 py-12 text-center shadow-sm">
          <div className="max-w-md">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-blue-50 text-brand-primary">
              <WalletCards className="h-7 w-7" />
            </span>
            <h3 className="mt-5 font-display text-xl font-black text-brand-text">Chưa kết nối ví</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-brand-text-variant/70">
              Kết nối MetaMask hoặc ví Web3 tương thích với tài khoản của bạn.
            </p>
            <button
              type="button"
              onClick={connectWallet}
              disabled={isConnecting}
              className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 bg-brand-primary px-5 text-sm font-extrabold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isConnecting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <WalletCards className="h-4 w-4" />}
              {isConnecting ? "Đang kết nối..." : "Kết nối ví"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          <div className="border border-brand-border/30 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-widest text-brand-text-variant/50">Địa chỉ ví</p>
                <p className="mt-2 break-all font-mono text-sm font-bold text-brand-text">{address}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={copyAddress}
                  title="Sao chép địa chỉ ví"
                  className="grid h-10 w-10 place-items-center border border-brand-border/40 text-brand-text-variant transition hover:border-brand-primary hover:text-brand-primary"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={refreshing}
                  title="Làm mới số dư"
                  className="grid h-10 w-10 place-items-center border border-brand-border/40 text-brand-text-variant transition hover:border-brand-primary hover:text-brand-primary disabled:opacity-60"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                </button>
                <button
                  type="button"
                  onClick={disconnectWallet}
                  className="inline-flex h-10 items-center gap-2 border border-red-200 px-4 text-xs font-extrabold text-red-600 transition hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" />
                  Ngắt kết nối
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <BalanceItem icon={WalletCards} label="Số dư ETH" value={`${ethBalance} ETH`} />
            <BalanceItem icon={CircleDollarSign} label="Số dư USDC" value={`${usdcBalance} USDC`} />
          </div>

          <div className="border border-brand-border/30 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <Network className="mt-0.5 h-5 w-5 text-brand-primary" />
              <div className="flex-1">
                <p className="font-display text-sm font-black text-brand-text">Mạng blockchain</p>
                <p className="mt-1 text-xs font-semibold text-brand-text-variant/60">
                  {activeChain ? activeChain.name : `Mạng chưa được hỗ trợ (Chain ID ${chainId})`}
                </p>
              </div>
              {activeChain ? (
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              )}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {Object.values(SUPPORTED_CHAINS).map((chain) => {
                const selected = chain.id === chainId;
                return (
                  <button
                    key={chain.id}
                    type="button"
                    onClick={() => switchNetwork(chain.id)}
                    className={`flex min-h-12 items-center justify-between border px-4 text-left text-sm font-extrabold transition ${
                      selected
                        ? "border-brand-primary bg-blue-50 text-brand-primary"
                        : "border-brand-border/40 text-brand-text hover:border-brand-primary/60"
                    }`}
                  >
                    <span>{chain.name}</span>
                    {selected && <Check className="h-4 w-4" />}
                  </button>
                );
              })}
            </div>

            {address && activeChain?.explorerUrl && (
              <div className="mt-5 border-t border-brand-border/20 pt-4 text-sm font-bold">
                <EtherscanLink address={address} chainId={chainId || DEFAULT_CHAIN_ID} label="Xem ví trên Etherscan" />
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-5 flex items-start gap-3 border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </section>
  );
}

function BalanceItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="border border-brand-border/30 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center bg-brand-low text-brand-primary">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-[11px] font-black uppercase tracking-widest text-brand-text-variant/50">{label}</p>
          <p className="mt-1 font-mono text-lg font-black text-brand-text">{value}</p>
        </div>
      </div>
    </div>
  );
}
