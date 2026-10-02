package iuh.fit.contract_service.service;

import iuh.fit.contract_service.config.security.*;
import iuh.fit.contract_service.entity.*;
import iuh.fit.contract_service.enums.ContractAgreementStatus;
import iuh.fit.contract_service.enums.DisputeStatus;
import iuh.fit.contract_service.enums.SettlementStatus;
import iuh.fit.contract_service.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import org.web3j.crypto.Hash;
import org.web3j.utils.Numeric;
import tools.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.math.BigInteger;
import java.time.OffsetDateTime;
import java.util.*;

@Service @RequiredArgsConstructor
public class TerminationService {
    private final TerminationCaseRepository cases;
    private final TerminationItemRepository items;
    private final TerminationEvidenceRepository evidence;
    private final ContractAgreementRepository agreements;
    private final SessionSettlementRepository settlements;
    private final DisputeRepository disputes;
    private final ContractAccessControl access;
    private final ObjectMapper mapper;
    private final NotificationDispatcher notifications;
    private final Eip712VerificationService verificationService;
    private final TerminationLearningClient learning;

    private static final long SIGNATURE_CLOCK_SKEW_SECONDS = 300;
    private static final long RESPONSE_WINDOW_HOURS = 24;
    private static final long NEXT_SESSION_BUFFER_HOURS = 2;
    private static final long MIN_SHORT_NOTICE_HOURS = 6;
    private static final String ORIGIN_PARTY = "PARTY_REQUEST";
    private static final String ORIGIN_AUTO_ABSENCE = "AUTO_TUTOR_ABSENCE";
    private static final String ORIGIN_SYSTEM_REVIEW = "SYSTEM_REVIEW";
    private static final String ORIGIN_ADMIN = "ADMIN_DIRECT";

    public record ItemView(UUID agreementId, String status, String lastError, String transactionHash,
                           String refundedUnits, String studentName, int tokenDecimals, Long chainId,
                           String depositedUnits, String tutorPaidUnits, String platformFeeUnits,
                           String sessionRefundedUnits, String remainingUnits, OffsetDateTime updatedAt) {}
    public record EvidenceView(UUID id, String originalFilename, String contentType, long sizeBytes,
                               String submittedByRole, java.time.Instant createdAt) {}
    public record View(TerminationCase request, List<ItemView> items, List<EvidenceView> evidence) {}
    private View view(TerminationCase c) {
        var itemViews = items.findByCaseIdOrderByAgreementId(c.getId()).stream()
                .map(i -> itemView(i, agreements.findById(i.getAgreementId()).orElseThrow())).toList();
        var evidenceViews = evidence.findByTerminationCaseIdOrderByCreatedAtAsc(c.getId()).stream()
                .map(item -> new EvidenceView(item.getId(), item.getOriginalFilename(), item.getContentType(),
                        item.getSizeBytes(), item.getSubmittedByRole(), item.getCreatedAt()))
                .toList();
        return new View(c, itemViews, evidenceViews);
    }

    private ItemView itemView(TerminationItem item, ContractAgreement agreement) {
        BigInteger tutorPaid = BigInteger.ZERO;
        BigInteger platformFee = BigInteger.ZERO;
        BigInteger sessionRefunded = BigInteger.ZERO;
        for (var settlement : settlements.findByAgreementId(agreement.getId())) {
            if (settlement.getStatus() != SettlementStatus.SETTLED && settlement.getStatus() != SettlementStatus.REFUNDED) continue;
            tutorPaid = tutorPaid.add(zeroIfNull(settlement.getTutorAmount()));
            platformFee = platformFee.add(zeroIfNull(settlement.getPlatformAmount()));
            sessionRefunded = sessionRefunded.add(zeroIfNull(settlement.getStudentRefundAmount()));
        }
        BigInteger deposited = zeroIfNull(agreement.getTotalAmountUsdcUnits());
        BigInteger refunded = zeroIfNull(item.getRefundedUnits());
        BigInteger remaining = deposited.subtract(tutorPaid).subtract(platformFee)
                .subtract(sessionRefunded).subtract(refunded).max(BigInteger.ZERO);
        if (agreement.getStatus() == ContractAgreementStatus.CANCELLED) remaining = BigInteger.ZERO;
        return new ItemView(item.getAgreementId(), item.getStatus(), item.getLastError(), item.getTransactionHash(),
                item.getRefundedUnits() == null ? null : item.getRefundedUnits().toString(),
                agreement.getStudentName() == null ? agreement.getStudentEmail() : agreement.getStudentName(),
                agreement.getTokenDecimals(), agreement.getChainId(), deposited.toString(), tutorPaid.toString(),
                platformFee.toString(), sessionRefunded.toString(), remaining.toString(), item.getUpdatedAt());
    }

    private BigInteger zeroIfNull(BigInteger value) { return value == null ? BigInteger.ZERO : value; }

    @Transactional(readOnly = true)
    public List<View> list(ContractUserPrincipal user) {
        return cases.findAll().stream().filter(c -> canView(c, user))
                .sorted(Comparator.comparing(TerminationCase::getCreatedAt).reversed())
                .map(this::view).toList();
    }

    @Transactional(readOnly = true)
    public List<View> listRefunds(ContractUserPrincipal user) {
        if (!user.hasActiveAuthority("STUDENT")) return list(user);
        return cases.findAll().stream()
                .sorted(Comparator.comparing(TerminationCase::getCreatedAt).reversed())
                .map(c -> c.isWholeClass() ? studentClassRefundView(c, user)
                        : (canView(c, user) ? view(c) : null))
                .filter(Objects::nonNull)
                .toList();
    }

    private View studentClassRefundView(TerminationCase c, ContractUserPrincipal user) {
        var ownItems = items.findByCaseIdOrderByAgreementId(c.getId()).stream()
                .map(item -> new AbstractMap.SimpleImmutableEntry<>(item, agreements.findById(item.getAgreementId()).orElse(null)))
                .filter(entry -> entry.getValue() != null && access.canViewAgreement(entry.getValue(), user))
                .map(entry -> itemView(entry.getKey(), entry.getValue())).toList();
        // Before approval there are no refund work items. Expose only the student's own
        // affected agreement as a read-only preview; never create settlement work here.
        if (ownItems.isEmpty() && Set.of("HOLD_PENDING", "REQUESTED", "RECOMMENDED", "RELEASE_PENDING").contains(c.getStatus())) {
            ownItems = agreements.findByClassroomIdOrderByCreatedAtAsc(c.getClassroomId()).stream()
                    .filter(TerminationService::activeTerminationAgreement)
                    .filter(agreement -> access.canViewAgreement(agreement, user))
                    .map(agreement -> {
                        var preview = new TerminationItem();
                        preview.setAgreementId(agreement.getId());
                        preview.setStatus("WAITING_APPROVAL");
                        return itemView(preview, agreement);
                    }).toList();
        }
        if (ownItems.isEmpty()) return null;

        var summary = new TerminationCase();
        summary.setId(c.getId());
        summary.setAnchorAgreementId(ownItems.get(0).agreementId());
        summary.setClassroomId(c.getClassroomId());
        summary.setWholeClass(true);
        summary.setReason(ORIGIN_ADMIN.equals(c.getOrigin()) ? "Admin quyết định dừng/hủy lớp"
                : ORIGIN_AUTO_ABSENCE.equals(c.getOrigin()) ? "Lớp được xem xét do cảnh cáo vắng học"
                : ORIGIN_SYSTEM_REVIEW.equals(c.getOrigin()) ? "Hệ thống đề nghị xem xét lớp"
                : "Gia sư đề xuất hủy lớp");
        summary.setRequestedBy(ORIGIN_ADMIN.equals(c.getOrigin()) ? "ADMIN"
                : ORIGIN_PARTY.equals(c.getOrigin()) ? "TUTOR" : "SYSTEM");
        summary.setStatus(c.getStatus());
        summary.setOrigin(c.getOrigin());
        summary.setResponseDeadline(c.getResponseDeadline());
        summary.setCreatedAt(c.getCreatedAt());
        summary.setUpdatedAt(c.getUpdatedAt());
        summary.setAuditJson("[]");
        return new View(summary, ownItems, List.of());
    }

    @Transactional
    public View request(UUID agreementId, boolean wholeClass, String reason, ContractUserPrincipal user) {
        return request(agreementId, wholeClass, reason, null, null, null, user);
    }

    @Transactional
    public View request(UUID agreementId, boolean wholeClass, String reason, String signature, String signerWallet, Long requestedAtTimestamp, ContractUserPrincipal user) {
        return requestInternal(agreementId, wholeClass, reason, signature, signerWallet, requestedAtTimestamp, user, null);
    }

    private View requestInternal(UUID agreementId, boolean wholeClass, String reason, String signature,
                                 String signerWallet, Long requestedAtTimestamp, ContractUserPrincipal user,
                                 String systemOrigin) {
        var source = agreements.findById(agreementId).orElseThrow();
        lockClass(source.getClassroomId());
        var anchor = agreements.lockById(agreementId).orElseThrow();
        access.requireCanViewAgreement(anchor, user);
        boolean systemRequest = user.userId() != null && user.userId() == 0L
                && "system@educonnect.invalid".equalsIgnoreCase(user.email());
        if (!systemRequest && (user.hasActiveAuthority("ADMIN") || user.hasActiveAuthority("STAFF"))) {
            fail(HttpStatus.FORBIDDEN, "Staff/Admin review termination requests but cannot submit unsigned party requests");
        }
        if (wholeClass && user.hasActiveAuthority("STUDENT")) fail(HttpStatus.FORBIDDEN, "Student can request only their own agreement");
        if (!wholeClass && user.hasActiveAuthority("TUTOR")) fail(HttpStatus.FORBIDDEN, "Tutor must request termination for the whole class");
        requireText(reason);
        if (anchor.getStatus() != ContractAgreementStatus.ACTIVE || anchor.isLegacyExcluded()) {
            fail(HttpStatus.CONFLICT, "Chỉ có thể yêu cầu chấm dứt đối với hợp đồng đã được hai bên ký kết và hoàn tất nạp cọc Escrow (ACTIVE).");
        }
        for (var existing : cases.findByClassroomIdOrderByCreatedAtDesc(anchor.getClassroomId())) {
            if (!Set.of("REJECTED", "COMPLETED").contains(existing.getStatus())
                    && (wholeClass || existing.isWholeClass() || existing.getAnchorAgreementId().equals(agreementId))) {
                fail(HttpStatus.CONFLICT, "An overlapping termination request already exists");
            }
        }

        // Enforce cryptographic EIP-712 wallet signature verification for student and tutor
        boolean isStudent = user.hasActiveAuthority("STUDENT");
        boolean isTutor = user.hasActiveAuthority("TUTOR");
        if (isStudent || isTutor) {
            String expectedWallet = isStudent ? anchor.getStudentWallet() : anchor.getTutorWallet();
            if (expectedWallet == null || expectedWallet.isBlank() || expectedWallet.equalsIgnoreCase("0x" + "0".repeat(40))) {
                fail(HttpStatus.BAD_REQUEST, "Hợp đồng chưa liên kết địa chỉ ví hợp lệ.");
            }
            String normalizedSignerWallet = signerWallet != null ? signerWallet.trim().toLowerCase(Locale.ROOT) : "";
            if (!normalizedSignerWallet.equalsIgnoreCase(expectedWallet.trim().toLowerCase(Locale.ROOT))) {
                fail(HttpStatus.FORBIDDEN, "Ví MetaMask dùng để ký kết thúc (" + signerWallet + ") không khớp với ví đã ký hợp đồng và nạp cọc (" + expectedWallet + "). Vui lòng chuyển sang đúng ví trên MetaMask.");
            }
            if (signature == null || signature.isBlank()) {
                fail(HttpStatus.BAD_REQUEST, "Yêu cầu kết thúc hợp đồng bắt buộc phải có chữ ký số xác nhận từ ví MetaMask.");
            }
            if (requestedAtTimestamp == null) {
                fail(HttpStatus.BAD_REQUEST, "Chữ ký kết thúc hợp đồng thiếu thời điểm ký.");
            }
            long now = System.currentTimeMillis() / 1000L;
            if (Math.abs(now - requestedAtTimestamp) > SIGNATURE_CLOCK_SKEW_SECONDS) {
                fail(HttpStatus.BAD_REQUEST, "Chữ ký kết thúc hợp đồng đã hết hạn hoặc có thời điểm không hợp lệ.");
            }
            if (cases.existsBySignature(signature)) {
                fail(HttpStatus.CONFLICT, "Chữ ký kết thúc hợp đồng đã được sử dụng.");
            }
            long requestedAt = requestedAtTimestamp;
            byte[] reasonHashBytes = Hash.sha3(reason.trim().getBytes(StandardCharsets.UTF_8));
            String reasonHashHex = Numeric.toHexString(reasonHashBytes);
            long chainId = anchor.getChainId() != null ? anchor.getChainId() : 11155111L;
            String escrowContract = anchor.getEscrowContractAddress() != null
                    ? anchor.getEscrowContractAddress()
                    : "0x984bEc42561BBC9f63BEE4BA1469872cD369d3b3";

            boolean validSig = verificationService.verifyTerminationSignature(
                    expectedWallet,
                    signature,
                    anchor.getId().toString(),
                    reasonHashHex,
                    wholeClass,
                    requestedAt,
                    chainId,
                    escrowContract
            );
            if (!validSig) {
                fail(HttpStatus.FORBIDDEN, "Chữ ký số xác nhận từ ví MetaMask không hợp lệ hoặc nội dung yêu cầu đã bị sửa đổi.");
            }
        }

        var c = new TerminationCase();
        c.setId(UUID.randomUUID()); c.setAnchorAgreementId(agreementId); c.setClassroomId(anchor.getClassroomId());
        c.setWholeClass(wholeClass); c.setReason(reason.trim()); c.setRequestedBy(user.email());
        c.setSignerWallet(signerWallet);
        c.setSignature(signature);
        c.setRequestedAtTimestamp(requestedAtTimestamp);
        String origin = systemRequest ? Objects.requireNonNullElse(systemOrigin, ORIGIN_SYSTEM_REVIEW) : ORIGIN_PARTY;
        c.setStatus("HOLD_PENDING"); c.setOrigin(origin);
        c.setCreatedAt(OffsetDateTime.now()); c.setAuditJson("[]");
        audit(c, user, "REQUESTED", reason);
        cases.saveAndFlush(c);
        if (ORIGIN_AUTO_ABSENCE.equals(origin)) {
            synchronizeHold(c, anchor);
        } else if (systemRequest) {
            c.setStatus("REQUESTED");
            c.setLastError(null);
        } else {
            synchronizeHold(c, anchor);
        }
        cases.saveAndFlush(c);
        String receivedMessage = ORIGIN_AUTO_ABSENCE.equals(origin)
                ? "Hệ thống ghi nhận Gia sư vắng 3 buổi liên tiếp. Lịch tương lai đã được tạm giữ; Gia sư cần gửi giải trình và minh chứng trước hạn hiển thị trong hồ sơ."
                : "Yêu cầu dừng lớp học đã được gửi và đang chờ thẩm định.";
        notifyParties(anchor, c, receivedMessage);
        return view(c);
    }

    @Transactional
    public View adminRequest(UUID agreementId, boolean wholeClass, String reason,
                             boolean approveImmediately, ContractUserPrincipal user) {
        if (!user.hasActiveAuthority("ADMIN")) fail(HttpStatus.FORBIDDEN, "Only Admin can create an administrative termination");
        requireText(reason);
        var source = agreements.findById(agreementId).orElseThrow();
        lockClass(source.getClassroomId());
        var anchor = agreements.lockById(agreementId).orElseThrow();
        access.requireCanViewAgreement(anchor, user);
        if (anchor.getStatus() != ContractAgreementStatus.ACTIVE || anchor.isLegacyExcluded()) {
            fail(HttpStatus.CONFLICT, "Chỉ có thể dừng hợp đồng ACTIVE có Escrow hợp lệ.");
        }
        ensureNoOverlappingRequest(anchor, agreementId, wholeClass);

        var c = new TerminationCase();
        c.setId(UUID.randomUUID());
        c.setAnchorAgreementId(agreementId); c.setClassroomId(anchor.getClassroomId());
        c.setWholeClass(wholeClass); c.setReason(reason.trim()); c.setRequestedBy(user.email());
        c.setOrigin(ORIGIN_ADMIN); c.setStatus("HOLD_PENDING");
        c.setCreatedAt(OffsetDateTime.now()); c.setAuditJson("[]");
        audit(c, user, "ADMIN_REQUESTED", reason);
        cases.saveAndFlush(c);
        synchronizeHold(c, anchor);
        cases.saveAndFlush(c);
        notifyParties(anchor, c, wholeClass
                ? "Admin đã tạm dừng lớp để xử lý hủy lớp. Các buổi tương lai đang được giữ."
                : "Admin đã tạm dừng hợp đồng của học viên để xử lý. Các buổi tương lai của học viên đang được giữ.");
        return approveImmediately && "REQUESTED".equals(c.getStatus())
                ? act(c.getId(), "FORCE_APPROVE", reason, user) : view(c);
    }

    private void ensureNoOverlappingRequest(ContractAgreement anchor, UUID agreementId, boolean wholeClass) {
        for (var existing : cases.findByClassroomIdOrderByCreatedAtDesc(anchor.getClassroomId())) {
            if (!Set.of("REJECTED", "COMPLETED").contains(existing.getStatus())
                    && (wholeClass || existing.isWholeClass() || existing.getAnchorAgreementId().equals(agreementId))) {
                fail(HttpStatus.CONFLICT, "An overlapping termination request already exists");
            }
        }
    }

    @Transactional
    public View act(UUID id, String action, String reason, ContractUserPrincipal user) {
        var c = cases.lockById(id).orElseThrow();
        if (!canView(c, user)) fail(HttpStatus.NOT_FOUND, "Termination request not found");
        lockClass(c.getClassroomId());
        var anchor = agreements.lockById(c.getAnchorAgreementId()).orElseThrow();
        requireText(reason);
        boolean manager = user.hasActiveAuthority("ADMIN") || user.hasActiveAuthority("STAFF");
        switch (action) {
            case "RESPOND" -> {
                requireStatus(c, "HOLD_PENDING", "REQUESTED", "RECOMMENDED");
                if (manager) fail(HttpStatus.FORBIDDEN, "Use review actions for Staff/Admin");
                if (ORIGIN_AUTO_ABSENCE.equals(c.getOrigin()) && !user.hasActiveAuthority("TUTOR")) {
                    fail(HttpStatus.FORBIDDEN, "Only the Tutor can explain an automatic absence warning");
                }
                if (user.hasActiveAuthority("TUTOR")) c.setTutorRespondedAt(OffsetDateTime.now());
            }
            case "RECOMMEND" -> {
                if (!user.hasActiveAuthority("STAFF")) fail(HttpStatus.FORBIDDEN, "Only assigned Staff can recommend termination");
                requireStatus(c, "REQUESTED");
                requireAutomaticWarningReady(c);
                requireNoPendingDisputes(c);
                c.setStatus("RECOMMENDED");
            }
            case "REJECT" -> {
                if (!user.hasActiveAuthority("ADMIN")) fail(HttpStatus.FORBIDDEN, "Only Admin can reject termination and restore learning");
                requireStatus(c, "REQUESTED", "RECOMMENDED");
                requireNoPendingDisputes(c);
                c.setStatus("RELEASE_PENDING");
                synchronizeRelease(c, anchor);
            }
            case "APPROVE", "FORCE_APPROVE" -> {
                if (!user.hasActiveAuthority("ADMIN")) fail(HttpStatus.FORBIDDEN, "Only Admin can approve termination");
                requireStatus(c, "REQUESTED", "RECOMMENDED");
                if ("APPROVE".equals(action)) {
                    requireAutomaticWarningReady(c);
                    requireNoPendingDisputes(c);
                }
                if (anchor.getTerminationCutoffSession() == null) synchronizeHold(c, anchor);
                if (anchor.getTerminationCutoffSession() == null) {
                    fail(HttpStatus.CONFLICT, "Learning hold is not ready; retry after synchronization");
                }
                var targets = c.isWholeClass() ? agreements.findByClassroomIdOrderByCreatedAtAsc(c.getClassroomId()) : List.of(anchor);
                for (var target : targets) {
                    if (!activeTerminationAgreement(target)) continue;
                    if (target.isLegacyExcluded()) fail(HttpStatus.CONFLICT, "Class contains audit-only agreements; reconcile before closure");
                    var locked = agreements.lockById(target.getId()).orElseThrow();
                    if (!activeTerminationAgreement(locked)) continue;
                    if (items.existsById(locked.getId())) {
                        if (terminal(locked) && "COMPLETED".equals(items.findById(locked.getId()).orElseThrow().getStatus())) continue;
                        fail(HttpStatus.CONFLICT, "Agreement already belongs to an approved termination");
                    }
                    if (locked.getTerminationCutoffSession() == null) {
                        fail(HttpStatus.CONFLICT, "Learning hold is not ready; retry after synchronization");
                    }
                    var item = new TerminationItem(); item.setAgreementId(locked.getId()); item.setCaseId(c.getId());
                    item.setStatus("LEARNING_PENDING"); item.setUpdatedAt(OffsetDateTime.now()); items.save(item);
                }
                c.setStatus("APPROVED");
            }
            default -> fail(HttpStatus.BAD_REQUEST, "Unknown termination action");
        }
        audit(c, user, action, reason);
        cases.saveAndFlush(c);
        String statusMessage = switch (c.getStatus()) {
            case "APPROVED" -> c.isWholeClass()
                    ? "Admin đã phê duyệt hủy cả lớp. Hệ thống đang xử lý quyết toán và hoàn phần cọc còn lại."
                    : "Admin đã phê duyệt chấm dứt hợp đồng của học viên. Lớp vẫn tiếp tục với các học viên khác; phần cọc còn lại của hợp đồng đang được xử lý hoàn trả.";
            case "RECOMMENDED" -> "Hồ sơ dừng lớp học đã được Staff thẩm định và đề xuất xử lý.";
            case "REJECTED" -> "Yêu cầu dừng lớp học đã bị từ chối.";
            default -> "Cập nhật hồ sơ dừng hợp đồng: " + c.getStatus();
        };
        if ("RESPOND".equals(action)) statusMessage = "Hồ sơ dừng/hủy đã có phản hồi mới. Staff/Admin có thể mở hồ sơ để thẩm định.";
        notifyParties(anchor, c, statusMessage);
        if (Set.of("APPROVE", "FORCE_APPROVE").contains(action) && c.isWholeClass()) {
            for (var item : items.findByCaseIdOrderByAgreementId(c.getId())) {
                if (item.getAgreementId().equals(anchor.getId())) continue;
                var affected = agreements.findById(item.getAgreementId()).orElseThrow();
                notifications.sendAsync(affected.getStudentEmail(), affected.getStudentId(), "Cham dut lop hoc",
                        "Admin đã phê duyệt dừng lớp học. Tiền cọc còn lại sẽ được hoàn về ví sau khi xử lý các buổi đã bắt đầu.",
                        "TERMINATION_UPDATED", "AGREEMENT", affected.getId().toString());
            }
        }
        return view(c);
    }

    private void requireAutomaticWarningReady(TerminationCase c) {
        if (!ORIGIN_AUTO_ABSENCE.equals(c.getOrigin()) || c.getTutorRespondedAt() != null) return;
        if (c.getResponseDeadline() != null && !OffsetDateTime.now().isBefore(c.getResponseDeadline())) return;
        fail(HttpStatus.CONFLICT,
                "Gia sư chưa giải trình và thời hạn phản hồi chưa hết. Admin có thể dùng quyết định khẩn cấp nếu cần dừng lớp ngay.");
    }

    private void requireNoPendingDisputes(TerminationCase termination) {
        var targets = termination.isWholeClass()
                ? agreements.findByClassroomIdOrderByCreatedAtAsc(termination.getClassroomId())
                : List.of(agreements.findById(termination.getAnchorAgreementId()).orElseThrow());
        var unresolved = List.of(DisputeStatus.OPENING, DisputeStatus.OPEN, DisputeStatus.UNDER_REVIEW,
                DisputeStatus.RESOLUTION_PENDING, DisputeStatus.FAILED_RETRYABLE);
        var affectedAgreementIds = targets.stream()
                .filter(TerminationService::activeTerminationAgreement)
                .filter(agreement -> disputes.existsBySettlement_Agreement_IdAndStatusIn(agreement.getId(), unresolved))
                .map(agreement -> agreement.getId().toString())
                .toList();
        if (!affectedAgreementIds.isEmpty()) {
            fail(HttpStatus.CONFLICT, "Chưa thể xử lý yêu cầu hủy/chấm dứt. Hãy giải quyết các khiếu nại đang chờ ở buổi học thuộc hợp đồng bị ảnh hưởng trước; lịch học tương lai hiện vẫn theo trạng thái của yêu cầu hủy. Hợp đồng cần xử lý: "
                    + String.join(", ", affectedAgreementIds) + ". Mở tab Khiếu nại để xử lý trước.");
        }
    }

    public boolean canView(TerminationCase c, ContractUserPrincipal user) {
        var a = agreements.findById(c.getAnchorAgreementId()).orElse(null);
        // A class file may include other students' reasons; students use their own agreement history.
        return a != null && !(c.isWholeClass() && user.hasActiveAuthority("STUDENT")) && access.canViewAgreement(a, user);
    }

    @Transactional(readOnly = true)
    public TerminationCase requireCanView(UUID id, ContractUserPrincipal user) {
        var termination = cases.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Termination request not found"));
        if (!canView(termination, user)) fail(HttpStatus.NOT_FOUND, "Termination request not found");
        return termination;
    }

    @Transactional(readOnly = true)
    public void requireCanAddEvidence(UUID id, ContractUserPrincipal user) {
        var termination = requireCanView(id, user);
        if (!user.hasActiveAuthority("STUDENT") && !user.hasActiveAuthority("TUTOR")) {
            fail(HttpStatus.FORBIDDEN, "Only the contract parties can submit termination evidence");
        }
        requireStatus(termination, "HOLD_PENDING", "REQUESTED", "RECOMMENDED");
        if (user.userId() == null) fail(HttpStatus.FORBIDDEN, "Authenticated user id is required");
        if (evidence.countByTerminationCaseIdAndSubmittedByUserId(id, user.userId()) >= 5) {
            fail(HttpStatus.CONFLICT, "Mỗi bên chỉ được tải tối đa 5 file minh chứng cho một hồ sơ.");
        }
    }

    @Transactional
    public View addEvidence(
            UUID id,
            ContractUserPrincipal user,
            DisputeEvidenceStorageService.StoredEvidence stored) {
        var termination = cases.lockById(id).orElseThrow();
        requireCanAddEvidence(id, user);
        requireStatus(termination, "HOLD_PENDING", "REQUESTED", "RECOMMENDED");
        evidence.save(TerminationEvidence.builder()
                .id(UUID.randomUUID())
                .terminationCase(termination)
                .submittedByUserId(user.userId())
                .submittedByRole(user.activeRole())
                .originalFilename(stored.originalFilename())
                .objectKey(stored.objectKey())
                .contentType(stored.contentType())
                .sizeBytes(stored.size())
                .sha256(stored.sha256())
                .build());
        if (ORIGIN_AUTO_ABSENCE.equals(termination.getOrigin()) && user.hasActiveAuthority("TUTOR")) {
            termination.setTutorRespondedAt(OffsetDateTime.now());
            termination.setUpdatedAt(OffsetDateTime.now());
            audit(termination, user, "EVIDENCE_SUBMITTED", "Gia sư đã gửi minh chứng cho cảnh cáo vắng học");
            cases.save(termination);
        }
        var anchor = agreements.findById(termination.getAnchorAgreementId()).orElseThrow();
        notifications.sendAsync(anchor.getClassroomReviewerEmail(), null, "Hồ sơ hủy lớp có minh chứng mới",
                "Một bên đã bổ sung minh chứng. Mở hồ sơ để xem tài liệu theo quyền được cấp.",
                "TERMINATION_EVIDENCE_SUBMITTED", "AGREEMENT", anchor.getId().toString());
        return view(termination);
    }

    @Transactional
    public void requireClassCanCreate(Long classroomId) {
        lockClass(classroomId);
        if (cases.findByClassroomIdOrderByCreatedAtDesc(classroomId).stream()
                .anyMatch(c -> c.isWholeClass() && !"REJECTED".equals(c.getStatus()))) {
            fail(HttpStatus.CONFLICT, "Classroom is terminating or terminated");
        }
    }

    @Transactional
    public void retryLearningSynchronization(UUID id) {
        var c = cases.lockById(id).orElseThrow();
        var anchor = agreements.lockById(c.getAnchorAgreementId()).orElseThrow();
        if ("HOLD_PENDING".equals(c.getStatus())) synchronizeHold(c, anchor);
        else if ("RELEASE_PENDING".equals(c.getStatus())) synchronizeRelease(c, anchor);
        cases.save(c);
        if (Set.of("REQUESTED", "REJECTED").contains(c.getStatus()))
            notifyParties(anchor, c, "REJECTED".equals(c.getStatus())
                    ? "Admin đã cho phép tiếp tục học. Lịch học đã được khôi phục."
                    : "Lịch học tương lai đã được tạm dừng để chờ Admin xem xét hồ sơ.");
    }

    private void synchronizeHold(TerminationCase c, ContractAgreement anchor) {
        try {
            var snapshot = learning.send(anchor.getClassroomId(), anchor.getStudentId(), anchor.getId(), c.isWholeClass(), "HOLD");
            if (snapshot.cutoffSession() < 0) throw new IllegalStateException("Invalid Learning hold cutoff");
            var targets = c.isWholeClass()
                    ? agreements.findByClassroomIdOrderByCreatedAtAsc(c.getClassroomId())
                    : List.of(anchor);
            for (var target : targets) {
                if (activeTerminationAgreement(target)) target.setTerminationCutoffSession(snapshot.cutoffSession());
            }
            if ("HOLD_PENDING".equals(c.getStatus())) c.setStatus("REQUESTED");
            if (ORIGIN_AUTO_ABSENCE.equals(c.getOrigin()) && c.getResponseDeadline() == null) {
                c.setResponseDeadline(calculateResponseDeadline(OffsetDateTime.now(), snapshot.nextSessionStart()));
            }
            c.setLastError(null);
            c.setUpdatedAt(OffsetDateTime.now());
            if (c.isWholeClass()) {
                for (var target : targets) {
                    if (target.getId().equals(anchor.getId()) || !activeTerminationAgreement(target)) continue;
                    notifications.sendAsync(target.getStudentEmail(), target.getStudentId(),
                            "Lop hoc tam dung cho xu ly",
                            "Lớp có hồ sơ dừng/hủy đang được xem xét. Các buổi tương lai đã tạm dừng để chờ quyết định của Admin.",
                            "TERMINATION_UPDATED", "AGREEMENT", target.getId().toString());
                }
            }
        } catch (Exception error) {
            c.setStatus("HOLD_PENDING");
            c.setLastError(shortError(error, "Learning hold pending"));
            c.setUpdatedAt(OffsetDateTime.now());
        }
    }

    static OffsetDateTime calculateResponseDeadline(OffsetDateTime now, OffsetDateTime nextSessionStart) {
        OffsetDateTime maximum = now.plusHours(RESPONSE_WINDOW_HOURS);
        if (nextSessionStart == null || nextSessionStart.isBefore(now.plusHours(MIN_SHORT_NOTICE_HOURS))) return maximum;
        OffsetDateTime beforeNextSession = nextSessionStart.minusHours(NEXT_SESSION_BUFFER_HOURS);
        return beforeNextSession.isBefore(maximum) ? beforeNextSession : maximum;
    }

    private void synchronizeRelease(TerminationCase c, ContractAgreement anchor) {
        try {
            learning.send(anchor.getClassroomId(), anchor.getStudentId(), anchor.getId(), c.isWholeClass(), "RELEASE");
            var targets = c.isWholeClass()
                    ? agreements.findByClassroomIdOrderByCreatedAtAsc(c.getClassroomId())
                    : List.of(anchor);
            for (var target : targets) {
                if (activeTerminationAgreement(target)) target.setTerminationCutoffSession(null);
            }
            c.setStatus("REJECTED");
            c.setLastError(null);
            c.setUpdatedAt(OffsetDateTime.now());
            if (c.isWholeClass()) {
                for (var target : targets) {
                    if (target.getId().equals(anchor.getId()) || !activeTerminationAgreement(target)) continue;
                    notifications.sendAsync(target.getStudentEmail(), target.getStudentId(),
                            "Lop hoc tiep tuc",
                            "De xuat dung giang day khong duoc chap thuan. Lich hoc tuong lai da duoc khoi phuc.",
                            "TERMINATION_UPDATED", "AGREEMENT", target.getId().toString());
                }
            }
        } catch (Exception error) {
            c.setStatus("RELEASE_PENDING");
            c.setLastError(shortError(error, "Learning hold release pending"));
            c.setUpdatedAt(OffsetDateTime.now());
        }
    }

    private static String shortError(Exception error, String fallback) {
        String text = error.getMessage() == null ? fallback : error.getMessage();
        return text.substring(0, Math.min(1000, text.length()));
    }
    private void lockClass(Long classroomId) {
        var existing = agreements.findByClassroomIdOrderByCreatedAtAsc(classroomId);
        if (!existing.isEmpty()) agreements.lockById(existing.getFirst().getId()).orElseThrow();
    }
    @Transactional
    public void requestSystemReview(UUID agreementId, String detectionKey, String reason) {
        var a = agreements.findById(agreementId).orElseThrow();
        lockClass(a.getClassroomId());
        var existing = cases.findByClassroomIdOrderByCreatedAtDesc(a.getClassroomId());
        if (existing.stream().anyMatch(c -> detectionKey.equals(c.getDetectionKey())
                || !Set.of("REJECTED", "COMPLETED").contains(c.getStatus()))) return;
        var system = new ContractUserPrincipal(0L, "system@educonnect.invalid", "ADMIN", List.of("ADMIN"));
        String origin = detectionKey.startsWith("TUTOR_ABSENT:") ? ORIGIN_AUTO_ABSENCE : ORIGIN_SYSTEM_REVIEW;
        var view = requestInternal(agreementId, true, reason, null, null, null, system, origin);
        view.request().setDetectionKey(detectionKey);
    }
    private void audit(TerminationCase c, ContractUserPrincipal user, String action, String reason) {
        var array = (tools.jackson.databind.node.ArrayNode) mapper.readTree(c.getAuditJson());
        array.add(mapper.valueToTree(Map.of("actor", user.email(), "role", user.activeRole(),
                "action", action, "reason", reason.trim(), "at", OffsetDateTime.now().toString())));
        c.setAuditJson(mapper.writeValueAsString(array)); c.setUpdatedAt(OffsetDateTime.now());
    }
    private void notifyParties(ContractAgreement a, TerminationCase c, String message) {
        if ("HOLD_PENDING".equals(c.getStatus())) message = "Đã tiếp nhận hồ sơ dừng/hủy. Hệ thống đang đồng bộ tạm dừng lịch; vui lòng theo dõi trạng thái hồ sơ.";
        if ("RELEASE_PENDING".equals(c.getStatus())) message = "Admin đã cho phép tiếp tục học. Hệ thống đang đồng bộ khôi phục lịch.";
        if (c.getResponseDeadline() != null && "REQUESTED".equals(c.getStatus()))
            message += " Hạn giải trình: " + c.getResponseDeadline().atZoneSameInstant(java.time.ZoneId.of("Asia/Bangkok"))
                    .format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm 'UTC+7'")) + ".";
        notifications.sendAsync(a.getStudentEmail(), a.getStudentId(), "Chấm dứt hợp đồng lớp học", message,
                "TERMINATION_UPDATED", "AGREEMENT", a.getId().toString());
        notifications.sendAsync(a.getTutorEmail(), a.getTutorId(), "Chấm dứt hợp đồng lớp học", message,
                "TERMINATION_UPDATED", "AGREEMENT", a.getId().toString());
        notifications.sendAsync(a.getClassroomReviewerEmail(), null, "Cập nhật hồ sơ dừng/hủy lớp #" + c.getClassroomId(),
                message, "TERMINATION_UPDATED", "AGREEMENT", a.getId().toString());
    }
    public static boolean terminal(ContractAgreement a) {
        return Set.of(ContractAgreementStatus.CANCELLED, ContractAgreementStatus.EXPIRED, ContractAgreementStatus.COMPLETED).contains(a.getStatus());
    }
    private static boolean activeTerminationAgreement(ContractAgreement a) {
        return a.getStatus() == ContractAgreementStatus.ACTIVE && !a.isLegacyExcluded();
    }
    private static void requireStatus(TerminationCase c, String... statuses) {
        if (!List.of(statuses).contains(c.getStatus())) fail(HttpStatus.CONFLICT, "Request has already moved to " + c.getStatus());
    }
    private static void requireText(String reason) {
        if (reason == null || reason.isBlank() || reason.length() > 5000) fail(HttpStatus.BAD_REQUEST, "Reason must contain 1 to 5000 characters");
    }
    private static void fail(HttpStatus status, String text) { throw new ResponseStatusException(status, text); }
}
