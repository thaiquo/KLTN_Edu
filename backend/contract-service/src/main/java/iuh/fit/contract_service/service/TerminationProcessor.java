package iuh.fit.contract_service.service;

import iuh.fit.contract_service.entity.*;
import iuh.fit.contract_service.enums.*;
import iuh.fit.contract_service.repository.*;
import iuh.fit.contract_service.enums.TrialStatus;
import iuh.fit.contract_service.repository.AgreementTrialRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;
import java.math.BigInteger;
import java.time.OffsetDateTime;
import java.util.*;

@Service
public class TerminationProcessor {
    private final TerminationCaseRepository cases;
    private final TerminationItemRepository items;
    private final ContractAgreementRepository agreements;
    private final SessionSettlementRepository settlements;
    private final BlockchainTransactionRepository transactions;
    private final ProcessedEventRepository events;
    private final AgreementLifecycleWorkflowService lifecycle;
    private final TerminationLearningClient learning;
    private final NotificationDispatcher notifications;
    private final ObjectMapper mapper;
    private final AgreementTrialRepository agreementTrialRepository;

    public TerminationProcessor(
            TerminationCaseRepository cases,
            TerminationItemRepository items,
            ContractAgreementRepository agreements,
            SessionSettlementRepository settlements,
            BlockchainTransactionRepository transactions,
            ProcessedEventRepository events,
            AgreementLifecycleWorkflowService lifecycle,
            TerminationLearningClient learning,
            NotificationDispatcher notifications,
            ObjectMapper mapper) {
        this(cases, items, agreements, settlements, transactions, events, lifecycle, learning, notifications, mapper, null);
    }

    @Autowired
    public TerminationProcessor(
            TerminationCaseRepository cases,
            TerminationItemRepository items,
            ContractAgreementRepository agreements,
            SessionSettlementRepository settlements,
            BlockchainTransactionRepository transactions,
            ProcessedEventRepository events,
            AgreementLifecycleWorkflowService lifecycle,
            TerminationLearningClient learning,
            NotificationDispatcher notifications,
            ObjectMapper mapper,
            AgreementTrialRepository agreementTrialRepository) {
        this.cases = cases;
        this.items = items;
        this.agreements = agreements;
        this.settlements = settlements;
        this.transactions = transactions;
        this.events = events;
        this.lifecycle = lifecycle;
        this.learning = learning;
        this.notifications = notifications;
        this.mapper = mapper;
        this.agreementTrialRepository = agreementTrialRepository;
    }

    @Transactional
    public void process(UUID agreementId) {
        var a = agreements.lockById(agreementId).orElseThrow();
        var item = items.findById(agreementId).orElseThrow();
        if ("COMPLETED".equals(item.getStatus())) return;
        var c = cases.findById(item.getCaseId()).orElseThrow();
        if (!"APPROVED".equals(c.getStatus())) return;
        var snapshot = Set.of("TRIAL_OPT_OUT", TerminationService.ORIGIN_SYSTEM_LATE_FUNDING).contains(c.getOrigin())
                ? persistedTrialSnapshot(a, c)
                : learning.send(a.getClassroomId(), a.getStudentId(), a.getId(), c.isWholeClass(), "FREEZE");
        if (snapshot.cutoffSession() < 0 || snapshot.requiredSessions() == null) {
            throw new IllegalStateException("Invalid Learning cutoff");
        }
        a.setTerminationCutoffSession(snapshot.cutoffSession());
        a.setTerminationSessionsJson(mapper.writeValueAsString(snapshot.requiredSessions()));
        item.setLastError(null); item.setUpdatedAt(OffsetDateTime.now());
        switch (a.getStatus()) {
            case DRAFT, PENDING_TUTOR_ACCEPTANCE, PENDING_STUDENT_ACCEPTANCE -> {
                a.markCancelled();
                item.setRefundedUnits(BigInteger.ZERO);
                close(a, c, item);
            }
            case PREPARING_BLOCKCHAIN, PAYMENT_CONFIRMING -> item.setStatus("WAITING_PAYMENT");
            case WAITING_PAYMENT -> {
                item.setStatus("WAITING_PAYMENT");
                if (a.getPaymentDeadline() != null && !OffsetDateTime.now().isBefore(a.getPaymentDeadline())) {
                    if (failedTransaction(a, item, "EXPIRE")) return;
                    lifecycle.initiateExpiration(a.getId());
                    reflectTransaction(a, item, "EXPIRE");
                }
            }
            case ACTIVE -> {
                item.setStatus("WAITING_SETTLEMENT");
                var rows = settlements.findByAgreementId(a.getId());
                if (rows.stream().anyMatch(s -> s.getSessionId() > snapshot.cutoffSession())) {
                    throw new IllegalStateException("A future session already has a proposal; review its audit before cancelling");
                }
                var unsettled = rows.stream().filter(s -> !settled(s)).toList();
                if (!unsettled.isEmpty()) {
                    String waiting = unsettled.stream()
                            .map(s -> "#" + s.getSessionId() + " (" + s.getStatus() + ")")
                            .reduce((left, right) -> left + ", " + right).orElse("");
                    item.setLastError("Waiting for confirmed session settlement: " + waiting);
                    return;
                }
                var missing = snapshot.requiredSessions().stream().filter(id -> rows.stream()
                        .noneMatch(s -> id.equals(s.getSessionId()) && settled(s))).toList();
                if (!missing.isEmpty()) {
                    String waiting = missing.stream().map(id -> "#" + id)
                            .reduce((left, right) -> left + ", " + right).orElse("");
                    item.setLastError("Waiting for Learning settlement delivery: " + waiting);
                    return;
                }
                if (failedTransaction(a, item, "CANCEL")) return;
                lifecycle.initiateCancellation(a.getId(), c.getReason());
                reflectTransaction(a, item, "CANCEL");
            }
            case CANCELLED -> {
                if (a.getOnchainAgreementId() != null) {
                    var refunds = events.findByEventTypeIgnoreCaseAndChainId("UNUSED_AMOUNT_REFUNDED", a.getChainId());
                    boolean found = false;
                    for (var event : refunds) {
                        if (!a.getEscrowContractAddress().equalsIgnoreCase(event.getContractAddress())) continue;
                        var decoded = mapper.readValue(event.getDecodedPayload(), iuh.fit.contract_service.blockchain.DecodedEscrowEvent.class);
                        if (!a.getOnchainAgreementId().equalsIgnoreCase(decoded.agreementId())) continue;
                        if (!a.getStudentWallet().equalsIgnoreCase(decoded.attributes().get("student"))) {
                            throw new IllegalStateException("Refund recipient mismatch");
                        }
                        item.setRefundedUnits(new BigInteger(decoded.attributes().get("amount")));
                        item.setTransactionHash(event.getTransactionHash()); found = true; break;
                    }
                    if (!found) { item.setStatus("WAITING_REFUND_EVENT"); return; }
                }
                close(a, c, item);
            }
            case COMPLETED, EXPIRED -> {
                item.setRefundedUnits(BigInteger.ZERO);
                close(a, c, item);
            }
        }
    }

    private boolean settled(SessionSettlement s) {
        return s.getStatus() == SettlementStatus.SETTLED || s.getStatus() == SettlementStatus.REFUNDED;
    }
    private boolean failedTransaction(ContractAgreement a, TerminationItem item, String action) {
        var tx = transactions.findByIdempotencyKey(action + ":" + a.getChainId() + ":" + a.getId());
        if (tx.isPresent() && tx.get().getStatus() == BlockchainTransactionStatus.FAILED) {
            reflectTransaction(a, item, action);
            return true;
        }
        return false;
    }
    private void reflectTransaction(ContractAgreement a, TerminationItem item, String action) {
        var tx = transactions.findByIdempotencyKey(action + ":" + a.getChainId() + ":" + a.getId()).orElseThrow();
        item.setTransactionHash(tx.getTransactionHash());
        item.setStatus(tx.getStatus() == BlockchainTransactionStatus.FAILED ? "TRANSACTION_FAILED" : "BLOCKCHAIN_PENDING");
        if (tx.getStatus() == BlockchainTransactionStatus.FAILED) item.setLastError("Transaction requires recovery; see transaction audit");
    }
    private void close(ContractAgreement a, TerminationCase c, TerminationItem item) {
        learning.send(a.getClassroomId(), a.getStudentId(), a.getId(), c.isWholeClass(), "CLOSE");
        item.setStatus("COMPLETED");
        notifications.sendAsync(a.getClassroomReviewerEmail(), null, "Đã hoàn tất thanh lý hợp đồng",
                "Hợp đồng đã hoàn tất quyết toán và cập nhật quyền tham gia lớp. Mở hồ sơ để xem kết quả và giao dịch xác nhận.",
                "TERMINATION_COMPLETED", "AGREEMENT", a.getId().toString());
        String scope = c.isWholeClass() ? "lop hoc" : "hop dong";
        notifications.sendAsync(a.getStudentEmail(), a.getStudentId(), "Ket qua cham dut hop dong",
                "Admin da hoan tat xu ly " + scope + ". Danh sach lop va lich hoc tuong lai da duoc cap nhat.",
                "TERMINATION_COMPLETED", "AGREEMENT", a.getId().toString());
        notifications.sendAsync(a.getTutorEmail(), a.getTutorId(), "Cap nhat cham dut hop dong",
                "Hop dong cua hoc vien da hoan tat thanh ly. Danh sach lop va tien do xu ly da duoc cap nhat.",
                "TERMINATION_COMPLETED", "AGREEMENT", a.getId().toString());
        if (agreementTrialRepository != null
                && Set.of("TRIAL_OPT_OUT", TerminationService.ORIGIN_SYSTEM_LATE_FUNDING).contains(c.getOrigin())) {
            agreementTrialRepository.findByAgreementId(a.getId()).ifPresent(trial -> {
                boolean matchingState = ("TRIAL_OPT_OUT".equals(c.getOrigin())
                        && trial.getStatus() == TrialStatus.OPT_OUT_PENDING)
                        || (TerminationService.ORIGIN_SYSTEM_LATE_FUNDING.equals(c.getOrigin())
                        && trial.getStatus() == TrialStatus.LATE_FUNDING_RECOVERY);
                if (matchingState
                        && Objects.equals(trial.getTerminationCaseId(), c.getId())) {
                    trial.setStatus(TrialStatus.TERMINATED);
                    trial.setUpdatedAt(OffsetDateTime.now());
                    agreementTrialRepository.save(trial);
                }
            });
        }
    }

    private TerminationLearningClient.Snapshot persistedTrialSnapshot(
            ContractAgreement agreement,
            TerminationCase termination) {
        if (agreementTrialRepository == null) {
            throw new IllegalStateException("Trial repository is unavailable");
        }
        var trial = agreementTrialRepository.findByAgreementId(agreement.getId())
                .orElseThrow(() -> new IllegalStateException("Trial state is missing"));
        int expectedCutoff;
        boolean matchingState;
        if ("TRIAL_OPT_OUT".equals(termination.getOrigin())) {
            expectedCutoff = trial.getTrialSessionSequence();
            matchingState = trial.getStatus() == TrialStatus.OPT_OUT_PENDING;
        } else if (TerminationService.ORIGIN_SYSTEM_LATE_FUNDING.equals(termination.getOrigin())) {
            expectedCutoff = 0;
            matchingState = trial.getStatus() == TrialStatus.LATE_FUNDING_RECOVERY;
        } else {
            throw new IllegalStateException("Unsupported persisted trial termination origin");
        }
        if (!matchingState
                || !Objects.equals(trial.getTerminationCaseId(), termination.getId())
                || agreement.getTerminationCutoffSession() == null
                || !Objects.equals(agreement.getTerminationCutoffSession(), expectedCutoff)) {
            throw new IllegalStateException("Persisted trial cutoff fence is inconsistent");
        }
        if (agreement.getTerminationSessionsJson() == null) {
            throw new IllegalStateException("Persisted trial settlement sessions are missing");
        }
        var node = mapper.readTree(agreement.getTerminationSessionsJson());
        if (!node.isArray()) {
            throw new IllegalStateException("Persisted trial settlement sessions are invalid");
        }
        List<Long> requiredSessions = new ArrayList<>();
        node.forEach(value -> requiredSessions.add(value.asLong()));
        return new TerminationLearningClient.Snapshot(
                agreement.getTerminationCutoffSession(), List.copyOf(requiredSessions), null);
    }
    @Transactional
    public void failure(UUID id, String error) {
        var item = items.findById(id).orElseThrow();
        item.setLastError(error == null ? "Processing failed" : error.substring(0, Math.min(1000, error.length())));
        item.setUpdatedAt(OffsetDateTime.now());
    }
    @Transactional
    public void finish(UUID id) {
        var c = cases.lockById(id).orElseThrow();
        if (!"APPROVED".equals(c.getStatus())) return;
        c.setUpdatedAt(OffsetDateTime.now());
        var targets = items.findByCaseIdOrderByAgreementId(id);
        if (targets.isEmpty() || targets.stream().anyMatch(i -> !"COMPLETED".equals(i.getStatus()))) return;
        if (c.isWholeClass()) {
            var a = agreements.findById(c.getAnchorAgreementId()).orElseThrow();
            learning.send(a.getClassroomId(), a.getStudentId(), a.getId(), true, "CLOSE_CLASS");
            notifications.sendAsync(a.getTutorEmail(), a.getTutorId(), "Lop hoc da huy theo quyet dinh Admin",
                    "Tat ca hop dong trong lop da hoan tat xu ly. Lop da chuyen sang CANCELLED va Gia su khong the mo lai.",
                    "TERMINATION_COMPLETED", "CLASSROOM", a.getClassroomId().toString());
        }
        c.setLastError(null); c.setStatus("COMPLETED");
    }
    @Transactional
    public void caseFailure(UUID id, String error) {
        var c = cases.findById(id).orElseThrow();
        c.setLastError(error == null ? "Learning closure pending" : error.substring(0, Math.min(1000, error.length())));
        c.setUpdatedAt(OffsetDateTime.now());
    }
}
