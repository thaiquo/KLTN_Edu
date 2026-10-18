import { ethers } from 'ethers';
import { getContractAddresses, DEFAULT_CHAIN_ID, ERC20_ABI, ESCROW_ABI } from './web3Config';

export interface EscrowAgreementOnchain {
  status: number; // 0: NONE, 1: CREATED, 2: FUNDED, 3: COMPLETED, 4: EXPIRED, 5: CANCELLED
  student: string;
  tutor: string;
  totalSessions: bigint;
  settledSessions: bigint;
  totalAmount: bigint;
  remainingDeposit: bigint;
  studentRefundedAmount: bigint;
  platformFeeBasisPoints: bigint;
  createdAtBlock: bigint;
  fundedAtBlock: bigint;
}

export interface SessionSettlementOnchain {
  proposedOutcome: number; // 0: BOTH_PRESENT, 1: STUDENT_ABSENT_TUTOR_PRESENT, 2: TUTOR_ABSENT
  status: number; // 0: NONE, 1: PROPOSED, 2: DISPUTED, 3: SETTLED, 4: REFUNDED
  disputeDeadline: bigint;
  proposalEvidenceHash: string;
  disputeEvidenceHash: string;
  resolutionHash: string;
}

export interface DisputeOnchain {
  status: number;
  openedBy: string;
  evidenceHash: string;
  studentRefundApproved: boolean;
  auditProofHash: string;
  createdAtBlock: bigint;
  resolvedAtBlock: bigint;
}

export function computeOnchainSessionId(sessionId: number | bigint | string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(`EDUCONNECT:SESSION:${sessionId}`));
}

export const FUND_AGREEMENT_SELECTOR = '0x7aaf23f6';
export const UNSUPPORTED_DELEGATED_FUNDING_MESSAGE =
  'Ví đang gửi giao dịch ký quỹ qua cơ chế ủy quyền/delegation nên Smart Contract không nhận đúng ví học viên. Vui lòng tắt Smart Account/Delegation trong ví hoặc dùng ví EOA thông thường rồi thử lại. Không cần approve hay nạp tiền lại.';

export function formatEscrowBytes32Id(id: string | number | bigint): string {
  if (typeof id === 'string') {
    const cleaned = id.trim();
    if (cleaned.startsWith('0x') && cleaned.length === 66) {
      return cleaned;
    }
    const hexOnly = cleaned.replace(/^0x/, '').replace(/-/g, '');
    if (hexOnly.length <= 64) {
      return '0x' + hexOnly.padStart(64, '0');
    }
  }
  try {
    return ethers.zeroPadValue(ethers.toBeHex(BigInt(id)), 32);
  } catch {
    return ethers.id(String(id));
  }
}

function assertExpectedFundAgreementTransaction(
  txRequest: ethers.TransactionRequest,
  expectedEscrowAddress: string
) {
  const actualTarget = typeof txRequest.to === 'string' ? txRequest.to.toLowerCase() : '';
  const expectedTarget = expectedEscrowAddress.toLowerCase();
  if (actualTarget !== expectedTarget) {
    throw new Error(UNSUPPORTED_DELEGATED_FUNDING_MESSAGE);
  }

  const data = typeof txRequest.data === 'string' ? txRequest.data.toLowerCase() : '';
  if (!data.startsWith(FUND_AGREEMENT_SELECTOR)) {
    throw new Error('Dữ liệu giao dịch ký quỹ không khớp hàm fundAgreement(bytes32). Vui lòng tải lại trang và thử lại.');
  }
}

export class EscrowContractService {
  private chainId: number;

  constructor(chainId: number = DEFAULT_CHAIN_ID) {
    this.chainId = chainId;
  }

  public getAddresses() {
    return getContractAddresses(this.chainId);
  }

  public getEscrowContract(runner: ethers.ContractRunner) {
    const addresses = this.getAddresses();
    if (!addresses.escrow || addresses.escrow === ethers.ZeroAddress) {
      throw new Error(`Escrow contract address not configured for chainId ${this.chainId}`);
    }
    return new ethers.Contract(addresses.escrow, ESCROW_ABI, runner);
  }

  public getUsdcContract(runner: ethers.ContractRunner) {
    const addresses = this.getAddresses();
    if (!addresses.usdc || addresses.usdc === ethers.ZeroAddress) {
      throw new Error(`USDC token address not configured for chainId ${this.chainId}`);
    }
    return new ethers.Contract(addresses.usdc, ERC20_ABI, runner);
  }

  /**
   * Check allowance for Escrow contract to spend user USDC
   */
  public async getUsdcAllowance(
    runner: ethers.ContractRunner,
    ownerAddress: string
  ): Promise<bigint> {
    const usdcContract = this.getUsdcContract(runner);
    const addresses = this.getAddresses();
    return await usdcContract.allowance(ownerAddress, addresses.escrow);
  }

  /**
   * Approve Escrow contract to spend USDC
   */
  public async approveUsdc(
    signer: ethers.JsonRpcSigner,
    amount: bigint
  ): Promise<ethers.ContractTransactionResponse> {
    const usdcContract = this.getUsdcContract(signer);
    const addresses = this.getAddresses();
    const tx = await usdcContract.approve(addresses.escrow, amount);
    return tx;
  }

  /**
   * Student deposits USDC to fund the agreement on-chain
   */
  public async preflightFundAgreement(
    signer: ethers.JsonRpcSigner,
    agreementId: bigint | number | string
  ): Promise<{ formattedAgreementId: string; transaction: ethers.TransactionRequest }> {
    const escrowContract = this.getEscrowContract(signer);
    const addresses = this.getAddresses();
    const formattedAgreementId = formatEscrowBytes32Id(agreementId);

    await escrowContract.getFunction('fundAgreement').staticCall(formattedAgreementId);
    const transaction = await escrowContract.getFunction('fundAgreement').populateTransaction(formattedAgreementId);
    assertExpectedFundAgreementTransaction(transaction, addresses.escrow);

    return { formattedAgreementId, transaction };
  }

  public isExpectedEscrowTarget(target?: string | null): boolean {
    if (!target) {
      return false;
    }
    return target.toLowerCase() === this.getAddresses().escrow.toLowerCase();
  }

  public async fundAgreement(
    signer: ethers.JsonRpcSigner,
    agreementId: bigint | number | string
  ): Promise<ethers.TransactionResponse> {
    const { transaction } = await this.preflightFundAgreement(signer, agreementId);
    return await signer.sendTransaction(transaction);
  }

  /**
   * Read agreement details from on-chain Escrow
   */
  public async getAgreement(
    runner: ethers.ContractRunner,
    agreementId: bigint | number | string
  ): Promise<EscrowAgreementOnchain> {
    const escrowContract = this.getEscrowContract(runner);
    const formattedId = formatEscrowBytes32Id(agreementId);
    const res = await escrowContract.getAgreement(formattedId);
    return {
      status: Number(res.status ?? res[12] ?? 0),
      student: res.student ?? res[0],
      tutor: res.tutor ?? res[1],
      totalSessions: BigInt(res.totalSessions ?? res[9] ?? 0),
      settledSessions: BigInt(res.settledSessions ?? res[10] ?? 0),
      totalAmount: BigInt(res.totalAmount ?? res[3] ?? 0),
      remainingDeposit: BigInt(res.remainingAmount ?? res[5] ?? 0),
      studentRefundedAmount: BigInt(res.refundedAmount ?? res[7] ?? 0),
      platformFeeBasisPoints: 1500n,
      createdAtBlock: 0n,
      fundedAtBlock: 0n,
    };
  }

  /**
   * Read session settlement from on-chain Escrow
   */
  public async getSessionSettlement(
    runner: ethers.ContractRunner,
    agreementId: bigint | number | string,
    sessionId: bigint | number | string
  ): Promise<SessionSettlementOnchain> {
    const escrowContract = this.getEscrowContract(runner);
    const onchainAgreementId = formatEscrowBytes32Id(agreementId);
    const onchainSessionId = typeof sessionId === 'string' && sessionId.startsWith('0x') && sessionId.length === 66
      ? sessionId
      : computeOnchainSessionId(sessionId);
    const res = await escrowContract.getSessionSettlement(onchainAgreementId, onchainSessionId);
    return {
      proposedOutcome: Number(res.proposedOutcome ?? res[0] ?? 0),
      status: Number(res.status ?? res[1] ?? 0),
      disputeDeadline: BigInt(res.disputeDeadline ?? res[2] ?? 0),
      proposalEvidenceHash: res.proposalEvidenceHash ?? res[3] ?? '',
      disputeEvidenceHash: res.disputeEvidenceHash ?? res[4] ?? '',
      resolutionHash: res.resolutionHash ?? res[5] ?? '',
    };
  }

}
