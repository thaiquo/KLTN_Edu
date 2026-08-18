package iuh.fit.learning_service.dto;

import iuh.fit.learning_service.enums.LevelType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;

public final class AdminCatalogDtos {
    private AdminCatalogDtos() {}
    public record LevelInput(@NotBlank @Size(max=80) String code, @NotBlank @Size(max=160) String name,
                             @NotNull LevelType type, @Size(max=500) String description, Integer orderIndex) {}
    public record CreateSubjectRequest(@NotNull Long categoryId, @NotBlank @Size(max=80) String code,
                                       @NotBlank @Size(max=160) String name, @Size(max=1000) String description,
                                       Integer orderIndex, @NotEmpty @Valid List<LevelInput> levels) {}
    public record UpdateSubjectRequest(@NotBlank @Size(max=80) String code,
                                       @NotBlank @Size(max=160) String name,
                                       @Size(max=1000) String description,
                                       Integer orderIndex, boolean active) {}
    public record CreateLevelRequest(@NotNull Long subjectId,
                                     @NotBlank @Size(max=80) String code,
                                     @NotBlank @Size(max=160) String name,
                                     @NotNull LevelType type,
                                     @Size(max=500) String description,
                                     Integer orderIndex) {}
    public record UpdateLevelRequest(@NotBlank @Size(max=80) String code,
                                     @NotBlank @Size(max=160) String name,
                                     @NotNull LevelType type,
                                     @Size(max=500) String description,
                                     Integer orderIndex, boolean active) {}
    public record ImportResponse(Long jobId, int totalRows, int successRows, int failedRows, List<String> errors) {}
}
