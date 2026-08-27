/**
 * Web3 Configuration for EduConnect Platform
 * Supports Localhost (Anvil: 31337) and Ethereum Sepolia Testnet (11155111)
 */

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

export const DEFAULT_CHAIN_ID = Number(import.meta.env.VITE_DEFAULT_CHAIN_ID || 31337);

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
  'function registerAgreement(uint256 agreementId, address student, address tutor, uint256 totalSessions, uint256 totalAmount, uint256 platformFeeBasisPoints) external',
  'function fundAgreement(uint256 agreementId) external',
  'function settleSessionProposal(uint256 agreementId, uint256 sessionId, uint8 attendanceType, uint256 totalUnitsScheduled, uint256 studentAttendedUnits, uint256 tutorTaughtUnits, bytes32 sessionProofHash) external',
  'function openTutorFraudDispute(uint256 agreementId, uint256 sessionId, bytes32 evidenceHash) external',
  'function resolveTutorFraudDispute(uint256 agreementId, uint256 sessionId, bool studentRefundApproved, bytes32 auditProofHash) external',
  'function cancelAndRefundAgreement(uint256 agreementId) external',
  'function getAgreement(uint256 agreementId) external view returns (uint8 status, address student, address tutor, uint256 totalSessions, uint256 settledSessions, uint256 totalAmount, uint256 remainingDeposit, uint256 studentRefundedAmount, uint256 platformFeeBasisPoints, uint256 createdAtBlock, uint256 fundedAtBlock)',
  'function getSessionSettlement(uint256 agreementId, uint256 sessionId) external view returns (uint8 status, uint8 attendanceType, uint256 tutorPaidAmount, uint256 studentRefundAmount, uint256 platformFeeAmount, uint256 disputeWindowDeadline, uint256 createdAtBlock)',
  'function getDispute(uint256 agreementId, uint256 sessionId) external view returns (uint8 status, address openedBy, bytes32 evidenceHash, bool studentRefundApproved, bytes32 auditProofHash, uint256 createdAtBlock, uint256 resolvedAtBlock)',
  'event AgreementRegistered(uint256 indexed agreementId, address indexed student, address indexed tutor, uint256 totalSessions, uint256 totalAmount, uint256 platformFeeBasisPoints)',
  'event AgreementFunded(uint256 indexed agreementId, address indexed student, uint256 totalAmount)',
  'event SessionSettled(uint256 indexed agreementId, uint256 indexed sessionId, uint8 attendanceType, uint256 tutorPaidAmount, uint256 studentRefundAmount, uint256 platformFeeAmount, uint256 disputeWindowDeadline)',
  'event TutorFraudDisputeOpened(uint256 indexed agreementId, uint256 indexed sessionId, address indexed student, bytes32 evidenceHash)',
  'event TutorFraudDisputeResolved(uint256 indexed agreementId, uint256 indexed sessionId, bool studentRefundApproved, uint256 tutorPaidAmount, uint256 studentRefundAmount, uint256 platformFeeAmount, bytes32 auditProofHash)',
  'event AgreementRefunded(uint256 indexed agreementId, address indexed student, uint256 refundAmount)',
];
