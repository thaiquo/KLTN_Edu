package iuh.fit.contract_service.service;

import iuh.fit.contract_service.entity.ClassTutorAttendanceSignal;
import iuh.fit.contract_service.repository.ClassTutorAttendanceSignalRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Objects;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TutorAttendanceSignalService {
    private static final Logger log = LoggerFactory.getLogger(TutorAttendanceSignalService.class);

    private final ClassTutorAttendanceSignalRepository signals;

    @Transactional
    public ClassTutorAttendanceSignal ingest(
            Long classroomId,
            Long learningSessionId,
            Integer sessionSequence,
            String tutorOutcome,
            OffsetDateTime finalizedAt,
            String sourceEventId,
            Integer nextSessionSequence,
            OffsetDateTime nextSessionStartAt) {

        if (sourceEventId == null || sourceEventId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "sourceEventId is required for tutor attendance signal");
        }
        if (sourceEventId.length() > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "sourceEventId exceeds 100 characters");
        }
        if (classroomId == null || learningSessionId == null || sessionSequence == null || tutorOutcome == null || finalizedAt == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "classroomId, learningSessionId, sessionSequence, tutorAttendanceOutcome and finalizedAt are required");
        }
        if (!java.util.Set.of("TUTOR_PRESENT", "TUTOR_ABSENT", "INCONSISTENT", "UNAVAILABLE").contains(tutorOutcome)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported tutorAttendanceOutcome");
        }
        if (sessionSequence <= 0
                || (nextSessionSequence == null) != (nextSessionStartAt == null)
                || (nextSessionSequence != null && (nextSessionSequence <= sessionSequence
                    || !nextSessionStartAt.isAfter(finalizedAt)))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid next-session governance snapshot");
        }

        var existingByEvent = signals.findBySourceEventId(sourceEventId);
        if (existingByEvent.isPresent()) {
            var existing = existingByEvent.get();
            boolean matches = Objects.equals(existing.getClassroomId(), classroomId)
                    && Objects.equals(existing.getSessionSequence(), sessionSequence)
                    && Objects.equals(existing.getLearningSessionId(), learningSessionId)
                    && Objects.equals(existing.getTutorAttendanceOutcome(), tutorOutcome)
                    && existing.getFinalizedAt().toInstant().equals(finalizedAt.toInstant())
                    && Objects.equals(existing.getNextSessionSequence(), nextSessionSequence)
                    && sameInstant(existing.getNextSessionStartAt(), nextSessionStartAt);
            if (matches) {
                log.info("Idempotent replay for sourceEventId={}", sourceEventId);
                return existing;
            }
            log.warn("Payload mismatch for sourceEventId={}: existing[class={}, seq={}, outcome={}] vs incoming[class={}, seq={}, outcome={}]",
                    sourceEventId, existing.getClassroomId(), existing.getSessionSequence(), existing.getTutorAttendanceOutcome(),
                    classroomId, sessionSequence, tutorOutcome);
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Payload mismatch for sourceEventId=" + sourceEventId);
        }

        var existingBySeq = signals.findByClassroomIdAndSessionSequence(classroomId, sessionSequence);
        if (existingBySeq.isPresent()) {
            log.warn("Conflicting signal already exists for classroomId={} sessionSequence={} with different sourceEventId={}",
                    classroomId, sessionSequence, existingBySeq.get().getSourceEventId());
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Different sourceEventId already exists for classroomId=" + classroomId + ", sessionSequence=" + sessionSequence);
        }

        var signal = new ClassTutorAttendanceSignal();
        signal.setId(UUID.randomUUID());
        signal.setClassroomId(classroomId);
        signal.setLearningSessionId(learningSessionId);
        signal.setSessionSequence(sessionSequence);
        signal.setTutorAttendanceOutcome(tutorOutcome);
        signal.setFinalizedAt(finalizedAt);
        signal.setNextSessionSequence(nextSessionSequence);
        signal.setNextSessionStartAt(nextSessionStartAt);
        signal.setSourceEventId(sourceEventId);
        signal.setCreatedAt(OffsetDateTime.now(ZoneOffset.UTC));

        return signals.saveAndFlush(signal);
    }

    private static boolean sameInstant(OffsetDateTime left, OffsetDateTime right) {
        return left == null ? right == null : right != null && left.toInstant().equals(right.toInstant());
    }
}
