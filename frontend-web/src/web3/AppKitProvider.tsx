import React, { ReactNode } from 'react';
import { Web3WalletProvider } from './useWeb3Wallet';

interface AppKitProviderProps {
  children: ReactNode;
}

export function AppKitProvider({ children }: AppKitProviderProps) {
  return (
    <Web3WalletProvider>
      {children}
    </Web3WalletProvider>
  );
}

export default AppKitProvider;
