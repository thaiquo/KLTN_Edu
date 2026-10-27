package iuh.fit.contract_service.blockchain;

import iuh.fit.contract_service.command.BlockchainTransactionIntentResult;
import iuh.fit.contract_service.config.BlockchainProperties;
import iuh.fit.contract_service.entity.ContractAgreement;
import iuh.fit.contract_service.entity.EscrowPayment;
import iuh.fit.contract_service.entity.ProcessedEvent;
import iuh.fit.contract_service.entity.SessionSettlement;
import iuh.fit.contract_service.enums.ContractAgreementStatus;
import iuh.fit.contract_service.enums.EscrowPaymentStatus;
import iuh.fit.contract_service.enums.SettlementOutcome;
import iuh.fit.contract_service.enums.SettlementStatus;
import iuh.fit.contract_service.repository.ContractAgreementRepository;
import iuh.fit.contract_service.repository.EscrowPaymentRepository;
import iuh.fit.contract_service.repository.ProcessedEventRepository;
import iuh.fit.contract_service.repository.SessionSettlementRepository;
import iuh.fit.contract_service.service.AgreementFundingWorkflowService;
import iuh.fit.contract_service.service.AgreementRegistrationWorkflowService;
import iuh.fit.contract_service.service.BlockchainEventIngestionService;
import iuh.fit.contract_service.service.BlockchainReceiptWatcher;
import iuh.fit.contract_service.service.OperatorTransactionDispatcher;
import iuh.fit.contract_service.service.SessionSettlementWorkflowService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.web3j.abi.FunctionEncoder;
import org.web3j.abi.datatypes.Address;
import org.web3j.abi.datatypes.Function;
import org.web3j.abi.datatypes.generated.Uint256;
import org.web3j.crypto.Hash;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.core.Request;
import org.web3j.protocol.core.methods.request.Transaction;
import org.web3j.protocol.http.HttpService;

import java.math.BigInteger;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest(properties = {
        "blockchain.enabled=true",
        "blockchain.operator.enabled=true",
        "blockchain.operator.address=0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
        "blockchain.operator.private-key=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
        "blockchain.rpc-url=http://127.0.0.1:8545",
        "blockchain.chain-id=31337",
        "blockchain.escrow-address=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
        "blockchain.usdc-address=0x5FbDB2315678afecb367f032d93F642f64180aa3",
        "blockchain.event-block-batch-size=1000"
})
@EnabledIfEnvironmentVariable(named = "RUN_ANVIL_SETTLEMENT_IT", matches = "true")
class AnvilSessionSettlementIntegrationTest {
    @org.springframework.test.context.bean.override.mockito.MockitoBean
    private iuh.fit.contract_service.service.LearningServiceDispatcher learningDispatcher;
    @org.springframework.test.context.bean.override.mockito.MockitoBean
    private iuh.fit.contract_service.service.NotificationDispatcher notificationDispatcher;
    @org.springframework.test.context.bean.override.mockito.MockitoBean
    private java.time.Clock clock;

    @Autowired
    private AgreementRegistrationWorkflowService registrationWorkflowService;

    @Autowired
    private AgreementFundingWorkflowService fundingWorkflowService;

    @Autowired
    private SessionSettlementWorkflowService settlementWorkflowService;

    @Autowired
    private OperatorTransactionDispatcher dispatcher;

    @Autowired
    private BlockchainReceiptWatcher receiptWatcher;

    @Autowired
    private BlockchainEventIngestionService ingestionService;

    @Autowired
    private ContractAgreementRepository agreementRepository;

    @Autowired
    private EscrowPaymentRepository escrowPaymentRepository;

    @Autowired
    private SessionSettlementRepository sessionSettlementRepository;

    @Autowired
    private ProcessedEventRepository processedEventRepository;

    @Autowired
    private BlockchainProperties properties;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @org.junit.jupiter.api.BeforeEach
    void clearBusinessFixtures() {
        for (String table : List.of("outbox_event", "blockchain_transaction", "processed_event", "blockchain_event_cursor",
                "dispute_evidence", "dispute", "session_settlement", "escrow_payment", "contract_agreement")) {
            jdbcTemplate.execute("DELETE FROM " + table);
        }
    }

    @Test
    void executesFullSessionSettlementLifecycleOnAnvil() throws Exception {
        String rpcUrl = System.getenv().getOrDefault("ANVIL_RPC_URL", properties.getRpcUrl().toString());
        String escrow = System.getenv().getOrDefault("ANVIL_ESCROW_ADDRESS", properties.getEscrowAddress());
        String usdc = System.getenv().getOrDefault("ANVIL_USDC_ADDRESS", properties.getUsdcAddress());
        Web3j web3j = Web3j.build(new HttpService(rpcUrl));

        try {
            List<String> accounts = web3j.ethAccounts().send().getAccounts();
            String operator = accounts.get(0);
            String student = accounts.get(1);
            String tutor = accounts.get(2);

            UUID agreementId = UUID.randomUUID();
            String onchainAgreementId = Hash.sha3String("EDUCONNECT:AGREEMENT:" + agreementId);
            String termsHash = Hash.sha3String("terms-settlement-anvil-v1");
            BigInteger totalAmount = BigInteger.valueOf(40_000_000L); // 40 USDC (1 session)

            insertAgreement(agreementId, onchainAgreementId, termsHash, student, tutor, operator, escrow, usdc, properties.getChainId());

            // 1. Register agreement
            registrationWorkflowService.initiateRegistration(agreementId);
            var dispatched = dispatcher.dispatchNext();
            assertTrue(dispatched.isPresent());
            for (int i = 0; i < 20; i++) {
                int reconciled = receiptWatcher.reconcilePendingReceipts();
                if (reconciled > 0) break;
                Thread.sleep(50);
            }
            for (int i = 0; i < 10; i++) {
                ingestionService.scanNextConfirmedRange();
                boolean found = processedEventRepository.findAll().stream()
                        .anyMatch(e -> "AGREEMENT_REGISTERED".equalsIgnoreCase(e.getEventType())
                                && e.getDecodedPayload() != null
                                && e.getDecodedPayload().toLowerCase().contains(onchainAgreementId.toLowerCase()));
                if (found) break;
                Thread.sleep(50);
            }

            ProcessedEvent regEvent = processedEventRepository.findAll().stream()
                    .filter(e -> "AGREEMENT_REGISTERED".equalsIgnoreCase(e.getEventType())
                            && e.getDecodedPayload() != null
                            && e.getDecodedPayload().toLowerCase().contains(onchainAgreementId.toLowerCase()))
                    .findFirst()
                    .orElseThrow();
            registrationWorkflowService.processConfirmedRegistrationEvent(regEvent);

            // 2. Fund agreement
            Function mintFunction = new Function(
                    "mint",
                    List.of(new Address(student), new Uint256(totalAmount)),
                    List.of());
            Transaction mintTx = Transaction.createFunctionCallTransaction(
                    operator, null, null, BigInteger.valueOf(100_000L), usdc, FunctionEncoder.encode(mintFunction));
            web3j.ethSendTransaction(mintTx).send();

            Function approveFunction = new Function(
                    "approve",
                    List.of(new Address(escrow), new Uint256(totalAmount)),
                    List.of());
            Transaction approveTx = Transaction.createFunctionCallTransaction(
                    student, null, null, BigInteger.valueOf(100_000L), usdc, FunctionEncoder.encode(approveFunction));
            web3j.ethSendTransaction(approveTx).send();

            String fundCalldata = EduConnectEscrowCalldataEncoder.encodeFundAgreement(onchainAgreementId);
            Transaction fundTx = Transaction.createFunctionCallTransaction(
                    student, null, null, BigInteger.valueOf(250_000L), escrow, fundCalldata);
            var fundResp = web3j.ethSendTransaction(fundTx).send();
            String fundTxHash = fundResp.getTransactionHash();
            fundingWorkflowService.recordPaymentSubmission(agreementId, fundTxHash);

            for (int i = 0; i < 10; i++) {
                ingestionService.scanNextConfirmedRange();
                boolean found = processedEventRepository.findAll().stream()
                        .anyMatch(e -> "AGREEMENT_FUNDED".equalsIgnoreCase(e.getEventType())
                                && e.getDecodedPayload() != null
                                && e.getDecodedPayload().toLowerCase().contains(onchainAgreementId.toLowerCase()));
                if (found) break;
                Thread.sleep(50);
            }
            ProcessedEvent fundEvent = processedEventRepository.findAll().stream()
                    .filter(e -> "AGREEMENT_FUNDED".equalsIgnoreCase(e.getEventType())
                            && e.getDecodedPayload() != null
                            && e.getDecodedPayload().toLowerCase().contains(onchainAgreementId.toLowerCase()))
                    .findFirst()
                    .orElseThrow();
            fundingWorkflowService.processConfirmedFundingEvent(fundEvent);

            ContractAgreement activeAgreement = agreementRepository.findById(agreementId).orElseThrow();
            assertEquals(ContractAgreementStatus.ACTIVE, activeAgreement.getStatus());

            // 3. Propose Session Settlement
            String evidenceHash = "0x" + "7".repeat(64);
            settlementWorkflowService.initiateSessionProposal(
                    agreementId, 1L, SettlementOutcome.BOTH_PRESENT, evidenceHash);
            dispatcher.dispatchNext();
            for (int i = 0; i < 20; i++) {
                int reconciled = receiptWatcher.reconcilePendingReceipts();
                if (reconciled > 0) break;
                Thread.sleep(50);
            }
            for (int i = 0; i < 10; i++) {
                ingestionService.scanNextConfirmedRange();
                boolean found = processedEventRepository.findAll().stream()
                        .anyMatch(e -> "SESSION_SETTLEMENT_PROPOSED".equalsIgnoreCase(e.getEventType())
                                && e.getDecodedPayload() != null
                                && e.getDecodedPayload().toLowerCase().contains(onchainAgreementId.toLowerCase()));
                if (found) break;
                Thread.sleep(50);
            }

            ProcessedEvent proposeEvent = processedEventRepository.findAll().stream()
                    .filter(e -> "SESSION_SETTLEMENT_PROPOSED".equalsIgnoreCase(e.getEventType())
                            && e.getDecodedPayload() != null
                            && e.getDecodedPayload().toLowerCase().contains(onchainAgreementId.toLowerCase()))
                    .findFirst()
                    .orElseThrow();
            settlementWorkflowService.processConfirmedSessionProposalEvent(proposeEvent);

            SessionSettlement proposedSettlement = sessionSettlementRepository
                    .findByAgreementIdAndSessionId(agreementId, 1L).orElseThrow();
            assertEquals(SettlementStatus.PROPOSED, proposedSettlement.getStatus());

            // 4. Advance Anvil time by 86401 seconds to bypass 24h dispute window
            new Request<>("evm_increaseTime", List.of(86401), new HttpService(rpcUrl), org.web3j.protocol.core.methods.response.NetVersion.class).send();
            new Request<>("evm_mine", Collections.emptyList(), new HttpService(rpcUrl), org.web3j.protocol.core.methods.response.NetVersion.class).send();

            // 5. Finalize Session Settlement
            // Advance the application clock alongside the local chain, preserving the persisted deadline.
            var chainTime = web3j.ethGetBlockByNumber(
                    org.web3j.protocol.core.DefaultBlockParameterName.LATEST, false).send().getBlock().getTimestamp();
            org.mockito.Mockito.when(clock.instant()).thenReturn(java.time.Instant.ofEpochSecond(chainTime.longValueExact()));
            org.mockito.Mockito.when(clock.getZone()).thenReturn(java.time.ZoneOffset.UTC);
            settlementWorkflowService.initiateSessionFinalization(proposedSettlement.getId());
            dispatcher.dispatchNext();
            for (int i = 0; i < 20; i++) {
                int reconciled = receiptWatcher.reconcilePendingReceipts();
                if (reconciled > 0) break;
                Thread.sleep(50);
            }
            for (int i = 0; i < 10; i++) {
                ingestionService.scanNextConfirmedRange();
                boolean found = processedEventRepository.findAll().stream()
                        .anyMatch(e -> "SESSION_SETTLED".equalsIgnoreCase(e.getEventType())
                                && e.getDecodedPayload() != null
                                && e.getDecodedPayload().toLowerCase().contains(onchainAgreementId.toLowerCase()));
                if (found) break;
                Thread.sleep(50);
            }

            ProcessedEvent settleEvent = processedEventRepository.findAll().stream()
                    .filter(e -> "SESSION_SETTLED".equalsIgnoreCase(e.getEventType())
                            && e.getDecodedPayload() != null
                            && e.getDecodedPayload().toLowerCase().contains(onchainAgreementId.toLowerCase()))
                    .findFirst()
                    .orElseThrow();
            settlementWorkflowService.processConfirmedSessionSettledEvent(settleEvent);

            SessionSettlement finalizedSettlement = sessionSettlementRepository
                    .findByAgreementIdAndSessionId(agreementId, 1L).orElseThrow();
            assertEquals(SettlementStatus.SETTLED, finalizedSettlement.getStatus());

            ContractAgreement completedAgreement = agreementRepository.findById(agreementId).orElseThrow();
            assertEquals(ContractAgreementStatus.COMPLETED, completedAgreement.getStatus());
        } finally {
            web3j.shutdown();
        }
    }

    private void insertAgreement(
            UUID id, String onchainAgreementId, String termsHash,
            String student, String tutor, String platform, String escrow, String usdc, long chainId) {
        long classroomId = Math.abs(id.getMostSignificantBits());
        long studentId = Math.abs(id.getLeastSignificantBits());
        jdbcTemplate.update("""
                INSERT INTO contract_agreement (
                    id, onchain_agreement_id, classroom_id, student_id, tutor_id,
                    student_wallet, tutor_wallet, platform_wallet, chain_id,
                    escrow_contract_address, token_address, token_symbol, token_decimals,
                    terms_json, terms_hash, contract_version, total_price_vnd,
                    vnd_per_usdc, total_amount_usdc_units, price_per_session_usdc_units,
                    total_sessions, status, version, created_at, updated_at
                ) VALUES (
                    ?, ?, ?, ?, 2,
                    ?, ?, ?, ?,
                    ?, ?, 'USDC', 6,
                    '{}', ?, 1, 1000000.00,
                    25000.00, 40000000, 40000000,
                    1, 'PREPARING_BLOCKCHAIN', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                )
                """,
                id, onchainAgreementId, classroomId, studentId, student, tutor, platform, chainId,
                escrow, usdc, termsHash);
    }

    private static String requiredEnv(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(name + " is required for the opt-in Anvil settlement test");
        }
        return value;
    }
}
