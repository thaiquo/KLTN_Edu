/**
 * API client for Contract/Escrow management.
 * Maps to ContractManagementController endpoints in contract-service.
 */
// @ts-ignore — client.js is a plain JS module
import { apiBlobRequest, apiRequest } from "./client";

// ─── Types ───────────────────────────────────────────

export interface AgreementSummary {
  id: string;
  onchainAgreementId: string | null;
  classroomId: number;
  className?: string | null;
  studentId: number;
  studentName?: string | null;
  studentEmail?: string | null;
  studentPhone?: string | null;
  tutorId: number;
  tutorName?: string | null;
  tutorEmail?: string | null;
  tutorPhone?: string | null;
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

export interface ContractDocumentParty {
  fullName: string | null;
  email: string | null;
  phone: string | null;
  walletAddress: string | null;
}

export interface ContractSignatureProof {
  signed: boolean;
  role: "TUTOR" | "STUDENT";
  walletAddress: string | null;
  signature: string | null;
  acceptedAt: string | null;
  termsHash: string | null;
  contractVersion: number | null;
}

export interface ContractDocumentView {
  agreementId: string;
  onchainAgreementId: string | null;
  className: string | null;
  tutor: ContractDocumentParty;
  student: ContractDocumentParty;
  platform: {
    walletAddress: string | null;
    chainId: number | null;
    escrowContractAddress: string | null;
    tokenAddress: string | null;
  };
  financialTerms: {
    tokenSymbol: string;
    tokenDecimals: number;
    totalAmountUsdc: string;
    pricePerSessionUsdc: string;
    totalPriceVnd: string;
    pricePerSessionVnd: string | null;
    vndPerUsdc: string;
    totalSessions: number;
  };
  learningTerms: {
    learningMode: string | null;
    meetingPlatform: string | null;
    meetingLink: string | null;
    learningAddress: string | null;
    courseStartDate: string | null;
    courseEndDate: string | null;
    durationPerSessionMinutes: number | null;
    schedules: Array<{ dayOfWeek: number; startTime: string; endTime: string }>;
    syllabus: Array<{ order: number; title: string | null; description: string | null; expectedSessions: number | null }>;
  };
  escrowPolicy: {
    paymentWindowHours: number | null;
    tutorPayoutBps: number | null;
    platformFeeBps: number | null;
    settlementRule: string | null;
  };
  termsHash: string;
  termsJson: string;
  contractVersion: number;
  status: string;
  createdAt: string;
  paymentDeadline: string | null;
  tutorSignature: ContractSignatureProof;
  studentSignature: ContractSignatureProof;
}

export interface ContractDocumentArtifact {
  agreementId: string;
  contractVersion: number;
  templateVersion: string;
  status: "GENERATING" | "READY" | "FAILED";
  pdfSha256: string | null;
  pdfSize: number | null;
  generatedAt: string | null;
  failureCode: string | null;
  failureMessage: string | null;
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
   * List agreements - filtered by role on backend via JWT headers or params.
   */
  listAgreements(params?: { status?: string; page?: number; size?: number; userId?: number; role?: string; email?: string }): Promise<PagedResponse<AgreementSummary>> {
    const query = new URLSearchParams();
    if (params?.status) query.set("status", params.status);
    if (params?.page !== undefined) query.set("page", String(params.page));
    if (params?.size !== undefined) query.set("size", String(params.size));
    if (params?.userId) query.set("userId", String(params.userId));
    if (params?.role) query.set("role", params.role);
    if (params?.email) query.set("email", params.email);
    const qs = query.toString() ? `?${query.toString()}` : "";
    return apiRequest(`/api/contracts/agreements${qs}`);
  },

  getAgreement(id: string): Promise<AgreementDetail> {
    return apiRequest(`/api/contracts/agreements/${id}`);
  },

  getContractDocument(id: string, params?: { userId?: number; role?: string; email?: string }): Promise<ContractDocumentView> {
    const query = new URLSearchParams();
    if (params?.userId) query.set("userId", String(params.userId));
    if (params?.role) query.set("role", params.role);
    if (params?.email) query.set("email", params.email);
    const qs = query.toString() ? `?${query.toString()}` : "";
    return apiRequest(`/api/contracts/agreements/${id}/document-view${qs}`);
  },

  getContractDocumentArtifact(id: string): Promise<ContractDocumentArtifact> {
    return apiRequest(`/api/contracts/agreements/${id}/document-artifact`);
  },

  finalizeContractDocument(id: string): Promise<ContractDocumentArtifact> {
    return apiRequest(`/api/contracts/agreements/${id}/document-artifact/finalize`, { method: "POST" });
  },

  getContractDocumentFile(id: string, format: "pdf" | "docx" = "pdf"): Promise<Blob> {
    return apiBlobRequest(`/api/contracts/agreements/${id}/document-artifact/download?format=${format}`);
  },

  getSettlements(agreementId: string): Promise<SettlementDto[]> {
    return apiRequest(`/api/contracts/agreements/${agreementId}/settlements`);
  },

  getAcceptances(agreementId: string): Promise<any[]> {
    return apiRequest(`/api/contracts/agreements/${agreementId}/acceptances`);
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
    className: string;
    studentId: number;
    studentName: string;
    studentEmail: string;
    studentPhone: string;
    tutorId: number;
    tutorName: string;
    tutorEmail: string;
    tutorPhone?: string;
    studentWallet: string;
    tutorWallet: string;
    pricePerSessionVnd?: number;
    totalSessions?: number;
    classroomReviewerEmail?: string;
    classDescription?: string;
    learningMode: "ONLINE" | "OFFLINE";
    meetingLink?: string;
    learningAddress?: string;
    courseStartDate: string;
    courseEndDate: string;
    durationPerSessionMinutes: number;
    schedules: Array<{ dayOfWeek: number; startTime: string; endTime: string }>;
    syllabus: Array<{ order: number; title?: string; description?: string; expectedSessions?: number }>;
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
    signature: string | null;
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
