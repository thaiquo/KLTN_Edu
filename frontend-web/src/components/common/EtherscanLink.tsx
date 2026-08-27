import React from 'react';
import { ExternalLink } from 'lucide-react';
import { getExplorerTxUrl, getExplorerAddressUrl, DEFAULT_CHAIN_ID } from '../../web3/web3Config';

interface EtherscanLinkProps {
  txHash?: string;
  address?: string;
  chainId?: number;
  label?: string;
  truncateLength?: number;
  className?: string;
  showIcon?: boolean;
}

export function EtherscanLink({
  txHash,
  address,
  chainId = DEFAULT_CHAIN_ID,
  label,
  truncateLength = 6,
  className = '',
  showIcon = true,
}: EtherscanLinkProps) {
  if (!txHash && !address) {
    return <span className="text-gray-400 font-mono text-xs">N/A</span>;
  }

  const url = txHash
    ? getExplorerTxUrl(txHash, chainId)
    : getExplorerAddressUrl(address, chainId);

  const formatText = (): string => {
    if (label) return label;
    const target = txHash || address || '';
    if (target.length <= truncateLength * 2 + 2) return target;
    return `${target.slice(0, truncateLength + 2)}...${target.slice(-truncateLength)}`;
  };

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={txHash ? `Xem giao dịch trên Explorer: ${txHash}` : `Xem địa chỉ trên Explorer: ${address}`}
      className={`inline-flex items-center gap-1 font-mono text-xs text-blue-600 hover:text-blue-800 hover:underline transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-1 py-0.5 bg-blue-50/50 hover:bg-blue-100/50 ${className}`}
    >
      <span className="font-semibold">{formatText()}</span>
      {showIcon && <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-75 group-hover:opacity-100" />}
    </a>
  );
}

export default EtherscanLink;
