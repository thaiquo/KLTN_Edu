package iuh.fit.learning_service.dto;

import iuh.fit.learning_service.enums.ClassRoomStatus;
import iuh.fit.learning_service.enums.DurationUnit;
import iuh.fit.learning_service.enums.JoinMode;
import iuh.fit.learning_service.enums.LearningMode;
import iuh.fit.learning_service.enums.SyllabusMode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public final class ClassRoomDtos {
    private ClassRoomDtos() {}

    public record ScheduleRequest(
            @NotNull @Min(2) @Max(8) Integer dayOfWeek,
            @NotBlank @Pattern(regexp = "^([01]?[0-9]|2[0-3]):[0-5][0-9]$", message = "Format HH:mm") String startTime,
            @NotBlank @Pattern(regexp = "^([01]?[0-9]|2[0-3]):[0-5][0-9]$", message = "Format HH:mm") String endTime
    ) {}

    public record ScheduleResponse(
            Long id,
            Integer dayOfWeek,
            String startTime,
            String endTime
    ) {}

    public record ChapterRequest(
            @NotBlank @Size(max = 255) String title,
            String description,
            @NotNull @Min(1) Integer expectedSessions,
            Integer orderIndex
    ) {}

    public record ChapterResponse(
            Long id,
            String title,
            String description,
            Integer expectedSessions,
            Integer orderIndex
    ) {}

    public record CreateClassRoomRequest(
            @NotNull Long tutorSubjectRegistrationId,
            @NotNull Long levelId,
            Long tutorProfileId,
            @Size(max = 255) String tutorFullName,
            @NotBlank @Size(max = 255) String name,
            @NotBlank String description,
            @NotNull LearningMode learningMode,
            @Size(max = 500) String meetingLink,
            @Size(max = 500) String address,
            @NotNull @Min(1) @Max(100) Integer maxStudents,
            @Min(1) @Max(300) Integer maxPendingRequests,
            @Min(100) @Max(300) Integer bufferPoolRatioPercent,
            @NotNull @DecimalMin("1") BigDecimal pricePerSession,
            @NotNull @Min(1) @Max(7) Integer sessionsPerWeek,
            @NotNull @Min(30) @Max(300) Integer durationPerSessionMinutes,
            @NotNull @Min(1) @Max(52) Integer durationValue,
            @NotNull DurationUnit durationUnit,
            @NotNull LocalDate startDate,
            @NotEmpty List<@Valid ScheduleRequest> schedules,
            @NotNull SyllabusMode syllabusMode,
            @Size(max = 1000) String syllabusFileUrl,
            List<@Valid ChapterRequest> chapters
    ) {}

    public record UpdateClassRoomRequest(
            @NotBlank @Size(max = 255) String name,
            @NotBlank String description,
            @NotNull LearningMode learningMode,
            @Size(max = 500) String meetingLink,
            @Size(max = 500) String address,
            @NotNull @Min(1) @Max(100) Integer maxStudents,
            @NotNull @DecimalMin("1") BigDecimal pricePerSession,
            @NotNull @Min(1) @Max(7) Integer sessionsPerWeek,
            @NotNull @Min(30) @Max(300) Integer durationPerSessionMinutes,
            @NotNull @Min(1) @Max(52) Integer durationValue,
            @NotNull DurationUnit durationUnit,
            @NotNull LocalDate startDate,
            @NotEmpty List<@Valid ScheduleRequest> schedules,
            @NotNull SyllabusMode syllabusMode,
            @Size(max = 1000) String syllabusFileUrl,
            List<@Valid ChapterRequest> chapters
    ) {}

    public record UpdateClassDetailsRequest(
            @NotBlank String description,
            @Size(max = 500) String meetingLink,
            @Size(max = 500) String address,
            @NotNull SyllabusMode syllabusMode,
            @Size(max = 1000) String syllabusFileUrl,
            List<@Valid ChapterRequest> chapters
    ) {}

    public record UpdateVisibilityRequest(
            @NotNull ClassRoomStatus status,
            @NotNull JoinMode joinMode,
            @Size(max = 50) String joinKey,
            @Min(1) @Max(300) Integer maxPendingRequests,
            @Min(100) @Max(300) Integer bufferPoolRatioPercent
    ) {}

    public record VerifyJoinKeyRequest(
            @NotBlank String joinKey
    ) {}

    public record VerifyJoinKeyResponse(
            boolean valid,
            String message
    ) {}

    public record RegistrationBrief(
            Long id,
            Long programTypeId,
            String programTypeName,
            Long educationLevelId,
            String educationLevelName,
            Long categoryId,
            String categoryName,
            Long subjectId,
            String subjectName,
            String subjectCode,
            BigDecimal tuitionMin,
            BigDecimal tuitionMax
    ) {}

    public record LevelBrief(
            Long id,
            String name,
            String code
    ) {}

    public record ClassRoomResponse(
            Long id,
            Long tutorSubjectRegistrationId,
            RegistrationBrief registration,
            LevelBrief level,
            String tutorEmail,
            Long tutorProfileId,
            String tutorFullName,
            String name,
            String description,
            LearningMode learningMode,
            String meetingLink,
            String address,
            Integer maxStudents,
            Integer maxPendingRequests,
            Integer bufferPoolRatioPercent,
            Long pendingCount,
            Long acceptedCount,
            Long availableSlots,
            Boolean isBufferPoolFull,
            BigDecimal pricePerSession,
            BigDecimal totalPrice,
            Integer sessionsPerWeek,
            Integer durationPerSessionMinutes,
            Integer durationValue,
            DurationUnit durationUnit,
            LocalDate startDate,
            LocalDate endDate,
            Integer totalSessions,
            SyllabusMode syllabusMode,
            String syllabusFileUrl,
            JoinMode joinMode,
            String joinKey,
            ClassRoomStatus status,
            String rejectReason,
            String reviewedByEmail,
            LocalDateTime reviewedAt,
            List<ScheduleResponse> schedules,
            List<ChapterResponse> chapters,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {}

    public record RejectClassRequest(
            @NotBlank @Size(max = 1000) String reason
    ) {}

    public record ClassRoomStatsResponse(
            long totalClasses,
            long activeCount,
            long pendingCount,
            long privateCount,
            long publishedCount,
            long lockedCount,
            long closedCount,
            long rejectedCount,
            long draftCount
    ) {}
}
