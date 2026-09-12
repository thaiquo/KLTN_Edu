package iuh.fit.contract_service.repository;

import iuh.fit.contract_service.entity.BlockchainTransaction;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BlockchainTransactionRepository extends JpaRepository<BlockchainTransaction, UUID> {
    Optional<BlockchainTransaction> findByIdempotencyKey(String idempotencyKey);

    Optional<BlockchainTransaction> findByChainIdAndTransactionHash(Long chainId, String transactionHash);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select transaction from BlockchainTransaction transaction
            where transaction.status = iuh.fit.contract_service.enums.BlockchainTransactionStatus.CREATED
              and not exists (select pending.id from BlockchainTransaction pending
                  where pending.chainId = transaction.chainId and lower(pending.fromAddress) = lower(transaction.fromAddress)
                    and pending.status in (iuh.fit.contract_service.enums.BlockchainTransactionStatus.DISPATCHING,
                        iuh.fit.contract_service.enums.BlockchainTransactionStatus.SUBMITTED))
              and (transaction.nextAttemptAt is null or transaction.nextAttemptAt <= :now)
            order by transaction.createdAt
            """)
    List<BlockchainTransaction> lockCreatedForDispatch(@Param("now") OffsetDateTime now, Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select transaction from BlockchainTransaction transaction where transaction.id = :id")
    Optional<BlockchainTransaction> lockById(@Param("id") UUID id);

    List<BlockchainTransaction> findByStatusInOrderByUpdatedAtAsc(
            List<iuh.fit.contract_service.enums.BlockchainTransactionStatus> statuses);

    List<BlockchainTransaction> findByStatusInOrderByUpdatedAtAsc(
            List<iuh.fit.contract_service.enums.BlockchainTransactionStatus> statuses,
            Pageable pageable);
}
