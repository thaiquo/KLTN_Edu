package iuh.fit.ai_service.service.semantic;

import iuh.fit.ai_service.dto.TutorMatchingDtos.TeachingMode;

import java.util.Set;

public record TutorSemanticCapability(
        String pointId,
        Long tutorId,
        Long userId,
        Long registrationId,
        Long subjectId,
        String subjectName,
        Long categoryId,
        String categoryName,
        Long levelId,
        String levelName,
        Integer experienceYears,
        String description,
        String tutorBio,
        Set<TeachingMode> teachingModes,
        String semanticDocument,
        String documentHash
) {
}
