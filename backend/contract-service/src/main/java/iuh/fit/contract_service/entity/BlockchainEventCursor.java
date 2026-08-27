package iuh.fit.contract_service.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.Locale;
import java.util.UUID;

@Getter
@Entity
@Table(name = "blockchain_event_cursor")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class BlockchainEventCursor {
    @Id
    private UUID id;

    @Column(name = "chain_id", nullable = false)
    private Long chainId;

    @Column(name = "contract_address", nullable = false, length = 42)
    private String contractAddress;

    @Column(name = "last_confirmed_block", nullable = false)
    private Long lastConfirmedBlock;

    @Column(name = "last_confirmed_block_hash", length = 66)
    private String lastConfirmedBlockHash;

    @Version
    @Column(nullable = false)
    private Long version;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    public static BlockchainEventCursor initialize(
            long chainId,
            String contractAddress,
            long blockBeforeStart,
            OffsetDateTime now) {
        BlockchainEventCursor cursor = new BlockchainEventCursor();
        cursor.id = UUID.randomUUID();
        cursor.chainId = chainId;
        cursor.contractAddress = contractAddress.toLowerCase(Locale.ROOT);
        cursor.lastConfirmedBlock = blockBeforeStart;
        cursor.updatedAt = now;
        return cursor;
    }

    public void advance(long expectedPreviousBlock, long blockNumber, String blockHash, OffsetDateTime now) {
        if (lastConfirmedBlock != expectedPreviousBlock) {
            throw new IllegalStateException("Blockchain cursor was advanced concurrently");
        }
        if (blockNumber <= lastConfirmedBlock) {
            throw new IllegalArgumentException("Blockchain cursor cannot move backwards");
        }
        lastConfirmedBlock = blockNumber;
        lastConfirmedBlockHash = blockHash.toLowerCase(Locale.ROOT);
        updatedAt = now;
    }
}
