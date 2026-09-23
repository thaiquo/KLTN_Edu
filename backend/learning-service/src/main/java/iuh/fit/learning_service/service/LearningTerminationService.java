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

    public record Command(Long classroomId, Long studentId, String agreementId, boolean wholeClass, String action) {}
    public record Snapshot(int cutoffSession, List<Long> requiredSessions) {}

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
            return new Snapshot(room.getTerminationCutoffSession(), List.of());
        }
        UUID.fromString(command.agreementId());
        var enrollment = enrollments.findByAgreementId(command.agreementId()).orElseThrow(() ->
                new IllegalStateException("Agreement has no matching Learning enrollment"));
        if (!room.getId().equals(enrollment.getClassRoom().getId())
                || !Objects.equals(command.studentId(), enrollment.getStudentId())) {
            throw new IllegalStateException("Agreement/enrollment identity mismatch");
        }
        if (!Set.of("HOLD", "RELEASE", "FREEZE", "CLOSE").contains(command.action())) throw new IllegalArgumentException("Unknown action");
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
            return new Snapshot(0, List.of());
        }
        if (stop == null) {
            if ("CLOSE".equals(command.action())) throw new IllegalStateException("Freeze must complete first");
            int cutoff = room.getTerminationCutoffSession() != null ? room.getTerminationCutoffSession()
                    : cutoff(rows, LocalDateTime.now());
            stop = new LearningTerminationStop();
            stop.setAgreementId(command.agreementId());
            stop.setClassroomId(room.getId());
            stop.setStudentId(command.studentId());
            stop.setCutoffSession(cutoff);
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
        return new Snapshot(cutoff, rows.stream()
                .filter(s -> s.getSequenceNumber() <= cutoff && s.getStatus() != ClassSessionStatus.CANCELLED)
                .map(s -> s.getSequenceNumber().longValue()).toList());
    }

    static int cutoff(List<ClassSession> rows, LocalDateTime now) {
        return rows.stream().filter(s -> s.getStatus() != ClassSessionStatus.CANCELLED)
                .filter(s -> !LocalDateTime.of(s.getSessionDate(), LocalTime.parse(s.getStartTime())).isAfter(now))
                .mapToInt(ClassSession::getSequenceNumber).max().orElse(0);
    }

    @Transactional
    public void requireCanAttend(ClassSession session, Long studentId) {
        var room = rooms.findByIdForUpdate(session.getClassRoom().getId()).orElseThrow();
        if (room.getTerminationCutoffSession() != null && session.getSequenceNumber() > room.getTerminationCutoffSession()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Lop dang cham dut; buoi hoc da dung");
        }
        if (studentId != null && stops.findByClassroomIdAndStudentId(room.getId(), studentId).stream()
                .anyMatch(s -> session.getSequenceNumber() > s.getCutoffSession())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Hop dong dang cham dut; buoi hoc da dung");
        }
    }

    public boolean isWholeClassSessionStopped(ClassSession session) {
        Integer cutoff = session.getClassRoom().getTerminationCutoffSession();
        return cutoff != null && session.getSequenceNumber() > cutoff;
    }
}
