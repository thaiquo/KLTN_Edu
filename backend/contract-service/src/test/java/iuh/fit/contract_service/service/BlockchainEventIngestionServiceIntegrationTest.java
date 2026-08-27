package iuh.fit.contract_service.service;

import iuh.fit.contract_service.blockchain.BlockchainBlock;
import iuh.fit.contract_service.blockchain.BlockchainEventRpcClient;
import iuh.fit.contract_service.blockchain.BlockchainLog;
import iuh.fit.contract_service.blockchain.BlockchainReorgDetectedException;
import iuh.fit.contract_service.blockchain.EduConnectEscrowEventDecoder;
import iuh.fit.contract_service.config.BlockchainProperties;
import iuh.fit.contract_service.repository.BlockchainEventCursorRepository;
import iuh.fit.contract_service.repository.ProcessedEventRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.web3j.abi.EventEncoder;
import org.web3j.abi.FunctionEncoder;
import org.web3j.abi.TypeReference;
import org.web3j.abi.datatypes.Address;
import org.web3j.abi.datatypes.Event;
import org.web3j.abi.datatypes.generated.Bytes32;
import org.web3j.abi.datatypes.generated.Uint256;
import tools.jackson.databind.ObjectMapper;

import java.math.BigInteger;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
class BlockchainEventIngestionServiceIntegrationTest {
    private static final String ESCROW = "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512";
    private static final String AGREEMENT = "0x" + "11".repeat(32);
    private static final String STUDENT = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8";

    @Autowired
    private BlockchainEventCursorRepository cursorRepository;

    @Autowired
    private ProcessedEventRepository eventRepository;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private BlockchainProperties properties;
    private FakeEventRpcClient rpc;
    private BlockchainEventIngestionService service;

    @BeforeEach
    void setUp() {
        jdbcTemplate.update("DELETE FROM processed_event");
        jdbcTemplate.update("DELETE FROM blockchain_event_cursor");
        properties = new BlockchainProperties();
        properties.setChainId(31_337);
        properties.setEscrowAddress(ESCROW);
        properties.setStartBlock(10);
        properties.setConfirmations(2);
        properties.setEventBlockBatchSize(500);
        rpc = new FakeEventRpcClient();
        service = new BlockchainEventIngestionService(
                properties,
                rpc,
                new EduConnectEscrowEventDecoder(),
                cursorRepository,
                eventRepository,
                objectMapper,
                transactionManager);
    }

    @Test
    void persistsOnlyConfirmedLogsAndAdvancesCursorIdempotently() {
        rpc.latestBlock = BigInteger.valueOf(11);
        rpc.blocks.put(10L, block(10, "aa"));
        rpc.blocks.put(11L, block(11, "bb"));
        rpc.logs.add(fundedLog(10, rpc.blocks.get(10L).hash(), 0, "cc"));
        rpc.logs.add(fundedLog(11, rpc.blocks.get(11L).hash(), 0, "dd"));

        assertEquals(1, service.scanNextConfirmedRange());
        assertEquals(1, eventRepository.count());
        var firstCursor = cursorRepository.findAll().getFirst();
        assertEquals(10L, firstCursor.getLastConfirmedBlock());
        assertTrue(eventRepository.findAll().getFirst().getDecodedPayload().contains("40000000"));

        assertEquals(0, service.scanNextConfirmedRange());
        assertEquals(1, eventRepository.count());

        rpc.latestBlock = BigInteger.valueOf(12);
        assertEquals(1, service.scanNextConfirmedRange());
        assertEquals(2, eventRepository.count());
        assertEquals(11L, cursorRepository.findAll().getFirst().getLastConfirmedBlock());
    }

    @Test
    void detectsCursorBlockHashChangeAndDoesNotAdvance() {
        rpc.latestBlock = BigInteger.valueOf(11);
        rpc.blocks.put(10L, block(10, "aa"));
        rpc.logs.add(fundedLog(10, rpc.blocks.get(10L).hash(), 0, "cc"));
        service.scanNextConfirmedRange();

        rpc.blocks.put(10L, block(10, "ff"));

        assertThrows(BlockchainReorgDetectedException.class, service::scanNextConfirmedRange);
        assertEquals(10L, cursorRepository.findAll().getFirst().getLastConfirmedBlock());
        assertEquals(1, eventRepository.count());
    }

    @Test
    void rejectsWrongRpcChainBeforeWritingCursor() {
        rpc.chainId = BigInteger.ONE;
        rpc.latestBlock = BigInteger.valueOf(11);

        assertThrows(IllegalStateException.class, service::scanNextConfirmedRange);
        assertEquals(0, cursorRepository.count());
        assertEquals(0, eventRepository.count());
    }

    private static BlockchainLog fundedLog(long block, String blockHash, long logIndex, String txByte) {
        Event event = new Event("AgreementFunded", List.of(
                new TypeReference<Bytes32>(true) {},
                new TypeReference<Address>(true) {},
                new TypeReference<Uint256>() {}));
        return new BlockchainLog(
                ESCROW,
                List.of(EventEncoder.encode(event), AGREEMENT, addressTopic(STUDENT)),
                FunctionEncoder.encodeConstructor(List.of(new Uint256(BigInteger.valueOf(40_000_000)))),
                block,
                blockHash,
                "0x" + txByte.repeat(32),
                logIndex);
    }

    private static BlockchainBlock block(long number, String hashByte) {
        return new BlockchainBlock(number, "0x" + hashByte.repeat(32));
    }

    private static String addressTopic(String address) {
        return "0x" + "0".repeat(24) + address.substring(2);
    }

    private static final class FakeEventRpcClient implements BlockchainEventRpcClient {
        private BigInteger chainId = BigInteger.valueOf(31_337);
        private BigInteger latestBlock = BigInteger.ZERO;
        private final Map<Long, BlockchainBlock> blocks = new HashMap<>();
        private final List<BlockchainLog> logs = new ArrayList<>();

        @Override
        public BigInteger getChainId() {
            return chainId;
        }

        @Override
        public BigInteger getLatestBlockNumber() {
            return latestBlock;
        }

        @Override
        public BlockchainBlock getBlock(long blockNumber) {
            return blocks.get(blockNumber);
        }

        @Override
        public List<BlockchainLog> getLogs(long fromBlock, long toBlock, String contractAddress) {
            return logs.stream()
                    .filter(log -> log.blockNumber() >= fromBlock && log.blockNumber() <= toBlock)
                    .toList();
        }
    }
}
