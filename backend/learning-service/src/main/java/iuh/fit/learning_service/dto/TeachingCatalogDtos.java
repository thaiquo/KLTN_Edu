package iuh.fit.learning_service.dto;

import iuh.fit.learning_service.enums.LevelType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public final class TeachingCatalogDtos {
    private TeachingCatalogDtos() {}

    public record Option(Long id, String code, String name, String description) {}
    public record CategoryOption(Long id, String code, String name, Option programType, Option educationLevel) {}
    public record SubjectOption(Long id, String code, String name, String description, CategoryOption category) {}
    public record LevelOption(Long id, String code, String name, LevelType type, String description) {}

    public record EvidenceRequest(
            @NotNull iuh.fit.learning_service.enums.EvidenceType evidenceType,
            @NotBlank @Size(max = 160) String title,
            Long accountDocumentId,
            @Size(max = 1000) String fileUrl
    ) {}

    public record CreateRegistrationRequest(
            @NotNull Long subjectId,
            @NotNull Long levelId,
            @NotNull @Min(0) @Max(60) Integer experienceYears,
            @NotNull @DecimalMin("1") BigDecimal tuitionMin,
            @NotNull @DecimalMin("1") BigDecimal tuitionMax,
            @NotBlank @Size(max = 1500) String description,
            @NotEmpty @Size(max = 5) List<@Valid EvidenceRequest> evidence
    ) {}

    public record CreateRegistrationBatchRequest(
            Long subjectId,
            List<Long> levelIds,
            @NotNull @Min(0) @Max(60) Integer experienceYears,
            @NotNull @DecimalMin("1") BigDecimal tuitionMin,
            @NotNull @DecimalMin("1") BigDecimal tuitionMax,
            @NotBlank @Size(max = 1500) String description,
            @NotEmpty @Size(max = 5) List<@Valid EvidenceRequest> evidence,

            Long categoryId,
            @Size(max = 160) String proposedSubjectName,
            @Size(max = 160) String proposedLevelName,
            LevelType proposedLevelType,
            @Size(max = 1000) String proposedNote
    ) {}

    public record ReviewRequest(@Size(max = 1000) String note) {}
    public record RejectRequest(@NotBlank @Size(max = 1000) String reason, @Size(max = 1000) String note) {}

    public record EvidenceResponse(Long id, iuh.fit.learning_service.enums.EvidenceType evidenceType, String title, Long accountDocumentId, String fileUrl) {}
    public record RegistrationResponse(
            Long id,
            String tutorEmail,
            Long tutorProfileId,
            Option programType,
            Option educationLevel,
            CategoryOption category,
            SubjectOption subject,
            List<LevelOption> levels,
            Integer experienceYears,
            BigDecimal tuitionMin,
            BigDecimal tuitionMax,
            String description,
            iuh.fit.learning_service.enums.TutorSubjectRegistrationStatus status,
            String rejectReason,
            String reviewNote,
            LocalDateTime submittedAt,
            LocalDateTime reviewedAt,
            String reviewedByEmail,
            List<EvidenceResponse> evidence,

            String proposedSubjectName,
            String proposedLevelName,
            LevelType proposedLevelType,
            String proposedNote
    ) {}
}
