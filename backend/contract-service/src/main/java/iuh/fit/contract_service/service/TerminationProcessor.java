package iuh.fit.contract_service.service;

import iuh.fit.contract_service.entity.*;
import iuh.fit.contract_service.enums.*;
import iuh.fit.contract_service.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;
import java.math.BigInteger;
import java.time.OffsetDateTime;
import java.util.*;

@Service @RequiredArgsConstructor
public class TerminationProcessor {
    private final TerminationCaseRepository cases;
    private final TerminationItemRepository items;
    private final ContractAgreementRepository agreements;
    private final SessionSettlementRepository settlements;
    private final BlockchainTransactionRepository transactions;
    private final ProcessedEventRepository events;
    private final AgreementLifecycleWorkflowService lifecycle;
    private final TerminationLearningClient learning;
    private final ObjectMapper mapper;

    @Transactional
    public void process(UUID agreementId) {
        var a = agreements.lockById(agreementId).orElseThrow();
        var item = items.findById(agreementId).orElseThrow();
        if ("COMPLETED".equals(item.getStatus())) return;
        var c = cases.findById(item.getCaseId()).orElseThrow();
        if (!"APPROVED".equals(c.getStatus())) return;
        var snapshot = learning.send(a.getClassroomId(), a.getStudentId(), a.getId(), c.isWholeClass(), "FREEZE");
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
                if (rows.stream().anyMatch(s -> !settled(s))) return;
                if (snapshot.requiredSessions().stream().anyMatch(id -> rows.stream()
                        .noneMatch(s -> id.equals(s.getSessionId()) && settled(s)))) return;
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
