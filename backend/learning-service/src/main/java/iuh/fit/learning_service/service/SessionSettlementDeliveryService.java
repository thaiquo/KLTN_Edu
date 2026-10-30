package iuh.fit.learning_service.service;

import iuh.fit.learning_service.enums.AttendanceOutcome;
import iuh.fit.learning_service.enums.ClassSessionStatus;
import iuh.fit.learning_service.repository.ClassSessionRepository;
import iuh.fit.learning_service.repository.SessionAttendanceRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

@Service
@RequiredArgsConstructor
public class SessionSettlementDeliveryService {
    private static final Logger log = LoggerFactory.getLogger(SessionSettlementDeliveryService.class);

    private final ClassSessionRepository sessions;
    private final SessionAttendanceRepository attendances;
    private final ContractServiceDispatcher dispatcher;

    @Scheduled(initialDelay = 5000, fixedDelay = 30000)
    @Transactional
    public void deliverPending() {
        for (var session : sessions.findTop50ByStatusAndSettlementDispatchedFalseOrderByIdAsc(ClassSessionStatus.COMPLETED)) {
            var records = attendances.findBySessionId(session.getId());
            if (records == null) {
                records = List.of();
            }
            if (!records.isEmpty() && records.stream().anyMatch(record -> record.getFinalOutcome() == null)) {
                continue;
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
                continue;
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
                continue;
            }

            if (session.getGovernanceSnapshotCapturedAt() == null) {
                OffsetDateTime nowUtc = OffsetDateTime.now(ZoneOffset.UTC);
                session.setGovernanceSnapshotCapturedAt(nowUtc);
                if (nextSessionOpt.isPresent()) {
                    var next = nextSessionOpt.get();
                    session.setGovernanceNextSessionSequence(next.getSequenceNumber());
                    LocalDateTime nextStart = LocalDateTime.of(next.getSessionDate(), LocalTime.parse(next.getStartTime()));
                    session.setGovernanceNextSessionStartAt(nextStart.atZone(CanonicalSessionPlanner.BUSINESS_ZONE).toOffsetDateTime());
                } else {
                    session.setGovernanceNextSessionSequence(null);
                    session.setGovernanceNextSessionStartAt(null);
                }
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
}
