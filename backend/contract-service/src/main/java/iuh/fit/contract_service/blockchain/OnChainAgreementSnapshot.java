package iuh.fit.contract_service.blockchain;

import java.math.BigInteger;

public record OnChainAgreementSnapshot(
        String student,
        String tutor,
        String termsHash,
        BigInteger totalAmount,
        BigInteger pricePerSession,
        BigInteger remainingAmount,
        BigInteger releasedAmount,
        BigInteger refundedAmount,
        BigInteger paymentDeadline,
        BigInteger totalSessions,
        BigInteger settledSessions,
        BigInteger openSessions,
        OnChainAgreementStatus status) {
}
