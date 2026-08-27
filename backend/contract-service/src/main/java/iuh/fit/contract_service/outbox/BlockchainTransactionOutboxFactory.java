package iuh.fit.contract_service.outbox;

import iuh.fit.contract_service.command.BlockchainTransactionCommand;
import iuh.fit.contract_service.entity.BlockchainTransaction;
import iuh.fit.contract_service.entity.OutboxEvent;

import java.time.OffsetDateTime;

public interface BlockchainTransactionOutboxFactory {
    OutboxEvent createIntentCreatedEvent(
            BlockchainTransactionCommand command,
            BlockchainTransaction transaction,
            OffsetDateTime occurredAt);
}
