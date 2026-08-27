package iuh.fit.contract_service.blockchain;

import java.math.BigInteger;

public enum OnChainAgreementStatus {
    NONE,
    CREATED,
    FUNDED,
    COMPLETED,
    EXPIRED,
    CANCELLED;

    public static OnChainAgreementStatus fromValue(BigInteger value) {
        int ordinal;
        try {
            ordinal = value.intValueExact();
        } catch (ArithmeticException exception) {
            throw new BlockchainConfigurationException("Invalid on-chain agreement status " + value, exception);
        }
        if (ordinal < 0 || ordinal >= values().length) {
            throw new BlockchainConfigurationException("Unknown on-chain agreement status " + value);
        }
        return values()[ordinal];
    }
}
