package iuh.fit.contract_service.service;

import iuh.fit.contract_service.blockchain.BlockchainBlock;
import iuh.fit.contract_service.blockchain.BlockchainEventRpcClient;
import iuh.fit.contract_service.blockchain.BlockchainLog;
import iuh.fit.contract_service.blockchain.BlockchainReorgDetectedException;
import iuh.fit.contract_service.blockchain.EduConnectEscrowEventDecoder;
import iuh.fit.contract_service.config.BlockchainProperties;
import iuh.fit.contract_service.enums.ContractAgreementStatus;
import iuh.fit.contract_service.repository.ContractAgreementRepository;
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
import org.web3j.abi.datatypes.generated.Uint32;
import org.web3j.abi.datatypes.generated.Uint64;
import org.web3j.crypto.Hash;
import tools.jackson.databind.ObjectMapper;

import java.math.BigInteger;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
class BlockchainEventIngestionServiceIntegrationTest {
    private static final String ESCROW = "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512";
    private static final String AGREEMENT = "0x" + "11".repeat(32);
    private static final String STUDENT = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8";
    private static final String TUTOR = "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc";
    private static final String PLATFORM = "0x90f79bf6eb2c4f870365e785982e1f101e93b906";
    private static final String TOKEN = "0x5fbdb2315678afecb367f032d93f642f64180aa3";
    private static final String TERMS_HASH = "0x" + "22".repeat(32);

    @Autowired
    private BlockchainEventCursorRepository cursorRepository;

    @Autowired
    private ProcessedEventRepository eventRepository;

    @Autowired
    private ContractAgreementRepository agreementRepository;

    @Autowired
    private AgreementRegistrationWorkflowService registrationWorkflowService;

    @Autowired
    private AgreementFundingWorkflowService fundingWorkflowService;

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
        jdbcTemplate.update("DELETE FROM outbox_event");
        jdbcTemplate.update("DELETE FROM blockchain_transaction");
        jdbcTemplate.update("DELETE FROM processed_event");
        jdbcTemplate.update("DELETE FROM blockchain_event_cursor");
        jdbcTemplate.update("DELETE FROM dispute_evidence");
        jdbcTemplate.update("DELETE FROM dispute");
        jdbcTemplate.update("DELETE FROM session_settlement");
        jdbcTemplate.update("DELETE FROM escrow_payment");
        jdbcTemplate.update("DELETE FROM contract_agreement");
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
                null,
                null,
                null,
                null,
                null,
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

    @Test
    void processesConfirmedAgreementRegisteredLogIntoWaitingPayment() {
        UUID agreementId = UUID.randomUUID();
        insertAgreement(agreementId);
        rpc.latestBlock = BigInteger.valueOf(11);
        rpc.blocks.put(10L, block(10, "aa"));
        rpc.blocks.put(11L, block(11, "bb"));
        rpc.logs.add(registeredLog(10, rpc.blocks.get(10L).hash(), 0, "ee", 1_780_000_000L));
        service = new BlockchainEventIngestionService(
                properties,
                rpc,
                new EduConnectEscrowEventDecoder(),
                cursorRepository,
                eventRepository,
                registrationWorkflowService,
                null,
                null,
                null,
                null,
                objectMapper,
                transactionManager);

        assertEquals(1, service.scanNextConfirmedRange());

        var agreement = agreementRepository.findById(agreementId).orElseThrow();
        assertEquals(ContractAgreementStatus.WAITING_PAYMENT, agreement.getStatus());
        assertEquals(1, eventRepository.count());
    }

    @Test
    void processesConfirmedAgreementFundedLogIntoActive() {
        UUID agreementId = UUID.randomUUID();
        insertAgreement(agreementId, "WAITING_PAYMENT");
        rpc.latestBlock = BigInteger.valueOf(11);
        rpc.blocks.put(10L, block(10, "aa"));
        rpc.blocks.put(11L, block(11, "bb"));
        rpc.logs.add(fundedLog(10, rpc.blocks.get(10L).hash(), 0, "cc"));
        service = new BlockchainEventIngestionService(
                properties,
                rpc,
                new EduConnectEscrowEventDecoder(),
                cursorRepository,
                eventRepository,
                null,
                fundingWorkflowService,
                null,
                null,
                null,
                objectMapper,
                transactionManager);

        assertEquals(1, service.scanNextConfirmedRange());

        var agreement = agreementRepository.findById(agreementId).orElseThrow();
        assertEquals(ContractAgreementStatus.ACTIVE, agreement.getStatus());
        assertEquals(1, eventRepository.count());
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

    private static BlockchainLog registeredLog(long block, String blockHash, long logIndex, String txByte, long deadline) {
        Event event = new Event("AgreementRegistered", List.of(
                new TypeReference<Bytes32>(true) {},
                new TypeReference<Address>(true) {},
                new TypeReference<Address>(true) {},
                new TypeReference<Bytes32>() {},
                new TypeReference<Uint256>() {},
                new TypeReference<Uint256>() {},
                new TypeReference<Uint32>() {},
                new TypeReference<Uint64>() {}));
        return new BlockchainLog(
                ESCROW,
                List.of(EventEncoder.encode(event), AGREEMENT, addressTopic(STUDENT), addressTopic(TUTOR)),
                FunctionEncoder.encodeConstructor(List.of(
                        new Bytes32(org.web3j.utils.Numeric.hexStringToByteArray(TERMS_HASH)),
                        new Uint256(BigInteger.valueOf(40_000_000L)),
                        new Uint256(BigInteger.valueOf(4_000_000L)),
                        new Uint32(BigInteger.TEN),
                        new Uint64(BigInteger.valueOf(deadline)))),
                block,
                blockHash,
                "0x" + txByte.repeat(32),
                logIndex);
    }

    private void insertAgreement(UUID id) {
        insertAgreement(id, "PREPARING_BLOCKCHAIN");
    }

    private void insertAgreement(UUID id, String status) {
        jdbcTemplate.update("""
                INSERT INTO contract_agreement (
                    id, onchain_agreement_id, classroom_id, student_id, tutor_id,
                    student_wallet, tutor_wallet, platform_wallet, chain_id,
                    escrow_contract_address, token_address, token_symbol, token_decimals,
                    terms_json, terms_hash, contract_version, total_price_vnd,
                    vnd_per_usdc, total_amount_usdc_units, price_per_session_usdc_units,
                    total_sessions, status, version, created_at, updated_at
                ) VALUES (
                    ?, ?, 1, 1, 2,
                    ?, ?, ?, ?,
                    ?, ?, 'USDC', 6,
                    '{}', ?, 1, 1000000.00,
                    25000.00, 40000000, 4000000,
                    10, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                )
                """,
                id, AGREEMENT, STUDENT, TUTOR, PLATFORM, properties.getChainId(),
                ESCROW, TOKEN, TERMS_HASH, status);
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
