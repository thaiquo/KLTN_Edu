package iuh.fit.contract_service.repository;

import iuh.fit.contract_service.entity.ProcessedEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface ProcessedEventRepository extends JpaRepository<ProcessedEvent, UUID> {
    java.util.List<ProcessedEvent> findByEventTypeIgnoreCaseAndChainIdAndTransactionHashIgnoreCase(
            String eventType, Long chainId, String transactionHash);
    boolean existsByChainIdAndTransactionHashIgnoreCaseAndLogIndex(
            Long chainId, String transactionHash, Long logIndex);

    boolean existsByEventTypeIgnoreCaseAndChainIdAndTransactionHashIgnoreCase(
            String eventType, Long chainId, String transactionHash);
}
