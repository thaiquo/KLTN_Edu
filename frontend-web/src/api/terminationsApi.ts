// @ts-ignore
import { apiRequest } from './client';

export interface TerminationItem {
  agreementId: string;
  status: string;
  lastError: string | null;
  transactionHash: string | null;
  refundedUnits: string | null;
  studentName: string;
  tokenDecimals: number;
  chainId: number | null;
  depositedUnits?: string;
  tutorPaidUnits?: string;
  platformFeeUnits?: string;
  sessionRefundedUnits?: string;
  remainingUnits?: string;
  updatedAt?: string | null;
}

export interface TerminationEvidenceView {
  id: string;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  submittedByRole: string;
  createdAt: string;
}

export interface TerminationView {
  request: {
    id: string;
    anchorAgreementId: string;
    classroomId: number;
    wholeClass: boolean;
    reason: string;
    requestedBy: string;
    status: string;
    createdAt: string;
    auditJson: string;
    lastError: string | null;
    signerWallet?: string | null;
    signature?: string | null;
    requestedAtTimestamp?: number | null;
  };
  items: TerminationItem[];
  evidence?: TerminationEvidenceView[];
}

export const terminationsApi = {
  list: (): Promise<TerminationView[]> => apiRequest('/api/contracts/terminations'),
  listRefunds: (): Promise<TerminationView[]> => apiRequest('/api/contracts/terminations/refunds'),
  request: (
    agreementId: string,
    wholeClass: boolean,
    reason: string,
    signature?: string,
    signerWallet?: string,
    requestedAtTimestamp?: number
  ): Promise<TerminationView> =>
    apiRequest('/api/contracts/terminations', {
      method: 'POST',
      body: JSON.stringify({ agreementId, wholeClass, reason, signature, signerWallet, requestedAtTimestamp }),
    }),
  act: (id: string, action: string, reason: string): Promise<TerminationView> =>
    apiRequest(`/api/contracts/terminations/${id}/actions`, { method: 'POST', body: JSON.stringify({ action, reason }) }),
  uploadEvidence: (id: string, file: File): Promise<TerminationView> => {
    const formData = new FormData();
    formData.append('file', file);
    return apiRequest(`/api/contracts/terminations/${id}/evidence`, {
      method: 'POST',
      body: formData,
    });
  },
  getEvidenceContentUrl: (caseId: string, evidenceId: string): string =>
    `/api/contracts/terminations/${caseId}/evidence/${evidenceId}/content`,
};
