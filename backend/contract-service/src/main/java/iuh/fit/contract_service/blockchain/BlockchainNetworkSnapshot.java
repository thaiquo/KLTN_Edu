package iuh.fit.contract_service.blockchain;

import java.math.BigInteger;

public record BlockchainNetworkSnapshot(
        BigInteger chainId,
        String escrowAddress,
        String tokenAddress,
        int tokenDecimals,
        String platformWallet) {
}
