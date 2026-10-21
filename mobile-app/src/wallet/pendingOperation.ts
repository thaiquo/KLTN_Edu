import { api } from '../api/client';
import { platformStorage } from '../storage/platformStorage';

const KEY = 'educonnect.pending-chain.v1';

export interface PendingOperation {
  userId: number;
  agreementId: string;
  operation: 'SIGN_AGREEMENT' | 'APPROVE_USDC' | 'FUND_AGREEMENT';
  chainId: number;
  contractAddress: string;
  transactionHash?: string;
  createdAt: string;
}

interface AgreementState {
  summary: { id: string; chainId: number; escrowContractAddress: string; status: string; fundedTxHash?: string | null };
}

async function read(): Promise<PendingOperation[]> {
  const raw = await platformStorage.getItem(KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as PendingOperation[]; } catch { return []; }
}

export const pendingOperationStore = {
  async save(operation: PendingOperation) {
    const existing = await read();
    const next = existing.filter(item => item.agreementId !== operation.agreementId || item.operation !== operation.operation);
    next.push(operation);
    await platformStorage.setItem(KEY, JSON.stringify(next));
  },
  async list(userId: number) { return (await read()).filter(item => item.userId === userId); },
  async clear(userId: number, agreementId?: string) {
    const next = (await read()).filter(item => item.userId !== userId || (agreementId != null && item.agreementId !== agreementId));
    if (next.length) await platformStorage.setItem(KEY, JSON.stringify(next));
    else await platformStorage.deleteItem(KEY);
  },
  async reconcile(userId: number) {
    const operations = await this.list(userId);
    for (const operation of operations) {
      try {
        const agreement = await api.request<AgreementState>(`/api/contracts/agreements/${operation.agreementId}`);
        const summary = agreement.summary;
        if (summary.chainId !== operation.chainId
            || summary.escrowContractAddress.toLowerCase() !== operation.contractAddress.toLowerCase()) continue;
        if (operation.operation === 'FUND_AGREEMENT' && operation.transactionHash
            && ['WAITING_PAYMENT', 'PAYMENT_CONFIRMING'].includes(summary.status)) {
          await api.request(`/api/contracts/agreements/${operation.agreementId}/payment-submitted`, {
            method: 'POST', body: JSON.stringify({ txHash: operation.transactionHash }),
          });
        }
        if (['ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED'].includes(summary.status)) {
          await this.clear(userId, operation.agreementId);
        }
      } catch {
        // Keep the durable operation for the next foreground/online recovery attempt.
      }
    }
  },
};
