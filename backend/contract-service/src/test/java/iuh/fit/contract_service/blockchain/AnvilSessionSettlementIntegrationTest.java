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

@SpringBootTest
@EnabledIfEnvironmentVariable(named = "RUN_ANVIL_SETTLEMENT_IT", matches = "true")
class AnvilSessionSettlementIntegrationTest {

    @Autowired
    private AgreementRegistrationWorkflowService registrationWorkflowService;

    @Autowired
    private AgreementFundingWorkflowService fundingWorkflowService;

    @Autowired
    private SessionSettlementWorkflowService settlementWorkflowService;

    @Autowired
    private OperatorTransactionDispatcher dispatcher;

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

    @Test
    void executesFullSessionSettlementLifecycleOnAnvil() throws Exception {
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
            String termsHash = Hash.sha3String("terms-settlement-anvil-v1");
            BigInteger totalAmount = BigInteger.valueOf(40_000_000L); // 40 USDC (1 session)

            insertAgreement(agreementId, onchainAgreementId, termsHash, student, tutor, operator, escrow, usdc, properties.getChainId());

            // 1. Register agreement
            registrationWorkflowService.initiateRegistration(agreementId);
            dispatcher.dispatchNext();
            ingestionService.scanNextConfirmedRange();

            ProcessedEvent regEvent = processedEventRepository.findAll().stream()
                    .filter(e -> "AGREEMENT_REGISTERED".equalsIgnoreCase(e.getEventType()))
                    .findFirst()
                    .orElseThrow();
            registrationWorkflowService.processConfirmedRegistrationEvent(regEvent);

            // 2. Fund agreement
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
            fundingWorkflowService.recordPaymentSubmission(agreementId, fundResp.getTransactionHash());

            ingestionService.scanNextConfirmedRange();
            ProcessedEvent fundEvent = processedEventRepository.findAll().stream()
                    .filter(e -> "AGREEMENT_FUNDED".equalsIgnoreCase(e.getEventType()))
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
            ingestionService.scanNextConfirmedRange();

            ProcessedEvent proposeEvent = processedEventRepository.findAll().stream()
                    .filter(e -> "SESSION_SETTLEMENT_PROPOSED".equalsIgnoreCase(e.getEventType()))
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
            settlementWorkflowService.initiateSessionFinalization(proposedSettlement.getId());
            dispatcher.dispatchNext();
            ingestionService.scanNextConfirmedRange();

            ProcessedEvent settleEvent = processedEventRepository.findAll().stream()
                    .filter(e -> "SESSION_SETTLED".equalsIgnoreCase(e.getEventType()))
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
                    25000.00, 40000000, 40000000,
                    1, 'PREPARING_BLOCKCHAIN', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                )
                """,
                id, onchainAgreementId, student, tutor, platform, chainId,
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
