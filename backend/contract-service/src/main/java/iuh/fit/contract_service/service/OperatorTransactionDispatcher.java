package iuh.fit.contract_service.service;

import iuh.fit.contract_service.blockchain.OperatorTransactionGateway;
import iuh.fit.contract_service.blockchain.PreparedOperatorTransaction;
import iuh.fit.contract_service.entity.BlockchainTransaction;
import iuh.fit.contract_service.repository.BlockchainTransactionRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

public class OperatorTransactionDispatcher {
    private static final Duration RECONCILIATION_DELAY = Duration.ofSeconds(5);

    private final BlockchainTransactionRepository repository;
    private final OperatorTransactionGateway gateway;
    private final TransactionTemplate transactionTemplate;

    public OperatorTransactionDispatcher(
            BlockchainTransactionRepository repository,
            OperatorTransactionGateway gateway,
            PlatformTransactionManager transactionManager) {
        this.repository = repository;
        this.gateway = gateway;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    public Optional<UUID> dispatchNext() {
        BlockchainTransaction transaction = transactionTemplate.execute(status -> {
            OffsetDateTime now = now();
            return repository.lockCreatedForDispatch(now, PageRequest.of(0, 1)).stream()
                    .findFirst()
                    .map(candidate -> {
                        candidate.claimForDispatch(now);
                        repository.saveAndFlush(candidate);
                        return candidate;
                    })
                    .orElse(null);
        });
        if (transaction == null) {
            return Optional.empty();
        }

        PreparedOperatorTransaction prepared;
        try {
            prepared = gateway.prepare(
                    transaction.getChainId(),
                    transaction.getFromAddress(),
                    transaction.getToAddress(),
                    transaction.getCalldata());
            transactionTemplate.executeWithoutResult(status -> {
                BlockchainTransaction locked = lock(transaction.getId());
                locked.recordPreparedTransaction(
                        prepared.nonce(), prepared.transactionHash(), prepared.signedRawTransaction(), now());
                repository.saveAndFlush(locked);
            });
        } catch (RuntimeException preparationFailure) {
            transactionTemplate.executeWithoutResult(status -> {
                BlockchainTransaction locked = lock(transaction.getId());
                locked.failBeforeBroadcast(safeMessage(preparationFailure), now());
                repository.saveAndFlush(locked);
            });
            throw preparationFailure;
        }

        try {
            String transactionHash = gateway.broadcast(prepared);
            transactionTemplate.executeWithoutResult(status -> {
                BlockchainTransaction locked = lock(transaction.getId());
                locked.markSubmitted(transactionHash, now());
                repository.saveAndFlush(locked);
            });
        } catch (RuntimeException uncertainBroadcast) {
            transactionTemplate.executeWithoutResult(status -> {
                BlockchainTransaction locked = lock(transaction.getId());
                OffsetDateTime current = now();
                locked.recordUncertainBroadcast(
                        safeMessage(uncertainBroadcast), current.plus(RECONCILIATION_DELAY), current);
                repository.saveAndFlush(locked);
            });
        }
        return Optional.of(transaction.getId());
    }

    private BlockchainTransaction lock(UUID id) {
        return repository.lockById(id).orElseThrow(() ->
                new IllegalStateException("Blockchain transaction disappeared during dispatch: " + id));
    }

    private static OffsetDateTime now() {
        return OffsetDateTime.now(ZoneOffset.UTC);
    }

    private static String safeMessage(Throwable throwable) {
        String message = throwable.getMessage();
        if (message == null || message.isBlank()) {
            return throwable.getClass().getSimpleName();
        }
        return message.length() <= 1_000 ? message : message.substring(0, 1_000);
    }
}
