import React, { ReactNode, useEffect } from 'react';
import { Web3WalletProvider } from './useWeb3Wallet';
import { initReownAppKit } from './web3Config';

interface AppKitProviderProps {
  children: ReactNode;
}

export function AppKitProvider({ children }: AppKitProviderProps) {
  useEffect(() => {
    initReownAppKit();
  }, []);

  return (
    <Web3WalletProvider>
      {children}
    </Web3WalletProvider>
  );
}

export default AppKitProvider;
