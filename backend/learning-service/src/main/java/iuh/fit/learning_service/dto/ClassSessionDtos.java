package iuh.fit.learning_service.dto;

import iuh.fit.learning_service.enums.AttendanceOutcome;
import iuh.fit.learning_service.enums.ClassSessionStatus;
import iuh.fit.learning_service.enums.EnrollmentRequestStatus;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public class ClassSessionDtos {

    public record SessionFileItem(
            Long id,
            Long sessionId,
            String fileCategory,
            String fileName,
            Long fileSize,
            String contentType,
            Integer fileOrder,
            LocalDateTime createdAt
    ) {}

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
            LocalDateTime assignmentDueAt,
            Boolean submissionRequired,
            Boolean lateSubmissionAllowed,
            String materialUrl,
            String materialDescription,
            ClassSessionStatus status,
            LocalDateTime createdAt,
            LocalDateTime updatedAt,
            Integer totalAttendees,
            Integer presentCount,
            Long myAttendanceId,
            Boolean myCheckedIn,
            String mySubmissionText,
            String mySubmissionFileUrl,
            LocalDateTime mySubmittedAt,
            String myGradeScore,
            String myTutorFeedback,
            LocalDateTime myGradedAt,
            Boolean tutorCheckedIn,
            AttendanceOutcome myFinalOutcome,
            Integer bothPresentCount,
            Integer studentAbsentCount,
            Integer tutorAbsentCount,
            Boolean settlementDispatched,
            List<SessionFileItem> assignmentFiles,
            List<SessionFileItem> materialFiles,
            String assignmentExternalUrl,
            String materialExternalUrl,
            String mySubmissionFileName,
            Long mySubmissionFileSize
    ) {}

    public record UpdateSessionDetailsRequest(
            String topic,
            String assignmentTitle,
            String assignmentDescription,
            String assignmentFileUrl,
            LocalDateTime assignmentDueAt,
            Boolean submissionRequired,
            Boolean lateSubmissionAllowed,
            String materialUrl,
            String materialDescription,
            String assignmentExternalUrl,
            String materialExternalUrl
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
            AttendanceOutcome finalOutcome,
            String submissionText,
            String submissionFileUrl,
            LocalDateTime submittedAt,
            String gradeScore,
            String tutorFeedback,
            LocalDateTime gradedAt,
            String gradedByTutorEmail,
            Boolean isLateSubmission,
            EnrollmentRequestStatus enrollmentStatus,
            Boolean attendanceLocked,
            String submissionFileName,
            Long submissionFileSize
    ) {}

    public record SubmitHomeworkRequest(
            String submissionText,
            String submissionFileUrl
    ) {}

    public record GradeHomeworkRequest(
            String gradeScore,
            String tutorFeedback
    ) {}

    public record TutorAttendanceRequest(
            /** Deprecated and ignored. Students must check in themselves. */
            List<Long> presentStudentIds,
            String note
    ) {}

    public record UpdateClassMeetingLinkRequest(
            String meetingLink
    ) {}

    public record TutorHomeworkItemResponse(
            Long sessionId,
            Long classRoomId,
            String classTitle,
            Integer sequenceNumber,
            String topic,
            LocalDate sessionDate,
            String startTime,
            String endTime,
            String assignmentTitle,
            String assignmentDescription,
            String assignmentFileUrl,
            LocalDateTime assignmentDueAt,
            Boolean submissionRequired,
            Boolean lateSubmissionAllowed,
            String materialUrl,
            String materialDescription,
            Integer totalStudents,
            Integer submittedCount,
            Integer gradedCount,
            List<SessionAttendanceResponse> submissions,
            List<SessionFileItem> assignmentFiles,
            List<SessionFileItem> materialFiles,
            String assignmentExternalUrl,
            String materialExternalUrl
    ) {}

    public record StudentHomeworkItemResponse(
            Long sessionId,
            Long attendanceId,
            Long classRoomId,
            String classTitle,
            String tutorName,
            Integer sequenceNumber,
            String topic,
            LocalDate sessionDate,
            String startTime,
            String endTime,
            String assignmentTitle,
            String assignmentDescription,
            String assignmentFileUrl,
            LocalDateTime assignmentDueAt,
            Boolean submissionRequired,
            Boolean lateSubmissionAllowed,
            String materialUrl,
            String materialDescription,
            Boolean studentCheckedIn,
            String submissionText,
            String submissionFileUrl,
            LocalDateTime submittedAt,
            String gradeScore,
            String tutorFeedback,
            LocalDateTime gradedAt,
            String status,
            List<SessionFileItem> assignmentFiles,
            List<SessionFileItem> materialFiles,
            String assignmentExternalUrl,
            String materialExternalUrl,
            String submissionFileName,
            Long submissionFileSize,
            Boolean isLateSubmission,
            Boolean submissionBlockedByDeadline
    ) {}
}
