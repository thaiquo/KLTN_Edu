package iuh.fit.contract_service.entity;

import iuh.fit.contract_service.blockchain.BlockchainLog;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.Locale;
import java.util.UUID;

@Getter
@Entity
@Table(name = "processed_event")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ProcessedEvent {
    @Id
    private UUID id;

    @Column(name = "consumer_name", nullable = false, length = 120)
    private String consumerName;

    @Column(name = "event_id", nullable = false)
    private UUID eventId;

    @Column(name = "event_type", nullable = false, length = 120)
    private String eventType;

    @Column(name = "processed_at", nullable = false)
    private OffsetDateTime processedAt;

    @Column(name = "chain_id")
    private Long chainId;

    @Column(name = "contract_address", length = 42)
    private String contractAddress;

    @Column(name = "transaction_hash", length = 66)
    private String transactionHash;

    @Column(name = "log_index")
    private Long logIndex;

    @Column(name = "block_number")
    private Long blockNumber;

    @Column(name = "block_hash", length = 66)
    private String blockHash;

    @Column(name = "decoded_payload", columnDefinition = "TEXT")
    private String decodedPayload;

    public static ProcessedEvent blockchainLog(
            long chainId,
            String contractAddress,
            BlockchainLog log,
            String eventType,
            String decodedPayload,
            OffsetDateTime now) {
        String identity = chainId + ":" + log.transactionHash().toLowerCase(Locale.ROOT) + ":" + log.logIndex();
        ProcessedEvent event = new ProcessedEvent();
        event.id = UUID.randomUUID();
        event.eventId = UUID.nameUUIDFromBytes(identity.getBytes(StandardCharsets.UTF_8));
        event.consumerName = "educonnect-escrow-chain-" + chainId;
        event.eventType = eventType;
        event.processedAt = now;
        event.chainId = chainId;
        event.contractAddress = contractAddress.toLowerCase(Locale.ROOT);
        event.transactionHash = log.transactionHash().toLowerCase(Locale.ROOT);
        event.logIndex = log.logIndex();
        event.blockNumber = log.blockNumber();
        event.blockHash = log.blockHash().toLowerCase(Locale.ROOT);
        event.decodedPayload = decodedPayload;
        return event;
    }
}
