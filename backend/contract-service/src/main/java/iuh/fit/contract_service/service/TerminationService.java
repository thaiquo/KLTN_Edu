package iuh.fit.contract_service.service;

import iuh.fit.contract_service.config.security.*;
import iuh.fit.contract_service.entity.*;
import iuh.fit.contract_service.enums.ContractAgreementStatus;
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
import java.time.OffsetDateTime;
import java.util.*;

@Service @RequiredArgsConstructor
public class TerminationService {
    private final TerminationCaseRepository cases;
    private final TerminationItemRepository items;
    private final TerminationEvidenceRepository evidence;
    private final ContractAgreementRepository agreements;
    private final ContractAccessControl access;
    private final ObjectMapper mapper;
    private final NotificationDispatcher notifications;
    private final Eip712VerificationService verificationService;
    private final TerminationLearningClient learning;

    private static final long SIGNATURE_CLOCK_SKEW_SECONDS = 300;

    public record ItemView(UUID agreementId, String status, String lastError, String transactionHash,
                           String refundedUnits, String studentName, int tokenDecimals, Long chainId) {}
    public record EvidenceView(UUID id, String originalFilename, String contentType, long sizeBytes,
                               String submittedByRole, java.time.Instant createdAt) {}
    public record View(TerminationCase request, List<ItemView> items, List<EvidenceView> evidence) {}
    private View view(TerminationCase c) {
        var itemViews = items.findByCaseIdOrderByAgreementId(c.getId()).stream().map(i -> {
            var a = agreements.findById(i.getAgreementId()).orElseThrow();
            return new ItemView(i.getAgreementId(), i.getStatus(), i.getLastError(), i.getTransactionHash(),
                    i.getRefundedUnits() == null ? null : i.getRefundedUnits().toString(),
                    a.getStudentName() == null ? a.getStudentEmail() : a.getStudentName(), a.getTokenDecimals(), a.getChainId());
        }).toList();
        var evidenceViews = evidence.findByTerminationCaseIdOrderByCreatedAtAsc(c.getId()).stream()
                .map(item -> new EvidenceView(item.getId(), item.getOriginalFilename(), item.getContentType(),
                        item.getSizeBytes(), item.getSubmittedByRole(), item.getCreatedAt()))
                .toList();
        return new View(c, itemViews, evidenceViews);
    }

    @Transactional(readOnly = true)
    public List<View> list(ContractUserPrincipal user) {
        return cases.findAll().stream().filter(c -> canView(c, user))
                .sorted(Comparator.comparing(TerminationCase::getCreatedAt).reversed())
                .map(this::view).toList();
    }

    @Transactional
    public View request(UUID agreementId, boolean wholeClass, String reason, ContractUserPrincipal user) {
        return request(agreementId, wholeClass, reason, null, null, null, user);
    }

    @Transactional
    public View request(UUID agreementId, boolean wholeClass, String reason, String signature, String signerWallet, Long requestedAtTimestamp, ContractUserPrincipal user) {
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
        if (terminal(anchor) || anchor.isLegacyExcluded()) fail(HttpStatus.CONFLICT, "Agreement is terminal or audit-only");
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
        c.setStatus("HOLD_PENDING"); c.setCreatedAt(OffsetDateTime.now()); c.setAuditJson("[]");
        audit(c, user, "REQUESTED", reason);
        cases.saveAndFlush(c);
        if (systemRequest) {
            c.setStatus("REQUESTED");
            c.setLastError(null);
        } else {
            synchronizeHold(c, anchor);
        }
        cases.saveAndFlush(c);
        notifyParties(anchor, c, "Yêu cầu dừng lớp học đã được gửi và đang chờ thẩm định.");
        notifications.sendAsync(anchor.getClassroomReviewerEmail(), null, "Yeu cau cham dut hop dong",
                "Lop #" + anchor.getClassroomId() + " co ho so cham dut can xem xet.",
                "TERMINATION_UPDATED", "AGREEMENT", anchor.getId().toString());
        return view(c);
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
            }
            case "RECOMMEND" -> {
                if (!user.hasActiveAuthority("STAFF")) fail(HttpStatus.FORBIDDEN, "Only assigned Staff can recommend termination");
                requireStatus(c, "REQUESTED"); c.setStatus("RECOMMENDED");
            }
            case "REJECT" -> {
                if (!manager) fail(HttpStatus.FORBIDDEN, "Assigned Staff/Admin required");
                requireStatus(c, "REQUESTED", "RECOMMENDED");
                c.setStatus("RELEASE_PENDING");
                synchronizeRelease(c, anchor);
            }
            case "APPROVE" -> {
                if (!user.hasActiveAuthority("ADMIN")) fail(HttpStatus.FORBIDDEN, "Only Admin can approve termination");
                requireStatus(c, "REQUESTED", "RECOMMENDED");
                if (anchor.getTerminationCutoffSession() == null) synchronizeHold(c, anchor);
                if (anchor.getTerminationCutoffSession() == null) {
                    fail(HttpStatus.CONFLICT, "Learning hold is not ready; retry after synchronization");
                }
                var targets = c.isWholeClass() ? agreements.findByClassroomIdOrderByCreatedAtAsc(c.getClassroomId()) : List.of(anchor);
                for (var target : targets) {
                    if (terminal(target)) continue;
                    if (target.isLegacyExcluded()) fail(HttpStatus.CONFLICT, "Class contains audit-only agreements; reconcile before closure");
                    var locked = agreements.lockById(target.getId()).orElseThrow();
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
            case "APPROVED" -> "Admin đã phê duyệt dừng lớp học. Các buổi học tương lai đã dừng và tiền cọc còn lại đang được hoàn trả.";
            case "RECOMMENDED" -> "Hồ sơ dừng lớp học đã được Staff thẩm định và đề xuất xử lý.";
            case "REJECTED" -> "Yêu cầu dừng lớp học đã bị từ chối.";
            default -> "Cập nhật hồ sơ dừng hợp đồng: " + c.getStatus();
        };
        notifyParties(anchor, c, statusMessage);
        if ("APPROVE".equals(action) && c.isWholeClass()) {
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
        requireCanAddEvidence(id, user);
        var termination = cases.lockById(id).orElseThrow();
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
    }

    private void synchronizeHold(TerminationCase c, ContractAgreement anchor) {
        try {
            var snapshot = learning.send(anchor.getClassroomId(), anchor.getStudentId(), anchor.getId(), c.isWholeClass(), "HOLD");
            if (snapshot.cutoffSession() < 0) throw new IllegalStateException("Invalid Learning hold cutoff");
            var targets = c.isWholeClass()
                    ? agreements.findByClassroomIdOrderByCreatedAtAsc(c.getClassroomId())
                    : List.of(anchor);
            for (var target : targets) {
                if (!terminal(target)) target.setTerminationCutoffSession(snapshot.cutoffSession());
            }
            if ("HOLD_PENDING".equals(c.getStatus())) c.setStatus("REQUESTED");
            c.setLastError(null);
            c.setUpdatedAt(OffsetDateTime.now());
            if (c.isWholeClass()) {
                for (var target : targets) {
                    if (target.getId().equals(anchor.getId()) || terminal(target)) continue;
                    notifications.sendAsync(target.getStudentEmail(), target.getStudentId(),
                            "Lop hoc tam dung cho xu ly",
                            "Gia su da gui de xuat dung giang day. Cac buoi tuong lai dang tam dung trong khi Admin xem xet.",
                            "TERMINATION_UPDATED", "AGREEMENT", target.getId().toString());
                }
            }
        } catch (Exception error) {
            c.setStatus("HOLD_PENDING");
            c.setLastError(shortError(error, "Learning hold pending"));
            c.setUpdatedAt(OffsetDateTime.now());
        }
    }

    private void synchronizeRelease(TerminationCase c, ContractAgreement anchor) {
        try {
            learning.send(anchor.getClassroomId(), anchor.getStudentId(), anchor.getId(), c.isWholeClass(), "RELEASE");
            var targets = c.isWholeClass()
                    ? agreements.findByClassroomIdOrderByCreatedAtAsc(c.getClassroomId())
                    : List.of(anchor);
            for (var target : targets) {
                if (!terminal(target)) target.setTerminationCutoffSession(null);
            }
            c.setStatus("REJECTED");
            c.setLastError(null);
            c.setUpdatedAt(OffsetDateTime.now());
            if (c.isWholeClass()) {
                for (var target : targets) {
                    if (target.getId().equals(anchor.getId()) || terminal(target)) continue;
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
        var view = request(agreementId, true, reason, system);
        view.request().setDetectionKey(detectionKey);
    }
    private void audit(TerminationCase c, ContractUserPrincipal user, String action, String reason) {
        var array = (tools.jackson.databind.node.ArrayNode) mapper.readTree(c.getAuditJson());
        array.add(mapper.valueToTree(Map.of("actor", user.email(), "role", user.activeRole(),
                "action", action, "reason", reason.trim(), "at", OffsetDateTime.now().toString())));
        c.setAuditJson(mapper.writeValueAsString(array)); c.setUpdatedAt(OffsetDateTime.now());
    }
    private void notifyParties(ContractAgreement a, TerminationCase c, String message) {
        notifications.sendAsync(a.getStudentEmail(), a.getStudentId(), "Chấm dứt hợp đồng lớp học", message,
                "TERMINATION_UPDATED", "AGREEMENT", a.getId().toString());
        notifications.sendAsync(a.getTutorEmail(), a.getTutorId(), "Chấm dứt hợp đồng lớp học", message,
                "TERMINATION_UPDATED", "AGREEMENT", a.getId().toString());
    }
    public static boolean terminal(ContractAgreement a) {
        return Set.of(ContractAgreementStatus.CANCELLED, ContractAgreementStatus.EXPIRED, ContractAgreementStatus.COMPLETED).contains(a.getStatus());
    }
    private static void requireStatus(TerminationCase c, String... statuses) {
        if (!List.of(statuses).contains(c.getStatus())) fail(HttpStatus.CONFLICT, "Request has already moved to " + c.getStatus());
    }
    private static void requireText(String reason) {
        if (reason == null || reason.isBlank() || reason.length() > 5000) fail(HttpStatus.BAD_REQUEST, "Reason must contain 1 to 5000 characters");
    }
    private static void fail(HttpStatus status, String text) { throw new ResponseStatusException(status, text); }
}
