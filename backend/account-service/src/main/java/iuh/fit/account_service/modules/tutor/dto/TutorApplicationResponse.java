package iuh.fit.account_service.modules.tutor.dto;

import iuh.fit.account_service.modules.tutor.enums.TutorApplicationStatus;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record TutorApplicationResponse(
    UUID id,
    UUID userId,
    String applicantName,
    String applicantEmail,
    TutorApplicationStatus status,
    Instant submittedAt,
    Instant reviewedAt,
    UUID reviewedBy,
    String rejectionReason,
    String reviewNote,
    List<CertificateResponse> certificates,
    List<TeachingSubjectResponse> teachingSubjects,
    List<TutorApplicationEventResponse> events,
    Instant createdAt,
    Instant updatedAt
) {
}
