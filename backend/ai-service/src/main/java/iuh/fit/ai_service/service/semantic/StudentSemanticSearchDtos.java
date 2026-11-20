package iuh.fit.ai_service.service.semantic;

import iuh.fit.ai_service.dto.TutorMatchingDtos.TeachingMode;

import java.util.List;

public final class StudentSemanticSearchDtos {
    private StudentSemanticSearchDtos() {
    }

    public enum SemanticSearchStatus {
        APPLICABLE,
        NO_CONTEXT,
        INDEX_EMPTY,
        QDRANT_UNAVAILABLE,
        EMBEDDING_FAILURE,
        NO_VALID_SEMANTIC_HITS,
        /** @deprecated kept only for clients compiled against the earlier contract. */
        @Deprecated
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
