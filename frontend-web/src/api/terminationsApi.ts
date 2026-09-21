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
}
export const terminationsApi = {
  list: (): Promise<TerminationView[]> => apiRequest('/api/contracts/terminations'),
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
};
