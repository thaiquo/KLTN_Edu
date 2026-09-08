package iuh.fit.contract_service.api;

import iuh.fit.contract_service.command.BlockchainTransactionIntentResult;
import iuh.fit.contract_service.config.security.ContractAccessControl;
import iuh.fit.contract_service.config.security.ContractUserPrincipal;
import iuh.fit.contract_service.config.security.CurrentUserContext;
import iuh.fit.contract_service.entity.ContractAgreement;
import iuh.fit.contract_service.entity.EscrowPayment;
import iuh.fit.contract_service.entity.SessionSettlement;
import iuh.fit.contract_service.entity.BlockchainTransaction;
import iuh.fit.contract_service.entity.Dispute;
import iuh.fit.contract_service.enums.ContractAgreementStatus;
import iuh.fit.contract_service.enums.DisputeStatus;
import iuh.fit.contract_service.enums.SettlementOutcome;
import iuh.fit.contract_service.enums.SettlementStatus;
import iuh.fit.contract_service.entity.ContractAcceptance;
import iuh.fit.contract_service.repository.ContractAcceptanceRepository;
import iuh.fit.contract_service.repository.ContractAgreementRepository;
import iuh.fit.contract_service.repository.SessionSettlementRepository;
import iuh.fit.contract_service.repository.BlockchainTransactionRepository;
import iuh.fit.contract_service.repository.DisputeRepository;
import iuh.fit.contract_service.service.AgreementLifecycleWorkflowService;
import iuh.fit.contract_service.service.DisputeWorkflowService;
import iuh.fit.contract_service.service.SessionSettlementWorkflowService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.bind.annotation.*;
import jakarta.servlet.http.HttpServletRequest;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * REST API for Contract/Escrow management.
 * Authorization (Admin sees all, Staff sees own classroom, Student/Tutor see own)
 * is done via query filtering using JWT claims passed as headers by API Gateway.
 */
@RestController
@RequestMapping("/api/contracts")
public class ContractManagementController {

    private final ContractAgreementRepository agreementRepository;
    private final SessionSettlementRepository settlementRepository;
    private final BlockchainTransactionRepository transactionRepository;
    private final DisputeRepository disputeRepository;
    private final DisputeWorkflowService disputeWorkflowService;
    private final SessionSettlementWorkflowService settlementWorkflowService;
    private final AgreementLifecycleWorkflowService lifecycleWorkflowService;
    private final iuh.fit.contract_service.service.NotificationDispatcher notificationDispatcher;
    private final iuh.fit.contract_service.service.ContractSignatureService signatureService;
    private final iuh.fit.contract_service.service.AgreementFundingWorkflowService fundingWorkflowService;
    private final iuh.fit.contract_service.repository.EscrowPaymentRepository escrowPaymentRepository;
    private final ContractAcceptanceRepository acceptanceRepository;
    private final iuh.fit.contract_service.service.LearningServiceDispatcher learningServiceDispatcher;
    private final CurrentUserContext currentUserContext;
    private final ContractAccessControl accessControl;

    public ContractManagementController(
            ContractAgreementRepository agreementRepository,
            SessionSettlementRepository settlementRepository,
            BlockchainTransactionRepository transactionRepository,
            DisputeRepository disputeRepository,
            DisputeWorkflowService disputeWorkflowService,
            SessionSettlementWorkflowService settlementWorkflowService,
            AgreementLifecycleWorkflowService lifecycleWorkflowService,
            iuh.fit.contract_service.service.NotificationDispatcher notificationDispatcher,
            iuh.fit.contract_service.service.ContractSignatureService signatureService,
            iuh.fit.contract_service.service.AgreementFundingWorkflowService fundingWorkflowService,
            iuh.fit.contract_service.repository.EscrowPaymentRepository escrowPaymentRepository,
            ContractAcceptanceRepository acceptanceRepository,
            iuh.fit.contract_service.service.LearningServiceDispatcher learningServiceDispatcher,
            CurrentUserContext currentUserContext,
            ContractAccessControl accessControl) {
        this.agreementRepository = agreementRepository;
        this.settlementRepository = settlementRepository;
        this.transactionRepository = transactionRepository;
        this.disputeRepository = disputeRepository;
        this.disputeWorkflowService = disputeWorkflowService;
        this.settlementWorkflowService = settlementWorkflowService;
        this.lifecycleWorkflowService = lifecycleWorkflowService;
        this.notificationDispatcher = notificationDispatcher;
        this.signatureService = signatureService;
        this.fundingWorkflowService = fundingWorkflowService;
        this.escrowPaymentRepository = escrowPaymentRepository;
        this.acceptanceRepository = acceptanceRepository;
        this.learningServiceDispatcher = learningServiceDispatcher;
        this.currentUserContext = currentUserContext;
        this.accessControl = accessControl;
    }

    public record InitiateAgreementRequest(
            Long classroomId,
            String className,
            Long studentId,
            String studentName,
            String studentEmail,
            String studentPhone,
            Long tutorId,
            String tutorName,
            String tutorEmail,
            String tutorPhone,
            String studentWallet,
            String tutorWallet,
            BigDecimal pricePerSessionVnd,
            Integer totalSessions,
            String classroomReviewerEmail
    ) {}

    public record SignAgreementRequest(
            String walletAddress,
            String signature
    ) {}

    public record ProposeSettlementRequest(
            Long sessionId,
            String outcome,
            String evidenceHash,
            String evidence
    ) {}

    public record OpenDisputeRequest(
            String reason,
            String evidenceHash,
            String evidenceObjectKey,
            String contentType,
            String sha256
    ) {}

    public record LifecycleReasonRequest(String reason) {}

    public record AcceptanceDto(
            String id,
            String agreementId,
            Long userId,
            String role,
            String walletAddress,
            String signature,
            String acceptedAt,
            String termsHash,
            Integer contractVersion
    ) {}

    @PostMapping("/agreements/initiate")
    public ResponseEntity<AgreementDetailDto> initiateAgreement(
            @RequestBody InitiateAgreementRequest request) {

        if (request.classroomId() == null || request.classroomId() <= 0
                || request.studentId() == null || request.studentId() <= 0
                || request.tutorId() == null || request.tutorId() <= 0
                || isBlank(request.className())
                || isBlank(request.studentEmail())
                || isBlank(request.tutorEmail())
                || request.pricePerSessionVnd() == null || request.pricePerSessionVnd().signum() <= 0
                || request.totalSessions() == null || request.totalSessions() <= 0) {
            return ResponseEntity.badRequest().build();
        }

        ContractUserPrincipal currentUser = currentUserContext.requireCurrentUser();
        accessControl.requireCanInitiateAgreement(
                new ContractAccessControl.ContractAgreementSeed(request.tutorId(), request.tutorEmail()),
                currentUser);

        // Return existing active/pending agreement if already initiated for this class and student
        Optional<ContractAgreement> existing = agreementRepository.findByClassroomIdAndStudentIdAndContractVersion(
                request.classroomId(), request.studentId(), 1);
        if (existing.isPresent()) {
            return ResponseEntity.ok(toAgreementDetail(existing.get()));
        }

        String studentName = !isBlank(request.studentName()) ? request.studentName() : request.studentEmail().split("@")[0];
        String tutorName = !isBlank(request.tutorName()) ? request.tutorName() : request.tutorEmail().split("@")[0];
        String studentPhone = request.studentPhone() != null ? request.studentPhone().trim() : "";
        String tutorPhone = request.tutorPhone() != null ? request.tutorPhone().trim() : "";

        String studentWallet = (request.studentWallet() != null && request.studentWallet().startsWith("0x") && request.studentWallet().length() == 42)
                ? request.studentWallet()
                : "0x0000000000000000000000000000000000000000";

        if (request.tutorWallet() == null || !request.tutorWallet().startsWith("0x") || request.tutorWallet().length() != 42) {
            return ResponseEntity.badRequest().build();
        }

        UUID agreementId = UUID.randomUUID();
        String onchainAgreementId = org.web3j.crypto.Hash.sha3String("AGREEMENT:" + agreementId);
        String termsHash = org.web3j.crypto.Hash.sha3String("TERMS:" + request.classroomId() + ":" + request.studentId() + ":" + request.tutorId());

        BigDecimal pricePerSessionVnd = request.pricePerSessionVnd();
        int totalSessions = request.totalSessions();
        BigDecimal totalPriceVnd = pricePerSessionVnd.multiply(BigDecimal.valueOf(totalSessions));
        BigDecimal vndPerUsdc = BigDecimal.valueOf(25000);

        // Convert to USDC units (6 decimals)
        long pricePerSessionUnits = pricePerSessionVnd.divide(vndPerUsdc, 2, java.math.RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(1_000_000)).longValue();
        long totalAmountUnits = pricePerSessionUnits * totalSessions;

        OffsetDateTime now = OffsetDateTime.now();

        ContractAgreement agreement = ContractAgreement.builder()
                .id(agreementId)
                .onchainAgreementId(onchainAgreementId)
                .classroomId(request.classroomId())
                .className(request.className())
                .studentId(request.studentId())
                .studentName(request.studentName())
                .studentEmail(request.studentEmail())
                .studentPhone(request.studentPhone())
                .tutorId(request.tutorId())
                .tutorName(request.tutorName())
                .tutorEmail(request.tutorEmail())
                .tutorPhone(request.tutorPhone())
                .classroomReviewerEmail(request.classroomReviewerEmail() != null ? request.classroomReviewerEmail() : request.tutorEmail())
                .studentWallet(studentWallet.toLowerCase(Locale.ROOT))
                .tutorWallet(request.tutorWallet().toLowerCase(Locale.ROOT))
                .platformWallet("0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266")
                .chainId(11155111L)
                .escrowContractAddress("0x984bEc42561BBC9f63BEE4BA1469872cD369d3b3")
                .tokenAddress("0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238")
                .tokenSymbol("USDC")
                .tokenDecimals((short) 6)
                .termsJson("{\"classroomId\":" + request.classroomId() + ",\"studentEmail\":\"" + (request.studentEmail() != null ? request.studentEmail() : "") + "\",\"sessions\":" + totalSessions + "}")
                .termsHash(termsHash)
                .contractVersion(1)
                .totalPriceVnd(totalPriceVnd)
                .vndPerUsdc(vndPerUsdc)
                .totalAmountUsdcUnits(BigInteger.valueOf(totalAmountUnits))
                .pricePerSessionUsdcUnits(BigInteger.valueOf(pricePerSessionUnits))
                .totalSessions(totalSessions)
                .status(ContractAgreementStatus.PENDING_TUTOR_ACCEPTANCE)
                .createdAt(now)
                .updatedAt(now)
                .build();

        ContractAgreement saved = agreementRepository.save(agreement);

        // Dispatch async notification to tutor to sign
        if (request.tutorEmail() != null && !request.tutorEmail().isBlank()) {
            notificationDispatcher.sendAsync(
                    request.tutorEmail(),
                    request.tutorId(),
                    "Vui lòng ký hợp đồng lớp học",
                    "Bạn đã chấp nhận yêu cầu học viên. Hợp đồng đã được khởi tạo, vui lòng kiểm tra và ký xác nhận!",
                    "AGREEMENT_PENDING_TUTOR",
                    "AGREEMENT",
                    saved.getId().toString()
            );
        }

        // Dispatch async notification to student that request accepted and tutor is signing
        if (request.studentEmail() != null && !request.studentEmail().isBlank()) {
            notificationDispatcher.sendAsync(
                    request.studentEmail(),
                    request.studentId(),
                    "Yêu cầu tham gia lớp đã được chấp nhận",
                    "Gia sư đã chấp nhận yêu cầu của bạn. Hợp đồng đang chờ Gia sư ký trước khi gửi cho bạn xác nhận.",
                    "AGREEMENT_ACCEPTED",
                    "AGREEMENT",
                    saved.getId().toString()
            );
        }

        return ResponseEntity.ok(toAgreementDetail(saved));
    }

    @PostMapping("/agreements/{id}/sign")
    public ResponseEntity<?> signAgreement(
            @PathVariable UUID id,
            @RequestBody SignAgreementRequest request,
            HttpServletRequest httpServletRequest) {

        String ipAddress = httpServletRequest.getRemoteAddr();
        String userAgent = httpServletRequest.getHeader("User-Agent");

        ContractUserPrincipal currentUser = currentUserContext.requireCurrentUser();
        String effectiveRole = currentUser.activeRole();
        ContractAgreement agreement = agreementRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND, "Agreement not found"));
        accessControl.requireCanSign(agreement, effectiveRole, currentUser);

        try {
            ContractAgreement updated = signatureService.signAgreement(
                    id,
                    currentUser.userId(),
                    currentUser.email(),
                    effectiveRole,
                    request.walletAddress(),
                    request.signature(),
                    null,
                    ipAddress,
                    userAgent
            );
            return ResponseEntity.ok(toAgreementDetail(updated));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Lỗi xử lý ký hợp đồng: " + e.getMessage()));
        }
    }

    @PostMapping("/agreements/{id}/payment-submitted")
    public ResponseEntity<?> submitPayment(
            @PathVariable UUID id,
            @RequestBody(required = false) Map<String, String> payload) {
        try {
            String txHash = payload != null ? payload.get("txHash") : null;
            ContractUserPrincipal currentUser = currentUserContext.requireCurrentUser();
            ContractAgreement agreement = agreementRepository.findById(id)
                    .orElseThrow(() -> new IllegalArgumentException("Hợp đồng không tồn tại: " + id));

            accessControl.requireCanSubmitPayment(agreement, currentUser);
            if (agreement.getStatus() != ContractAgreementStatus.WAITING_PAYMENT
                    && agreement.getStatus() != ContractAgreementStatus.PAYMENT_CONFIRMING) {
                return ResponseEntity.status(409).body(Map.of(
                        "error",
                        "Hợp đồng chưa được ghi nhận on-chain nên chưa thể nạp cọc.",
                        "status",
                        agreement.getStatus().name()));
            }
            ContractAgreement saved = fundingWorkflowService.recordPaymentSubmission(id, txHash);
            return ResponseEntity.ok(toAgreementDetail(saved));
        } catch (ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode()).body(Map.of("error", e.getReason() != null ? e.getReason() : "Forbidden"));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Lỗi ghi nhận thanh toán: " + e.getMessage()));
        }
    }

    private String extractStudentEmail(ContractAgreement agreement) {
        if (agreement.getTermsJson() != null && agreement.getTermsJson().contains("\"studentEmail\":\"")) {
            try {
                int start = agreement.getTermsJson().indexOf("\"studentEmail\":\"") + 16;
                int end = agreement.getTermsJson().indexOf("\"", start);
                if (start > 15 && end > start) {
                    return agreement.getTermsJson().substring(start, end);
                }
            } catch (Exception ignored) {}
        }
        return null;
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private String resolveBytes32Hash(String suppliedHash, String source) {
        if (suppliedHash != null && suppliedHash.matches("^0x[0-9a-fA-F]{64}$")) {
            return suppliedHash.toLowerCase(Locale.ROOT);
        }
        return org.web3j.crypto.Hash.sha3String(source != null ? source : "");
    }

    private String nullToBlank(String value) {
        return value == null ? "" : value;
    }

    @GetMapping("/agreements/{id}/acceptances")
    public ResponseEntity<List<AcceptanceDto>> getAcceptances(@PathVariable UUID id) {
        ContractUserPrincipal currentUser = currentUserContext.requireCurrentUser();
        ContractAgreement agreement = agreementRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND, "Agreement not found"));
        accessControl.requireCanViewAgreement(agreement, currentUser);

        List<AcceptanceDto> list = signatureService.getAcceptances(id).stream()
                .map(a -> new AcceptanceDto(
                        a.getId().toString(),
                        a.getAgreementId().toString(),
                        a.getUserId(),
                        a.getRole(),
                        a.getWalletAddress(),
                        a.getSignature(),
                        a.getAcceptedAt() != null ? a.getAcceptedAt().toString() : null,
                        a.getTermsHash(),
                        a.getContractVersion()
                ))
                .collect(Collectors.toList());
        return ResponseEntity.ok(list);
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // AGREEMENTS
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    @GetMapping("/agreements")
    public ResponseEntity<Page<AgreementSummaryDto>> listAgreements(
            @RequestParam(value = "status", required = false) String statusFilter,
            @PageableDefault(size = 20) Pageable pageable) {

        ContractUserPrincipal currentUser = currentUserContext.requireCurrentUser();
        List<ContractAgreement> filtered = accessControl.filterAgreements(agreementRepository.findAll(), currentUser);

        // Filter by status
        if (statusFilter != null && !statusFilter.isBlank()) {
            try {
                ContractAgreementStatus st = ContractAgreementStatus.valueOf(statusFilter.toUpperCase());
                filtered = filtered.stream()
                        .filter(a -> a.getStatus() == st)
                        .collect(Collectors.toList());
            } catch (IllegalArgumentException ignored) {}
        }

        // Sort by createdAt desc
        filtered.sort(Comparator.comparing(ContractAgreement::getCreatedAt).reversed());

        // Manual pagination
        int start = (int) pageable.getOffset();
        int end = Math.min(start + pageable.getPageSize(), filtered.size());
        List<AgreementSummaryDto> page = (start >= filtered.size())
                ? Collections.emptyList()
                : filtered.subList(start, end).stream()
                        .map(this::toAgreementSummary)
                        .collect(Collectors.toList());

        return ResponseEntity.ok(new PageImpl<>(page, pageable, filtered.size()));
    }

    @GetMapping("/agreements/{id}")
    public ResponseEntity<AgreementDetailDto> getAgreement(
            @PathVariable UUID id) {
        ContractUserPrincipal currentUser = currentUserContext.requireCurrentUser();
        return agreementRepository.findById(id)
                .filter(a -> accessControl.canViewAgreement(a, currentUser))
                .map(this::toAgreementDetail)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/agreements/{id}/settlements")
    public ResponseEntity<List<SettlementDto>> getSettlements(
            @PathVariable UUID id) {
        ContractUserPrincipal currentUser = currentUserContext.requireCurrentUser();
        return agreementRepository.findById(id)
                .filter(a -> accessControl.canViewAgreement(a, currentUser))
                .map(agreement -> {
                    List<SettlementDto> list = settlementRepository
                            .findByAgreementId(agreement.getId())
                            .stream()
                            .sorted(Comparator.comparing(SessionSettlement::getCreatedAt))
                            .map(this::toSettlementDto)
                        .collect(Collectors.toList());
                    return ResponseEntity.ok(list);
                }).orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/agreements/{id}/settlements/propose")
    public ResponseEntity<Map<String, Object>> proposeSettlement(
            @PathVariable UUID id,
            @RequestBody ProposeSettlementRequest body) {
        try {
            ContractUserPrincipal currentUser = currentUserContext.requireCurrentUser();
            ContractAgreement agreement = agreementRepository.findById(id)
                    .orElseThrow(() -> new ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND, "Agreement not found"));
            accessControl.requireCanManageSettlement(agreement, currentUser);

            SettlementOutcome outcome = SettlementOutcome.valueOf(body.outcome().trim().toUpperCase(Locale.ROOT));
            String evidenceHash = resolveBytes32Hash(
                    body.evidenceHash(),
                    "SETTLEMENT:" + id + ":" + body.sessionId() + ":" + body.outcome() + ":" + nullToBlank(body.evidence()));
            BlockchainTransactionIntentResult result = settlementWorkflowService.initiateSessionProposal(
                    id, body.sessionId(), outcome, evidenceHash);
            SessionSettlement settlement = settlementRepository.findByAgreementIdAndSessionId(id, body.sessionId())
                    .orElseThrow();

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "agreementId", id.toString(),
                    "settlementId", settlement.getId().toString(),
                    "transactionStatus", result.status().name()));
        } catch (ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode())
                    .body(Map.of("error", e.getReason() != null ? e.getReason() : "Forbidden"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/settlements/{id}/finalize")
    public ResponseEntity<Map<String, Object>> finalizeSettlement(@PathVariable UUID id) {
        try {
            ContractUserPrincipal currentUser = currentUserContext.requireCurrentUser();
            SessionSettlement settlement = settlementRepository.findById(id)
                    .orElseThrow(() -> new ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND, "Settlement not found"));
            accessControl.requireCanManageSettlement(settlement.getAgreement(), currentUser);

            BlockchainTransactionIntentResult result = settlementWorkflowService.initiateSessionFinalization(id);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "settlementId", id.toString(),
                    "transactionStatus", result.status().name()));
        } catch (ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode())
                    .body(Map.of("error", e.getReason() != null ? e.getReason() : "Forbidden"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/agreements/{agreementId}/settlements/{sessionId}/dispute")
    public ResponseEntity<Map<String, Object>> openDispute(
            @PathVariable UUID agreementId,
            @PathVariable Long sessionId,
            @RequestBody OpenDisputeRequest body) {
        try {
            ContractUserPrincipal currentUser = currentUserContext.requireCurrentUser();
            ContractAgreement agreement = agreementRepository.findById(agreementId)
                    .orElseThrow(() -> new ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND, "Agreement not found"));
            accessControl.requireCanOpenDispute(agreement, currentUser);
            SessionSettlement settlement = settlementRepository.findByAgreementIdAndSessionId(agreementId, sessionId)
                    .orElseThrow(() -> new ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND, "Settlement not found"));

            String evidenceHash = resolveBytes32Hash(
                    body.evidenceHash(),
                    "DISPUTE:" + agreementId + ":" + sessionId + ":" + nullToBlank(body.reason()) + ":" + nullToBlank(body.evidenceObjectKey()));
            BlockchainTransactionIntentResult result = disputeWorkflowService.initiateDisputeOpening(
                    settlement.getId(),
                    currentUser.userId(),
                    evidenceHash,
                    body.evidenceObjectKey(),
                    body.contentType(),
                    body.sha256());

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "agreementId", agreementId.toString(),
                    "settlementId", settlement.getId().toString(),
                    "transactionStatus", result.status().name()));
        } catch (ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode())
                    .body(Map.of("error", e.getReason() != null ? e.getReason() : "Forbidden"));
        } catch (SecurityException e) {
            return ResponseEntity.status(403).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/agreements/{id}/expire")
    public ResponseEntity<Map<String, Object>> expireAgreement(@PathVariable UUID id) {
        try {
            ContractUserPrincipal currentUser = currentUserContext.requireCurrentUser();
            ContractAgreement agreement = agreementRepository.findById(id)
                    .orElseThrow(() -> new ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND, "Agreement not found"));
            accessControl.requireCanManageAgreementLifecycle(agreement, currentUser);
            BlockchainTransactionIntentResult result = lifecycleWorkflowService.initiateExpiration(id);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "agreementId", id.toString(),
                    "transactionStatus", result.status().name()));
        } catch (ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode())
                    .body(Map.of("error", e.getReason() != null ? e.getReason() : "Forbidden"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/agreements/{id}/cancel")
    public ResponseEntity<Map<String, Object>> cancelAgreement(
            @PathVariable UUID id,
            @RequestBody(required = false) LifecycleReasonRequest body) {
        try {
            ContractUserPrincipal currentUser = currentUserContext.requireCurrentUser();
            ContractAgreement agreement = agreementRepository.findById(id)
                    .orElseThrow(() -> new ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND, "Agreement not found"));
            accessControl.requireCanManageAgreementLifecycle(agreement, currentUser);
            BlockchainTransactionIntentResult result = lifecycleWorkflowService.initiateCancellation(
                    id, body != null ? body.reason() : "");
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "agreementId", id.toString(),
                    "transactionStatus", result.status().name()));
        } catch (ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode())
                    .body(Map.of("error", e.getReason() != null ? e.getReason() : "Forbidden"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/agreements/{id}/transactions")
    public ResponseEntity<List<BlockchainTxDto>> getTransactions(
            @PathVariable UUID id) {
        ContractUserPrincipal currentUser = currentUserContext.requireCurrentUser();
        ContractAgreement agreement = agreementRepository.findById(id).orElse(null);
        if (agreement == null || !accessControl.canViewAgreement(agreement, currentUser)) {
            return ResponseEntity.notFound().build();
        }

        List<BlockchainTxDto> list = new ArrayList<>(transactionRepository.findAll().stream()
                .filter(t -> id.equals(t.getAgreementId()))
                .sorted(Comparator.comparing(BlockchainTransaction::getCreatedAt))
                .map(this::toTxDto)
                .collect(Collectors.toList()));

        escrowPaymentRepository.findByAgreementId(id).ifPresent(p -> {
            if (p.getFundTxHash() != null && p.getFundTxHash().startsWith("0x") && !p.getFundTxHash().equals("0x_escrow_deposit_tx")) {
                boolean alreadyListed = list.stream().anyMatch(t -> p.getFundTxHash().equalsIgnoreCase(t.transactionHash()));
                if (!alreadyListed) {
                    list.add(new BlockchainTxDto(
                            UUID.randomUUID().toString(),
                            "DEPOSIT_ESCROW",
                            p.getFundTxHash(),
                            p.getStatus().name(),
                            p.getConfirmedBlockNumber(),
                            (short) 1,
                            id.toString(),
                            null,
                            p.getChainId(),
                            p.getCreatedAt() != null ? p.getCreatedAt().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME) : null,
                            p.getUpdatedAt() != null ? p.getUpdatedAt().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME) : null,
                            null
                    ));
                }
            }
        });

        return ResponseEntity.ok(list);
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // DISPUTES
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    @GetMapping("/disputes")
    public ResponseEntity<Page<DisputeSummaryDto>> listDisputes(
            @RequestParam(value = "status", required = false) String statusFilter,
            @PageableDefault(size = 20) Pageable pageable) {

        ContractUserPrincipal currentUser = currentUserContext.requireCurrentUser();
        List<Dispute> filtered = accessControl.filterDisputes(disputeRepository.findAll(), currentUser);

        if (statusFilter != null && !statusFilter.isBlank()) {
            try {
                DisputeStatus st = DisputeStatus.valueOf(statusFilter.toUpperCase());
                filtered = filtered.stream()
                        .filter(d -> d.getStatus() == st)
                        .collect(Collectors.toList());
            } catch (IllegalArgumentException ignored) {}
        }

        filtered.sort(Comparator.comparing(Dispute::getCreatedAt).reversed());

        int start = (int) pageable.getOffset();
        int end = Math.min(start + pageable.getPageSize(), filtered.size());
        List<DisputeSummaryDto> page = (start >= filtered.size())
                ? Collections.emptyList()
                : filtered.subList(start, end).stream()
                        .map(this::toDisputeDto)
                        .collect(Collectors.toList());

        return ResponseEntity.ok(new PageImpl<>(page, pageable, filtered.size()));
    }

    @GetMapping("/disputes/{id}")
    public ResponseEntity<DisputeSummaryDto> getDispute(@PathVariable UUID id) {
        ContractUserPrincipal currentUser = currentUserContext.requireCurrentUser();
        return disputeRepository.findById(id)
                .filter(dispute -> accessControl.canViewDispute(dispute, currentUser))
                .map(this::toDisputeDto)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Resolve dispute â€” ADMIN resolves all, STAFF only own-classroom disputes.
     */
    @PostMapping("/disputes/{id}/resolve")
    public ResponseEntity<Map<String, Object>> resolveDispute(
            @PathVariable UUID id,
            @RequestBody ResolveDisputeRequest body) {

        ContractUserPrincipal currentUser = currentUserContext.requireCurrentUser();
        if (!currentUser.hasActiveAuthority("ADMIN") && !currentUser.hasActiveAuthority("STAFF")) {
            return ResponseEntity.status(403)
                    .body(Map.of("error", "Chỉ Admin hoặc Staff mới có quyền xử lý khiếu nại."));
        }

        Dispute dispute = disputeRepository.findById(id).orElse(null);
        if (dispute == null) return ResponseEntity.notFound().build();

        // STAFF scope check
        if (currentUser.hasActiveAuthority("STAFF")) {
            String reviewer = dispute.getSettlement().getAgreement().getClassroomReviewerEmail();
            if (!currentUser.email().equalsIgnoreCase(reviewer)) {
                return ResponseEntity.status(403)
                        .body(Map.of("error", "Staff chỉ được xử lý khiếu nại thuộc lớp mình duyệt."));
            }
        }

        try {
            // Build a simple audit hash from the reason text
            String resolutionHash = org.web3j.crypto.Hash.sha3String(
                    "RESOLVE:" + id + ":" + body.reason());
            BlockchainTransactionIntentResult result = disputeWorkflowService.initiateDisputeResolution(
                    id,
                    currentUser.userId(),
                    currentUser.email(),
                    currentUser.activeRole(),
                    body.approved(),
                    body.reason(),
                    resolutionHash
            );
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "disputeId", id.toString(),
                    "resolution", body.approved() ? "APPROVED" : "REJECTED",
                    "transactionStatus", result.status().name()
            ));
        } catch (SecurityException e) {
            return ResponseEntity.status(403).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // ALL TRANSACTIONS (Admin view)
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    @GetMapping("/transactions")
    public ResponseEntity<Page<BlockchainTxDto>> listAllTransactions(
            @PageableDefault(size = 30) Pageable pageable) {

        ContractUserPrincipal currentUser = currentUserContext.requireCurrentUser();
        List<BlockchainTransaction> all = transactionRepository.findAll();

        List<BlockchainTransaction> filtered;
        if (accessControl.canViewTransactionsAsStaffOrAdmin(currentUser)) {
            filtered = all;
        } else {
            // Student/Tutor see only their own agreement transactions
            Set<UUID> myAgreementIds = agreementRepository.findAll().stream()
                    .filter(a -> currentUser.matchesUserId(a.getStudentId()) || currentUser.matchesUserId(a.getTutorId()))
                    .map(ContractAgreement::getId)
                    .collect(Collectors.toSet());
            filtered = all.stream()
                    .filter(t -> t.getAgreementId() != null && myAgreementIds.contains(t.getAgreementId()))
                    .collect(Collectors.toList());
        }

        filtered.sort(Comparator.comparing(BlockchainTransaction::getCreatedAt).reversed());

        int start = (int) pageable.getOffset();
        int end = Math.min(start + pageable.getPageSize(), filtered.size());
        List<BlockchainTxDto> page = (start >= filtered.size())
                ? Collections.emptyList()
                : filtered.subList(start, end).stream()
                        .map(this::toTxDto)
                        .collect(Collectors.toList());

        return ResponseEntity.ok(new PageImpl<>(page, pageable, filtered.size()));
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // MAPPERS
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    private AgreementSummaryDto toAgreementSummary(ContractAgreement a) {
        long settled = settlementRepository.findByAgreementId(a.getId()).stream()
                .filter(s -> s.getStatus() == SettlementStatus.SETTLED
                        || s.getStatus() == SettlementStatus.REFUNDED)
                .count();

        String studentEmail = a.getStudentEmail();
        if (studentEmail == null || studentEmail.isBlank()) {
            studentEmail = extractStudentEmail(a);
        }

        String tutorEmail = a.getTutorEmail();
        if (tutorEmail == null || tutorEmail.isBlank()) {
            tutorEmail = a.getClassroomReviewerEmail();
        }

        String studentName = a.getStudentName();
        if (studentName != null && (studentName.isBlank() || studentName.contains("@") || studentName.startsWith("Học viên #"))) {
            studentName = null;
        }

        String tutorName = a.getTutorName();
        if (tutorName != null && (tutorName.isBlank() || tutorName.contains("@") || tutorName.startsWith("Gia sư #"))) {
            tutorName = null;
        }

        String className = a.getClassName();
        if (className == null || className.isBlank()) {
            className = "Lớp học #" + a.getClassroomId();
        }

        return new AgreementSummaryDto(
                a.getId().toString(),
                a.getOnchainAgreementId(),
                a.getClassroomId(),
                className,
                a.getStudentId(),
                studentName,
                studentEmail,
                a.getStudentPhone(),
                a.getTutorId(),
                tutorName,
                tutorEmail,
                a.getTutorPhone(),
                a.getStudentWallet(),
                a.getTutorWallet(),
                a.getPlatformWallet(),
                a.getTokenSymbol(),
                toUsdc(a.getTotalAmountUsdcUnits(), a.getTokenDecimals()),
                toUsdc(a.getPricePerSessionUsdcUnits(), a.getTokenDecimals()),
                a.getTotalSessions(),
                (int) settled,
                a.getStatus().name(),
                a.getCreatedAt() != null ? a.getCreatedAt().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME) : null,
                a.getPaymentDeadline() != null ? a.getPaymentDeadline().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME) : null,
                a.getChainId(),
                a.getEscrowContractAddress(),
                a.getClassroomReviewerEmail()
        );
    }

    private AgreementDetailDto toAgreementDetail(ContractAgreement a) {
        AgreementSummaryDto summary = toAgreementSummary(a);
        return new AgreementDetailDto(summary, a.getTermsHash(), a.getContractVersion(), a.getTotalPriceVnd());
    }

    private SettlementDto toSettlementDto(SessionSettlement s) {
        int decimals = s.getAgreement().getTokenDecimals();
        return new SettlementDto(
                s.getId().toString(),
                s.getSessionId(),
                s.getOnchainSessionId(),
                s.getOutcome().name(),
                toUsdc(s.getAmount(), (short) decimals),
                toUsdc(s.getTutorAmount(), (short) decimals),
                toUsdc(s.getPlatformAmount(), (short) decimals),
                toUsdc(s.getStudentRefundAmount(), (short) decimals),
                s.getStatus().name(),
                s.getProposeTxHash(),
                s.getFinalizeTxHash(),
                s.getDisputeDeadline() != null ? s.getDisputeDeadline().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME) : null,
                s.getCreatedAt() != null ? s.getCreatedAt().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME) : null
        );
    }

    private BlockchainTxDto toTxDto(BlockchainTransaction t) {
        return new BlockchainTxDto(
                t.getId().toString(),
                t.getAction(),
                t.getTransactionHash(),
                t.getStatus().name(),
                t.getBlockNumber(),
                t.getReceiptStatus(),
                t.getAgreementId() != null ? t.getAgreementId().toString() : null,
                t.getSettlementId() != null ? t.getSettlementId().toString() : null,
                t.getChainId(),
                t.getCreatedAt() != null ? t.getCreatedAt().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME) : null,
                t.getUpdatedAt() != null ? t.getUpdatedAt().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME) : null,
                t.getErrorMessage()
        );
    }

    private DisputeSummaryDto toDisputeDto(Dispute d) {
        SessionSettlement s = d.getSettlement();
        ContractAgreement a = s.getAgreement();
        return new DisputeSummaryDto(
                d.getId().toString(),
                a.getId().toString(),
                a.getOnchainAgreementId(),
                s.getId().toString(),
                s.getSessionId(),
                d.getComplainantId(),
                d.getType(),
                d.getStatus().name(),
                d.getSubmittedAt() != null ? d.getSubmittedAt().toString() : null,
                d.getResolution(),
                d.getResolutionReason(),
                d.getResolvedByEmail(),
                d.getResolvedByRole(),
                d.getResolvedAt() != null ? d.getResolvedAt().toString() : null,
                d.getOpenTxHash(),
                d.getResolveTxHash(),
                d.getTutorResponse(),
                a.getStudentWallet(),
                a.getTutorWallet(),
                a.getClassroomReviewerEmail(),
                s.getDisputeDeadline() != null ? s.getDisputeDeadline().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME) : null,
                d.getCreatedAt() != null ? d.getCreatedAt().toString() : null
        );
    }

    private double toUsdc(BigInteger units, short decimals) {
        if (units == null) return 0.0;
        BigDecimal bd = new BigDecimal(units);
        BigDecimal divisor = BigDecimal.TEN.pow(decimals);
        return bd.divide(divisor).doubleValue();
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // DTOs
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    public record AgreementSummaryDto(
            String id, String onchainAgreementId,
            Long classroomId, String className,
            Long studentId, String studentName, String studentEmail, String studentPhone,
            Long tutorId, String tutorName, String tutorEmail, String tutorPhone,
            String studentWallet, String tutorWallet, String platformWallet,
            String tokenSymbol,
            double totalAmountUsdc, double pricePerSessionUsdc,
            int totalSessions, int settledSessions,
            String status, String createdAt, String paymentDeadline,
            Long chainId, String escrowContractAddress, String classroomReviewerEmail) {}

    public record AgreementDetailDto(
            AgreementSummaryDto summary,
            String termsHash, Integer contractVersion, BigDecimal totalPriceVnd) {}

    public record SettlementDto(
            String id, Long sessionId, String onchainSessionId,
            String outcome, double amountUsdc,
            double tutorAmountUsdc, double platformAmountUsdc, double studentRefundUsdc,
            String status,
            String proposeTxHash, String finalizeTxHash,
            String disputeDeadline, String createdAt) {}

    public record BlockchainTxDto(
            String id, String action, String transactionHash, String status,
            Long blockNumber, Short receiptStatus,
            String agreementId, String settlementId, Long chainId,
            String createdAt, String updatedAt, String errorMessage) {}

    public record DisputeSummaryDto(
            String id, String agreementId, String onchainAgreementId,
            String settlementId, Long sessionId,
            Long complainantId, String type, String status,
            String submittedAt, String resolution, String resolutionReason,
            String resolvedByEmail, String resolvedByRole, String resolvedAt,
            String openTxHash, String resolveTxHash, String tutorResponse,
            String studentWallet, String tutorWallet, String classroomReviewerEmail,
            String disputeDeadline, String createdAt) {}

    public record ResolveDisputeRequest(boolean approved, String reason) {}
}
