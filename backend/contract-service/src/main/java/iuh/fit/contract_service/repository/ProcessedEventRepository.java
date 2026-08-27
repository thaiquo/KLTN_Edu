package iuh.fit.contract_service.repository;

import iuh.fit.contract_service.entity.ProcessedEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface ProcessedEventRepository extends JpaRepository<ProcessedEvent, UUID> {
    boolean existsByChainIdAndTransactionHashIgnoreCaseAndLogIndex(
            Long chainId, String transactionHash, Long logIndex);
}
