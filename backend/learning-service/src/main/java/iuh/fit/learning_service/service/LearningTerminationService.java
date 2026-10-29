package iuh.fit.learning_service.service;

import iuh.fit.learning_service.entity.*;
import iuh.fit.learning_service.enums.*;
import iuh.fit.learning_service.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.time.*;
import java.util.*;

@Service @RequiredArgsConstructor
public class LearningTerminationService {
    private final ClassRoomRepository rooms;
    private final ClassSessionRepository sessions;
    private final EnrollmentRequestRepository enrollments;
    private final LearningTerminationStopRepository stops;
    private final SessionAttendanceRepository attendances;
    private final RollingSessionService rollingSessions;
    private final LearningTerminationCommandInboxRepository inboxRepository;

    public record Command(
            Long classroomId,
            Long studentId,
            String agreementId,
            boolean wholeClass,
            String action,
            String origin,
            Integer requestedCutoffSession,
            OffsetDateTime effectiveRequestedAt,
            UUID commandId,
            UUID expectedHoldCommandId,
            OffsetDateTime releaseNotAfter,
            Boolean cancelClassIfEmpty) {
        public Command(Long classroomId, Long studentId, String agreementId, boolean wholeClass, String action) {
            this(classroomId, studentId, agreementId, wholeClass, action, null, null, null, null, null, null, null);
        }
        public Command(
                Long classroomId,
                Long studentId,
                String agreementId,
                boolean wholeClass,
                String action,
                String origin,
                Integer requestedCutoffSession,
                OffsetDateTime effectiveRequestedAt,
                UUID commandId) {
            this(classroomId, studentId, agreementId, wholeClass, action, origin, requestedCutoffSession, effectiveRequestedAt, commandId, null, null, null);
        }
        public Command(
                Long classroomId,
                Long studentId,
                String agreementId,
                boolean wholeClass,
                String action,
                String origin,
                Integer requestedCutoffSession,
                OffsetDateTime effectiveRequestedAt,
                UUID commandId,
                UUID expectedHoldCommandId,
                OffsetDateTime releaseNotAfter) {
            this(classroomId, studentId, agreementId, wholeClass, action, origin, requestedCutoffSession, effectiveRequestedAt, commandId, expectedHoldCommandId, releaseNotAfter, null);
        }
    }
    public record Snapshot(int cutoffSession, List<Long> requiredSessions, OffsetDateTime nextSessionStart, Boolean classCancelled) {
        public Snapshot(int cutoffSession, List<Long> requiredSessions, OffsetDateTime nextSessionStart) {
            this(cutoffSession, requiredSessions, nextSessionStart, false);
        }
    }
    private static final ZoneId BUSINESS_ZONE = CanonicalSessionPlanner.BUSINESS_ZONE;
    private static final String TRIAL_OPT_OUT = "TRIAL_OPT_OUT";
    private static final String SYSTEM_LATE_FUNDING = "SYSTEM_LATE_FUNDING";
    public static final String AUTO_TUTOR_ABSENCE = "AUTO_TUTOR_ABSENCE";
    public static final String AUTO_TUTOR_ABSENCE_RELAPSE = "AUTO_TUTOR_ABSENCE_RELAPSE";

    @Transactional
    public Snapshot apply(Command command) {
        var room = rooms.findByIdForUpdate(command.classroomId()).orElseThrow();
        var rows = sessions.findByClassRoomIdOrderBySequenceNumberAsc(room.getId());
        if ("CLOSE_CLASS".equals(command.action())) {
            if (room.getTerminationCutoffSession() == null) throw new IllegalStateException("Class is not terminating");
            if (enrollments.countByClassRoomIdAndStatusIn(room.getId(),
                    List.of(EnrollmentRequestStatus.ENROLLED, EnrollmentRequestStatus.ACCEPTED)) > 0) {
                throw new IllegalStateException("Class still has active enrollments");
            }
            room.setStatus(ClassRoomStatus.CANCELLED);
            return new Snapshot(room.getTerminationCutoffSession(), List.of(), null);
        }
        UUID.fromString(command.agreementId());
        var enrollment = enrollments.findByAgreementId(command.agreementId()).orElseThrow(() ->
                new IllegalStateException("Agreement has no matching Learning enrollment"));
        if (!room.getId().equals(enrollment.getClassRoom().getId())
                || !Objects.equals(command.studentId(), enrollment.getStudentId())) {
            throw new IllegalStateException("Agreement/enrollment identity mismatch");
        }
        if (!Set.of("HOLD", "RELEASE", "FREEZE", "CLOSE").contains(command.action())) throw new IllegalArgumentException("Unknown action");
        boolean trialOptOut = TRIAL_OPT_OUT.equals(command.origin());
        boolean lateFundingRecovery = SYSTEM_LATE_FUNDING.equals(command.origin());
        boolean tutorAbsence = AUTO_TUTOR_ABSENCE.equals(command.origin()) || AUTO_TUTOR_ABSENCE_RELAPSE.equals(command.origin());
        boolean stableCutoffCommand = trialOptOut || lateFundingRecovery || tutorAbsence;
        validateExtendedCommand(command, room, rows, trialOptOut, lateFundingRecovery);

        if (command.commandId() != null) {
            String payloadHash = computePayloadHash(command);
            var inboxOpt = inboxRepository.findByCommandIdAndAction(command.commandId(), command.action());
            if (inboxOpt.isPresent()) {
                var inbox = inboxOpt.get();
                if (!Objects.equals(inbox.getPayloadHash(), payloadHash)) {
                    throw new IllegalStateException("Learning termination command payload mismatch for commandId=" + command.commandId());
                }
                int cutoff = inbox.getCutoffSession();
                return new Snapshot(cutoff, parseRequiredSessions(inbox.getRequiredSessionSequencesCsv()), inbox.getNextSessionStartAt(), inbox.isClassCancelled());
            }
        }

        var stop = stops.findById(command.agreementId()).orElse(null);
        if ("RELEASE".equals(command.action())) {
            if (command.releaseNotAfter() != null) {
                OffsetDateTime nowUtc = OffsetDateTime.now(ZoneOffset.UTC);
                if (!nowUtc.isBefore(command.releaseNotAfter())) {
                    throw new IllegalStateException("RELEASE command received after releaseNotAfter deadline");
                }
            }
            if (tutorAbsence) {
                if (stop == null || command.expectedHoldCommandId() == null
                        || !Objects.equals(stop.getCommandId(), command.expectedHoldCommandId())) {
                    throw new IllegalStateException("RELEASE expectedHoldCommandId mismatch with existing stop");
                }
                if (!Objects.equals(stop.getCutoffSession(), command.requestedCutoffSession())) {
                    throw new IllegalStateException("RELEASE cutoff does not match the persisted hold");
                }
            }
            if (stop != null && !stop.isClosed()) stops.delete(stop);
            if (command.wholeClass()) room.setTerminationCutoffSession(null);
            if (command.wholeClass()) {
                for (var activeEnrollment : enrollments.findByClassRoomIdAndStatus(
                        room.getId(), EnrollmentRequestStatus.ENROLLED)) {
                    rollingSessions.createMissingAttendancesForEnrollment(activeEnrollment);
                }
            } else {
                rollingSessions.createMissingAttendancesForEnrollment(enrollment);
            }
            var releaseSnapshot = new Snapshot(0, List.of(), null, false);
            recordInbox(command, releaseSnapshot);
            return releaseSnapshot;
        }
        if (stableCutoffCommand && stop != null) {
            requireSameStableCutoffCommand(stop, command);
        }
        if (stop == null) {
            if ("CLOSE".equals(command.action())) throw new IllegalStateException("Freeze must complete first");
            if (command.commandId() != null && stops.findByCommandId(command.commandId()).isPresent()) {
                throw new IllegalStateException("Termination commandId is already used by another agreement");
            }
            int cutoff = command.requestedCutoffSession() != null
                    ? command.requestedCutoffSession()
                    : room.getTerminationCutoffSession() != null ? room.getTerminationCutoffSession()
                    : cutoff(rows, LocalDateTime.now(BUSINESS_ZONE));
            stop = new LearningTerminationStop();
            stop.setAgreementId(command.agreementId());
            stop.setClassroomId(room.getId());
            stop.setStudentId(command.studentId());
            stop.setCutoffSession(cutoff);
            stop.setOrigin(command.origin());
            stop.setEffectiveRequestedAt(command.effectiveRequestedAt());
            stop.setCommandId(command.commandId());
            stop.setCreatedAt(OffsetDateTime.now(ZoneOffset.UTC));
            stops.saveAndFlush(stop);
        }
        if (command.wholeClass() && room.getTerminationCutoffSession() == null) {
            room.setTerminationCutoffSession(stop.getCutoffSession());
        }
        if (Set.of("HOLD", "FREEZE").contains(command.action())) {
            for (var session : rows) {
                if (session.getSequenceNumber() > stop.getCutoffSession()) {
                    if (command.wholeClass()) {
                        attendances.deleteBySession_Id(session.getId());
                    } else {
                        attendances.deleteBySession_IdAndStudentId(session.getId(), enrollment.getStudentId());
                    }
                }
            }
        }
        if (command.wholeClass() && "FREEZE".equals(command.action())) {
            int cutoff = room.getTerminationCutoffSession();
            // Keep the classroom locked while the approved agreements settle.
            // It becomes CANCELLED only after every affected agreement is closed.
            room.setStatus(ClassRoomStatus.LOCKED);
            for (var session : rows) {
                if (session.getSequenceNumber() > cutoff) {
                    session.setStatus(ClassSessionStatus.CANCELLED);
                }
            }
            for (var pending : enrollments.findByClassRoomIdAndStatus(room.getId(), EnrollmentRequestStatus.PENDING)) {
                pending.setStatus(EnrollmentRequestStatus.CANCELLED);
            }
        }
        boolean classCancelled = false;
        if ("CLOSE".equals(command.action())) {
            enrollment.setStatus(EnrollmentRequestStatus.CANCELLED);
            enrollments.saveAndFlush(enrollment);
            for (var session : rows) {
                if (session.getSequenceNumber() > stop.getCutoffSession()) {
                    attendances.deleteBySession_IdAndStudentId(session.getId(), enrollment.getStudentId());
                }
            }
            stop.setClosed(true);

            if (Boolean.TRUE.equals(command.cancelClassIfEmpty())) {
                long activeStudents = enrollments.countByClassRoomIdAndStatusIn(
                        room.getId(),
                        List.of(EnrollmentRequestStatus.ACCEPTED, EnrollmentRequestStatus.ENROLLED)
                );
                if (activeStudents == 0) {
                    room.setStatus(ClassRoomStatus.CANCELLED);
                    if (room.getTerminationCutoffSession() == null) {
                        room.setTerminationCutoffSession(stop.getCutoffSession());
                    }
                    int cutoff = room.getTerminationCutoffSession();
                    for (var session : rows) {
                        if (session.getSequenceNumber() > cutoff) {
                            session.setStatus(ClassSessionStatus.CANCELLED);
                            attendances.deleteBySession_Id(session.getId());
                        }
                    }
                    for (var pending : enrollments.findByClassRoomIdAndStatus(room.getId(), EnrollmentRequestStatus.PENDING)) {
                        pending.setStatus(EnrollmentRequestStatus.CANCELLED);
                    }
                    classCancelled = true;
                }
            }
        }
        final int cutoff = (command.wholeClass() && room.getTerminationCutoffSession() != null)
                ? room.getTerminationCutoffSession()
                : stop.getCutoffSession();
        OffsetDateTime nextSessionStart = rows.stream()
                .filter(s -> s.getStatus() != ClassSessionStatus.CANCELLED)
                .filter(s -> s.getSequenceNumber() > cutoff)
                .map(s -> LocalDateTime.of(s.getSessionDate(), LocalTime.parse(s.getStartTime())))
                .filter(start -> start.isAfter(LocalDateTime.now(BUSINESS_ZONE)))
                .min(LocalDateTime::compareTo)
                .map(start -> start.atZone(BUSINESS_ZONE).toOffsetDateTime())
                .orElse(null);
        var snapshot = new Snapshot(cutoff, rows.stream()
                .filter(s -> s.getSequenceNumber() <= cutoff && s.getStatus() != ClassSessionStatus.CANCELLED)
                .map(s -> s.getSequenceNumber().longValue()).toList(), nextSessionStart, classCancelled);
        recordInbox(command, snapshot);
        return snapshot;
    }

    private void validateExtendedCommand(
            Command command,
            ClassRoom room,
            List<ClassSession> rows,
            boolean trialOptOut,
            boolean lateFundingRecovery) {
        boolean tutorAbsence = AUTO_TUTOR_ABSENCE.equals(command.origin())
                || AUTO_TUTOR_ABSENCE_RELAPSE.equals(command.origin());
        boolean hasExplicitFields = command.requestedCutoffSession() != null
                || command.effectiveRequestedAt() != null
                || command.commandId() != null
                || command.expectedHoldCommandId() != null
                || command.releaseNotAfter() != null
                || Boolean.TRUE.equals(command.cancelClassIfEmpty());
        if (!trialOptOut && !lateFundingRecovery && !tutorAbsence && hasExplicitFields) {
            throw new IllegalArgumentException("Explicit cutoff/audit fields require a supported system origin");
        }
        if (Boolean.TRUE.equals(command.cancelClassIfEmpty())) {
            if (!trialOptOut || !"CLOSE".equals(command.action()) || command.wholeClass()) {
                throw new IllegalArgumentException("cancelClassIfEmpty is only permitted on individual TRIAL_OPT_OUT CLOSE commands");
            }
        }
        if (tutorAbsence) {
            if (!command.wholeClass()) {
                throw new IllegalArgumentException(command.origin() + " must be a whole-class command");
            }
            if (command.commandId() == null) {
                throw new IllegalArgumentException(command.origin() + " requires commandId");
            }
            if ("RELEASE".equals(command.action())) {
                if (command.requestedCutoffSession() == null
                        || command.effectiveRequestedAt() == null
                        || command.expectedHoldCommandId() == null
                        || command.releaseNotAfter() == null) {
                    throw new IllegalArgumentException(command.origin()
                            + " RELEASE requires cutoff, effective time, expected hold command and release deadline");
                }
            }
            if ("HOLD".equals(command.action()) || "FREEZE".equals(command.action())) {
                if (command.requestedCutoffSession() == null || command.effectiveRequestedAt() == null) {
                    throw new IllegalArgumentException(command.origin() + " requires cutoff and effective time");
                }
                int requestedCutoff = command.requestedCutoffSession();
                if (requestedCutoff <= 0
                        || (room.getTotalSessions() != null && requestedCutoff > room.getTotalSessions())) {
                    throw new IllegalArgumentException("Requested tutor absence cutoff is outside the classroom session range");
                }
                boolean cutoffSessionExists = rows.stream()
                        .anyMatch(session -> session.getSequenceNumber() == requestedCutoff
                                && session.getStatus() != ClassSessionStatus.CANCELLED);
                if (!cutoffSessionExists) {
                    throw new IllegalStateException("Requested tutor absence cutoff session is not available");
                }
            }
            return;
        }
        if (!trialOptOut && !lateFundingRecovery) {
            return;
        }
        if (command.wholeClass() || (!"HOLD".equals(command.action()) && !"CLOSE".equals(command.action()))) {
            throw new IllegalArgumentException(command.origin() + " must be an individual HOLD or CLOSE command");
        }
        if ("CLOSE".equals(command.action())) {
            if (command.commandId() == null || command.requestedCutoffSession() == null || command.effectiveRequestedAt() == null) {
                throw new IllegalArgumentException(command.origin() + " CLOSE requires commandId, cutoff and effective time");
            }
            return;
        }
        if (command.requestedCutoffSession() == null
                || command.effectiveRequestedAt() == null
                || command.commandId() == null) {
            throw new IllegalArgumentException(command.origin() + " requires cutoff, effective time and commandId");
        }
        if (!Short.valueOf((short) 1).equals(room.getTrialPolicyVersion())) {
            throw new IllegalStateException("Classroom is not enrolled in trial policy v1");
        }
        int requestedCutoff = command.requestedCutoffSession();
        if (lateFundingRecovery) {
            if (requestedCutoff != 0) {
                throw new IllegalArgumentException("SYSTEM_LATE_FUNDING requires cutoff session 0");
            }
            return;
        }
        if (requestedCutoff <= 0
                || room.getTotalSessions() == null
                || requestedCutoff > room.getTotalSessions()) {
            throw new IllegalArgumentException("Requested trial cutoff is outside the classroom session range");
        }
        boolean cutoffSessionExists = rows.stream()
                .anyMatch(session -> session.getSequenceNumber() == requestedCutoff
                        && session.getStatus() != ClassSessionStatus.CANCELLED);
        if (!cutoffSessionExists) {
            throw new IllegalStateException("Requested trial cutoff session is not available");
        }
    }

    private void recordInbox(Command command, Snapshot snapshot) {
        if (command.commandId() != null) {
            String payloadHash = computePayloadHash(command);
            var entry = new LearningTerminationCommandInbox();
            entry.setId(UUID.randomUUID());
            entry.setCommandId(command.commandId());
            entry.setAction(command.action());
            entry.setClassroomId(command.classroomId());
            entry.setAgreementId(command.agreementId());
            entry.setCutoffSession(snapshot.cutoffSession());
            entry.setPayloadHash(payloadHash);
            entry.setStatus("COMPLETED");
            entry.setRequiredSessionSequencesCsv(snapshot.requiredSessions().stream()
                    .map(String::valueOf).collect(java.util.stream.Collectors.joining(",")));
            entry.setNextSessionStartAt(snapshot.nextSessionStart());
            entry.setClassCancelled(Boolean.TRUE.equals(snapshot.classCancelled()));
            entry.setCreatedAt(OffsetDateTime.now(ZoneOffset.UTC));
            entry.setUpdatedAt(entry.getCreatedAt());
            inboxRepository.saveAndFlush(entry);
        }
    }

    private List<Long> parseRequiredSessions(String value) {
        if (value == null || value.isBlank()) return List.of();
        return Arrays.stream(value.split(",")).map(Long::parseLong).toList();
    }

    private String computePayloadHash(Command command) {
        String raw = String.format("%s|%s|%s|%s|%s|%s|%s|%s|%s|%s%s",
                command.commandId(),
                command.action(),
                command.classroomId(),
                command.agreementId(),
                command.wholeClass(),
                command.origin(),
                command.requestedCutoffSession(),
                command.effectiveRequestedAt() != null ? command.effectiveRequestedAt().toInstant().toEpochMilli() : "",
                command.expectedHoldCommandId(),
                command.releaseNotAfter() != null ? command.releaseNotAfter().toInstant().toEpochMilli() : "",
                Boolean.TRUE.equals(command.cancelClassIfEmpty()) ? "|true" : ""
        );
        try {
            var md = java.security.MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(raw.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(hash);
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new RuntimeException(e);
        }
    }

    private void requireSameStableCutoffCommand(LearningTerminationStop stop, Command command) {
        if (!Objects.equals(command.origin(), stop.getOrigin())
                || !Objects.equals(stop.getCommandId(), command.commandId())) {
            throw new IllegalStateException("Trial opt-out replay does not match the persisted command");
        }
        if (command.requestedCutoffSession() != null && !Objects.equals(stop.getCutoffSession(), command.requestedCutoffSession())) {
            throw new IllegalStateException("Trial opt-out cutoff does not match the persisted stop");
        }
        if (command.effectiveRequestedAt() != null && stop.getEffectiveRequestedAt() != null
                && !stop.getEffectiveRequestedAt().toInstant().equals(command.effectiveRequestedAt().toInstant())) {
            throw new IllegalStateException("Trial opt-out effectiveRequestedAt does not match the persisted stop");
        }
    }

    static int cutoff(List<ClassSession> rows, LocalDateTime now) {
        return rows.stream().filter(s -> s.getStatus() != ClassSessionStatus.CANCELLED)
                .filter(s -> !LocalDateTime.of(s.getSessionDate(), LocalTime.parse(s.getStartTime())).isAfter(now))
                .mapToInt(ClassSession::getSequenceNumber).max().orElse(0);
    }

    @Transactional
    public void requireCanAttend(ClassSession session, Long studentId) {
        var room = rooms.findByIdForUpdate(session.getClassRoom().getId()).orElseThrow();
        if (room.getStatus() == ClassRoomStatus.CANCELLED || room.getStatus() == ClassRoomStatus.CLOSED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Lop da ket thuc; khong the diem danh");
        }
        if (room.getTerminationCutoffSession() != null && session.getSequenceNumber() > room.getTerminationCutoffSession()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Lop dang cham dut; buoi hoc da dung");
        }
        if (studentId != null && stops.findByClassroomIdAndStudentId(room.getId(), studentId).stream()
                .anyMatch(s -> session.getSequenceNumber() > s.getCutoffSession())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Hop dong dang cham dut; buoi hoc da dung");
        }
    }

    public boolean isWholeClassSessionStopped(ClassSession session) {
        var room = session.getClassRoom();
        if (room == null || room.getStatus() == ClassRoomStatus.CANCELLED || room.getStatus() == ClassRoomStatus.CLOSED) {
            return true;
        }
        Integer cutoff = room.getTerminationCutoffSession();
        return cutoff != null && session.getSequenceNumber() > cutoff;
    }

    public boolean isAttendanceStopped(ClassSession session, Long studentId) {
        var room = session.getClassRoom();
        return room.getStatus() == ClassRoomStatus.CANCELLED || room.getStatus() == ClassRoomStatus.CLOSED
                || isWholeClassSessionStopped(session)
                || (studentId != null && stops.findByClassroomIdAndStudentId(room.getId(), studentId).stream()
                    .anyMatch(stop -> session.getSequenceNumber() > stop.getCutoffSession()));
    }
}
