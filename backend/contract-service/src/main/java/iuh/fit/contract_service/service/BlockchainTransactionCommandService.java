package iuh.fit.contract_service.service;

import iuh.fit.contract_service.command.BlockchainTransactionCommand;
import iuh.fit.contract_service.command.BlockchainTransactionIntentResult;
import iuh.fit.contract_service.command.IdempotencyConflictException;
import iuh.fit.contract_service.entity.BlockchainTransaction;
import iuh.fit.contract_service.entity.OutboxEvent;
import iuh.fit.contract_service.outbox.BlockchainTransactionOutboxFactory;
import iuh.fit.contract_service.repository.BlockchainTransactionRepository;
import iuh.fit.contract_service.repository.OutboxEventRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;

@Service
public class BlockchainTransactionCommandService {
    private final BlockchainTransactionRepository transactionRepository;
    private final OutboxEventRepository outboxRepository;
    private final BlockchainTransactionOutboxFactory outboxFactory;
    private final TransactionTemplate transactionTemplate;

    public BlockchainTransactionCommandService(
            BlockchainTransactionRepository transactionRepository,
            OutboxEventRepository outboxRepository,
            BlockchainTransactionOutboxFactory outboxFactory,
            PlatformTransactionManager transactionManager) {
        this.transactionRepository = transactionRepository;
        this.outboxRepository = outboxRepository;
        this.outboxFactory = outboxFactory;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    public BlockchainTransactionIntentResult createIntent(BlockchainTransactionCommand command) {
        try {
            return transactionTemplate.execute(status -> createOrReturnExisting(command));
        } catch (DataIntegrityViolationException race) {
            BlockchainTransaction existing = transactionTemplate.execute(status -> transactionRepository
                    .findByIdempotencyKey(command.idempotencyKey())
                    .orElse(null));
            if (existing == null) {
                throw race;
            }
            requireSameIntent(existing, command);
            return result(existing, false);
        }
    }

    private BlockchainTransactionIntentResult createOrReturnExisting(BlockchainTransactionCommand command) {
        BlockchainTransaction existing = transactionRepository
                .findByIdempotencyKey(command.idempotencyKey())
                .orElse(null);
        if (existing != null) {
            requireSameIntent(existing, command);
            return result(existing, false);
        }

        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        BlockchainTransaction transaction = BlockchainTransaction.createIntent(
                command.idempotencyKey(),
                command.action().name(),
                command.chainId(),
                command.fromAddress(),
                command.toAddress(),
                command.calldata(),
                command.calldataHash(),
                command.agreementId(),
                command.settlementId(),
                now);
        transactionRepository.saveAndFlush(transaction);

        OutboxEvent event = outboxFactory.createIntentCreatedEvent(command, transaction, now);
        outboxRepository.saveAndFlush(event);
        return result(transaction, true);
    }

    private static void requireSameIntent(
            BlockchainTransaction existing,
            BlockchainTransactionCommand command) {
        boolean matches = existing.matchesIntent(
                command.action().name(),
                command.chainId(),
                command.fromAddress(),
                command.toAddress(),
                command.calldata(),
                command.calldataHash(),
                command.agreementId(),
                command.settlementId());
        if (!matches) {
            throw new IdempotencyConflictException(command.idempotencyKey());
        }
    }

    private static BlockchainTransactionIntentResult result(
            BlockchainTransaction transaction,
            boolean created) {
        return new BlockchainTransactionIntentResult(
                transaction.getId(),
                transaction.getIdempotencyKey(),
                transaction.getStatus(),
                created);
    }
}
