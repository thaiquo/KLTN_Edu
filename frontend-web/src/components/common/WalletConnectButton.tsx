import React, { useState, useRef, useEffect } from 'react';
import { Wallet, ChevronDown, Copy, Check, LogOut, RefreshCw, AlertTriangle, ArrowRightLeft } from 'lucide-react';
import { useWeb3Wallet } from '../../web3/useWeb3Wallet';
import { SUPPORTED_CHAINS, DEFAULT_CHAIN_ID } from '../../web3/web3Config';
import { EtherscanLink } from './EtherscanLink';

interface WalletConnectButtonProps {
  className?: string;
}

export function WalletConnectButton({ className = '' }: WalletConnectButtonProps) {
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

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopy = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshBalances();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const currentChain = chainId ? SUPPORTED_CHAINS[chainId] : null;
  const isSupportedChain = !!currentChain;

  if (!isConnected) {
    return (
      <div className="relative">
        <button
          onClick={connectWallet}
          disabled={isConnecting}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-display font-black tracking-wide bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm hover:shadow-md hover:from-blue-700 hover:to-indigo-700 active:scale-95 transition-all disabled:opacity-50 ${className}`}
        >
          <Wallet className={`w-3.5 h-3.5 ${isConnecting ? 'animate-spin' : ''}`} />
          <span>{isConnecting ? 'Đang kết nối...' : 'Kết nối ví Web3'}</span>
        </button>
        {error && (
          <div className="absolute right-0 mt-2 w-64 p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 shadow-lg z-50">
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div className="flex items-center gap-1.5">
        {/* Network indicator badge */}
        {!isSupportedChain ? (
          <button
            onClick={() => switchNetwork(DEFAULT_CHAIN_ID)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-100 text-amber-800 text-[11px] font-bold border border-amber-300 hover:bg-amber-200 transition-colors"
            title="Mạng không được hỗ trợ. Bấm để đổi sang Sepolia / Anvil"
          >
            <AlertTriangle className="w-3 h-3 text-amber-600 animate-bounce" />
            <span>Sai mạng</span>
          </button>
        ) : (
          <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 border border-slate-200 text-[11px] font-semibold text-slate-700">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>{currentChain?.name}</span>
          </div>
        )}

        {/* Wallet Address & Balance Trigger */}
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-brand-border/40 hover:border-brand-primary/50 text-brand-text shadow-sm hover:shadow transition-all group"
        >
          <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white text-[10px] font-mono font-bold shadow-inner">
            Ξ
          </div>
          <div className="text-left font-mono text-xs">
            <span className="font-bold text-slate-800">
              {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ''}
            </span>
          </div>
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Wallet Dropdown Popover */}
      {isDropdownOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl border border-slate-200 shadow-xl p-4 z-50 space-y-3 font-sans animate-in fade-in zoom-in-95 duration-100">
          {/* Header with Address and Copy */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-mono font-bold">
                Ξ
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Ví đã kết nối</p>
                <p className="font-mono text-xs font-bold text-slate-800">
                  {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleCopy}
                title="Sao chép địa chỉ ví"
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={handleRefresh}
                title="Làm mới số dư"
                className={`p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors ${isRefreshing ? 'animate-spin text-blue-600' : ''}`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Balances Card */}
          <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Số dư ETH:</span>
              <span className="font-mono text-xs font-bold text-slate-800">{ethBalance} ETH</span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200/40 pt-1.5">
              <span className="text-xs font-semibold text-slate-500">Số dư USDC:</span>
              <span className="font-mono text-xs font-black text-emerald-600">${usdcBalance} USDC</span>
            </div>
          </div>

          {/* Network Switcher */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Chuyển mạng blockchain</p>
            <div className="grid grid-cols-2 gap-1.5">
              {Object.values(SUPPORTED_CHAINS).map((chain) => {
                const isActive = chainId === chain.id;
                return (
                  <button
                    key={chain.id}
                    onClick={() => switchNetwork(chain.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all text-left flex items-center justify-between ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 border border-blue-200 font-black'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-transparent'
                    }`}
                  >
                    <span className="truncate">{chain.name}</span>
                    {isActive && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0"></span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Explorer Link & Disconnect */}
          <div className="border-t border-slate-100 pt-2 flex items-center justify-between text-xs">
            <EtherscanLink
              address={address || undefined}
              chainId={chainId || DEFAULT_CHAIN_ID}
              label="Etherscan"
            />
            <button
              onClick={() => {
                disconnectWallet();
                setIsDropdownOpen(false);
              }}
              className="flex items-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-lg font-bold transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Ngắt kết nối</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default WalletConnectButton;
