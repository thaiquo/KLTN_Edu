package iuh.fit.contract_service.outbox;

import iuh.fit.contract_service.command.BlockchainTransactionCommand;
import iuh.fit.contract_service.entity.BlockchainTransaction;
import iuh.fit.contract_service.entity.OutboxEvent;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

import java.time.OffsetDateTime;
import java.util.UUID;

@Component
public class JsonBlockchainTransactionOutboxFactory implements BlockchainTransactionOutboxFactory {
    public static final String EVENT_TYPE = "blockchain.transaction.intent.created.v1";
    public static final String AGGREGATE_TYPE = "BLOCKCHAIN_TRANSACTION";

    private final ObjectMapper objectMapper;

    public JsonBlockchainTransactionOutboxFactory(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public OutboxEvent createIntentCreatedEvent(
            BlockchainTransactionCommand command,
            BlockchainTransaction transaction,
            OffsetDateTime occurredAt) {
        IntentCreatedPayload payload = new IntentCreatedPayload(
                transaction.getId(),
                command.idempotencyKey(),
                command.action().name(),
                command.chainId(),
                command.fromAddress(),
                command.toAddress(),
                command.calldataHash(),
                command.agreementId(),
                command.settlementId());
        try {
            return OutboxEvent.create(
                    EVENT_TYPE,
                    AGGREGATE_TYPE,
                    transaction.getId().toString(),
                    command.correlationId(),
                    objectMapper.writeValueAsString(payload),
                    occurredAt);
        } catch (JacksonException exception) {
            throw new IllegalStateException("Could not serialize blockchain transaction outbox event", exception);
        }
    }

    private record IntentCreatedPayload(
            UUID transactionId,
            String idempotencyKey,
            String action,
            long chainId,
            String fromAddress,
            String toAddress,
            String calldataHash,
            UUID agreementId,
            UUID settlementId) {
    }
}
