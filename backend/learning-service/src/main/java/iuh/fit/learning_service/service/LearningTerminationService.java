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

    public record Command(
            Long classroomId,
            Long studentId,
            String agreementId,
            boolean wholeClass,
            String action,
            String origin,
            Integer requestedCutoffSession,
            OffsetDateTime effectiveRequestedAt,
            UUID commandId) {
        public Command(Long classroomId, Long studentId, String agreementId, boolean wholeClass, String action) {
            this(classroomId, studentId, agreementId, wholeClass, action, null, null, null, null);
        }
    }
    public record Snapshot(int cutoffSession, List<Long> requiredSessions, OffsetDateTime nextSessionStart) {}
    private static final ZoneId BUSINESS_ZONE = CanonicalSessionPlanner.BUSINESS_ZONE;
    private static final String TRIAL_OPT_OUT = "TRIAL_OPT_OUT";
    private static final String SYSTEM_LATE_FUNDING = "SYSTEM_LATE_FUNDING";

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
        boolean stableCutoffCommand = trialOptOut || lateFundingRecovery;
        validateExtendedCommand(command, room, rows, trialOptOut, lateFundingRecovery);
        var stop = stops.findById(command.agreementId()).orElse(null);
        if ("RELEASE".equals(command.action())) {
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
            return new Snapshot(0, List.of(), null);
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
        if ("CLOSE".equals(command.action())) {
            enrollment.setStatus(EnrollmentRequestStatus.CANCELLED);
            for (var session : rows) {
                if (session.getSequenceNumber() > stop.getCutoffSession()) {
                    attendances.deleteBySession_IdAndStudentId(session.getId(), enrollment.getStudentId());
                }
            }
            stop.setClosed(true);
        }
        final int cutoff = stop.getCutoffSession();
        OffsetDateTime nextSessionStart = rows.stream()
                .filter(s -> s.getStatus() != ClassSessionStatus.CANCELLED)
                .filter(s -> s.getSequenceNumber() > cutoff)
                .map(s -> LocalDateTime.of(s.getSessionDate(), LocalTime.parse(s.getStartTime())))
                .filter(start -> start.isAfter(LocalDateTime.now(BUSINESS_ZONE)))
                .min(LocalDateTime::compareTo)
                .map(start -> start.atZone(BUSINESS_ZONE).toOffsetDateTime())
                .orElse(null);
        return new Snapshot(cutoff, rows.stream()
                .filter(s -> s.getSequenceNumber() <= cutoff && s.getStatus() != ClassSessionStatus.CANCELLED)
                .map(s -> s.getSequenceNumber().longValue()).toList(), nextSessionStart);
    }

    private void validateExtendedCommand(
            Command command,
            ClassRoom room,
            List<ClassSession> rows,
            boolean trialOptOut,
            boolean lateFundingRecovery) {
        boolean hasTrialFields = command.requestedCutoffSession() != null
                || command.effectiveRequestedAt() != null
                || command.commandId() != null;
        if (!trialOptOut && !lateFundingRecovery && hasTrialFields) {
            throw new IllegalArgumentException("Explicit cutoff/audit fields require a supported system origin");
        }
        if (!trialOptOut && !lateFundingRecovery) {
            return;
        }
        if (command.wholeClass() || !"HOLD".equals(command.action())) {
            throw new IllegalArgumentException(command.origin() + " must be an individual HOLD command");
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

    private void requireSameStableCutoffCommand(LearningTerminationStop stop, Command command) {
        if (!Objects.equals(command.origin(), stop.getOrigin())
                || !Objects.equals(stop.getCommandId(), command.commandId())
                || !Objects.equals(stop.getCutoffSession(), command.requestedCutoffSession())
                || stop.getEffectiveRequestedAt() == null
                || !stop.getEffectiveRequestedAt().toInstant().equals(command.effectiveRequestedAt().toInstant())) {
            throw new IllegalStateException("Trial opt-out replay does not match the persisted command");
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
