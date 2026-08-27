package iuh.fit.contract_service.command;

import iuh.fit.contract_service.enums.BlockchainTransactionStatus;

import java.util.UUID;

public record BlockchainTransactionIntentResult(
        UUID transactionId,
        String idempotencyKey,
        BlockchainTransactionStatus status,
        boolean created) {
}
