package iuh.fit.contract_service.service;

import iuh.fit.contract_service.blockchain.DecodedEscrowEvent;
import iuh.fit.contract_service.blockchain.EduConnectEscrowCalldataEncoder;
import iuh.fit.contract_service.command.BlockchainTransactionCommand;
import iuh.fit.contract_service.command.BlockchainTransactionIntentResult;
import iuh.fit.contract_service.entity.ContractAgreement;
import iuh.fit.contract_service.entity.OutboxEvent;
import iuh.fit.contract_service.entity.ProcessedEvent;
import iuh.fit.contract_service.enums.BlockchainTransactionAction;
import iuh.fit.contract_service.enums.ContractAgreementStatus;
import iuh.fit.contract_service.repository.ContractAgreementRepository;
import iuh.fit.contract_service.repository.OutboxEventRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.web3j.crypto.Hash;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
public class AgreementRegistrationWorkflowService {
    private static final Logger log = LoggerFactory.getLogger(AgreementRegistrationWorkflowService.class);
    private static final String ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

    private final ContractAgreementRepository agreementRepository;
    private final BlockchainTransactionCommandService commandService;
    private final OutboxEventRepository outboxEventRepository;
    private final ObjectMapper objectMapper;
    private final iuh.fit.contract_service.repository.AgreementTrialRepository agreementTrialRepository;
    private final iuh.fit.contract_service.config.EscrowTrialProperties escrowTrialProperties;

    public AgreementRegistrationWorkflowService(
            ContractAgreementRepository agreementRepository,
            BlockchainTransactionCommandService commandService,
            OutboxEventRepository outboxEventRepository,
            ObjectMapper objectMapper) {
        this(agreementRepository, commandService, outboxEventRepository, objectMapper, null, null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public AgreementRegistrationWorkflowService(
            ContractAgreementRepository agreementRepository,
            BlockchainTransactionCommandService commandService,
            OutboxEventRepository outboxEventRepository,
            ObjectMapper objectMapper,
            iuh.fit.contract_service.repository.AgreementTrialRepository agreementTrialRepository,
            iuh.fit.contract_service.config.EscrowTrialProperties escrowTrialProperties) {
        this.agreementRepository = agreementRepository;
        this.commandService = commandService;
        this.outboxEventRepository = outboxEventRepository;
        this.objectMapper = objectMapper;
        this.agreementTrialRepository = agreementTrialRepository;
        this.escrowTrialProperties = escrowTrialProperties;
    }

    @Transactional
    public BlockchainTransactionIntentResult initiateRegistration(UUID agreementId) {
        ContractAgreement agreement = agreementRepository.findById(agreementId)
                .orElseThrow(() -> new IllegalArgumentException("Contract agreement not found: " + agreementId));

        if (agreement.getStatus() != ContractAgreementStatus.PREPARING_BLOCKCHAIN) {
            throw new IllegalStateException("Agreement must be in PREPARING_BLOCKCHAIN status to initiate registration, actual: " + agreement.getStatus());
        }

        validateRegistrationCommandSource(agreement);

        if (agreementTrialRepository != null) {
            agreementTrialRepository.findByAgreementId(agreement.getId()).ifPresent(trial -> {
                OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
                java.time.Duration margin = (escrowTrialProperties != null && escrowTrialProperties.fundingConfirmationSafetyMargin() != null)
                        ? escrowTrialProperties.fundingConfirmationSafetyMargin()
                        : java.time.Duration.ofMinutes(30);
                requireFundingWindow(now, margin, trial.getTrialSessionStartAt());
            });
        }

        String calldata = EduConnectEscrowCalldataEncoder.encodeRegisterAgreement(
                agreement.getOnchainAgreementId(),
                agreement.getStudentWallet(),
                agreement.getTutorWallet(),
                agreement.getTermsHash(),
                agreement.getTotalAmountUsdcUnits(),
                agreement.getPricePerSessionUsdcUnits(),
                agreement.getTotalSessions());

        String calldataHash = Hash.sha3(calldata);
        String idempotencyKey = "REGISTER:" + agreement.getChainId() + ":" + agreement.getId();

        BlockchainTransactionCommand command = new BlockchainTransactionCommand(
                idempotencyKey,
                BlockchainTransactionAction.REGISTER,
                agreement.getChainId(),
                agreement.getPlatformWallet(),
                agreement.getEscrowContractAddress(),
                calldata,
                calldataHash,
                agreement.getId(),
                null,
                null);

        return commandService.createIntent(command);
    }

    @Transactional
    public boolean processConfirmedRegistrationEvent(ProcessedEvent event) {
        if (!"AGREEMENT_REGISTERED".equalsIgnoreCase(event.getEventType())) {
            return false;
        }

        DecodedEscrowEvent decodedEvent;
        try {
            decodedEvent = objectMapper.readValue(event.getDecodedPayload(), DecodedEscrowEvent.class);
        } catch (Exception e) {
            log.error("Failed to deserialize ProcessedEvent decodedPayload for event ID {}", event.getId(), e);
            throw new IllegalStateException("Invalid event payload", e);
        }

        String onchainAgreementId = decodedEvent.agreementId().toLowerCase(Locale.ROOT);
        ContractAgreement agreement = agreementRepository
                .findByChainIdAndOnchainAgreementId(event.getChainId(), onchainAgreementId)
                .orElse(null);

        if (agreement == null) {
            log.warn("No agreement found for chainId {} and onchainAgreementId {}", event.getChainId(), onchainAgreementId);
            return false;
        }

        if (agreement.getStatus() == ContractAgreementStatus.WAITING_PAYMENT) {
            log.info("Agreement {} is already in WAITING_PAYMENT status", agreement.getId());
            return true;
        }

        if (agreement.getStatus() != ContractAgreementStatus.PREPARING_BLOCKCHAIN) {
            throw new IllegalStateException("Cannot transition agreement " + agreement.getId() +
                    " to WAITING_PAYMENT from current status " + agreement.getStatus());
        }

        Map<String, String> attrs = decodedEvent.attributes();
        validateEventAttributesMatchAgreement(agreement, attrs);

        long deadlineSeconds = Long.parseLong(attrs.get("paymentDeadline"));
        OffsetDateTime paymentDeadline = OffsetDateTime.ofInstant(Instant.ofEpochSecond(deadlineSeconds), ZoneOffset.UTC);

        agreement.markWaitingPayment(paymentDeadline);
        agreementRepository.saveAndFlush(agreement);

        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        String payloadJson = String.format(
                "{\"agreementId\":\"%s\",\"onchainAgreementId\":\"%s\",\"paymentDeadline\":\"%s\"}",
                agreement.getId(), agreement.getOnchainAgreementId(), paymentDeadline);

        OutboxEvent outboxEvent = OutboxEvent.create(
                "contract.waiting_payment.v1",
                "ContractAgreement",
                agreement.getId().toString(),
                null,
                payloadJson,
                now);
        outboxEventRepository.saveAndFlush(outboxEvent);

        log.info("Successfully transitioned agreement {} to WAITING_PAYMENT with deadline {}", agreement.getId(), paymentDeadline);
        return true;
    }

    private void validateEventAttributesMatchAgreement(ContractAgreement agreement, Map<String, String> attrs) {
        requireAttributeMatch("student", agreement.getStudentWallet(), attrs.get("student"));
        requireAttributeMatch("tutor", agreement.getTutorWallet(), attrs.get("tutor"));
        requireAttributeMatch("termsHash", agreement.getTermsHash(), attrs.get("termsHash"));
        requireAttributeMatch("totalAmount", agreement.getTotalAmountUsdcUnits().toString(), attrs.get("totalAmount"));
        requireAttributeMatch("pricePerSession", agreement.getPricePerSessionUsdcUnits().toString(), attrs.get("pricePerSession"));
        requireAttributeMatch("totalSessions", String.valueOf(agreement.getTotalSessions()), attrs.get("totalSessions"));
    }

    static void requireFundingWindow(
            OffsetDateTime registrationRequestedAt,
            java.time.Duration safetyMargin,
            OffsetDateTime trialSessionStartAt) {
        OffsetDateTime safeFundingBoundary = registrationRequestedAt.plusHours(24).plus(safetyMargin);
        if (!safeFundingBoundary.isBefore(trialSessionStartAt)) {
            throw new IllegalStateException(
                    "Cannot initiate on-chain registration: insufficient funding window before trial session starts at "
                            + trialSessionStartAt);
        }
    }

    private void requireAttributeMatch(String fieldName, String expected, String actual) {
        if (actual == null || !expected.equalsIgnoreCase(actual)) {
            throw new IllegalStateException(String.format(
                    "Event attribute mismatch for field '%s': expected '%s', got '%s'", fieldName, expected, actual));
        }
    }

    private void validateRegistrationCommandSource(ContractAgreement agreement) {
        requireUsableAddress("studentWallet", agreement.getStudentWallet());
        requireUsableAddress("tutorWallet", agreement.getTutorWallet());
        requireUsableAddress("platformWallet", agreement.getPlatformWallet());
        requireUsableAddress("escrowContractAddress", agreement.getEscrowContractAddress());
    }

    private void requireUsableAddress(String fieldName, String address) {
        if (address == null || !address.matches("^0x[0-9a-fA-F]{40}$") || ZERO_ADDRESS.equalsIgnoreCase(address)) {
            throw new IllegalStateException(fieldName + " must be a non-zero EVM address before registering agreement on-chain");
        }
    }
}
