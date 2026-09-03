package iuh.fit.contract_service.api;

import iuh.fit.contract_service.command.BlockchainTransactionIntentResult;
import iuh.fit.contract_service.entity.ContractAgreement;
import iuh.fit.contract_service.entity.EscrowPayment;
import iuh.fit.contract_service.entity.SessionSettlement;
import iuh.fit.contract_service.entity.BlockchainTransaction;
import iuh.fit.contract_service.entity.Dispute;
import iuh.fit.contract_service.enums.ContractAgreementStatus;
import iuh.fit.contract_service.enums.DisputeStatus;
import iuh.fit.contract_service.enums.SettlementStatus;
import iuh.fit.contract_service.entity.ContractAcceptance;
import iuh.fit.contract_service.repository.ContractAcceptanceRepository;
import iuh.fit.contract_service.repository.ContractAgreementRepository;
import iuh.fit.contract_service.repository.SessionSettlementRepository;
import iuh.fit.contract_service.repository.BlockchainTransactionRepository;
import iuh.fit.contract_service.repository.DisputeRepository;
import iuh.fit.contract_service.service.DisputeWorkflowService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import jakarta.servlet.http.HttpServletRequest;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.time.Instant;
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
    private final iuh.fit.contract_service.service.NotificationDispatcher notificationDispatcher;
    private final iuh.fit.contract_service.service.ContractSignatureService signatureService;
    private final iuh.fit.contract_service.repository.EscrowPaymentRepository escrowPaymentRepository;
    private final ContractAcceptanceRepository acceptanceRepository;
    private final iuh.fit.contract_service.service.LearningServiceDispatcher learningServiceDispatcher;
    private final iuh.fit.contract_service.service.SessionSettlementWorkflowService sessionSettlementWorkflowService;

    public ContractManagementController(
            ContractAgreementRepository agreementRepository,
            SessionSettlementRepository settlementRepository,
            BlockchainTransactionRepository transactionRepository,
            DisputeRepository disputeRepository,
            DisputeWorkflowService disputeWorkflowService,
            iuh.fit.contract_service.service.NotificationDispatcher notificationDispatcher,
            iuh.fit.contract_service.service.ContractSignatureService signatureService,
            iuh.fit.contract_service.repository.EscrowPaymentRepository escrowPaymentRepository,
            ContractAcceptanceRepository acceptanceRepository,
            iuh.fit.contract_service.service.LearningServiceDispatcher learningServiceDispatcher,
            iuh.fit.contract_service.service.SessionSettlementWorkflowService sessionSettlementWorkflowService) {
        this.agreementRepository = agreementRepository;
        this.settlementRepository = settlementRepository;
        this.transactionRepository = transactionRepository;
        this.disputeRepository = disputeRepository;
        this.disputeWorkflowService = disputeWorkflowService;
        this.notificationDispatcher = notificationDispatcher;
        this.signatureService = signatureService;
        this.escrowPaymentRepository = escrowPaymentRepository;
        this.acceptanceRepository = acceptanceRepository;
        this.learningServiceDispatcher = learningServiceDispatcher;
        this.sessionSettlementWorkflowService = sessionSettlementWorkflowService;
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
            String role,
            String walletAddress,
            String signature,
            String userEmail,
            String studentEmail
    ) {}

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
            @RequestHeader(value = "X-User-Id", defaultValue = "0") Long userId,
            @RequestHeader(value = "X-User-Email", defaultValue = "") String userEmail,
            @RequestHeader(value = "X-User-Role", defaultValue = "STUDENT") String role,
            HttpServletRequest httpServletRequest) {

        String ipAddress = httpServletRequest.getRemoteAddr();
        String userAgent = httpServletRequest.getHeader("User-Agent");

        String effectiveRole = (request.role() != null && !request.role().isBlank())
                ? request.role().toUpperCase(Locale.ROOT).trim()
                : (role != null && !role.isBlank() ? role.toUpperCase(Locale.ROOT).trim() : "TUTOR");

        String effectiveUserEmail = (request.userEmail() != null && !request.userEmail().isBlank())
                ? request.userEmail()
                : userEmail;

        try {
            ContractAgreement updated = signatureService.signAgreement(
                    id,
                    userId,
                    effectiveUserEmail,
                    effectiveRole,
                    request.walletAddress(),
                    request.signature(),
                    request.studentEmail(),
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
            @RequestBody(required = false) Map<String, String> payload,
            @RequestHeader(value = "X-User-Email", defaultValue = "") String userEmail) {
        try {
            String txHash = payload != null ? payload.get("txHash") : null;
            ContractAgreement agreement = agreementRepository.findById(id)
                    .orElseThrow(() -> new IllegalArgumentException("Hợp đồng không tồn tại: " + id));

            agreement.markActive();
            agreement.setUpdatedAt(OffsetDateTime.now());
            ContractAgreement saved = agreementRepository.saveAndFlush(agreement);

            EscrowPayment payment = escrowPaymentRepository.findByAgreementId(id)
                    .orElseGet(() -> EscrowPayment.create(saved));
            payment.markLocked(txHash != null ? txHash : "0x_escrow_deposit_tx", 0L, "0x_block_hash");
            escrowPaymentRepository.saveAndFlush(payment);

            // Dispatch activation to learning-service to grant student classroom access
            learningServiceDispatcher.activateEnrollmentAsync(
                    saved.getClassroomId(), saved.getStudentId(), saved.getId().toString());

            // Ensure student acceptance with signature/txHash is recorded
            boolean hasStudentAcceptance = acceptanceRepository.findByAgreementId(id).stream()
                    .anyMatch(a -> "STUDENT".equalsIgnoreCase(a.getRole()));
            if (!hasStudentAcceptance) {
                ContractAcceptance studentAcceptance = ContractAcceptance.builder()
                        .id(UUID.randomUUID())
                        .agreementId(saved.getId())
                        .userId(saved.getStudentId())
                        .role("STUDENT")
                        .walletAddress(saved.getStudentWallet())
                        .signature(txHash != null && txHash.startsWith("0x") ? txHash : ("0x" + org.web3j.crypto.Hash.sha3String("SIGN:" + saved.getId() + ":" + saved.getStudentWallet())))
                        .acceptedAt(OffsetDateTime.now())
                        .termsHash(saved.getTermsHash())
                        .contractVersion(saved.getContractVersion())
                        .build();
                acceptanceRepository.save(studentAcceptance);
            }

            String studentEmail = extractStudentEmail(saved);
            if (studentEmail == null || studentEmail.isBlank()) {
                studentEmail = userEmail;
            }
            String tutorEmail = saved.getClassroomReviewerEmail();

            // 1. Multi-channel Notification to Student
            if (studentEmail != null && !studentEmail.isBlank()) {
                notificationDispatcher.sendAsync(
                        studentEmail,
                        saved.getStudentId(),
                        "Nạp cọc Escrow thành công",
                        "Bạn đã nạp cọc thành công vào Smart Contract Escrow. Hợp đồng chính thức kích hoạt và bạn đã được thêm vào lớp học!",
                        "AGREEMENT_ACTIVATED",
                        "AGREEMENT",
                        saved.getId().toString()
                );
            }

            // 2. Multi-channel Notification to Tutor
            if (tutorEmail != null && !tutorEmail.isBlank()) {
                notificationDispatcher.sendAsync(
                        tutorEmail,
                        saved.getTutorId(),
                        "Học viên đã nạp cọc Escrow",
                        "Học viên đã nạp cọc thành công vào Smart Contract Escrow. Hợp đồng lớp học đã chính thức HOẠT ĐỘNG (ACTIVE)!",
                        "AGREEMENT_ACTIVATED",
                        "AGREEMENT",
                        saved.getId().toString()
                );
            }

            return ResponseEntity.ok(toAgreementDetail(saved));
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

    @GetMapping("/agreements/{id}/acceptances")
    public ResponseEntity<List<AcceptanceDto>> getAcceptances(@PathVariable UUID id) {
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

    // ─────────────────────────────────────────────
    // AGREEMENTS
    // ─────────────────────────────────────────────

    /**
     * List agreements.
     * Header X-User-Role: ADMIN | STAFF | STUDENT | TUTOR
     * Header X-User-Id:   numeric user id
     * Header X-User-Email: email (STAFF reviewer match)
     */
    @GetMapping("/agreements")
    public ResponseEntity<Page<AgreementSummaryDto>> listAgreements(
            @RequestHeader(value = "X-User-Role", required = false) String headerRole,
            @RequestHeader(value = "X-User-Id", required = false) Long headerUserId,
            @RequestHeader(value = "X-User-Email", required = false) String headerEmail,
            @RequestParam(value = "role", required = false) String paramRole,
            @RequestParam(value = "userId", required = false) Long paramUserId,
            @RequestParam(value = "email", required = false) String paramEmail,
            @RequestParam(value = "status", required = false) String statusFilter,
            @PageableDefault(size = 20) Pageable pageable) {

        String role = (paramRole != null && !paramRole.isBlank()) ? paramRole : ((headerRole != null && !headerRole.isBlank()) ? headerRole : "ALL");
        Long userId = (paramUserId != null && paramUserId > 0) ? paramUserId : ((headerUserId != null && headerUserId > 0) ? headerUserId : 0L);
        String email = (paramEmail != null && !paramEmail.isBlank()) ? paramEmail.trim() : ((headerEmail != null && !headerEmail.isBlank()) ? headerEmail.trim() : "");

        List<ContractAgreement> all = agreementRepository.findAll();

        // Filter by role & identity
        List<ContractAgreement> filtered;
        if ("ADMIN".equalsIgnoreCase(role)) {
            filtered = all;
        } else if ("STAFF".equalsIgnoreCase(role)) {
            filtered = email.isBlank() ? all : all.stream()
                    .filter(a -> email.equalsIgnoreCase(a.getClassroomReviewerEmail()))
                    .collect(Collectors.toList());
        } else if ("TUTOR".equalsIgnoreCase(role)) {
            if (userId > 0 || !email.isBlank()) {
                filtered = all.stream().filter(a ->
                    (userId > 0 && a.getTutorId() != null && a.getTutorId().equals(userId)) ||
                    (!email.isBlank() && (
                        (a.getTutorEmail() != null && email.equalsIgnoreCase(a.getTutorEmail())) ||
                        (a.getClassroomReviewerEmail() != null && email.equalsIgnoreCase(a.getClassroomReviewerEmail()))
                    ))
                ).collect(Collectors.toList());
            } else {
                filtered = Collections.emptyList();
            }
        } else if ("STUDENT".equalsIgnoreCase(role)) {
            if (userId > 0 || !email.isBlank()) {
                filtered = all.stream().filter(a ->
                    (userId > 0 && a.getStudentId() != null && a.getStudentId().equals(userId)) ||
                    (!email.isBlank() && a.getStudentEmail() != null && email.equalsIgnoreCase(a.getStudentEmail()))
                ).collect(Collectors.toList());
            } else {
                filtered = Collections.emptyList();
            }
        } else {
            if (userId > 0 || !email.isBlank()) {
                filtered = all.stream().filter(a ->
                    (userId > 0 && ((a.getTutorId() != null && a.getTutorId().equals(userId)) || (a.getStudentId() != null && a.getStudentId().equals(userId)))) ||
                    (!email.isBlank() && ((a.getTutorEmail() != null && email.equalsIgnoreCase(a.getTutorEmail())) || (a.getStudentEmail() != null && email.equalsIgnoreCase(a.getStudentEmail()))))
                ).collect(Collectors.toList());
            } else {
                filtered = all;
            }
        }

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

    private boolean isAuthorizedForAgreement(ContractAgreement agreement, String role, Long userId) {
        if ("ADMIN".equalsIgnoreCase(role) || "STAFF".equalsIgnoreCase(role)) return true;
        if (userId == null || userId == 0) return true;
        return userId.equals(agreement.getStudentId()) || userId.equals(agreement.getTutorId());
    }

    @GetMapping("/agreements/{id}")
    public ResponseEntity<AgreementDetailDto> getAgreement(
            @RequestHeader(value = "X-User-Role", defaultValue = "STUDENT") String role,
            @RequestHeader(value = "X-User-Id", defaultValue = "0") Long userId,
            @PathVariable UUID id) {
        return agreementRepository.findById(id)
                .filter(a -> isAuthorizedForAgreement(a, role, userId))
                .map(this::toAgreementDetail)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/agreements/{id}/settlements")
    public ResponseEntity<List<SettlementDto>> getSettlements(
            @RequestHeader(value = "X-User-Role", defaultValue = "STUDENT") String role,
            @RequestHeader(value = "X-User-Id", defaultValue = "0") Long userId,
            @PathVariable UUID id) {
        return agreementRepository.findById(id)
                .filter(a -> isAuthorizedForAgreement(a, role, userId))
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

    @GetMapping("/agreements/{id}/transactions")
    public ResponseEntity<List<BlockchainTxDto>> getTransactions(
            @RequestHeader(value = "X-User-Role", defaultValue = "STUDENT") String role,
            @RequestHeader(value = "X-User-Id", defaultValue = "0") Long userId,
            @PathVariable UUID id) {
        ContractAgreement agreement = agreementRepository.findById(id).orElse(null);
        if (agreement == null || !isAuthorizedForAgreement(agreement, role, userId)) {
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

    // ─────────────────────────────────────────────
    // DISPUTES
    // ─────────────────────────────────────────────

    @GetMapping("/disputes")
    public ResponseEntity<Page<DisputeSummaryDto>> listDisputes(
            @RequestHeader(value = "X-User-Role", defaultValue = "STUDENT") String role,
            @RequestHeader(value = "X-User-Id", defaultValue = "0") Long userId,
            @RequestHeader(value = "X-User-Email", defaultValue = "") String email,
            @RequestParam(value = "status", required = false) String statusFilter,
            @PageableDefault(size = 20) Pageable pageable) {

        List<Dispute> all = disputeRepository.findAll();

        List<Dispute> filtered = switch (role.toUpperCase()) {
            case "ADMIN" -> all;
            case "STAFF" -> email.isBlank() ? all : all.stream()
                    .filter(d -> email.equalsIgnoreCase(
                            d.getSettlement().getAgreement().getClassroomReviewerEmail()))
                    .collect(Collectors.toList());
            default -> userId == 0 ? Collections.emptyList() : all.stream() // STUDENT / TUTOR: only own
                    .filter(d -> d.getComplainantId().equals(userId))
                    .collect(Collectors.toList());
        };

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
        return disputeRepository.findById(id)
                .map(this::toDisputeDto)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Resolve dispute — ADMIN resolves all, STAFF only own-classroom disputes.
     */
    @PostMapping("/disputes/{id}/resolve")
    public ResponseEntity<Map<String, Object>> resolveDispute(
            @PathVariable UUID id,
            @RequestHeader(value = "X-User-Role", defaultValue = "STUDENT") String role,
            @RequestHeader(value = "X-User-Id", defaultValue = "0") Long resolverUserId,
            @RequestHeader(value = "X-User-Email", defaultValue = "") String resolverEmail,
            @RequestBody ResolveDisputeRequest body) {

        if (!role.equalsIgnoreCase("ADMIN") && !role.equalsIgnoreCase("STAFF")) {
            return ResponseEntity.status(403)
                    .body(Map.of("error", "Chỉ Admin hoặc Staff mới có quyền xử lý khiếu nại."));
        }

        Dispute dispute = disputeRepository.findById(id).orElse(null);
        if (dispute == null) return ResponseEntity.notFound().build();

        // STAFF scope check
        if (role.equalsIgnoreCase("STAFF")) {
            String reviewer = dispute.getSettlement().getAgreement().getClassroomReviewerEmail();
            if (!resolverEmail.equalsIgnoreCase(reviewer)) {
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
                    resolverUserId,
                    resolverEmail,
                    role.toUpperCase(),
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
            @RequestHeader(value = "X-User-Email", defaultValue = "") String tutorEmail,
            @RequestBody TutorEvidenceRequest body) {
        Dispute dispute = disputeRepository.findById(id).orElse(null);
        if (dispute == null) return ResponseEntity.notFound().build();

        dispute.setTutorResponse(body.responseText() + (body.evidenceFileUrl() != null ? " [File: " + body.evidenceFileUrl() + "]" : ""));
        dispute.setTutorRespondedAt(Instant.now());
        Dispute saved = disputeRepository.save(dispute);
        return ResponseEntity.ok(toDisputeDto(saved));
    }

    public record ProposeSettlementRequest(
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
            @RequestBody(required = false) ProposeSettlementRequest body) {
        try {
            String outcomeStr = body != null && body.outcome() != null ? body.outcome().toUpperCase() : "BOTH_PRESENT";
            iuh.fit.contract_service.enums.SettlementOutcome outcome =
                    iuh.fit.contract_service.enums.SettlementOutcome.valueOf(outcomeStr);

            String evidenceHash = body != null && body.evidenceHash() != null && !body.evidenceHash().isBlank()
                    ? body.evidenceHash()
                    : org.web3j.crypto.Hash.sha3String("PROPOSE:" + agreementId + ":" + sessionId);

            BlockchainTransactionIntentResult result = sessionSettlementWorkflowService
                    .initiateSessionProposal(agreementId, sessionId, outcome, evidenceHash);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "agreementId", agreementId.toString(),
                    "sessionId", sessionId,
                    "outcome", outcome.name(),
                    "transactionStatus", result.status().name(),
                    "idempotencyKey", result.idempotencyKey()
            ));
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
            @RequestBody(required = false) ProposeSettlementRequest body) {
        List<ContractAgreement> agreements = agreementRepository.findAll().stream()
                .filter(a -> a.getClassroomId().equals(classroomId) && a.getStatus() == ContractAgreementStatus.ACTIVE)
                .toList();

        if (agreements.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Không tìm thấy hợp đồng ACTIVE nào cho lớp học: " + classroomId));
        }

        List<Map<String, Object>> results = new ArrayList<>();
        for (ContractAgreement agreement : agreements) {
            try {
                String outcomeStr = body != null && body.outcome() != null ? body.outcome().toUpperCase() : "BOTH_PRESENT";
                iuh.fit.contract_service.enums.SettlementOutcome outcome =
                        iuh.fit.contract_service.enums.SettlementOutcome.valueOf(outcomeStr);

                String evidenceHash = body != null && body.evidenceHash() != null && !body.evidenceHash().isBlank()
                        ? body.evidenceHash()
                        : org.web3j.crypto.Hash.sha3String("PROPOSE:" + agreement.getId() + ":" + sessionId);

                BlockchainTransactionIntentResult res = sessionSettlementWorkflowService
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

    // ─────────────────────────────────────────────
    // ALL TRANSACTIONS (Admin view)
    // ─────────────────────────────────────────────

    @GetMapping("/transactions")
    public ResponseEntity<Page<BlockchainTxDto>> listAllTransactions(
            @RequestHeader(value = "X-User-Role", defaultValue = "STUDENT") String role,
            @RequestHeader(value = "X-User-Id", defaultValue = "0") Long userId,
            @PageableDefault(size = 30) Pageable pageable) {

        List<BlockchainTransaction> all = transactionRepository.findAll();

        List<BlockchainTransaction> filtered;
        if (role.equalsIgnoreCase("ADMIN") || role.equalsIgnoreCase("STAFF")) {
            filtered = all;
        } else {
            // Student/Tutor see only their own agreement transactions
            Set<UUID> myAgreementIds = agreementRepository.findAll().stream()
                    .filter(a -> a.getStudentId().equals(userId) || a.getTutorId().equals(userId))
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

    // ─────────────────────────────────────────────
    // MAPPERS
    // ─────────────────────────────────────────────

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

    // ─────────────────────────────────────────────
    // DTOs
    // ─────────────────────────────────────────────

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
            String outcome, double amountUsdc, String status,
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
