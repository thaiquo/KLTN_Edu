/**
 * API client for Contract/Escrow management.
 * Maps to ContractManagementController endpoints in contract-service.
 */
// @ts-ignore — client.js is a plain JS module
import { apiRequest } from "./client";

// ─── Types ───────────────────────────────────────────

export interface AgreementSummary {
  id: string;
  onchainAgreementId: string | null;
  classroomId: number;
  studentId: number;
  tutorId: number;
  studentWallet: string;
  tutorWallet: string;
  platformWallet: string;
  tokenSymbol: string;
  totalAmountUsdc: number;
  pricePerSessionUsdc: number;
  totalSessions: number;
  settledSessions: number;
  status: string;
  createdAt: string;
  paymentDeadline: string | null;
  chainId: number | null;
  escrowContractAddress: string | null;
  classroomReviewerEmail: string | null;
}

export interface AgreementDetail {
  summary: AgreementSummary;
  termsHash: string;
  contractVersion: number;
  totalPriceVnd: number;
}

export interface SettlementDto {
  id: string;
  sessionId: number;
  onchainSessionId: string;
  outcome: string;
  amountUsdc: number;
  status: string;
  proposeTxHash: string | null;
  finalizeTxHash: string | null;
  disputeDeadline: string | null;
  createdAt: string;
}

export interface BlockchainTxDto {
  id: string;
  action: string;
  transactionHash: string | null;
  status: string;
  blockNumber: number | null;
  receiptStatus: number | null;
  agreementId: string | null;
  settlementId: string | null;
  chainId: number;
  createdAt: string;
  updatedAt: string;
  errorMessage: string | null;
}

export interface DisputeDto {
  id: string;
  agreementId: string;
  onchainAgreementId: string | null;
  settlementId: string;
  sessionId: number;
  complainantId: number;
  type: string;
  status: string;
  submittedAt: string;
  resolution: string | null;
  resolutionReason: string | null;
  resolvedByEmail: string | null;
  resolvedByRole: string | null;
  resolvedAt: string | null;
  openTxHash: string | null;
  resolveTxHash: string | null;
  tutorResponse: string | null;
  studentWallet: string;
  tutorWallet: string;
  classroomReviewerEmail: string | null;
  disputeDeadline: string | null;
  createdAt: string;
}

export interface PagedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

// ─── API Functions ────────────────────────────────────

export const contractsApi = {
  /**
   * List agreements - filtered by role on backend via JWT headers.
   */
  listAgreements(params?: { status?: string; page?: number; size?: number }): Promise<PagedResponse<AgreementSummary>> {
    const query = new URLSearchParams();
    if (params?.status) query.set("status", params.status);
    if (params?.page !== undefined) query.set("page", String(params.page));
    if (params?.size !== undefined) query.set("size", String(params.size));
    const qs = query.toString() ? `?${query.toString()}` : "";
    return apiRequest(`/api/contracts/agreements${qs}`);
  },

  getAgreement(id: string): Promise<AgreementDetail> {
    return apiRequest(`/api/contracts/agreements/${id}`);
  },

  getSettlements(agreementId: string): Promise<SettlementDto[]> {
    return apiRequest(`/api/contracts/agreements/${agreementId}/settlements`);
  },

  getAgreementTransactions(agreementId: string): Promise<BlockchainTxDto[]> {
    return apiRequest(`/api/contracts/agreements/${agreementId}/transactions`);
  },

  listDisputes(params?: { status?: string; page?: number; size?: number }): Promise<PagedResponse<DisputeDto>> {
    const query = new URLSearchParams();
    if (params?.status) query.set("status", params.status);
    if (params?.page !== undefined) query.set("page", String(params.page));
    if (params?.size !== undefined) query.set("size", String(params.size));
    const qs = query.toString() ? `?${query.toString()}` : "";
    return apiRequest(`/api/contracts/disputes${qs}`);
  },

  getDispute(id: string): Promise<DisputeDto> {
    return apiRequest(`/api/contracts/disputes/${id}`);
  },

  resolveDispute(id: string, approved: boolean, reason: string): Promise<{ success: boolean; resolution: string; transactionStatus: string }> {
    return apiRequest(`/api/contracts/disputes/${id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved, reason }),
    });
  },

  initiateAgreement(payload: {
    classroomId: number;
    studentId?: number;
    studentEmail?: string;
    tutorId?: number;
    tutorEmail?: string;
    studentWallet: string;
    tutorWallet: string;
    pricePerSessionVnd?: number;
    totalSessions?: number;
    classroomReviewerEmail?: string;
  }): Promise<AgreementDetail> {
    return apiRequest(`/api/contracts/agreements/initiate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },

  signAgreement(id: string, payload: { role?: string; walletAddress: string; signature?: string; userEmail?: string; studentEmail?: string }): Promise<AgreementDetail> {
    return apiRequest(`/api/contracts/agreements/${id}/sign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },

  submitPayment(id: string, txHash?: string): Promise<AgreementDetail> {
    return apiRequest(`/api/contracts/agreements/${id}/payment-submitted`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ txHash }),
    });
  },

  getAcceptances(id: string): Promise<Array<{
    id: string;
    agreementId: string;
    userId: number;
    role: string;
    walletAddress: string;
    acceptedAt: string;
    termsHash: string;
    contractVersion: number;
  }>> {
    return apiRequest(`/api/contracts/agreements/${id}/acceptances`);
  },

  listAllTransactions(params?: { page?: number; size?: number }): Promise<PagedResponse<BlockchainTxDto>> {
    const query = new URLSearchParams();
    if (params?.page !== undefined) query.set("page", String(params.page));
    if (params?.size !== undefined) query.set("size", String(params.size));
    const qs = query.toString() ? `?${query.toString()}` : "";
    return apiRequest(`/api/contracts/transactions${qs}`);
  },
};
