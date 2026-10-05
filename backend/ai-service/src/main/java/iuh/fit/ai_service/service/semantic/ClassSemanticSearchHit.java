package iuh.fit.ai_service.service.semantic;

public record ClassSemanticSearchHit(
        String pointId,
        Long classId,
        Long tutorProfileId,
        Long registrationId,
        Long subjectId,
        Long levelId,
        String teachingMode,
        String status,
        double similarity
) {
}
