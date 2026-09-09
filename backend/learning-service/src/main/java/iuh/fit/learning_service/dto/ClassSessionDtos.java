package iuh.fit.learning_service.dto;

import iuh.fit.learning_service.enums.AttendanceOutcome;
import iuh.fit.learning_service.enums.ClassSessionStatus;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public class ClassSessionDtos {

    public record ClassSessionResponse(
            Long id,
            Long classRoomId,
            Integer sequenceNumber,
            String topic,
            LocalDate sessionDate,
            String startTime,
            String endTime,
            String assignmentTitle,
            String assignmentDescription,
            String assignmentFileUrl,
            ClassSessionStatus status,
            LocalDateTime createdAt,
            LocalDateTime updatedAt,
            Integer totalAttendees,
            Integer presentCount,
            Boolean myCheckedIn
    ) {}

    public record UpdateSessionDetailsRequest(
            String topic,
            String assignmentTitle,
            String assignmentDescription,
            String assignmentFileUrl
    ) {}

    public record SessionAttendanceResponse(
            Long id,
            Long sessionId,
            Long studentId,
            String studentName,
            String studentEmail,
            Long tutorId,
            Boolean tutorChecked,
            LocalDateTime tutorCheckedAt,
            Boolean studentChecked,
            LocalDateTime studentCheckedAt,
            AttendanceOutcome finalOutcome
    ) {}

    public record TutorAttendanceRequest(
            List<Long> presentStudentIds,
            String note
    ) {}

    public record UpdateClassMeetingLinkRequest(
            String meetingLink
    ) {}
}
