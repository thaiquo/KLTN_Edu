package iuh.fit.contract_service.blockchain;

import iuh.fit.contract_service.command.BlockchainTransactionIntentResult;
import iuh.fit.contract_service.config.BlockchainProperties;
import iuh.fit.contract_service.entity.ContractAgreement;
import iuh.fit.contract_service.entity.ProcessedEvent;

import iuh.fit.contract_service.enums.ContractAgreementStatus;
import iuh.fit.contract_service.repository.ContractAgreementRepository;
import iuh.fit.contract_service.repository.ProcessedEventRepository;
import iuh.fit.contract_service.service.AgreementRegistrationWorkflowService;
import iuh.fit.contract_service.service.BlockchainEventIngestionService;
import iuh.fit.contract_service.service.OperatorTransactionDispatcher;
import iuh.fit.contract_service.service.BlockchainReceiptWatcher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.web3j.crypto.Hash;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.http.HttpService;

import java.math.BigInteger;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
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
@EnabledIfEnvironmentVariable(named = "RUN_ANVIL_REGISTRATION_IT", matches = "true")
class AnvilAgreementRegistrationIntegrationTest {

    @Autowired
    private AgreementRegistrationWorkflowService workflowService;

    @Autowired
    private OperatorTransactionDispatcher dispatcher;

    @Autowired
    private BlockchainReceiptWatcher receiptWatcher;

    @Autowired
    private BlockchainEventIngestionService ingestionService;

    @Autowired
    private ContractAgreementRepository agreementRepository;

    @Autowired
    private ProcessedEventRepository processedEventRepository;

    @Autowired
    private BlockchainProperties properties;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void clearBusinessFixtures() {
        for (String table : List.of("outbox_event", "blockchain_transaction", "processed_event", "blockchain_event_cursor",
                "dispute_evidence", "dispute", "session_settlement", "escrow_payment", "contract_agreement")) {
            jdbcTemplate.execute("DELETE FROM " + table);
        }
    }

    @Test
    void executesEndToEndAgreementRegistrationOnAnvil() throws Exception {
        String rpcUrl = System.getenv().getOrDefault("ANVIL_RPC_URL", properties.getRpcUrl().toString());
        String escrow = System.getenv().getOrDefault("ANVIL_ESCROW_ADDRESS", properties.getEscrowAddress());
        Web3j web3j = Web3j.build(new HttpService(rpcUrl));

        try {
            List<String> accounts = web3j.ethAccounts().send().getAccounts();
            String operator = accounts.get(0);
            String student = accounts.get(1);
            String tutor = accounts.get(2);

            UUID agreementId = UUID.randomUUID();
            String onchainAgreementId = Hash.sha3String("EDUCONNECT:AGREEMENT:" + agreementId);
            String termsHash = Hash.sha3String("terms-anvil-v1");

            insertAgreement(agreementId, onchainAgreementId, termsHash, student, tutor, operator, escrow, properties.getChainId());

            // 1. Initiate registration (Create transaction intent)
            BlockchainTransactionIntentResult intent = workflowService.initiateRegistration(agreementId);
            assertTrue(intent.created());

            // 2. Dispatch operator transaction
            var dispatched = dispatcher.dispatchNext();
            assertTrue(dispatched.isPresent());
            for (int i = 0; i < 20; i++) {
                int reconciled = receiptWatcher.reconcilePendingReceipts();
                if (reconciled > 0) break;
                Thread.sleep(50);
            }

            // 3. Scan event logs via ingestion service
            for (int i = 0; i < 10; i++) {
                ingestionService.scanNextConfirmedRange();
                boolean found = processedEventRepository.findAll().stream()
                        .anyMatch(e -> "AGREEMENT_REGISTERED".equalsIgnoreCase(e.getEventType())
                                && e.getDecodedPayload() != null
                                && e.getDecodedPayload().toLowerCase().contains(onchainAgreementId.toLowerCase()));
                if (found) break;
                Thread.sleep(50);
            }

            // 4. Find decoded ProcessedEvent
            ProcessedEvent processedEvent = processedEventRepository.findAll().stream()
                    .filter(e -> "AGREEMENT_REGISTERED".equalsIgnoreCase(e.getEventType())
                            && e.getDecodedPayload() != null
                            && e.getDecodedPayload().toLowerCase().contains(onchainAgreementId.toLowerCase()))
                    .findFirst()
                    .orElseThrow();

            // 5. Process confirmed event to transition status
            boolean success = workflowService.processConfirmedRegistrationEvent(processedEvent);
            assertTrue(success);

            // 6. Verify agreement state updated to WAITING_PAYMENT
            ContractAgreement updated = agreementRepository.findById(agreementId).orElseThrow();
            assertEquals(ContractAgreementStatus.WAITING_PAYMENT, updated.getStatus());
            assertNotNull(updated.getPaymentDeadline());
        } finally {
            web3j.shutdown();
        }
    }

    private void insertAgreement(
            UUID id, String onchainAgreementId, String termsHash,
            String student, String tutor, String platform, String escrow, long chainId) {
        long classroomId = Math.abs(id.getMostSignificantBits());
        long studentId = Math.abs(id.getLeastSignificantBits());
        jdbcTemplate.update("""
                INSERT INTO contract_agreement (
                    id, onchain_agreement_id, classroom_id, student_id, tutor_id,
                    student_wallet, tutor_wallet, platform_wallet, chain_id,
                    escrow_contract_address, token_symbol, token_decimals,
                    terms_json, terms_hash, contract_version, total_price_vnd,
                    vnd_per_usdc, total_amount_usdc_units, price_per_session_usdc_units,
                    total_sessions, status, version, created_at, updated_at
                ) VALUES (
                    ?, ?, ?, ?, 2,
                    ?, ?, ?, ?,
                    ?, 'USDC', 6,
                    '{}', ?, 1, 1000000.00,
                    25000.00, 40000000, 4000000,
                    10, 'PREPARING_BLOCKCHAIN', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                )
                """,
                id, onchainAgreementId, classroomId, studentId, student, tutor, platform, chainId,
                escrow, termsHash);
    }

    private static String requiredEnv(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(name + " is required for the opt-in Anvil registration test");
        }
        return value;
    }
}
