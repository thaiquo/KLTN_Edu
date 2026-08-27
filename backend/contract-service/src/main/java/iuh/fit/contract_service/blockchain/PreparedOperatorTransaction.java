package iuh.fit.contract_service.blockchain;

import java.math.BigInteger;

public record PreparedOperatorTransaction(
        BigInteger nonce,
        String transactionHash,
        String signedRawTransaction) {
}
