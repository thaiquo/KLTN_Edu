package iuh.fit.ai_service.service.semantic;

import iuh.fit.ai_service.dto.ClassMatchingDtos.PublicClassSource;
import iuh.fit.ai_service.dto.TutorMatchingDtos.TeachingMode;

public record ClassSemanticDocument(
        String pointId,
        Long classId,
        Long tutorProfileId,
        Long registrationId,
        Long subjectId,
        Long levelId,
        TeachingMode teachingMode,
        String status,
        String semanticDocument,
        String documentHash,
        PublicClassSource source
) {
}
