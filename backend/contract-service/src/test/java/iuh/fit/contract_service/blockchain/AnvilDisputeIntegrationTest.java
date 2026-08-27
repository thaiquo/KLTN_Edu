package iuh.fit.contract_service.blockchain;

import iuh.fit.contract_service.config.BlockchainProperties;
import iuh.fit.contract_service.entity.ContractAgreement;
import iuh.fit.contract_service.entity.Dispute;
import iuh.fit.contract_service.entity.ProcessedEvent;
import iuh.fit.contract_service.entity.SessionSettlement;
import iuh.fit.contract_service.enums.ContractAgreementStatus;
import iuh.fit.contract_service.enums.DisputeStatus;
import iuh.fit.contract_service.enums.SettlementOutcome;
import iuh.fit.contract_service.enums.SettlementStatus;
import iuh.fit.contract_service.repository.ContractAgreementRepository;
import iuh.fit.contract_service.repository.DisputeRepository;
import iuh.fit.contract_service.repository.EscrowPaymentRepository;
import iuh.fit.contract_service.repository.ProcessedEventRepository;
import iuh.fit.contract_service.repository.SessionSettlementRepository;
import iuh.fit.contract_service.service.AgreementFundingWorkflowService;
import iuh.fit.contract_service.service.AgreementRegistrationWorkflowService;
import iuh.fit.contract_service.service.BlockchainEventIngestionService;
import iuh.fit.contract_service.service.DisputeWorkflowService;
import iuh.fit.contract_service.service.OperatorTransactionDispatcher;
import iuh.fit.contract_service.service.SessionSettlementWorkflowService;
import org.junit.jupiter.api.BeforeEach;
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

@SpringBootTest
@EnabledIfEnvironmentVariable(named = "RUN_ANVIL_DISPUTE_IT", matches = "true")
class AnvilDisputeIntegrationTest {

    @Autowired
    private AgreementRegistrationWorkflowService registrationWorkflowService;

    @Autowired
    private AgreementFundingWorkflowService fundingWorkflowService;

    @Autowired
    private SessionSettlementWorkflowService settlementWorkflowService;

    @Autowired
    private DisputeWorkflowService disputeWorkflowService;

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
    private DisputeRepository disputeRepository;

    @Autowired
    private ProcessedEventRepository processedEventRepository;

    @Autowired
    private BlockchainProperties blockchainProperties;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void cleanUp() {
        jdbcTemplate.execute("DELETE FROM outbox_event");
        jdbcTemplate.execute("DELETE FROM blockchain_transaction");
        jdbcTemplate.execute("DELETE FROM processed_event");
        jdbcTemplate.execute("DELETE FROM dispute_evidence");
        jdbcTemplate.execute("DELETE FROM dispute");
        jdbcTemplate.execute("DELETE FROM session_settlement");
        jdbcTemplate.execute("DELETE FROM escrow_payment");
        jdbcTemplate.execute("DELETE FROM contract_agreement");
    }

    @Test
    void endToEndDisputeOpeningAndStaffResolutionOnAnvil() throws Exception {
        UUID agreementId = UUID.randomUUID();
        long studentId = 101L;
        String reviewerEmail = "staff_approver@educonnect.com";

        String studentWallet = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8";
        String tutorWallet = "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc";
        String platformWallet = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
        String escrowAddress = blockchainProperties.getEscrowAddress();
        String tokenAddress = blockchainProperties.getUsdcAddress();
        String onchainAgreementId = Hash.sha3String("EDUCONNECT:AGREEMENT:" + agreementId);

        jdbcTemplate.update("""
                INSERT INTO contract_agreement (
                    id, onchain_agreement_id, classroom_id, student_id, tutor_id,
                    classroom_reviewer_email,
                    student_wallet, tutor_wallet, platform_wallet, chain_id,
                    escrow_contract_address, token_address, token_symbol, token_decimals,
                    terms_json, terms_hash, contract_version, total_price_vnd,
                    vnd_per_usdc, total_amount_usdc_units, price_per_session_usdc_units,
                    total_sessions, status, version, created_at, updated_at
                ) VALUES (
                    ?, ?, 1001, 101, 102,
                    ?,
                    ?, ?, ?, ?,
                    ?, ?, 'USDC', 6,
                    '{}', ?, 1, 1000000.00,
                    25000.00, 40000000, 40000000,
                    1, 'PREPARING_BLOCKCHAIN', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                )
                """,
                agreementId, onchainAgreementId, reviewerEmail,
                studentWallet, tutorWallet, platformWallet, blockchainProperties.getChainId(),
                escrowAddress, tokenAddress, Hash.sha3String("terms"));

        ContractAgreement agreement = agreementRepository.findById(agreementId).orElseThrow();

        // 1. Register on-chain
        registrationWorkflowService.initiateRegistration(agreementId);
        dispatcher.dispatchNext();

        String rpcUrl = blockchainProperties.getRpcUrl() != null ? blockchainProperties.getRpcUrl().toString() : "http://127.0.0.1:8545";
        Web3j web3j = Web3j.build(new HttpService(rpcUrl));
        ingestionService.scanNextConfirmedRange();

        List<ProcessedEvent> registerEvents = processedEventRepository.findAll().stream()
                .filter(e -> "AGREEMENT_REGISTERED".equals(e.getEventType()))
                .toList();
        if (!registerEvents.isEmpty()) {
            registrationWorkflowService.processConfirmedRegistrationEvent(registerEvents.get(registerEvents.size() - 1));
        }

        // 2. Fund agreement
        String approveData = FunctionEncoder.encode(new Function(
                "approve",
                List.of(new Address(escrowAddress), new Uint256(BigInteger.valueOf(40000000L))),
                List.of()));
        web3j.ethSendTransaction(Transaction.createFunctionCallTransaction(
                studentWallet, null, null, null, tokenAddress, approveData)).send();

        String fundData = EduConnectEscrowCalldataEncoder.encodeFundAgreement(agreement.getOnchainAgreementId());
        String fundTxHash = web3j.ethSendTransaction(Transaction.createFunctionCallTransaction(
                studentWallet, null, null, null, escrowAddress, fundData)).send().getTransactionHash();

        fundingWorkflowService.recordPaymentSubmission(agreementId, fundTxHash);
        ingestionService.scanNextConfirmedRange();

        List<ProcessedEvent> fundEvents = processedEventRepository.findAll().stream()
                .filter(e -> "AGREEMENT_FUNDED".equals(e.getEventType()))
                .toList();
        if (!fundEvents.isEmpty()) {
            fundingWorkflowService.processConfirmedFundingEvent(fundEvents.get(fundEvents.size() - 1));
        }

        // 3. Propose session
        String proposalEvidenceHash = "0x" + "a".repeat(64);
        settlementWorkflowService.initiateSessionProposal(
                agreementId, 1L, SettlementOutcome.BOTH_PRESENT, proposalEvidenceHash);
        dispatcher.dispatchNext();

        ingestionService.scanNextConfirmedRange();

        List<ProcessedEvent> proposeEvents = processedEventRepository.findAll().stream()
                .filter(e -> "SESSION_SETTLEMENT_PROPOSED".equals(e.getEventType()))
                .toList();
        if (!proposeEvents.isEmpty()) {
            settlementWorkflowService.processConfirmedSessionProposalEvent(proposeEvents.get(proposeEvents.size() - 1));
        }

        SessionSettlement settlement = sessionSettlementRepository
                .findByAgreementIdAndSessionId(agreementId, 1L).orElse(null);
        if (settlement != null) {
            // 4. Open dispute by student
            String disputeEvidenceHash = "0x" + "d".repeat(64);
            disputeWorkflowService.initiateDisputeOpening(
                    settlement.getId(),
                    studentId,
                    disputeEvidenceHash,
                    "disputes/session1.pdf",
                    "application/pdf",
                    "sha256_hash");
            dispatcher.dispatchNext();

            ingestionService.scanNextConfirmedRange();

            List<ProcessedEvent> disputeOpenedEvents = processedEventRepository.findAll().stream()
                    .filter(e -> "TUTOR_FRAUD_DISPUTE_OPENED".equals(e.getEventType()))
                    .toList();
            if (!disputeOpenedEvents.isEmpty()) {
                disputeWorkflowService.processConfirmedDisputeOpenedEvent(disputeOpenedEvents.get(disputeOpenedEvents.size() - 1));
            }

            Dispute dispute = disputeRepository.findBySettlementId(settlement.getId()).orElse(null);
            if (dispute != null) {
                // 5. Resolve dispute by assigned staff (approved -> student refunded 100%)
                String resolutionHash = "0x" + "r".repeat(64);
                disputeWorkflowService.initiateDisputeResolution(
                        dispute.getId(),
                        201L,
                        reviewerEmail,
                        "STAFF",
                        true,
                        "Tutor did not show up in video recording",
                        resolutionHash);
                dispatcher.dispatchNext();

                ingestionService.scanNextConfirmedRange();

                List<ProcessedEvent> disputeResolvedEvents = processedEventRepository.findAll().stream()
                        .filter(e -> "TUTOR_FRAUD_DISPUTE_RESOLVED".equals(e.getEventType()))
                        .toList();
                if (!disputeResolvedEvents.isEmpty()) {
                    disputeWorkflowService.processConfirmedDisputeResolvedEvent(disputeResolvedEvents.get(disputeResolvedEvents.size() - 1));
                }
            }
        }
    }
}
