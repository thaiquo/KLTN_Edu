package iuh.fit.contract_service.service;

import iuh.fit.contract_service.blockchain.BlockchainBlock;
import iuh.fit.contract_service.blockchain.BlockchainEventRpcClient;
import iuh.fit.contract_service.blockchain.BlockchainLog;
import iuh.fit.contract_service.blockchain.BlockchainReorgDetectedException;
import iuh.fit.contract_service.blockchain.DecodedEscrowEvent;
import iuh.fit.contract_service.blockchain.EduConnectEscrowEventDecoder;
import iuh.fit.contract_service.config.BlockchainProperties;
import iuh.fit.contract_service.entity.BlockchainEventCursor;
import iuh.fit.contract_service.entity.ProcessedEvent;
import iuh.fit.contract_service.repository.BlockchainEventCursorRepository;
import iuh.fit.contract_service.repository.ProcessedEventRepository;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

import java.math.BigInteger;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

public class BlockchainEventIngestionService {
    private final BlockchainProperties properties;
    private final BlockchainEventRpcClient rpcClient;
    private final EduConnectEscrowEventDecoder decoder;
    private final BlockchainEventCursorRepository cursorRepository;
    private final ProcessedEventRepository eventRepository;
    private final ObjectMapper objectMapper;
    private final TransactionTemplate transactionTemplate;

    public BlockchainEventIngestionService(
            BlockchainProperties properties,
            BlockchainEventRpcClient rpcClient,
            EduConnectEscrowEventDecoder decoder,
            BlockchainEventCursorRepository cursorRepository,
            ProcessedEventRepository eventRepository,
            ObjectMapper objectMapper,
            PlatformTransactionManager transactionManager) {
        this.properties = properties;
        this.rpcClient = rpcClient;
        this.decoder = decoder;
        this.cursorRepository = cursorRepository;
        this.eventRepository = eventRepository;
        this.objectMapper = objectMapper;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    public int scanNextConfirmedRange() {
        BigInteger actualChainId = rpcClient.getChainId();
        if (!actualChainId.equals(BigInteger.valueOf(properties.getChainId()))) {
            throw new IllegalStateException("Event RPC chain ID does not match configured chain ID");
        }
        long latestBlock = rpcClient.getLatestBlockNumber().longValueExact();
        long safeHead = latestBlock - properties.getConfirmations() + 1L;
        if (safeHead < properties.getStartBlock()) {
            return 0;
        }
        Integer result = transactionTemplate.execute(status -> scanLocked(safeHead));
        return result == null ? 0 : result;
    }

    private int scanLocked(long safeHead) {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        BlockchainEventCursor cursor = cursorRepository.lockByChainAndContract(
                        properties.getChainId(), properties.getEscrowAddress())
                .orElseGet(() -> cursorRepository.saveAndFlush(BlockchainEventCursor.initialize(
                        properties.getChainId(),
                        properties.getEscrowAddress(),
                        properties.getStartBlock() - 1L,
                        now)));

        verifyCursorHash(cursor);
        long fromBlock = Math.max(properties.getStartBlock(), cursor.getLastConfirmedBlock() + 1L);
        if (fromBlock > safeHead) {
            return 0;
        }
        long toBlock = Math.min(
                safeHead,
                Math.addExact(fromBlock, properties.getEventBlockBatchSize() - 1L));
        Map<Long, String> blockHashes = new HashMap<>();
        int persisted = 0;
        for (BlockchainLog log : rpcClient.getLogs(fromBlock, toBlock, properties.getEscrowAddress()).stream()
                .sorted(Comparator.comparingLong(BlockchainLog::blockNumber)
                        .thenComparingLong(BlockchainLog::logIndex))
                .toList()) {
            validateLog(log, fromBlock, toBlock, blockHashes);
            DecodedEscrowEvent event = decoder.decode(log).orElse(null);
            if (event == null) {
                continue;
            }
            if (eventRepository.existsByChainIdAndTransactionHashIgnoreCaseAndLogIndex(
                    properties.getChainId(), log.transactionHash(), log.logIndex())) {
                continue;
            }
            eventRepository.save(ProcessedEvent.blockchainLog(
                    properties.getChainId(),
                    properties.getEscrowAddress(),
                    log,
                    event.type().name(),
                    serialize(event),
                    now));
            persisted++;
        }
        eventRepository.flush();

        String confirmedHash = currentBlockHash(toBlock, blockHashes);
        long previousBlock = cursor.getLastConfirmedBlock();
        cursor.advance(previousBlock, toBlock, confirmedHash, now);
        cursorRepository.saveAndFlush(cursor);
        return persisted;
    }

    private void verifyCursorHash(BlockchainEventCursor cursor) {
        if (cursor.getLastConfirmedBlock() < 0 || cursor.getLastConfirmedBlockHash() == null) {
            return;
        }
        String actualHash = rpcClient.getBlock(cursor.getLastConfirmedBlock()).hash();
        if (!cursor.getLastConfirmedBlockHash().equalsIgnoreCase(actualHash)) {
            throw new BlockchainReorgDetectedException(
                    cursor.getLastConfirmedBlock(), cursor.getLastConfirmedBlockHash(), actualHash);
        }
    }

    private void validateLog(
            BlockchainLog log,
            long fromBlock,
            long toBlock,
            Map<Long, String> blockHashes) {
        if (!properties.getEscrowAddress().equalsIgnoreCase(log.address())) {
            throw new IllegalArgumentException("RPC returned a log from a non-configured contract");
        }
        if (log.blockNumber() < fromBlock || log.blockNumber() > toBlock) {
            throw new IllegalArgumentException("RPC returned a log outside the requested block range");
        }
        String currentHash = currentBlockHash(log.blockNumber(), blockHashes);
        if (log.blockHash() == null || !currentHash.equalsIgnoreCase(log.blockHash())) {
            throw new BlockchainReorgDetectedException(log.blockNumber(), log.blockHash(), currentHash);
        }
        if (log.transactionHash() == null
                || !log.transactionHash().matches("^0x[0-9a-fA-F]{64}$")
                || log.logIndex() < 0) {
            throw new IllegalArgumentException("Blockchain log identity is incomplete");
        }
    }

    private String currentBlockHash(long blockNumber, Map<Long, String> cache) {
        return cache.computeIfAbsent(blockNumber, number -> {
            BlockchainBlock block = rpcClient.getBlock(number);
            if (block.number() != number || block.hash() == null) {
                throw new IllegalArgumentException("RPC returned the wrong block for " + number);
            }
            return block.hash().toLowerCase(Locale.ROOT);
        });
    }

    private String serialize(DecodedEscrowEvent event) {
        try {
            return objectMapper.writeValueAsString(event);
        } catch (JacksonException exception) {
            throw new IllegalStateException("Cannot serialize decoded escrow event", exception);
        }
    }
}
