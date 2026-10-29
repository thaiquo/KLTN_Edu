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

export interface TutorAbsenceProbation {
  id: string;
  classroomId: number;
  sourceCaseId: string;
  sessionSequence: number;
  sessionStartAt: string;
  status: 'ACTIVE' | 'PASSED' | 'FAILED' | 'CANCELLED';
  failureCaseId?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
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
    origin?: 'PARTY_REQUEST' | 'AUTO_TUTOR_ABSENCE' | 'AUTO_TUTOR_ABSENCE_RELAPSE' | 'SYSTEM_REVIEW' | 'ADMIN_DIRECT' | string;
    responseDeadline?: string | null;
    tutorRespondedAt?: string | null;
    createdAt: string;
    auditJson: string;
    lastError: string | null;
    signerWallet?: string | null;
    signature?: string | null;
    requestedAtTimestamp?: number | null;
    absenceGovernanceVersion?: number | null;
    triggerSessionSequence?: number | null;
    nextSessionSequence?: number | null;
    nextSessionStartAt?: string | null;
    decisionDeadline?: string | null;
    autoDecisionAt?: string | null;
    autoDecisionReason?: string | null;
  };
  items: TerminationItem[];
  evidence?: TerminationEvidenceView[];
  probation?: TutorAbsenceProbation | null;
  serverNow?: string;
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
  adminRequest: (
    agreementId: string,
    wholeClass: boolean,
    reason: string,
    approveImmediately: boolean
  ): Promise<TerminationView> =>
    apiRequest('/api/contracts/terminations/admin', {
      method: 'POST',
      body: JSON.stringify({ agreementId, wholeClass, reason, approveImmediately }),
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
