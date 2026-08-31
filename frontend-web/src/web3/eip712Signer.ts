import { BrowserProvider } from "ethers";
import { DEFAULT_CHAIN_ID } from "./web3Config";

export const EIP712_DOMAIN_NAME = "EduConnect Platform";
export const EIP712_DOMAIN_VERSION = "1";

export interface SignableContractAgreement {
  id: string;
  tutorWallet: string;
  studentWallet: string;
  totalAmountUsdcUnits?: string | number;
  totalAmountUsdc?: number;
  termsHash?: string;
  createdAt?: string;
  chainId?: number;
  escrowContractAddress?: string;
}

/**
 * Prompts MetaMask to sign an EIP-712 Typed Data structure representing the contract agreement.
 * Completely gasless (0 ETH/Sepolia).
 */
export async function signContractAgreementEip712(
  agreement: SignableContractAgreement,
  activeAccount: string
): Promise<string> {
  if (typeof window === "undefined" || !(window as any).ethereum) {
    throw new Error("Không tìm thấy tiện ích ví MetaMask trên trình duyệt.");
  }

  const provider = new BrowserProvider((window as any).ethereum);
  const signer = await provider.getSigner();
  const signerAddress = await signer.getAddress();

  if (signerAddress.toLowerCase() !== activeAccount.toLowerCase()) {
    throw new Error(
      `Ví MetaMask (${signerAddress.slice(0, 6)}...${signerAddress.slice(-4)}) không khớp với ví cần ký (${activeAccount.slice(0, 6)}...${activeAccount.slice(-4)}). Vui lòng chuyển đúng tài khoản ví trong MetaMask.`
    );
  }

  const chainId = agreement.chainId || DEFAULT_CHAIN_ID;
  const verifyingContract =
    agreement.escrowContractAddress ||
    import.meta.env.VITE_ESCROW_CONTRACT_ADDRESS ||
    "0x984bEc42561BBC9f63BEE4BA1469872cD369d3b3";

  const domain = {
    name: EIP712_DOMAIN_NAME,
    version: EIP712_DOMAIN_VERSION,
    chainId: chainId,
    verifyingContract: verifyingContract,
  };

  const types = {
    ClassContract: [
      { name: "contractId", type: "string" },
      { name: "tutorAddress", type: "address" },
      { name: "studentAddress", type: "address" },
      { name: "totalAmountUsdc", type: "uint256" },
      { name: "termsHash", type: "bytes32" },
      { name: "createdAt", type: "uint256" },
    ],
  };

  const createdAtTimestamp = agreement.createdAt
    ? Math.floor(new Date(agreement.createdAt).getTime() / 1000)
    : Math.floor(Date.now() / 1000);

  // Convert amount to 6-decimal units (USDC)
  let totalAmountUnits: bigint;
  if (agreement.totalAmountUsdcUnits) {
    totalAmountUnits = BigInt(agreement.totalAmountUsdcUnits.toString());
  } else if (agreement.totalAmountUsdc) {
    totalAmountUnits = BigInt(Math.round(agreement.totalAmountUsdc * 1_000_000));
  } else {
    totalAmountUnits = 0n;
  }

  const rawHash = agreement.termsHash || "0x0000000000000000000000000000000000000000000000000000000000000000";
  const termsHashFormatted = rawHash.startsWith("0x") ? rawHash : `0x${rawHash}`;

  const value = {
    contractId: agreement.id,
    tutorAddress: agreement.tutorWallet,
    studentAddress: agreement.studentWallet,
    totalAmountUsdc: totalAmountUnits,
    termsHash: termsHashFormatted,
    createdAt: createdAtTimestamp,
  };

  const signature = await signer.signTypedData(domain, types, value);
  return signature;
}
