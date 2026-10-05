package iuh.fit.ai_service.service.semantic;

import iuh.fit.ai_service.dto.TutorMatchingDtos.TeachingMode;

import java.util.List;

public final class ClassSemanticSearchDtos {
    private ClassSemanticSearchDtos() {
    }

    public enum ClassSemanticSearchStatus {
        APPLICABLE,
        NOT_APPLICABLE,
        FALLBACK
    }

    public record ClassSemanticSearchRequest(
            Long subjectId,
            String subjectName,
            Long levelId,
            String levelName,
            TeachingMode teachingMode,
            String learningGoal,
            List<String> weakTopics,
            List<String> classPreferences,
            Integer topK
    ) {
    }

    public record ClassSemanticSearchResult(
            ClassSemanticSearchStatus status,
            String queryHash,
            int requestedTopK,
            int qdrantLimit,
            int rawHits,
            int rejectedHits,
            List<SemanticClassCandidate> candidates
    ) {
    }

    public record SemanticClassCandidate(
            Long classId,
            Long tutorProfileId,
            Long registrationId,
            Long subjectId,
            Long levelId,
            TeachingMode teachingMode,
            double semanticSimilarity
    ) {
    }
}
