package iuh.fit.contract_service.blockchain;

import iuh.fit.contract_service.command.BlockchainTransactionIntentResult;
import iuh.fit.contract_service.config.BlockchainProperties;
import iuh.fit.contract_service.entity.ContractAgreement;
import iuh.fit.contract_service.entity.EscrowPayment;
import iuh.fit.contract_service.entity.ProcessedEvent;
import iuh.fit.contract_service.enums.ContractAgreementStatus;
import iuh.fit.contract_service.enums.EscrowPaymentStatus;
import iuh.fit.contract_service.repository.ContractAgreementRepository;
import iuh.fit.contract_service.repository.EscrowPaymentRepository;
import iuh.fit.contract_service.repository.ProcessedEventRepository;
import iuh.fit.contract_service.service.AgreementFundingWorkflowService;
import iuh.fit.contract_service.service.AgreementRegistrationWorkflowService;
import iuh.fit.contract_service.service.BlockchainEventIngestionService;
import iuh.fit.contract_service.service.OperatorTransactionDispatcher;
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
import org.web3j.protocol.core.methods.request.Transaction;
import org.web3j.protocol.http.HttpService;

import java.math.BigInteger;
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
@EnabledIfEnvironmentVariable(named = "RUN_ANVIL_FUNDING_IT", matches = "true")
class AnvilAgreementFundingIntegrationTest {

    @Autowired
    private AgreementRegistrationWorkflowService registrationWorkflowService;

    @Autowired
    private AgreementFundingWorkflowService fundingWorkflowService;

    @Autowired
    private OperatorTransactionDispatcher dispatcher;

    @Autowired
    private iuh.fit.contract_service.service.BlockchainReceiptWatcher receiptWatcher;

    @Autowired
    private BlockchainEventIngestionService ingestionService;

    @Autowired
    private ContractAgreementRepository agreementRepository;

    @Autowired
    private EscrowPaymentRepository escrowPaymentRepository;

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
    void executesEndToEndAgreementFundingOnAnvil() throws Exception {
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
            String termsHash = Hash.sha3String("terms-funding-anvil-v1");
            BigInteger totalAmount = BigInteger.valueOf(40_000_000L); // 40 USDC

            insertAgreement(agreementId, onchainAgreementId, termsHash, student, tutor, operator, escrow, usdc, properties.getChainId());

            // 1. Register agreement on-chain via Operator
            BlockchainTransactionIntentResult intent = registrationWorkflowService.initiateRegistration(agreementId);
            assertTrue(intent.created());

            var dispatched = dispatcher.dispatchNext();
            assertTrue(dispatched.isPresent());
            for (int i = 0; i < 20; i++) {
                int reconciled = receiptWatcher.reconcilePendingReceipts();
                if (reconciled > 0) break;
                Thread.sleep(50);
            }

            // Scan registration event
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

            boolean regProcessed = registrationWorkflowService.processConfirmedRegistrationEvent(regEvent);
            assertTrue(regProcessed);

            ContractAgreement waitingAgreement = agreementRepository.findById(agreementId).orElseThrow();
            assertEquals(ContractAgreementStatus.WAITING_PAYMENT, waitingAgreement.getStatus());

            // Mint test USDC to student
            Function mintFunction = new Function(
                    "mint",
                    List.of(new Address(student), new Uint256(totalAmount)),
                    List.of());
            Transaction mintTx = Transaction.createFunctionCallTransaction(
                    operator, null, null, BigInteger.valueOf(100_000L), usdc, FunctionEncoder.encode(mintFunction));
            web3j.ethSendTransaction(mintTx).send();

            // 2. Student approves USDC to Escrow
            Function approveFunction = new Function(
                    "approve",
                    List.of(new Address(escrow), new Uint256(totalAmount)),
                    List.of());
            String approveCalldata = FunctionEncoder.encode(approveFunction);

            Transaction approveTx = Transaction.createFunctionCallTransaction(
                    student, null, null, BigInteger.valueOf(100_000L), usdc, approveCalldata);
            var approveResp = web3j.ethSendTransaction(approveTx).send();
            assertTrue(approveResp.getTransactionHash() != null);

            // 3. Student calls fundAgreement(agreementId)
            String fundCalldata = EduConnectEscrowCalldataEncoder.encodeFundAgreement(onchainAgreementId);
            Transaction fundTx = Transaction.createFunctionCallTransaction(
                    student, null, null, BigInteger.valueOf(250_000L), escrow, fundCalldata);
            var fundResp = web3j.ethSendTransaction(fundTx).send();
            String fundTxHash = fundResp.getTransactionHash();
            assertTrue(fundTxHash != null);

            // Record submission on backend
            fundingWorkflowService.recordPaymentSubmission(agreementId, fundTxHash);

            // 4. Ingest on-chain event AGREEMENT_FUNDED
            for (int i = 0; i < 10; i++) {
                ingestionService.scanNextConfirmedRange();
                boolean found = processedEventRepository.findAll().stream()
                        .anyMatch(e -> "AGREEMENT_FUNDED".equalsIgnoreCase(e.getEventType())
                                && fundTxHash.equalsIgnoreCase(e.getTransactionHash()));
                if (found) break;
                Thread.sleep(50);
            }

            ProcessedEvent fundEvent = processedEventRepository.findAll().stream()
                    .filter(e -> "AGREEMENT_FUNDED".equalsIgnoreCase(e.getEventType())
                            && fundTxHash.equalsIgnoreCase(e.getTransactionHash()))
                    .findFirst()
                    .orElseThrow();

            // 5. Process confirmed funding event
            boolean fundSuccess = fundingWorkflowService.processConfirmedFundingEvent(fundEvent);
            assertTrue(fundSuccess);

            // 6. Verify agreement becomes ACTIVE and payment becomes LOCKED
            ContractAgreement activeAgreement = agreementRepository.findById(agreementId).orElseThrow();
            assertEquals(ContractAgreementStatus.ACTIVE, activeAgreement.getStatus());

            EscrowPayment lockedPayment = escrowPaymentRepository.findByAgreementId(agreementId).orElseThrow();
            assertEquals(EscrowPaymentStatus.LOCKED, lockedPayment.getStatus());
            assertEquals(fundTxHash, lockedPayment.getFundTxHash());

            // Verify Outbox event created
            long outboxCount = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM outbox_event WHERE event_type = 'contract.activated.v1'", Long.class);
            assertEquals(1L, outboxCount);
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
                    total_sessions, status, version, legacy_excluded, created_at, updated_at
                ) VALUES (
                    ?, ?, ?, ?, 2,
                    ?, ?, ?, ?,
                    ?, ?, 'USDC', 6,
                    '{}', ?, 1, 1000000.00,
                    25000.00, 40000000, 4000000,
                    10, 'PREPARING_BLOCKCHAIN', 0, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                )
                """,
                id, onchainAgreementId, classroomId, studentId, student, tutor, platform, chainId,
                escrow, usdc, termsHash);
    }

    private static String requiredEnv(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(name + " is required for the opt-in Anvil funding test");
        }
        return value;
    }
}
