import { createAppKit } from '@reown/appkit/react';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { sepolia } from '@reown/appkit/networks';

export interface ChainConfig {
  id: number;
  name: string;
  currency: string;
  explorerUrl: string;
  rpcUrl: string;
}

export const SUPPORTED_CHAINS: Record<number, ChainConfig> = {
  31337: {
    id: 31337,
    name: 'Anvil Localhost',
    currency: 'ETH',
    explorerUrl: '',
    rpcUrl: import.meta.env.VITE_ANVIL_RPC_URL || 'http://127.0.0.1:8545',
  },
  11155111: {
    id: 11155111,
    name: 'Sepolia Testnet',
    currency: 'ETH',
    explorerUrl: 'https://sepolia.etherscan.io',
    rpcUrl: import.meta.env.VITE_SEPOLIA_RPC_URL || 'https://rpc.sepolia.org',
  },
};

export const DEFAULT_CHAIN_ID = Number(import.meta.env.VITE_DEFAULT_CHAIN_ID || 11155111);

export const WALLETCONNECT_PROJECT_ID =
  import.meta.env.VITE_PROJECT_ID_WALLETCONNECT || '8cb9e1ffa64671cc0e67dec78579cc61';

let appKitModalInstance: any = null;

export function initReownAppKit() {
  if (typeof window === 'undefined') return null;
  if (appKitModalInstance) return appKitModalInstance;

  try {
    appKitModalInstance = createAppKit({
      adapters: [new EthersAdapter()],
      networks: [sepolia],
      metadata: {
        name: 'EduConnect Platform',
        description: 'Nền tảng Hợp đồng Escrow Blockchain EduConnect',
        url: window.location.origin,
        icons: ['https://assets.reown.com/reown-profile-pic.png'],
      },
      projectId: WALLETCONNECT_PROJECT_ID,
      features: {
        analytics: true,
        email: false,
        socials: [],
      },
      themeMode: 'light',
      themeVariables: {
        '--w3m-accent': '#0284c7',
        '--w3m-border-radius-master': '16px',
      },
    });
    return appKitModalInstance;
  } catch (err) {
    console.warn('Reown AppKit initialization warning:', err);
    return null;
  }
}

export function openWeb3Modal() {
  try {
    const modal = initReownAppKit();
    if (modal && typeof modal.open === 'function') {
      modal.open();
      return;
    }
  } catch (err) {
    console.warn('Failed to open Web3Modal via Reown API:', err);
  }
}

export const CONTRACT_ADDRESSES: Record<number, { escrow: string; usdc: string }> = {
  31337: {
    escrow: import.meta.env.VITE_ESCROW_CONTRACT_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    usdc: import.meta.env.VITE_USDC_CONTRACT_ADDRESS || '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
  },
  11155111: {
    escrow: import.meta.env.VITE_ESCROW_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000',
    usdc: import.meta.env.VITE_USDC_CONTRACT_ADDRESS || '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // Circle Sepolia Mock USDC
  },
};

export function getContractAddresses(chainId: number) {
  return CONTRACT_ADDRESSES[chainId] || CONTRACT_ADDRESSES[DEFAULT_CHAIN_ID];
}

export function getExplorerTxUrl(txHash?: string, chainId: number = DEFAULT_CHAIN_ID): string {
  if (!txHash) return '#';
  const chain = SUPPORTED_CHAINS[chainId] || SUPPORTED_CHAINS[11155111];
  if (chain.explorerUrl) {
    return `${chain.explorerUrl}/tx/${txHash}`;
  }
  // For local anvil or unconfigured explorer, link to a mock viewer or return tx
  return `https://sepolia.etherscan.io/tx/${txHash}`;
}

export function getExplorerAddressUrl(address?: string, chainId: number = DEFAULT_CHAIN_ID): string {
  if (!address) return '#';
  const chain = SUPPORTED_CHAINS[chainId] || SUPPORTED_CHAINS[11155111];
  if (chain.explorerUrl) {
    return `${chain.explorerUrl}/address/${address}`;
  }
  return `https://sepolia.etherscan.io/address/${address}`;
}

export const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 value) returns (bool)',
  'function transfer(address to, uint256 value) returns (bool)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
];

export const ESCROW_ABI = [
  'function registerAgreement(bytes32 agreementId, address student, address tutor, bytes32 termsHash, uint256 totalAmount, uint256 pricePerSession, uint32 totalSessions) external',
  'function fundAgreement(bytes32 agreementId) external',
  'function proposeSessionSettlement(bytes32 agreementId, bytes32 sessionId, uint8 outcome, bytes32 evidenceHash) external',
  'function openTutorFraudDispute(bytes32 agreementId, bytes32 sessionId, bytes32 evidenceHash) external',
  'function finalizeSession(bytes32 agreementId, bytes32 sessionId) external',
  'function resolveTutorFraudDispute(bytes32 agreementId, bytes32 sessionId, bool complaintApproved, bytes32 resolutionHash) external',
  'function expireAgreement(bytes32 agreementId) external',
  'function cancelAgreementAndRefundUnused(bytes32 agreementId, bytes32 reasonHash) external',
  'function getAgreement(bytes32 agreementId) external view returns (tuple(address student, address tutor, bytes32 termsHash, uint256 totalAmount, uint256 pricePerSession, uint256 remainingAmount, uint256 releasedAmount, uint256 refundedAmount, uint64 paymentDeadline, uint32 totalSessions, uint32 settledSessions, uint32 openSessions, uint8 status))',
  'function getSessionSettlement(bytes32 agreementId, bytes32 sessionId) external view returns (tuple(uint8 outcome, uint256 tutorAmount, uint256 studentRefund, uint256 platformFee, uint64 disputeDeadline, bytes32 evidenceHash, uint8 status))',
  'event AgreementRegistered(bytes32 indexed agreementId, address indexed student, address indexed tutor, bytes32 termsHash, uint256 totalAmount, uint256 pricePerSession, uint32 totalSessions, uint64 paymentDeadline)',
  'event AgreementFunded(bytes32 indexed agreementId, address indexed student, uint256 totalAmount)',
  'event SessionSettled(bytes32 indexed agreementId, bytes32 indexed sessionId, uint8 outcome, uint256 tutorAmount, uint256 studentRefund, uint256 platformFee)',
  'event TutorFraudDisputeOpened(bytes32 indexed agreementId, bytes32 indexed sessionId, address indexed student, bytes32 evidenceHash)',
  'event TutorFraudDisputeResolved(bytes32 indexed agreementId, bytes32 indexed sessionId, bool complaintApproved, bytes32 resolutionHash)',
  'event AgreementCompleted(bytes32 indexed agreementId)',
  'event AgreementExpired(bytes32 indexed agreementId)',
  'event AgreementCancelled(bytes32 indexed agreementId, bytes32 reasonHash)',
  'event UnusedAmountRefunded(bytes32 indexed agreementId, address indexed student, uint256 amount)',
];
