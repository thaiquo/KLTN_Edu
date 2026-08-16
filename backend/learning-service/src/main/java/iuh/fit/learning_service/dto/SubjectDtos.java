package iuh.fit.learning_service.dto;

import iuh.fit.learning_service.enums.TeachingLevel;

import java.util.Set;

public final class SubjectDtos {
    private SubjectDtos() {
    }

    public record CategoryResponse(Long id, String name) {
    }

    public record GroupResponse(Long id, String name, CategoryResponse category) {
    }

    public record SubjectResponse(
            Long id,
            String name,
            CategoryResponse category,
            GroupResponse group,
            Set<TeachingLevel> supportedLevels
    ) {
    }
}
