package iuh.fit.contract_service.repository;

import iuh.fit.contract_service.entity.BlockchainEventCursor;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface BlockchainEventCursorRepository extends JpaRepository<BlockchainEventCursor, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select cursor from BlockchainEventCursor cursor
            where cursor.chainId = :chainId
              and lower(cursor.contractAddress) = lower(:contractAddress)
            """)
    Optional<BlockchainEventCursor> lockByChainAndContract(
            @Param("chainId") Long chainId,
            @Param("contractAddress") String contractAddress);
}
