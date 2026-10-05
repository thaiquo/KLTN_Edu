package iuh.fit.ai_service.service.semantic;

import iuh.fit.ai_service.dto.TutorMatchingDtos.TeachingMode;

public record SemanticSearchFilter(
        Long subjectId,
        Long levelId,
        TeachingMode teachingMode
) {
}
