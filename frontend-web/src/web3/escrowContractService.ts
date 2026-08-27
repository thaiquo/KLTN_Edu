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
    const tx = await escrowContract.fundAgreement(BigInt(agreementId));
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
    const res = await escrowContract.getAgreement(BigInt(agreementId));
    return {
      status: Number(res[0]),
      student: res[1],
      tutor: res[2],
      totalSessions: res[3],
      settledSessions: res[4],
      totalAmount: res[5],
      remainingDeposit: res[6],
      studentRefundedAmount: res[7],
      platformFeeBasisPoints: res[8],
      createdAtBlock: res[9],
      fundedAtBlock: res[10],
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
    const res = await escrowContract.getSessionSettlement(BigInt(agreementId), BigInt(sessionId));
    return {
      status: Number(res[0]),
      attendanceType: Number(res[1]),
      tutorPaidAmount: res[2],
      studentRefundAmount: res[3],
      platformFeeAmount: res[4],
      disputeWindowDeadline: res[5],
      createdAtBlock: res[6],
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
      BigInt(agreementId),
      BigInt(sessionId),
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
      BigInt(agreementId),
      BigInt(sessionId),
      studentRefundApproved,
      auditProofHash
    );
    return tx;
  }
}
