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
import iuh.fit.contract_service.repository.ProcessedEventRepository;
import iuh.fit.contract_service.service.AgreementLifecycleWorkflowService;
import iuh.fit.contract_service.service.DisputeWorkflowService;
import iuh.fit.contract_service.service.SessionSettlementWorkflowService;
import iuh.fit.contract_service.service.OperationalFundingPolicy;
import iuh.fit.contract_service.service.ContractTermsSnapshot;
import iuh.fit.contract_service.service.ContractTermsSnapshotService;
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
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * REST API for Contract/Escrow management.
 * Authorization (Admin sees all, Staff sees own classroom, Student/Tutor see own)
 * is derived from the authenticated cookie JWT and agreement ownership.
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
    private final iuh.fit.contract_service.service.AgreementRegistrationWorkflowService registrationWorkflowService;
    private final iuh.fit.contract_service.repository.EscrowPaymentRepository escrowPaymentRepository;
    private final ProcessedEventRepository processedEventRepository;
    private final ContractAcceptanceRepository acceptanceRepository;
    private final iuh.fit.contract_service.service.LearningServiceDispatcher learningServiceDispatcher;
    private final CurrentUserContext currentUserContext;
    private final ContractAccessControl accessControl;
    private final OperationalFundingPolicy operationalFundingPolicy;
    private final org.springframework.beans.factory.ObjectProvider<iuh.fit.contract_service.blockchain.EduConnectEscrowReadGateway> blockchainGateway;

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
            iuh.fit.contract_service.service.AgreementRegistrationWorkflowService registrationWorkflowService,
            iuh.fit.contract_service.repository.EscrowPaymentRepository escrowPaymentRepository,
            ProcessedEventRepository processedEventRepository,
            ContractAcceptanceRepository acceptanceRepository,
            iuh.fit.contract_service.service.LearningServiceDispatcher learningServiceDispatcher,
            CurrentUserContext currentUserContext,
            ContractAccessControl accessControl,
            org.springframework.beans.factory.ObjectProvider<iuh.fit.contract_service.blockchain.EduConnectEscrowReadGateway> blockchainGateway,
            OperationalFundingPolicy operationalFundingPolicy) {
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
        this.registrationWorkflowService = registrationWorkflowService;
        this.escrowPaymentRepository = escrowPaymentRepository;
        this.processedEventRepository = processedEventRepository;
        this.acceptanceRepository = acceptanceRepository;
        this.learningServiceDispatcher = learningServiceDispatcher;
        this.currentUserContext = currentUserContext;
        this.accessControl = accessControl;
        this.blockchainGateway = blockchainGateway;
        this.operationalFundingPolicy = operationalFundingPolicy;
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
            String classroomReviewerEmail,
            String classDescription,
            String learningMode,
            String meetingPlatform,
            String meetingLink,
            String learningAddress,
            String courseStartDate,
            String courseEndDate,
            Integer durationPerSessionMinutes,
            List<ContractTermsSnapshot.ScheduleTerms> schedules,
            List<ContractTermsSnapshot.SyllabusTerms> syllabus
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

        String studentWallet = request.studentWallet();
        if (!usableWallet(studentWallet) || !usableWallet(request.tutorWallet())
                || studentWallet.equalsIgnoreCase(request.tutorWallet())) {
            throw new ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST,
                    "Student and tutor must provide distinct, non-zero wallets before agreement creation");
        }

        UUID agreementId = UUID.randomUUID();
        String onchainAgreementId = org.web3j.crypto.Hash.sha3String("AGREEMENT:" + agreementId);

        BigDecimal pricePerSessionVnd = request.pricePerSessionVnd();
        int totalSessions = request.totalSessions();
        BigDecimal totalPriceVnd = pricePerSessionVnd.multiply(BigDecimal.valueOf(totalSessions));
        BigDecimal vndPerUsdc = BigDecimal.valueOf(25000);

        // Convert to USDC units (6 decimals)
        BigInteger pricePerSessionUnits = pricePerSessionVnd.divide(vndPerUsdc, 6, java.math.RoundingMode.HALF_UP)
                .movePointRight(6).toBigIntegerExact();
        BigInteger totalAmountUnits = pricePerSessionUnits.multiply(BigInteger.valueOf(totalSessions));
        if (pricePerSessionUnits.signum() <= 0 || totalAmountUnits.bitLength() > 256) {
            throw new ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, "Invalid USDC amount");
        }

        OffsetDateTime now = OffsetDateTime.now();

        iuh.fit.contract_service.blockchain.EduConnectEscrowReadGateway gateway =
                blockchainGateway != null ? blockchainGateway.getIfAvailable() : null;
        iuh.fit.contract_service.blockchain.BlockchainNetworkSnapshot network =
                gateway != null ? gateway.validateConfiguration() : null;
        if (network == null || network.tokenDecimals() != 6) {
            throw new ResponseStatusException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE,
                    "A validated USDC escrow deployment is required to create an agreement");
        }
        String platformWallet = network.platformWallet();
        long chainId = network.chainId().longValueExact();
        String escrowAddress = network.escrowAddress();
        String tokenAddress = network.tokenAddress();
        short tokenDecimals = (short) network.tokenDecimals();
        var snapshotService = new ContractTermsSnapshotService();
        String termsJson = snapshotService.serialize(new ContractTermsSnapshot(
                ContractTermsSnapshotService.SCHEMA_VERSION,
                new ContractTermsSnapshot.ClassroomTerms(request.className(), request.classDescription(),
                        request.learningMode(), request.meetingPlatform(), request.meetingLink(), request.learningAddress(),
                        request.courseStartDate(), request.courseEndDate(), request.durationPerSessionMinutes(),
                        request.schedules() == null ? List.of() : request.schedules(),
                        request.syllabus() == null ? List.of() : request.syllabus()),
                new ContractTermsSnapshot.PartiesTerms(
                        new ContractTermsSnapshot.PartyTerms(tutorName, request.tutorEmail(), tutorPhone, request.tutorWallet().toLowerCase(Locale.ROOT)),
                        new ContractTermsSnapshot.PartyTerms(studentName, request.studentEmail(), studentPhone, studentWallet.toLowerCase(Locale.ROOT))),
                new ContractTermsSnapshot.FinancialTerms(pricePerSessionVnd, totalPriceVnd, vndPerUsdc, "USDC", tokenDecimals,
                        pricePerSessionUnits.toString(), totalAmountUnits.toString(), totalSessions),
                new ContractTermsSnapshot.PlatformTerms(chainId, platformWallet, escrowAddress, tokenAddress),
                new ContractTermsSnapshot.EscrowPolicyTerms(24, 8500, 1500,
                        "24h dispute after proposal; BOTH_PRESENT=85/15/0; STUDENT_ABSENT_TUTOR_PRESENT=45/10/45; TUTOR_ABSENT=0/0/100; tutor-fraud dispute only for BOTH_PRESENT")));
        String termsHash = snapshotService.hash(termsJson);

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
                .platformWallet(platformWallet)
                .chainId(chainId)
                .escrowContractAddress(escrowAddress)
                .tokenAddress(tokenAddress)
                .tokenSymbol("USDC")
                .tokenDecimals(tokenDecimals)
                .termsJson(termsJson)
                .termsHash(termsHash)
                .contractVersion(1)
                .totalPriceVnd(totalPriceVnd)
                .vndPerUsdc(vndPerUsdc)
                .totalAmountUsdcUnits(totalAmountUnits)
                .pricePerSessionUsdcUnits(pricePerSessionUnits)
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
        filtered = filtered.stream()
                .sorted(Comparator.comparing(ContractAgreement::getCreatedAt).reversed())
                .toList();

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

    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    @GetMapping("/agreements/{id}/settlements")
    public ResponseEntity<List<SettlementDto>> getSettlements(
            @PathVariable UUID id) {
        ContractUserPrincipal currentUser = currentUserContext.requireCurrentUser();
        return agreementRepository.findById(id)
                .filter(a -> accessControl.canViewAgreement(a, currentUser))
                .map(agreement -> {
                    short decimals = agreement.getTokenDecimals();
                    List<SettlementDto> list = settlementRepository
                            .findByAgreementId(agreement.getId())
                            .stream()
                            .sorted(Comparator.comparing(SessionSettlement::getCreatedAt))
                            .map(s -> toSettlementDto(s, decimals))
                            .collect(Collectors.toList());
                    return ResponseEntity.ok(list);
                }).orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/agreements/{id}/register-onchain")
    public ResponseEntity<Map<String, Object>> triggerRegistrationOnchain(@PathVariable UUID id) {
        ContractUserPrincipal currentUser = currentUserContext.requireCurrentUser();
        ContractAgreement agreement = agreementRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND, "Agreement not found"));
        if (!accessControl.canViewAgreement(agreement, currentUser)) {
            throw new ResponseStatusException(org.springframework.http.HttpStatus.FORBIDDEN, "Access denied");
        }
        if (agreement.getStatus() != ContractAgreementStatus.PREPARING_BLOCKCHAIN) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "Hợp đồng không ở trạng thái PREPARING_BLOCKCHAIN (hiện tại: " + agreement.getStatus() + ")"
            ));
        }
        BlockchainTransactionIntentResult result = registrationWorkflowService.initiateRegistration(id);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "status", result.status().name(),
                "transactionId", result.transactionId().toString(),
                "idempotencyKey", result.idempotencyKey()
        ));
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
            requireSettlementEligible(agreement);
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
            requireOperationalFundingForActiveAgreement(agreement);
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

        filtered = filtered.stream()
                .sorted(Comparator.comparing(Dispute::getCreatedAt).reversed())
                .toList();

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

    public record TutorEvidenceRequest(
            String responseText,
            String evidenceFileUrl
    ) {}

    /**
     * Gia sư nộp giải trình và bằng chứng đối chất khi nhận được thông báo khiếu nại.
     */
    @PutMapping("/disputes/{id}/tutor-evidence")
    public ResponseEntity<?> submitTutorDisputeEvidence(
            @PathVariable UUID id,
            @RequestBody TutorEvidenceRequest body) {
        Dispute dispute = disputeRepository.findById(id).orElse(null);
        if (dispute == null) return ResponseEntity.notFound().build();

        ContractUserPrincipal currentUser = currentUserContext.requireCurrentUser();
        accessControl.requireCanSign(dispute.getSettlement().getAgreement(), "TUTOR", currentUser);
        if (dispute.getStatus() != DisputeStatus.OPEN) {
            return ResponseEntity.badRequest().body(Map.of("error", "Only open disputes accept tutor evidence."));
        }
        if (body.responseText() == null || body.responseText().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Tutor response is required."));
        }
        dispute.setTutorResponse(body.responseText() + (body.evidenceFileUrl() != null ? " [File: " + body.evidenceFileUrl() + "]" : ""));
        dispute.setTutorRespondedAt(Instant.now());
        Dispute saved = disputeRepository.save(dispute);
        return ResponseEntity.ok(toDisputeDto(saved));
    }

    public record LegacyProposeSettlementRequest(
            String outcome, // BOTH_PRESENT, STUDENT_ABSENT_TUTOR_PRESENT, TUTOR_ABSENT
            String evidenceHash
    ) {}

    /**
     * Đề xuất quyết toán buổi học cho 1 agreement cụ thể trên Sepolia Blockchain.
     */
    @PostMapping("/agreements/{agreementId}/sessions/{sessionId}/propose")
    public ResponseEntity<?> proposeSessionSettlement(
            @PathVariable UUID agreementId,
            @PathVariable Long sessionId,
            @RequestBody(required = false) LegacyProposeSettlementRequest body) {
        ContractAgreement agreement = agreementRepository.findById(agreementId)
                .orElseThrow(() -> new ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND, "Agreement not found"));
        accessControl.requireCanManageSettlement(agreement, currentUserContext.requireCurrentUser());
        try {
            requireSettlementEligible(agreement);
            String outcomeStr = body != null && body.outcome() != null ? body.outcome().toUpperCase() : "BOTH_PRESENT";
            iuh.fit.contract_service.enums.SettlementOutcome outcome =
                    iuh.fit.contract_service.enums.SettlementOutcome.valueOf(outcomeStr);

            String evidenceHash = body != null && body.evidenceHash() != null && !body.evidenceHash().isBlank()
                    ? body.evidenceHash()
                    : org.web3j.crypto.Hash.sha3String("PROPOSE:" + agreementId + ":" + sessionId);

            BlockchainTransactionIntentResult result = settlementWorkflowService
                    .initiateSessionProposal(agreementId, sessionId, outcome, evidenceHash);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "agreementId", agreementId.toString(),
                    "sessionId", sessionId,
                    "outcome", outcome.name(),
                    "transactionStatus", result.status().name(),
                    "idempotencyKey", result.idempotencyKey()
            ));
        } catch (ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode())
                    .body(Map.of("error", e.getReason() != null ? e.getReason() : "Settlement rejected"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Đề xuất quyết toán buổi học theo classroomId cho tất cả các agreement ACTIVE trong lớp đó.
     */
    @PostMapping("/classrooms/{classroomId}/sessions/{sessionId}/propose")
    public ResponseEntity<?> proposeSettlementByClassroom(
            @PathVariable Long classroomId,
            @PathVariable Long sessionId,
            @RequestBody(required = false) LegacyProposeSettlementRequest body) {
        List<ContractAgreement> agreements = agreementRepository.findAll().stream()
                .filter(a -> a.getClassroomId().equals(classroomId) && isSettlementEligible(a))
                .toList();

        if (agreements.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Không tìm thấy hợp đồng ACTIVE nào cho lớp học: " + classroomId));
        }

        ContractUserPrincipal currentUser = currentUserContext.requireCurrentUser();
        agreements.forEach(agreement -> accessControl.requireCanManageSettlement(agreement, currentUser));
        List<Map<String, Object>> results = new ArrayList<>();
        for (ContractAgreement agreement : agreements) {
            try {
                String outcomeStr = body != null && body.outcome() != null ? body.outcome().toUpperCase() : "BOTH_PRESENT";
                iuh.fit.contract_service.enums.SettlementOutcome outcome =
                        iuh.fit.contract_service.enums.SettlementOutcome.valueOf(outcomeStr);

                String evidenceHash = body != null && body.evidenceHash() != null && !body.evidenceHash().isBlank()
                        ? body.evidenceHash()
                        : org.web3j.crypto.Hash.sha3String("PROPOSE:" + agreement.getId() + ":" + sessionId);

                BlockchainTransactionIntentResult res = settlementWorkflowService
                        .initiateSessionProposal(agreement.getId(), sessionId, outcome, evidenceHash);

                results.add(Map.of(
                        "agreementId", agreement.getId().toString(),
                        "studentId", agreement.getStudentId(),
                        "status", res.status().name()
                ));
            } catch (Exception e) {
                results.add(Map.of(
                        "agreementId", agreement.getId().toString(),
                        "studentId", agreement.getStudentId(),
                        "error", e.getMessage()
                ));
            }
        }

        return ResponseEntity.ok(Map.of("classroomId", classroomId, "sessionId", sessionId, "proposals", results));
    }

    public record StudentAttendanceOutcome(Long studentId, String outcome) {}
    public record InternalAutoProposeRequest(List<StudentAttendanceOutcome> attendances) {}

    /**
     * Internal endpoint called by learning-service when a session is finalized/completed.
     * Automatically initiates settlement proposals for all ACTIVE agreements in the classroom.
     */
    @PostMapping("/internal/classrooms/{classroomId}/sessions/{sessionId}/auto-propose")
    public ResponseEntity<?> internalAutoProposeSettlement(
            @PathVariable Long classroomId,
            @PathVariable Long sessionId,
            @RequestBody(required = false) InternalAutoProposeRequest body) {
        List<ContractAgreement> agreements = agreementRepository.findAll().stream()
                .filter(a -> a.getClassroomId().equals(classroomId) && isSettlementEligible(a))
                .toList();

        if (agreements.isEmpty()) {
            return ResponseEntity.ok(Map.of("classroomId", classroomId, "sessionId", sessionId, "proposals", List.of(), "message", "No active agreements"));
        }

        Map<Long, String> outcomeByStudent = new HashMap<>();
        if (body != null && body.attendances() != null) {
            for (StudentAttendanceOutcome att : body.attendances()) {
                if (att.studentId() != null && att.outcome() != null) {
                    outcomeByStudent.put(att.studentId(), att.outcome().trim().toUpperCase(Locale.ROOT));
                }
            }
        }

        List<Map<String, Object>> results = new ArrayList<>();
        for (ContractAgreement agreement : agreements) {
            try {
                var existingOpt = settlementRepository.findByAgreementIdAndSessionId(agreement.getId(), sessionId);
                if (existingOpt.isPresent() && existingOpt.get().getStatus() != SettlementStatus.PREPARING && existingOpt.get().getStatus() != SettlementStatus.PROPOSE_PENDING) {
                    results.add(Map.of(
                            "agreementId", agreement.getId().toString(),
                            "studentId", agreement.getStudentId(),
                            "status", existingOpt.get().getStatus().name(),
                            "skipped", true
                    ));
                    continue;
                }

                // Missing or corrupt attendance must never become a tutor payout.
                SettlementOutcome outcome = resolveAttendanceOutcome(outcomeByStudent, agreement.getStudentId());

                String evidenceHash = org.web3j.crypto.Hash.sha3String("PROPOSE:" + agreement.getId() + ":" + sessionId);
                BlockchainTransactionIntentResult res = settlementWorkflowService
                        .initiateSessionProposal(agreement.getId(), sessionId, outcome, evidenceHash);

                try {
                    notificationDispatcher.sendAsync(
                            agreement.getTutorEmail(),
                            agreement.getTutorId(),
                            "Đề xuất quyết toán Buổi #" + sessionId,
                            "Buổi học #" + sessionId + " đã hoàn thành. Hệ thống đã mở đề xuất quyết toán (" + outcome.name() + ").",
                            "SETTLEMENT_PROPOSED",
                            "CONTRACT_AGREEMENT",
                            agreement.getId().toString()
                    );
                    notificationDispatcher.sendAsync(
                            agreement.getStudentEmail(),
                            agreement.getStudentId(),
                            "Quyết toán Buổi #" + sessionId,
                            "Buổi học #" + sessionId + " đã hoàn thành (" + outcome.name() + "). Thời hạn khiếu nại 24h đã được kích hoạt.",
                            "SETTLEMENT_PROPOSED",
                            "CONTRACT_AGREEMENT",
                            agreement.getId().toString()
                    );
                } catch (Exception ex) {
                    // ignore notification failure
                }

                results.add(Map.of(
                        "agreementId", agreement.getId().toString(),
                        "studentId", agreement.getStudentId(),
                        "status", res.status().name(),
                        "outcome", outcome.name()
                ));
            } catch (Exception e) {
                results.add(Map.of(
                        "agreementId", agreement.getId().toString(),
                        "studentId", agreement.getStudentId(),
                        "error", e.getMessage()
                ));
            }
        }

        return ResponseEntity.ok(Map.of("classroomId", classroomId, "sessionId", sessionId, "proposals", results));
    }



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
        var confirmedSettlements = settlementRepository.findByAgreementId(a.getId()).stream()
                .filter(s -> s.getStatus() == SettlementStatus.SETTLED
                        || s.getStatus() == SettlementStatus.REFUNDED)
                .toList();
        long settled = confirmedSettlements.size();
        boolean onchainFunded = hasConfirmedFundingEvent(a);
        BigInteger released = onchainFunded ? confirmedSettlements.stream()
                .map(s -> zeroIfNull(s.getTutorAmount()).add(zeroIfNull(s.getPlatformAmount())))
                .reduce(BigInteger.ZERO, BigInteger::add) : BigInteger.ZERO;
        BigInteger refunded = onchainFunded ? confirmedSettlements.stream()
                .map(s -> zeroIfNull(s.getStudentRefundAmount()))
                .reduce(BigInteger.ZERO, BigInteger::add) : BigInteger.ZERO;
        BigInteger remaining = onchainFunded ? a.getTotalAmountUsdcUnits().subtract(confirmedSettlements.stream()
                .map(SessionSettlement::getAmount).reduce(BigInteger.ZERO, BigInteger::add)).max(BigInteger.ZERO)
                : BigInteger.ZERO;
        if (a.getStatus() == ContractAgreementStatus.CANCELLED || a.getStatus() == ContractAgreementStatus.COMPLETED) {
            if (onchainFunded && a.getStatus() == ContractAgreementStatus.CANCELLED) refunded = refunded.add(remaining);
            remaining = BigInteger.ZERO;
        }
        boolean legacyUnreconciled = isLegacyUnreconciled(a, onchainFunded);
        boolean settlementEligible = a.getStatus() == ContractAgreementStatus.ACTIVE && onchainFunded;

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
                a.getClassroomReviewerEmail(),
                onchainFunded,
                legacyUnreconciled,
                settlementEligible,
                toUsdc(remaining, a.getTokenDecimals()),
                toUsdc(released, a.getTokenDecimals()),
                toUsdc(refunded, a.getTokenDecimals()),
                onchainFunded ? escrowPaymentRepository.findByAgreementId(a.getId()).map(EscrowPayment::getFundTxHash).orElse(null) : null
        );
    }

    private boolean hasConfirmedFundingEvent(ContractAgreement agreement) {
        return operationalFundingPolicy.isFunded(agreement);
    }

    private static boolean usableWallet(String wallet) {
        return wallet != null && wallet.matches("0x[0-9a-fA-F]{40}")
                && !wallet.equalsIgnoreCase("0x" + "0".repeat(40));
    }

    private static BigInteger zeroIfNull(BigInteger value) { return value == null ? BigInteger.ZERO : value; }

    private boolean isLegacyUnreconciled(ContractAgreement agreement, boolean onchainFunded) {
        return agreement.isLegacyExcluded() || !onchainFunded
                && (agreement.getStatus() == ContractAgreementStatus.ACTIVE
                || agreement.getStatus() == ContractAgreementStatus.COMPLETED);
    }

    private boolean isSettlementEligible(ContractAgreement agreement) {
        return agreement.getStatus() == ContractAgreementStatus.ACTIVE && hasConfirmedFundingEvent(agreement);
    }

    private void requireSettlementEligible(ContractAgreement agreement) {
        if (!isSettlementEligible(agreement)) {
            throw new ResponseStatusException(
                    org.springframework.http.HttpStatus.CONFLICT,
                    "Agreement is not backed by a confirmed on-chain AgreementFunded event and cannot be settled.");
        }
    }

    private void requireOperationalFundingForActiveAgreement(ContractAgreement agreement) {
        if ((agreement.getStatus() == ContractAgreementStatus.ACTIVE
                || agreement.getStatus() == ContractAgreementStatus.COMPLETED)
                && !hasConfirmedFundingEvent(agreement)) {
            throw new ResponseStatusException(
                    org.springframework.http.HttpStatus.CONFLICT,
                    "Legacy unreconciled agreement is audit-only and cannot execute blockchain lifecycle actions.");
        }
    }

    private AgreementDetailDto toAgreementDetail(ContractAgreement a) {
        AgreementSummaryDto summary = toAgreementSummary(a);
        return new AgreementDetailDto(summary, a.getTermsHash(), a.getContractVersion(), a.getTotalPriceVnd());
    }

    private SettlementDto toSettlementDto(SessionSettlement s, short decimals) {
        return new SettlementDto(
                s.getId().toString(),
                s.getSessionId(),
                s.getOnchainSessionId(),
                s.getOutcome() != null ? s.getOutcome().name() : null,
                toUsdc(s.getAmount(), decimals),
                toUsdc(s.getTutorAmount(), decimals),
                toUsdc(s.getPlatformAmount(), decimals),
                toUsdc(s.getStudentRefundAmount(), decimals),
                s.getStatus() != null ? s.getStatus().name() : null,
                s.getProposeTxHash(),
                s.getFinalizeTxHash(),
                s.getDisputeDeadline() != null ? s.getDisputeDeadline().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME) : null,
                s.getCreatedAt() != null ? s.getCreatedAt().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME) : null
        );
    }

    private SettlementDto toSettlementDto(SessionSettlement s) {
        short decimals = (s.getAgreement() != null) ? s.getAgreement().getTokenDecimals() : (short) 6;
        return toSettlementDto(s, decimals);
    }

    static SettlementOutcome resolveAttendanceOutcome(Map<Long, String> outcomeByStudent, Long studentId) {
        String value = outcomeByStudent.get(studentId);
        if (value == null || value.isBlank()) {
            return SettlementOutcome.TUTOR_ABSENT;
        }
        try {
            return SettlementOutcome.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            return SettlementOutcome.TUTOR_ABSENT;
        }
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
        ContractAgreement a = s != null ? s.getAgreement() : null;
        return new DisputeSummaryDto(
                d.getId().toString(),
                a != null ? a.getId().toString() : null,
                a != null ? a.getOnchainAgreementId() : null,
                s != null ? s.getId().toString() : null,
                s != null ? s.getSessionId() : null,
                d.getComplainantId(),
                d.getType(),
                d.getStatus() != null ? d.getStatus().name() : null,
                d.getSubmittedAt() != null ? d.getSubmittedAt().toString() : null,
                d.getResolution(),
                d.getResolutionReason(),
                d.getResolvedByEmail(),
                d.getResolvedByRole(),
                d.getResolvedAt() != null ? d.getResolvedAt().toString() : null,
                d.getOpenTxHash(),
                d.getResolveTxHash(),
                d.getTutorResponse(),
                a != null ? a.getStudentWallet() : null,
                a != null ? a.getTutorWallet() : null,
                a != null ? a.getClassroomReviewerEmail() : null,
                s != null && s.getDisputeDeadline() != null ? s.getDisputeDeadline().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME) : null,
                d.getCreatedAt() != null ? d.getCreatedAt().toString() : null
        );
    }

    private double toUsdc(BigInteger units, short decimals) {
        if (units == null) return 0.0;
        BigDecimal bd = new BigDecimal(units);
        BigDecimal divisor = BigDecimal.TEN.pow(decimals);
        return bd.divide(divisor, 4, java.math.RoundingMode.HALF_UP).doubleValue();
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
            Long chainId, String escrowContractAddress, String classroomReviewerEmail,
            boolean onchainFunded, boolean legacyUnreconciled, boolean settlementEligible, double remainingDeposit,
            double releasedAmountUsdc, double refundedAmountUsdc, String fundedTxHash) {}

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
