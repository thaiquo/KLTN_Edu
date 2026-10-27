package iuh.fit.learning_service.controller;

import iuh.fit.learning_service.config.EscrowTrialProperties;
import iuh.fit.learning_service.entity.ClassRoom;
import iuh.fit.learning_service.entity.EnrollmentRequest;
import iuh.fit.learning_service.enums.EnrollmentRequestStatus;
import iuh.fit.learning_service.repository.ClassRoomRepository;
import iuh.fit.learning_service.repository.ClassSessionRepository;
import iuh.fit.learning_service.repository.EnrollmentRequestRepository;
import iuh.fit.learning_service.repository.TutorAuthorizationStateRepository;
import iuh.fit.learning_service.service.CanonicalSessionPlanner;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/learning/internal/contracts")
public class InternalContractSnapshotController {
    private final ClassRoomRepository classes;
    private final EnrollmentRequestRepository requests;
    private final TutorAuthorizationStateRepository tutors;
    private final ClassSessionRepository sessions;
    private final CanonicalSessionPlanner sessionPlanner;
    private final EscrowTrialProperties trialProperties;

    public InternalContractSnapshotController(ClassRoomRepository classes,
                                              EnrollmentRequestRepository requests,
                                              TutorAuthorizationStateRepository tutors,
                                              ClassSessionRepository sessions,
                                              CanonicalSessionPlanner sessionPlanner,
                                              EscrowTrialProperties trialProperties) {
        this.classes = classes;
        this.requests = requests;
        this.tutors = tutors;
        this.sessions = sessions;
        this.sessionPlanner = sessionPlanner;
        this.trialProperties = trialProperties;
    }

    public record Schedule(int dayOfWeek, String startTime, String endTime) {}
    public record Chapter(int order, String title, String description, int expectedSessions) {}
    public record Snapshot(Long classroomId, String className, String classDescription,
                           Long tutorId, String tutorEmail, Long studentId, String studentEmail,
                           BigDecimal pricePerSessionVnd, int totalSessions, String classroomReviewerEmail,
                           String learningMode, String meetingLink, String learningAddress,
                           LocalDate courseStartDate, LocalDate courseEndDate, int durationPerSessionMinutes,
                           List<Schedule> schedules, List<Chapter> syllabus,
                           boolean trialPolicyEnabled, Short trialPolicyVersion,
                           Integer trialSessionSequence, Integer nextSessionSequence,
                           OffsetDateTime trialSessionStartAt, OffsetDateTime nextSessionStartAt,
                           OffsetDateTime initialTrialDeadline, String scheduleFingerprint) {}

    @GetMapping("/snapshot")
    @PreAuthorize("hasRole('INTERNAL_CONTRACT')")
    @Transactional(readOnly = true)
    public Snapshot snapshot(@RequestParam Long classroomId, @RequestParam Long studentId) {
        ClassRoom room = classes.findById(classroomId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Class not found"));
        if (!java.util.Set.of("ACTIVE", "PRIVATE", "PUBLISHED", "LOCKED").contains(room.getStatus().name())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Class is not available for enrollment");
        }
        EnrollmentRequest request = requests.findFirstByClassRoomIdAndStudentIdAndStatusInOrderByCreatedAtDesc(
                classroomId, studentId, List.of(EnrollmentRequestStatus.PENDING))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "Pending enrollment request not found"));
        var tutor = tutors.findByTutorProfileId(room.getTutorProfileId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "Tutor identity unavailable"));
        if (!"APPROVED".equalsIgnoreCase(tutor.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Tutor is not approved");
        }
        Long tutorId = tutor.getUserId();
        boolean trialEnabled = trialProperties.isEnabled()
                && Short.valueOf((short) 1).equals(room.getTrialPolicyVersion());
        CanonicalSessionPlanner.TrialSchedule trial = trialEnabled
                ? sessionPlanner.trialSchedule(room)
                : null;
        if (trialEnabled) {
            sessionPlanner.requirePersistedPrefix(
                    room,
                    sessions.findByClassRoomIdOrderBySequenceNumberAsc(room.getId()));
        }
        return new Snapshot(room.getId(), room.getName(), room.getDescription(), tutorId, room.getTutorEmail(),
                request.getStudentId(), request.getStudentEmail(), room.getPricePerSession(), room.getTotalSessions(),
                room.getReviewedByEmail(), room.getLearningMode().name(), room.getMeetingLink(), room.getAddress(),
                room.getStartDate(), room.getEndDate(), room.getDurationPerSessionMinutes(),
                room.getSchedules().stream().map(s -> new Schedule(s.getDayOfWeek(), s.getStartTime(), s.getEndTime())).toList(),
                room.getChapters().stream().map(c -> new Chapter(c.getOrderIndex(), c.getTitle(),
                        c.getDescription(), c.getExpectedSessions())).toList(),
                trialEnabled, trialEnabled ? room.getTrialPolicyVersion() : null,
                trial == null ? null : trial.trialSessionSequence(),
                trial == null ? null : trial.nextSessionSequence(),
                trial == null ? null : trial.trialSessionStartAt(),
                trial == null ? null : trial.nextSessionStartAt(),
                trial == null ? null : trial.initialTrialDeadline(),
                trial == null ? null : trial.scheduleFingerprint());
    }
}
