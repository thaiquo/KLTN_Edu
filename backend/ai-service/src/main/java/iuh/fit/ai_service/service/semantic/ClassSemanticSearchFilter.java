package iuh.fit.ai_service.service.semantic;

import iuh.fit.ai_service.dto.TutorMatchingDtos.TeachingMode;

public record ClassSemanticSearchFilter(
        Long subjectId,
        Long levelId,
        TeachingMode teachingMode
) {
}
