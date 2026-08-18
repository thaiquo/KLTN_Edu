package iuh.fit.learning_service.dto;

import iuh.fit.learning_service.enums.LevelType;
import jakarta.validation.constraints.*;
import java.time.LocalDateTime;

public final class CatalogSuggestionDtos {
    private CatalogSuggestionDtos() {}
    public record CreateRequest(@NotNull Long categoryId, @NotBlank @Size(max=160) String subjectName,
                                @NotBlank @Size(max=160) String levelName, @NotNull LevelType levelType,
                                @Size(max=1000) String note) {}
    public record RejectRequest(@NotBlank @Size(max=1000) String reason) {}
    public record Response(Long id, TeachingCatalogDtos.CategoryOption category, String subjectName,
                           String levelName, LevelType levelType, String note, String requestedByEmail,
                           String status, String reviewedByEmail, LocalDateTime reviewedAt, String rejectReason,
                           Long approvedSubjectId, Long approvedLevelId, LocalDateTime createdAt) {}
}
