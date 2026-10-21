export interface WalletAdapter {
  connect(): Promise<string>;
  disconnect(): Promise<void>;
  getAddress(): Promise<string | null>;
  getChainId(): Promise<number | null>;
  signMessage(message: string): Promise<string>;
  signTypedData(domain: unknown, types: unknown, value: unknown): Promise<string>;
  sendTransaction(transaction: { to: string; data: string; value?: string }): Promise<string>;
}
