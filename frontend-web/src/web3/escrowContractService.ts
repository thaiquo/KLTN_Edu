import { ethers } from 'ethers';
import { getContractAddresses, DEFAULT_CHAIN_ID, ERC20_ABI, ESCROW_ABI } from './web3Config';

export interface EscrowAgreementOnchain {
  status: number; // 0: NONE, 1: REGISTERED, 2: FUNDED, 3: COMPLETED, 4: REFUNDED, 5: CANCELLED
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
  status: number;
  attendanceType: number;
  tutorPaidAmount: bigint;
  studentRefundAmount: bigint;
  platformFeeAmount: bigint;
  disputeWindowDeadline: bigint;
  createdAtBlock: bigint;
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

function toBytes32(id: string | number | bigint): string {
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
  public async fundAgreement(
    signer: ethers.JsonRpcSigner,
    agreementId: bigint | number | string
  ): Promise<ethers.ContractTransactionResponse> {
    const escrowContract = this.getEscrowContract(signer);
    const formattedId = toBytes32(agreementId);
    const tx = await escrowContract.fundAgreement(formattedId);
    return tx;
  }

  /**
   * Read agreement details from on-chain Escrow
   */
  public async getAgreement(
    runner: ethers.ContractRunner,
    agreementId: bigint | number | string
  ): Promise<EscrowAgreementOnchain> {
    const escrowContract = this.getEscrowContract(runner);
    const formattedId = toBytes32(agreementId);
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
    const res = await escrowContract.getSessionSettlement(toBytes32(agreementId), toBytes32(sessionId));
    return {
      status: Number(res.status ?? res[6] ?? 0),
      attendanceType: Number(res.outcome ?? res[0] ?? 0),
      tutorPaidAmount: BigInt(res.tutorAmount ?? res[1] ?? 0),
      studentRefundAmount: BigInt(res.studentRefund ?? res[2] ?? 0),
      platformFeeAmount: BigInt(res.platformFee ?? res[3] ?? 0),
      disputeWindowDeadline: BigInt(res.disputeDeadline ?? res[4] ?? 0),
      createdAtBlock: 0n,
    };
  }

  /**
   * Open tutor fraud dispute (student)
   */
  public async openTutorFraudDispute(
    signer: ethers.JsonRpcSigner,
    agreementId: bigint | number | string,
    sessionId: bigint | number | string,
    evidenceHash: string
  ): Promise<ethers.ContractTransactionResponse> {
    const escrowContract = this.getEscrowContract(signer);
    const tx = await escrowContract.openTutorFraudDispute(
      toBytes32(agreementId),
      toBytes32(sessionId),
      evidenceHash
    );
    return tx;
  }

  /**
   * Resolve tutor fraud dispute (admin/staff)
   */
  public async resolveTutorFraudDispute(
    signer: ethers.JsonRpcSigner,
    agreementId: bigint | number | string,
    sessionId: bigint | number | string,
    studentRefundApproved: boolean,
    auditProofHash: string
  ): Promise<ethers.ContractTransactionResponse> {
    const escrowContract = this.getEscrowContract(signer);
    const tx = await escrowContract.resolveTutorFraudDispute(
      toBytes32(agreementId),
      toBytes32(sessionId),
      studentRefundApproved,
      auditProofHash
    );
    return tx;
  }
}
