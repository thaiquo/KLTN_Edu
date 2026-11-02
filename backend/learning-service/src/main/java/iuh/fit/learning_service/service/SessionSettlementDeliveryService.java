package iuh.fit.learning_service.service;

import iuh.fit.learning_service.enums.AttendanceOutcome;
import iuh.fit.learning_service.enums.ClassSessionStatus;
import iuh.fit.learning_service.repository.ClassSessionRepository;
import iuh.fit.learning_service.repository.SessionAttendanceRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

@Service
public class SessionSettlementDeliveryService {
    private static final Logger log = LoggerFactory.getLogger(SessionSettlementDeliveryService.class);

    private final ClassSessionRepository sessions;
    private final SessionAttendanceRepository attendances;
    private final ContractServiceDispatcher dispatcher;
    private final TransactionTemplate transactionTemplate;

    public SessionSettlementDeliveryService(
            ClassSessionRepository sessions,
            SessionAttendanceRepository attendances,
            ContractServiceDispatcher dispatcher,
            PlatformTransactionManager transactionManager
    ) {
        this.sessions = sessions;
        this.attendances = attendances;
        this.dispatcher = dispatcher;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    @Scheduled(initialDelay = 5000, fixedDelay = 30000)
    public void deliverPending() {
        var pendingSessionIds = sessions
                .findTop50ByStatusAndSettlementDispatchedFalseOrderByIdAsc(ClassSessionStatus.COMPLETED)
                .stream()
                .map(iuh.fit.learning_service.entity.ClassSession::getId)
                .toList();

        for (Long sessionId : pendingSessionIds) {
            try {
                transactionTemplate.executeWithoutResult(ignored -> deliverSession(sessionId));
            } catch (RuntimeException ex) {
                log.error("Settlement delivery failed for session {}; continuing with remaining sessions", sessionId, ex);
            }
        }
    }

    private void deliverSession(Long sessionId) {
        var sessionOpt = sessions.findById(sessionId);
        if (sessionOpt.isEmpty()) {
            return;
        }
        var session = sessionOpt.get();
        var records = attendances.findBySessionId(session.getId());
        if (records == null) {
            records = List.of();
        }
        if (!records.isEmpty() && records.stream().anyMatch(record -> record.getFinalOutcome() == null)) {
            return;
        }

        // Rows completed before V17 deliberately remain outside governance v1. They
        // still use the legacy settlement delivery so financial processing is never blocked.
        if (session.getAttendanceFinalizedAt() == null) {
            var legacyOutcomes = records.stream().map(record ->
                        new ContractServiceDispatcher.StudentAttendanceOutcomeItem(
                                record.getStudentId(), record.getFinalOutcome().name())).toList();
            if (dispatcher.dispatchAutoPropose(
                    session.getClassRoom().getId(), session.getSequenceNumber().longValue(), legacyOutcomes)) {
                session.setSettlementDispatched(true);
                sessions.save(session);
            }
            return;
        }

        var room = session.getClassRoom();
        Long roomId = room != null ? room.getId() : null;
        Integer currentSeq = session.getSequenceNumber();
        Integer totalSessions = room != null ? room.getTotalSessions() : null;

        var allSessions = roomId != null
                ? sessions.findByClassRoomIdOrderBySequenceNumberAsc(roomId)
                : List.<iuh.fit.learning_service.entity.ClassSession>of();
        if (allSessions == null) {
            allSessions = List.of();
        }

        var nextSessionOpt = allSessions.stream()
                .filter(s -> s.getSequenceNumber() != null && currentSeq != null
                        && s.getSequenceNumber() > currentSeq
                        && s.getStatus() != ClassSessionStatus.CANCELLED)
                .findFirst();

        if (totalSessions != null && currentSeq != null && currentSeq < totalSessions && nextSessionOpt.isEmpty()) {
            log.warn("Classroom {} session {} completed but next session not yet generated (totalSessions={}). Postponing settlement delivery.",
                    roomId, currentSeq, totalSessions);
            return;
        }

        if (session.getGovernanceSnapshotCapturedAt() == null) {
            OffsetDateTime nowUtc = OffsetDateTime.now(ZoneOffset.UTC);
            Integer nextSequence = null;
            OffsetDateTime nextStartAt = null;
            if (nextSessionOpt.isPresent()) {
                var next = nextSessionOpt.get();
                LocalDateTime nextStart = LocalDateTime.of(next.getSessionDate(), LocalTime.parse(next.getStartTime()));
                OffsetDateTime candidateStartAt = nextStart.atZone(CanonicalSessionPlanner.BUSINESS_ZONE).toOffsetDateTime();
                if (candidateStartAt.isAfter(session.getAttendanceFinalizedAt())) {
                    nextSequence = next.getSequenceNumber();
                    nextStartAt = candidateStartAt;
                } else {
                    log.warn("Classroom {} session {} was finalized after its next session {} started; capturing no active N+1 governance window",
                            roomId, currentSeq, next.getSequenceNumber());
                }
            }
            session.captureGovernanceSnapshot(nowUtc, nextSequence, nextStartAt);
        }

        String tutorOutcome;
        List<ContractServiceDispatcher.StudentAttendanceOutcomeItem> outcomes;
        if (records.isEmpty()) {
            tutorOutcome = "UNAVAILABLE";
            outcomes = List.of();
        } else {
            boolean allAbsent = records.stream().allMatch(record -> record.getFinalOutcome() == AttendanceOutcome.TUTOR_ABSENT);
            boolean allPresent = records.stream().allMatch(record ->
                    record.getFinalOutcome() == AttendanceOutcome.BOTH_PRESENT
                            || record.getFinalOutcome() == AttendanceOutcome.STUDENT_ABSENT_TUTOR_PRESENT);
            if (allAbsent) {
                tutorOutcome = "TUTOR_ABSENT";
            } else if (allPresent) {
                tutorOutcome = "TUTOR_PRESENT";
            } else {
                tutorOutcome = "INCONSISTENT";
            }
            outcomes = records.stream().map(record -> new ContractServiceDispatcher.StudentAttendanceOutcomeItem(
                    record.getStudentId(), record.getFinalOutcome().name())).toList();
        }

        String sourceEventId = roomId != null && currentSeq != null
                ? "ATTENDANCE:" + roomId + ":" + currentSeq + ":v1"
                : "ATTENDANCE:" + session.getId() + ":v1";

        var payload = new ContractServiceDispatcher.AutoProposePayload(
                outcomes,
                session.getId(),
                currentSeq,
                tutorOutcome,
                session.getAttendanceFinalizedAt(),
                sourceEventId,
                session.getGovernanceNextSessionSequence(),
                session.getGovernanceNextSessionStartAt()
        );

        Long dispatchSeq = currentSeq != null ? currentSeq.longValue() : session.getId();
        if (dispatcher.dispatchAutoPropose(roomId, dispatchSeq, payload)) {
            session.setSettlementDispatched(true);
            sessions.save(session);
        }
    }
}
