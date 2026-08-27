/// <reference types="vite/client" />

interface Window {
  ethereum?: any;
}

interface ImportMetaEnv {
  readonly VITE_REOWN_PROJECT_ID?: string;
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string;
  readonly VITE_ESCROW_CONTRACT_ADDRESS?: string;
  readonly VITE_USDC_CONTRACT_ADDRESS?: string;
  readonly VITE_DEFAULT_CHAIN_ID?: string;
  readonly VITE_SEPOLIA_RPC_URL?: string;
  readonly VITE_ANVIL_RPC_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
