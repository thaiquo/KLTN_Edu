package iuh.fit.ai_service.service.semantic;

import iuh.fit.ai_service.dto.TutorMatchingDtos.TeachingMode;

import java.util.List;

public final class StudentSemanticSearchDtos {
    private StudentSemanticSearchDtos() {
    }

    public enum SemanticSearchStatus {
        APPLICABLE,
        NOT_APPLICABLE
    }

    public record SemanticSearchRequest(
            Long subjectId,
            String subjectName,
            Long levelId,
            String levelName,
            TeachingMode teachingMode,
            String learningGoal,
            List<String> weakTopics,
            List<String> tutorPreferences,
            Integer topK
    ) {
    }

    public record SemanticSearchResult(
            SemanticSearchStatus status,
            String queryHash,
            int requestedTopK,
            int qdrantRequestedLimit,
            int qdrantHitCount,
            int rejectedHitCount,
            List<SemanticTutorCandidate> candidates
    ) {
    }

    public record SemanticTutorCandidate(
            Long tutorId,
            Long userId,
            Long capabilityId,
            Long subjectId,
            Long levelId,
            TeachingMode teachingMode,
            double semanticSimilarity
    ) {
    }
}
