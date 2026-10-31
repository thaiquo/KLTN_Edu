package iuh.fit.contract_service.blockchain;

import com.fasterxml.jackson.databind.ObjectMapper;
import iuh.fit.contract_service.config.BlockchainProperties;
import iuh.fit.contract_service.config.security.ContractUserPrincipal;
import iuh.fit.contract_service.entity.*;
import iuh.fit.contract_service.enums.*;
import iuh.fit.contract_service.repository.*;
import iuh.fit.contract_service.service.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.web3j.abi.FunctionEncoder;
import org.web3j.abi.datatypes.Address;
import org.web3j.abi.datatypes.Function;
import org.web3j.abi.datatypes.generated.Uint256;
import org.web3j.crypto.*;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.core.Request;
import org.web3j.protocol.core.methods.request.Transaction;
import org.web3j.protocol.http.HttpService;
import org.web3j.utils.Numeric;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

@SpringBootTest(properties = {
        "blockchain.enabled=true",
        "blockchain.operator.enabled=true",
        "blockchain.operator.address=0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
        "blockchain.operator.private-key=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
        "blockchain.rpc-url=http://127.0.0.1:8545",
        "blockchain.chain-id=31337",
        "blockchain.escrow-address=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
        "blockchain.usdc-address=0x5FbDB2315678afecb367f032d93F642f64180aa3",
        "blockchain.event-block-batch-size=1000",
        "escrow.trial.enabled=true"
})
@EnabledIfEnvironmentVariable(named = "RUN_ANVIL_TRIAL_IT", matches = "true")
class AnvilTrialCoolingOffIntegrationTest {

    @MockitoBean
    private LearningServiceDispatcher learningDispatcher;

    @MockitoBean
    private NotificationDispatcher notificationDispatcher;

    @MockitoBean
    private TerminationLearningClient terminationLearningClient;

    @MockitoBean
    private Clock clock;

    @Autowired
    private AgreementRegistrationWorkflowService registrationWorkflowService;

    @Autowired
    private AgreementFundingWorkflowService fundingWorkflowService;

    @Autowired
    private SessionSettlementWorkflowService settlementWorkflowService;

    @Autowired
    private AgreementLifecycleWorkflowService lifecycleWorkflowService;

    @Autowired
    private TerminationService terminationService;

    @Autowired
    private TerminationProcessor terminationProcessor;

    @Autowired
    private OperatorTransactionDispatcher dispatcher;

    @Autowired
    private BlockchainReceiptWatcher receiptWatcher;

    @Autowired
    private BlockchainEventIngestionService ingestionService;

    @Autowired
    private ContractAgreementRepository agreementRepository;

    @Autowired
    private AgreementTrialRepository agreementTrialRepository;

    @Autowired
    private SessionSettlementRepository sessionSettlementRepository;

    @Autowired
    private TerminationCaseRepository terminationCaseRepository;

    @Autowired
    private TerminationItemRepository terminationItemRepository;

    @Autowired
    private ProcessedEventRepository processedEventRepository;

    @Autowired
    private BlockchainProperties properties;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private static final byte[] EIP191_PREFIX = new byte[]{0x19, 0x01};
    private static final byte[] DOMAIN_TYPEHASH = Hash.sha3(
            "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                    .getBytes(StandardCharsets.UTF_8));
    private static final byte[] TERMINATION_REQUEST_TYPEHASH = Hash.sha3(
            "TerminationRequest(string contractId,bytes32 reasonHash,bool wholeClass,uint256 requestedAt)"
                    .getBytes(StandardCharsets.UTF_8));

    @BeforeEach
    void clearBusinessFixtures() {
        for (String table : List.of("outbox_event", "blockchain_transaction", "processed_event", "blockchain_event_cursor",
                "termination_item", "termination_case", "agreement_trial", "dispute_evidence", "dispute",
                "session_settlement", "escrow_payment", "contract_agreement")) {
            jdbcTemplate.execute("DELETE FROM " + table);
        }
    }

    @Test
    void executesTrialCoolingOffOptOutAndOnChainRefundOnAnvil() throws Exception {
        String rpcUrl = System.getenv().getOrDefault("ANVIL_RPC_URL", properties.getRpcUrl().toString());
        String escrow = System.getenv().getOrDefault("ANVIL_ESCROW_ADDRESS", properties.getEscrowAddress());
        String usdc = System.getenv().getOrDefault("ANVIL_USDC_ADDRESS", properties.getUsdcAddress());
        Web3j web3j = Web3j.build(new HttpService(rpcUrl));

        try {
            List<String> accounts = web3j.ethAccounts().send().getAccounts();
            String operator = accounts.get(0);
            String student = accounts.get(1); // 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
            String tutor = accounts.get(2);

            // Student private key on default Anvil mnemonic
            BigInteger studentPrivateKey = new BigInteger("59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", 16);
            ECKeyPair studentKeyPair = ECKeyPair.create(studentPrivateKey);

            UUID agreementId = UUID.randomUUID();
            String onchainAgreementId = Hash.sha3String("EDUCONNECT:TRIAL:" + agreementId);
            String termsHash = Hash.sha3String("terms-trial-v1");
            BigInteger totalAmount = BigInteger.valueOf(40_000_000L); // 40 USDC total
            BigInteger pricePerSession = BigInteger.valueOf(10_000_000L); // 10 USDC / session (4 sessions)

            long studentId = 1001L;
            long classroomId = 2002L;

            // 1. Insert Agreement and AgreementTrial in DB
            insertAgreement(agreementId, classroomId, studentId, onchainAgreementId, termsHash,
                    student, tutor, operator, escrow, usdc, properties.getChainId(), totalAmount, pricePerSession, 4);

            OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
            AgreementTrial trial = new AgreementTrial();
            trial.setAgreementId(agreementId);
            trial.setPolicyVersion((short) 1);
            trial.setTrialSessionSequence(1);
            trial.setNextSessionSequence(2);
            trial.setTrialSessionStartAt(now.plusDays(5));
            trial.setTrialDeadline(now.plusDays(6));
            trial.setScheduleFingerprint("0".repeat(64));
            trial.setStatus(TrialStatus.NOT_STARTED);
            trial.setDecisionSource(null);
            trial.setCreatedAt(now);
            trial.setUpdatedAt(now);
            agreementTrialRepository.saveAndFlush(trial);

            // 2. Register agreement on Anvil via Operator
            registrationWorkflowService.initiateRegistration(agreementId);
            var dispatchedReg = dispatcher.dispatchNext();
            assertTrue(dispatchedReg.isPresent());
            reconcileReceipts();

            scanEventsUntilIngested("AGREEMENT_REGISTERED", onchainAgreementId);
            ProcessedEvent regEvent = findProcessedEvent("AGREEMENT_REGISTERED", onchainAgreementId);
            registrationWorkflowService.processConfirmedRegistrationEvent(regEvent);

            ContractAgreement waitingAgreement = agreementRepository.findById(agreementId).orElseThrow();
            assertEquals(ContractAgreementStatus.WAITING_PAYMENT, waitingAgreement.getStatus());

            // 3. Student funds 40 USDC to Escrow
            Function balanceFunc = new Function("balanceOf", List.of(new Address(student)), List.of());
            var preEthCall = web3j.ethCall(Transaction.createEthCallTransaction(student, usdc, FunctionEncoder.encode(balanceFunc)),
                    org.web3j.protocol.core.DefaultBlockParameterName.LATEST).send();
            BigInteger studentInitialBalance = Numeric.decodeQuantity(preEthCall.getValue());

            // Mint 40 USDC to student
            Function mintFunction = new Function("mint", List.of(new Address(student), new Uint256(totalAmount)), List.of());
            web3j.ethSendTransaction(Transaction.createFunctionCallTransaction(
                    operator, null, null, BigInteger.valueOf(100_000L), usdc, FunctionEncoder.encode(mintFunction))).send();

            // Student approves Escrow
            Function approveFunction = new Function("approve", List.of(new Address(escrow), new Uint256(totalAmount)), List.of());
            web3j.ethSendTransaction(Transaction.createFunctionCallTransaction(
                    student, null, null, BigInteger.valueOf(100_000L), usdc, FunctionEncoder.encode(approveFunction))).send();

            // Student funds agreement
            String fundCalldata = EduConnectEscrowCalldataEncoder.encodeFundAgreement(onchainAgreementId);
            var fundResp = web3j.ethSendTransaction(Transaction.createFunctionCallTransaction(
                    student, null, null, BigInteger.valueOf(250_000L), escrow, fundCalldata)).send();
            String fundTxHash = fundResp.getTransactionHash();
            fundingWorkflowService.recordPaymentSubmission(agreementId, fundTxHash);

            scanEventsUntilIngested("AGREEMENT_FUNDED", onchainAgreementId);
            ProcessedEvent fundEvent = findProcessedEvent("AGREEMENT_FUNDED", onchainAgreementId);
            fundingWorkflowService.processConfirmedFundingEvent(fundEvent);

            ContractAgreement activeAgreement = agreementRepository.findById(agreementId).orElseThrow();
            assertEquals(ContractAgreementStatus.ACTIVE, activeAgreement.getStatus());

            // 4. Propose Session 1 settlement (Session 1 completed)
            String evidenceHash = "0x" + "e".repeat(64);
            settlementWorkflowService.initiateSessionProposal(
                    agreementId, 1L, SettlementOutcome.BOTH_PRESENT, evidenceHash);
            dispatcher.dispatchNext();
            reconcileReceipts();

            scanEventsUntilIngested("SESSION_SETTLEMENT_PROPOSED", onchainAgreementId);
            ProcessedEvent proposeEvent = findProcessedEvent("SESSION_SETTLEMENT_PROPOSED", onchainAgreementId);
            settlementWorkflowService.processConfirmedSessionProposalEvent(proposeEvent);

            // Open decision window on AgreementTrial
            trial = agreementTrialRepository.findById(agreementId).orElseThrow();
            trial.setStatus(TrialStatus.DECISION_OPEN);
            agreementTrialRepository.saveAndFlush(trial);

            // 5. Student opts out before session 2 starts, using an EIP-712 signature.
            long requestedAt = System.currentTimeMillis() / 1000L;
            String reason = "Dừng trong giai đoạn trải nghiệm (Trial opt-out)";
            byte[] reasonHashBytes = Hash.sha3(reason.getBytes(StandardCharsets.UTF_8));
            String reasonHashHex = Numeric.toHexString(reasonHashBytes);

            String eip712Signature = signTrialOptOut(
                    studentKeyPair,
                    agreementId.toString(),
                    reasonHashHex,
                    requestedAt,
                    properties.getChainId(),
                    escrow);

            ContractUserPrincipal studentPrincipal = new ContractUserPrincipal(
                    studentId, "student@test.vn", "STUDENT", List.of("STUDENT"));

            // Mock Learning sync to succeed
            when(terminationLearningClient.send(eq(classroomId), eq(studentId), eq(agreementId), eq(false), eq("HOLD"),
                    eq("TRIAL_OPT_OUT"), eq(1), any(), any()))
                    .thenReturn(new TerminationLearningClient.Snapshot(1, List.of(1L), OffsetDateTime.now(ZoneOffset.UTC).plusDays(2)));

            var optOutResult = terminationService.trialOptOut(
                    agreementId, reason, eip712Signature, student, requestedAt, studentPrincipal);
            assertNotNull(optOutResult);

            // Verify cutoff fence committed
            ContractAgreement fenceAgreement = agreementRepository.findById(agreementId).orElseThrow();
            assertEquals(1, fenceAgreement.getTerminationCutoffSession());

            trial = agreementTrialRepository.findById(agreementId).orElseThrow();
            assertEquals(TrialStatus.OPT_OUT_PENDING, trial.getStatus());
            assertEquals(TrialDecisionSource.STUDENT_OPT_OUT, trial.getDecisionSource());

            // Synchronize with Learning -> TerminationCase becomes APPROVED
            UUID caseId = optOutResult.request().getId();
            terminationService.retryLearningSynchronization(caseId);

            TerminationCase approvedCase = terminationCaseRepository.findById(caseId).orElseThrow();
            assertEquals("APPROVED", approvedCase.getStatus());

            // 6. Warp through the independent 24h settlement-dispute window and finalize session 1.
            new Request<>("evm_increaseTime", List.of(86401), new HttpService(rpcUrl), org.web3j.protocol.core.methods.response.NetVersion.class).send();
            new Request<>("evm_mine", Collections.emptyList(), new HttpService(rpcUrl), org.web3j.protocol.core.methods.response.NetVersion.class).send();

            var chainTime = web3j.ethGetBlockByNumber(
                    org.web3j.protocol.core.DefaultBlockParameterName.LATEST, false).send().getBlock().getTimestamp();
            when(clock.instant()).thenReturn(Instant.ofEpochSecond(chainTime.longValueExact()));
            when(clock.getZone()).thenReturn(ZoneOffset.UTC);

            SessionSettlement session1Settlement = sessionSettlementRepository
                    .findByAgreementIdAndSessionId(agreementId, 1L).orElseThrow();
            settlementWorkflowService.initiateSessionFinalization(session1Settlement.getId());
            dispatcher.dispatchNext();
            reconcileReceipts();

            scanEventsUntilIngested("SESSION_SETTLED", onchainAgreementId);
            ProcessedEvent settleEvent = findProcessedEvent("SESSION_SETTLED", onchainAgreementId);
            settlementWorkflowService.processConfirmedSessionSettledEvent(settleEvent);

            SessionSettlement settled1 = sessionSettlementRepository.findById(session1Settlement.getId()).orElseThrow();
            assertEquals(SettlementStatus.SETTLED, settled1.getStatus());

            // 7. Termination Processor cancels agreement on-chain and triggers refund of remaining 3 sessions (30 USDC)
            terminationProcessor.process(agreementId);

            // Dispatch CANCEL transaction on-chain via Operator
            var cancelDispatched = dispatcher.dispatchNext();
            assertTrue(cancelDispatched.isPresent(), "Cancellation intent should be dispatched to Anvil");
            reconcileReceipts();

            // Ingest on-chain event AgreementCancelled & UNUSED_AMOUNT_REFUNDED
            scanEventsUntilIngested("AGREEMENT_CANCELLED", onchainAgreementId);
            ProcessedEvent cancelEvent = findProcessedEvent("AGREEMENT_CANCELLED", onchainAgreementId);
            lifecycleWorkflowService.processCancelledEvent(cancelEvent);

            scanEventsUntilIngested("UNUSED_AMOUNT_REFUNDED", onchainAgreementId);
            ProcessedEvent refundEvent = findProcessedEvent("UNUSED_AMOUNT_REFUNDED", onchainAgreementId);
            lifecycleWorkflowService.processUnusedAmountRefundedEvent(refundEvent);

            // Re-run processor to complete case
            terminationProcessor.process(agreementId);

            // 8. Assert Final State
            ContractAgreement finalAgreement = agreementRepository.findById(agreementId).orElseThrow();
            assertEquals(ContractAgreementStatus.CANCELLED, finalAgreement.getStatus());

            TerminationItem finalItem = terminationItemRepository.findById(agreementId).orElseThrow();
            assertEquals("COMPLETED", finalItem.getStatus());
            assertEquals(BigInteger.valueOf(30_000_000L), finalItem.getRefundedUnits(), "Student should be refunded 30 USDC (3 remaining sessions)");

            trial = agreementTrialRepository.findById(agreementId).orElseThrow();
            assertEquals(TrialStatus.TERMINATED, trial.getStatus());

            // Verify on-chain USDC balances
            Function finalBalanceFunc = new Function("balanceOf", List.of(new Address(student)), List.of());
            var ethCall = web3j.ethCall(Transaction.createEthCallTransaction(student, usdc, FunctionEncoder.encode(finalBalanceFunc)),
                    org.web3j.protocol.core.DefaultBlockParameterName.LATEST).send();
            BigInteger studentFinalBalance = Numeric.decodeQuantity(ethCall.getValue());
            assertEquals(studentInitialBalance.add(BigInteger.valueOf(30_000_000L)), studentFinalBalance,
                    "Student wallet on Anvil must receive the 30 USDC refund on top of prior balance");

        } finally {
            web3j.shutdown();
        }
    }

    private void reconcileReceipts() throws Exception {
        for (int i = 0; i < 20; i++) {
            int reconciled = receiptWatcher.reconcilePendingReceipts();
            if (reconciled > 0) break;
            Thread.sleep(50);
        }
    }

    private void scanEventsUntilIngested(String eventType, String onchainAgreementId) throws Exception {
        for (int i = 0; i < 15; i++) {
            ingestionService.scanNextConfirmedRange();
            boolean found = processedEventRepository.findAll().stream()
                    .anyMatch(e -> eventType.equalsIgnoreCase(e.getEventType())
                            && e.getDecodedPayload() != null
                            && e.getDecodedPayload().toLowerCase().contains(onchainAgreementId.toLowerCase()));
            if (found) break;
            Thread.sleep(50);
        }
    }

    private ProcessedEvent findProcessedEvent(String eventType, String onchainAgreementId) {
        return processedEventRepository.findAll().stream()
                .filter(e -> eventType.equalsIgnoreCase(e.getEventType())
                        && e.getDecodedPayload() != null
                        && e.getDecodedPayload().toLowerCase().contains(onchainAgreementId.toLowerCase()))
                .findFirst()
                .orElseThrow(() -> new NoSuchElementException("Event " + eventType + " for agreement " + onchainAgreementId + " not found"));
    }

    private String signTrialOptOut(
            ECKeyPair keyPair, String agreementId, String reasonHashHex,
            long requestedAt, long chainId, String verifyingContract) throws Exception {
        byte[] domainSeparator = computeDomainSeparator(chainId, verifyingContract);
        byte[] contractIdHash = Hash.sha3(agreementId.getBytes(StandardCharsets.UTF_8));
        byte[] reasonHashBytes = Numeric.toBytesPadded(Numeric.toBigInt(reasonHashHex), 32);
        byte[] wholeClassBytes = Numeric.toBytesPadded(BigInteger.ZERO, 32);
        byte[] requestedAtBytes = Numeric.toBytesPadded(BigInteger.valueOf(requestedAt), 32);

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write(TERMINATION_REQUEST_TYPEHASH);
        out.write(contractIdHash);
        out.write(reasonHashBytes);
        out.write(wholeClassBytes);
        out.write(requestedAtBytes);
        byte[] structHash = Hash.sha3(out.toByteArray());

        ByteArrayOutputStream digestStream = new ByteArrayOutputStream();
        digestStream.write(EIP191_PREFIX);
        digestStream.write(domainSeparator);
        digestStream.write(structHash);
        byte[] digest = Hash.sha3(digestStream.toByteArray());

        Sign.SignatureData sigData = Sign.signMessage(digest, keyPair, false);
        byte[] r = sigData.getR();
        byte[] s = sigData.getS();
        byte[] v = sigData.getV();
        byte[] sig = new byte[65];
        System.arraycopy(r, 0, sig, 0, 32);
        System.arraycopy(s, 0, sig, 32, 32);
        sig[64] = v[0];
        return Numeric.toHexString(sig);
    }

    private byte[] computeDomainSeparator(long chainId, String verifyingContract) throws Exception {
        byte[] nameHash = Hash.sha3("EduConnect Platform".getBytes(StandardCharsets.UTF_8));
        byte[] versionHash = Hash.sha3("1".getBytes(StandardCharsets.UTF_8));
        byte[] chainIdBytes = Numeric.toBytesPadded(BigInteger.valueOf(chainId), 32);
        byte[] contractAddressBytes = Numeric.toBytesPadded(Numeric.toBigInt(verifyingContract), 32);

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write(DOMAIN_TYPEHASH);
        out.write(nameHash);
        out.write(versionHash);
        out.write(chainIdBytes);
        out.write(contractAddressBytes);
        return Hash.sha3(out.toByteArray());
    }

    private void insertAgreement(
            UUID id, long classroomId, long studentId, String onchainAgreementId, String termsHash,
            String student, String tutor, String platform, String escrow, String usdc, long chainId,
            BigInteger totalAmount, BigInteger pricePerSession, int totalSessions) {
        jdbcTemplate.update("""
            INSERT INTO contract_agreement (
                id, classroom_id, student_id, tutor_id, student_email, tutor_email,
                student_wallet, tutor_wallet, platform_wallet, classroom_reviewer_email,
                chain_id, escrow_contract_address, token_address, token_symbol, token_decimals,
                terms_json, terms_hash, contract_version, total_price_vnd, vnd_per_usdc,
                total_amount_usdc_units, price_per_session_usdc_units, total_sessions,
                status, onchain_agreement_id, legacy_excluded, created_at, updated_at
            ) VALUES (
                ?, ?, ?, 1002, 'student@test.vn', 'tutor@test.vn',
                ?, ?, ?, 'staff@test.vn',
                ?, ?, ?, 'USDC', 6,
                '{}', ?, 1, 1000000.00, 25000.00,
                ?, ?, ?,
                'PREPARING_BLOCKCHAIN', ?, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            )
            """,
                id, classroomId, studentId,
                student, tutor, platform,
                chainId, escrow, usdc,
                termsHash,
                totalAmount, pricePerSession, totalSessions,
                onchainAgreementId);
    }
}
