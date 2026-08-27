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

@SpringBootTest
@EnabledIfEnvironmentVariable(named = "RUN_ANVIL_REGISTRATION_IT", matches = "true")
class AnvilAgreementRegistrationIntegrationTest {

    @Autowired
    private AgreementRegistrationWorkflowService workflowService;

    @Autowired
    private OperatorTransactionDispatcher dispatcher;

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

    @Test
    void executesEndToEndAgreementRegistrationOnAnvil() throws Exception {
        String rpcUrl = System.getenv().getOrDefault("ANVIL_RPC_URL", "http://127.0.0.1:8545");
        String escrow = requiredEnv("ANVIL_ESCROW_ADDRESS");
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

            // 3. Scan event logs via ingestion service
            int scannedEvents = ingestionService.scanNextConfirmedRange();
            assertTrue(scannedEvents >= 1);

            // 4. Find decoded ProcessedEvent
            ProcessedEvent processedEvent = processedEventRepository.findAll().stream()
                    .filter(e -> "AGREEMENT_REGISTERED".equalsIgnoreCase(e.getEventType()))
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
        jdbcTemplate.update("""
                INSERT INTO contract_agreement (
                    id, onchain_agreement_id, classroom_id, student_id, tutor_id,
                    student_wallet, tutor_wallet, platform_wallet, chain_id,
                    escrow_contract_address, token_symbol, token_decimals,
                    terms_json, terms_hash, contract_version, total_price_vnd,
                    vnd_per_usdc, total_amount_usdc_units, price_per_session_usdc_units,
                    total_sessions, status, version, created_at, updated_at
                ) VALUES (
                    ?, ?, 1, 1, 2,
                    ?, ?, ?, ?,
                    ?, 'USDC', 6,
                    '{}', ?, 1, 1000000.00,
                    25000.00, 40000000, 4000000,
                    10, 'PREPARING_BLOCKCHAIN', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                )
                """,
                id, onchainAgreementId, student, tutor, platform, chainId,
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
