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

@SpringBootTest
@EnabledIfEnvironmentVariable(named = "RUN_ANVIL_FUNDING_IT", matches = "true")
class AnvilAgreementFundingIntegrationTest {

    @Autowired
    private AgreementRegistrationWorkflowService registrationWorkflowService;

    @Autowired
    private AgreementFundingWorkflowService fundingWorkflowService;

    @Autowired
    private OperatorTransactionDispatcher dispatcher;

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

    @Test
    void executesEndToEndAgreementFundingOnAnvil() throws Exception {
        String rpcUrl = System.getenv().getOrDefault("ANVIL_RPC_URL", "http://127.0.0.1:8545");
        String escrow = requiredEnv("ANVIL_ESCROW_ADDRESS");
        String usdc = requiredEnv("ANVIL_USDC_ADDRESS");
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

            // Scan registration event
            int regScanned = ingestionService.scanNextConfirmedRange();
            assertTrue(regScanned >= 1);

            ProcessedEvent regEvent = processedEventRepository.findAll().stream()
                    .filter(e -> "AGREEMENT_REGISTERED".equalsIgnoreCase(e.getEventType()))
                    .findFirst()
                    .orElseThrow();

            boolean regProcessed = registrationWorkflowService.processConfirmedRegistrationEvent(regEvent);
            assertTrue(regProcessed);

            ContractAgreement waitingAgreement = agreementRepository.findById(agreementId).orElseThrow();
            assertEquals(ContractAgreementStatus.WAITING_PAYMENT, waitingAgreement.getStatus());

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
            int fundScanned = ingestionService.scanNextConfirmedRange();
            assertTrue(fundScanned >= 1);

            ProcessedEvent fundEvent = processedEventRepository.findAll().stream()
                    .filter(e -> "AGREEMENT_FUNDED".equalsIgnoreCase(e.getEventType()))
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
                    10, 'PREPARING_BLOCKCHAIN', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                )
                """,
                id, onchainAgreementId, student, tutor, platform, chainId,
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
