package iuh.fit.contract_service.api;

import iuh.fit.contract_service.command.BlockchainTransactionIntentResult;
import iuh.fit.contract_service.entity.ContractAgreement;
import iuh.fit.contract_service.entity.SessionSettlement;
import iuh.fit.contract_service.entity.BlockchainTransaction;
import iuh.fit.contract_service.entity.Dispute;
import iuh.fit.contract_service.enums.ContractAgreementStatus;
import iuh.fit.contract_service.enums.DisputeStatus;
import iuh.fit.contract_service.enums.SettlementStatus;
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
    private final iuh.fit.contract_service.service.NotificationDispatcher notificationDispatcher;
    private final iuh.fit.contract_service.service.ContractSignatureService signatureService;

    public ContractManagementController(
            ContractAgreementRepository agreementRepository,
            SessionSettlementRepository settlementRepository,
            BlockchainTransactionRepository transactionRepository,
            DisputeRepository disputeRepository,
            DisputeWorkflowService disputeWorkflowService,
            iuh.fit.contract_service.service.NotificationDispatcher notificationDispatcher,
            iuh.fit.contract_service.service.ContractSignatureService signatureService) {
        this.agreementRepository = agreementRepository;
        this.settlementRepository = settlementRepository;
        this.transactionRepository = transactionRepository;
        this.disputeRepository = disputeRepository;
        this.disputeWorkflowService = disputeWorkflowService;
        this.notificationDispatcher = notificationDispatcher;
        this.signatureService = signatureService;
    }

    public record InitiateAgreementRequest(
            Long classroomId,
            Long studentId,
            String studentEmail,
            Long tutorId,
            String tutorEmail,
            String studentWallet,
            String tutorWallet,
            BigDecimal pricePerSessionVnd,
            Integer totalSessions,
            String classroomReviewerEmail
    ) {}

    public record SignAgreementRequest(
            String role,
            String walletAddress,
            String signature
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

        if (request.studentWallet() == null || !request.studentWallet().startsWith("0x") || request.studentWallet().length() != 42) {
            return ResponseEntity.badRequest().build();
        }
        if (request.tutorWallet() == null || !request.tutorWallet().startsWith("0x") || request.tutorWallet().length() != 42) {
            return ResponseEntity.badRequest().build();
        }

        UUID agreementId = UUID.randomUUID();
        String onchainAgreementId = org.web3j.crypto.Hash.sha3String("AGREEMENT:" + agreementId);
        String termsHash = org.web3j.crypto.Hash.sha3String("TERMS:" + request.classroomId() + ":" + request.studentId() + ":" + request.tutorId());

        BigDecimal pricePerSessionVnd = request.pricePerSessionVnd() != null ? request.pricePerSessionVnd() : BigDecimal.valueOf(250000);
        int totalSessions = request.totalSessions() != null && request.totalSessions() > 0 ? request.totalSessions() : 10;
        BigDecimal totalPriceVnd = pricePerSessionVnd.multiply(BigDecimal.valueOf(totalSessions));
        BigDecimal vndPerUsdc = BigDecimal.valueOf(25000);

        // Convert to USDC units (6 decimals)
        long pricePerSessionUnits = pricePerSessionVnd.divide(vndPerUsdc, 2, java.math.RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(1_000_000)).longValue();
        long totalAmountUnits = pricePerSessionUnits * totalSessions;

        OffsetDateTime now = OffsetDateTime.now();

        ContractAgreement agreement = ContractAgreement.builder()
                .id(agreementId)
                .onchainAgreementId(onchainAgreementId)
                .classroomId(request.classroomId() != null ? request.classroomId() : 1L)
                .studentId(request.studentId() != null ? request.studentId() : 1L)
                .tutorId(request.tutorId() != null ? request.tutorId() : 1L)
                .classroomReviewerEmail(request.classroomReviewerEmail())
                .studentWallet(request.studentWallet().toLowerCase(Locale.ROOT))
                .tutorWallet(request.tutorWallet().toLowerCase(Locale.ROOT))
                .platformWallet("0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266")
                .chainId(11155111L)
                .escrowContractAddress("0x984bEc42561BBC9f63BEE4BA1469872cD369d3b3")
                .tokenAddress("0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238")
                .tokenSymbol("USDC")
                .tokenDecimals((short) 6)
                .termsJson("{\"classroomId\":" + request.classroomId() + ",\"sessions\":" + totalSessions + "}")
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
            @RequestHeader(value = "X-User-Role", defaultValue = "TUTOR") String headerRole,
            @RequestHeader(value = "X-User-Id", defaultValue = "0") Long userId,
            @RequestHeader(value = "X-User-Email", defaultValue = "") String userEmail,
            @RequestHeader(value = "X-Forwarded-For", defaultValue = "127.0.0.1") String ipAddress,
            @RequestHeader(value = "User-Agent", defaultValue = "EduConnect-Web") String userAgent,
            @RequestBody SignAgreementRequest request) {

        String role = (request.role() != null && !request.role().isBlank()) ? request.role() : headerRole;

        try {
            ContractAgreement updated = signatureService.signAgreement(
                    id,
                    userId,
                    userEmail,
                    role,
                    request.walletAddress(),
                    request.signature(),
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
            @RequestHeader(value = "X-User-Role", defaultValue = "STUDENT") String role,
            @RequestHeader(value = "X-User-Id", defaultValue = "0") Long userId,
            @RequestHeader(value = "X-User-Email", defaultValue = "") String email,
            @RequestParam(value = "status", required = false) String statusFilter,
            @PageableDefault(size = 20) Pageable pageable) {

        List<ContractAgreement> all = agreementRepository.findAll();

        // Filter by role
        List<ContractAgreement> filtered = switch (role.toUpperCase()) {
            case "ADMIN" -> all;
            case "STAFF" -> email.isBlank() ? all : all.stream()
                    .filter(a -> email.equalsIgnoreCase(a.getClassroomReviewerEmail()))
                    .collect(Collectors.toList());
            case "TUTOR" -> userId == 0 ? all : all.stream()
                    .filter(a -> a.getTutorId().equals(userId))
                    .collect(Collectors.toList());
            default -> userId == 0 ? all : all.stream() // STUDENT
                    .filter(a -> a.getStudentId().equals(userId))
                    .collect(Collectors.toList());
        };

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
    public ResponseEntity<AgreementDetailDto> getAgreement(@PathVariable UUID id) {
        return agreementRepository.findById(id)
                .map(this::toAgreementDetail)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/agreements/{id}/settlements")
    public ResponseEntity<List<SettlementDto>> getSettlements(@PathVariable UUID id) {
        return agreementRepository.findById(id).map(agreement -> {
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
    public ResponseEntity<List<BlockchainTxDto>> getTransactions(@PathVariable UUID id) {
        List<BlockchainTxDto> list = transactionRepository.findAll().stream()
                .filter(t -> id.equals(t.getAgreementId()))
                .sorted(Comparator.comparing(BlockchainTransaction::getCreatedAt))
                .map(this::toTxDto)
                .collect(Collectors.toList());
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
            default -> userId == 0 ? all : all.stream() // STUDENT / TUTOR: only own
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
        return new AgreementSummaryDto(
                a.getId().toString(),
                a.getOnchainAgreementId(),
                a.getClassroomId(),
                a.getStudentId(),
                a.getTutorId(),
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
            Long classroomId, Long studentId, Long tutorId,
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
