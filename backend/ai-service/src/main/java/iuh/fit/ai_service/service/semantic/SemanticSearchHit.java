package iuh.fit.ai_service.service.semantic;

public record SemanticSearchHit(
        String pointId,
        Long tutorId,
        Long userId,
        Long capabilityId,
        Long subjectId,
        Long levelId,
        double similarity
) {
}
