import React, { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { ethers } from 'ethers';
import { SUPPORTED_CHAINS, DEFAULT_CHAIN_ID, getContractAddresses, ERC20_ABI } from './web3Config';

export interface Web3WalletState {
  address: string | null;
  chainId: number | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  ethBalance: string;
  usdcBalance: string;
  provider: ethers.BrowserProvider | null;
  signer: ethers.JsonRpcSigner | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  switchNetwork: (targetChainId: number) => Promise<void>;
  refreshBalances: () => Promise<void>;
}

const Web3Context = createContext<Web3WalletState | null>(null);

export function Web3WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [ethBalance, setEthBalance] = useState<string>('0');
  const [usdcBalance, setUsdcBalance] = useState<string>('0');
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);

  const initProvider = useCallback(() => {
    if (typeof window !== 'undefined' && window.ethereum) {
      return new ethers.BrowserProvider(window.ethereum);
    }
    return null;
  }, []);

  const refreshBalances = useCallback(async () => {
    if (!address) return;
    try {
      const activeProvider = provider || initProvider();
      if (!activeProvider) return;

      // Fetch ETH balance
      const rawEthBal = await activeProvider.getBalance(address);
      setEthBalance(parseFloat(ethers.formatEther(rawEthBal)).toFixed(4));

      // Fetch USDC balance if chain matches
      const currentChainId = chainId || DEFAULT_CHAIN_ID;
      const contracts = getContractAddresses(currentChainId);
      if (contracts.usdc && contracts.usdc !== ethers.ZeroAddress) {
        try {
          const usdcContract = new ethers.Contract(contracts.usdc, ERC20_ABI, activeProvider);
          const rawUsdcBal = await usdcContract.balanceOf(address);
          const decimals = await usdcContract.decimals().catch(() => 6);
          setUsdcBalance(parseFloat(ethers.formatUnits(rawUsdcBal, decimals)).toFixed(2));
        } catch {
          setUsdcBalance('0.00');
        }
      }
    } catch (err: any) {
      console.warn('Could not refresh balances:', err?.message || err);
    }
  }, [address, chainId, provider, initProvider]);

  const updateWalletState = useCallback(async (browserProvider: ethers.BrowserProvider) => {
    try {
      const rpcSigner = await browserProvider.getSigner();
      const userAddress = await rpcSigner.getAddress();
      const network = await browserProvider.getNetwork();
      const netChainId = Number(network.chainId);

      setProvider(browserProvider);
      setSigner(rpcSigner);
      setAddress(userAddress);
      setChainId(netChainId);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to get wallet details');
    }
  }, []);

  const connectWallet = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      setError('Vui lòng cài đặt MetaMask hoặc ví Web3 để tiếp tục!');
      window.open('https://metamask.io/download/', '_blank');
      return;
    }

    try {
      setIsConnecting(true);
      setError(null);

      const browserProvider = new ethers.BrowserProvider(window.ethereum);
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      await updateWalletState(browserProvider);
    } catch (err: any) {
      if (err.code === 4001) {
        setError('Người dùng đã từ chối yêu cầu kết nối ví.');
      } else {
        setError(err?.message || 'Lỗi khi kết nối ví.');
      }
    } finally {
      setIsConnecting(false);
    }
  }, [updateWalletState]);

  const disconnectWallet = useCallback(() => {
    setAddress(null);
    setChainId(null);
    setSigner(null);
    setEthBalance('0');
    setUsdcBalance('0');
    setError(null);
  }, []);

  const switchNetwork = useCallback(async (targetChainId: number) => {
    if (!window.ethereum) {
      setError('Ví Web3 chưa được cài đặt.');
      return;
    }

    const hexChainId = `0x${targetChainId.toString(16)}`;
    const chainConfig = SUPPORTED_CHAINS[targetChainId];

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: hexChainId }],
      });
    } catch (switchError: any) {
      // Error code 4902 means network has not been added yet
      if (switchError.code === 4902 && chainConfig) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: hexChainId,
                chainName: chainConfig.name,
                nativeCurrency: {
                  name: chainConfig.currency,
                  symbol: chainConfig.currency,
                  decimals: 18,
                },
                rpcUrls: [chainConfig.rpcUrl],
                blockExplorerUrls: chainConfig.explorerUrl ? [chainConfig.explorerUrl] : undefined,
              },
            ],
          });
        } catch (addError: any) {
          setError(`Không thể thêm mạng ${chainConfig.name} vào ví: ${addError.message}`);
        }
      } else {
        setError(`Không thể chuyển sang mạng: ${switchError.message}`);
      }
    }
  }, []);

  // Listen to provider events (accountsChanged, chainChanged)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnectWallet();
      } else {
        const browserProvider = new ethers.BrowserProvider(window.ethereum);
        updateWalletState(browserProvider);
      }
    };

    const handleChainChanged = () => {
      const browserProvider = new ethers.BrowserProvider(window.ethereum);
      updateWalletState(browserProvider);
    };

    window.ethereum.on?.('accountsChanged', handleAccountsChanged);
    window.ethereum.on?.('chainChanged', handleChainChanged);

    // Check if already authorized
    window.ethereum.request?.({ method: 'eth_accounts' }).then((accounts: string[]) => {
      if (accounts && accounts.length > 0) {
        const browserProvider = new ethers.BrowserProvider(window.ethereum);
        updateWalletState(browserProvider);
      }
    }).catch(() => {});

    return () => {
      window.ethereum?.removeListener?.('accountsChanged', handleAccountsChanged);
      window.ethereum?.removeListener?.('chainChanged', handleChainChanged);
    };
  }, [disconnectWallet, updateWalletState]);

  // Periodically refresh balances when connected
  useEffect(() => {
    if (address) {
      refreshBalances();
      const interval = setInterval(refreshBalances, 15000);
      return () => clearInterval(interval);
    }
  }, [address, chainId, refreshBalances]);

  const value: Web3WalletState = {
    address,
    chainId,
    isConnected: !!address,
    isConnecting,
    error,
    ethBalance,
    usdcBalance,
    provider,
    signer,
    connectWallet,
    disconnectWallet,
    switchNetwork,
    refreshBalances,
  };

  return <Web3Context.Provider value={value}>{children}</Web3Context.Provider>;
}

export function useWeb3Wallet(): Web3WalletState {
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error('useWeb3Wallet must be used within a Web3WalletProvider');
  }
  return context;
}
