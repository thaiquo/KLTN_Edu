package iuh.fit.ai_service.service.semantic;

import iuh.fit.ai_service.client.TutorCandidateClient;
import iuh.fit.ai_service.dto.TutorMatchingDtos.SubjectCapability;
import iuh.fit.ai_service.dto.TutorMatchingDtos.TeachingMode;
import iuh.fit.ai_service.dto.TutorMatchingDtos.TutorCandidate;
import iuh.fit.ai_service.service.embedding.EmbeddingService;
import iuh.fit.ai_service.service.embedding.EmbeddingVector;
import iuh.fit.ai_service.service.semantic.StudentSemanticQueryBuilder.StudentSemanticQueryInput;
import iuh.fit.ai_service.service.semantic.StudentSemanticSearchDtos.SemanticSearchRequest;
import iuh.fit.ai_service.service.semantic.StudentSemanticSearchDtos.SemanticSearchResult;
import iuh.fit.ai_service.service.semantic.StudentSemanticSearchDtos.SemanticSearchStatus;
import iuh.fit.ai_service.service.semantic.StudentSemanticSearchDtos.SemanticTutorCandidate;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClientException;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
public class StudentSemanticSearchService {
    private final StudentSemanticQueryBuilder queryBuilder;
    private final EmbeddingService embeddingService;
    private final SemanticVectorStore vectorStore;
    private final TutorCandidateClient tutorCandidateClient;
    private final QdrantProperties properties;

    public StudentSemanticSearchService(
            StudentSemanticQueryBuilder queryBuilder,
            EmbeddingService embeddingService,
            SemanticVectorStore vectorStore,
            TutorCandidateClient tutorCandidateClient,
            QdrantProperties properties
    ) {
        this.queryBuilder = queryBuilder;
        this.embeddingService = embeddingService;
        this.vectorStore = vectorStore;
        this.tutorCandidateClient = tutorCandidateClient;
        this.properties = properties;
    }

    public SemanticSearchResult search(SemanticSearchRequest request) {
        int topK = requestedTopK(request);
        if (!hasMeaningfulSemanticContext(request)) {
            return new SemanticSearchResult(
                    SemanticSearchStatus.NOT_APPLICABLE,
                    null,
                    topK,
                    0,
                    0,
                    0,
                    List.of()
            );
        }
        validateHardScope(request);
        vectorStore.initializeCollection();
        String query = queryBuilder.build(new StudentSemanticQueryInput(
                request.subjectName(),
                request.levelName(),
                request.learningGoal(),
                request.weakTopics(),
                request.tutorPreferences()
        ));
        EmbeddingVector vector = embeddingService.embed(query);
        int qdrantLimit = qdrantCandidateLimit(topK);
        List<SemanticSearchHit> hits = vectorStore.search(
                vector,
                new SemanticSearchFilter(request.subjectId(), request.levelId(), request.teachingMode()),
                qdrantLimit
        );
        List<TutorCandidate> authoritativeCandidates = findAuthoritativeCandidates(request);
        Map<Long, TutorCandidate> authoritativeByTutorId = new LinkedHashMap<>();
        for (TutorCandidate candidate : authoritativeCandidates) {
            if (candidate != null && candidate.tutorId() != null) {
                authoritativeByTutorId.putIfAbsent(candidate.tutorId(), candidate);
            }
        }
        DeduplicationResult deduplicated = deduplicateValidCandidates(request, hits, authoritativeByTutorId);
        return new SemanticSearchResult(
                SemanticSearchStatus.APPLICABLE,
                SemanticHash.sha256(query),
                topK,
                qdrantLimit,
                hits.size(),
                hits.size() - deduplicated.validHitCount(),
                deduplicated.candidates()
        );
    }

    private int requestedTopK(SemanticSearchRequest request) {
        return request == null || request.topK() == null || request.topK() <= 0 ? properties.topK() : request.topK();
    }

    private int qdrantCandidateLimit(int topK) {
        return Math.max(topK, topK * 3);
    }

    private boolean hasMeaningfulSemanticContext(SemanticSearchRequest request) {
        if (request == null) {
            return false;
        }
        return StringUtils.hasText(request.learningGoal())
                || hasTextItem(request.weakTopics())
                || hasTextItem(request.tutorPreferences());
    }

    private boolean hasTextItem(List<String> values) {
        return values != null && values.stream().anyMatch(StringUtils::hasText);
    }

    private void validateHardScope(SemanticSearchRequest request) {
        if (request.subjectId() == null || request.levelId() == null || request.teachingMode() == null) {
            throw new IllegalArgumentException("Semantic retrieval requires subjectId, levelId, and teachingMode.");
        }
    }

    private List<TutorCandidate> findAuthoritativeCandidates(SemanticSearchRequest request) {
        try {
            return tutorCandidateClient.findCandidates(request.subjectId(), request.levelId(), request.teachingMode());
        } catch (RestClientException exception) {
            throw new SemanticAuthoritativeValidationException("Authoritative tutor validation is unavailable.", exception);
        }
    }

    private DeduplicationResult deduplicateValidCandidates(
            SemanticSearchRequest request,
            List<SemanticSearchHit> hits,
            Map<Long, TutorCandidate> authoritativeByTutorId
    ) {
        Map<Long, SemanticTutorCandidate> bestByTutor = new LinkedHashMap<>();
        int validHitCount = 0;
        for (SemanticSearchHit hit : hits == null ? List.<SemanticSearchHit>of() : hits) {
            SemanticTutorCandidate candidate = validateHit(request, hit, authoritativeByTutorId);
            if (candidate == null) {
                continue;
            }
            validHitCount++;
            bestByTutor.merge(candidate.tutorId(), candidate, this::bestCandidate);
        }
        List<SemanticTutorCandidate> candidates = bestByTutor.values().stream()
                .sorted(Comparator.comparingDouble(SemanticTutorCandidate::semanticSimilarity).reversed()
                        .thenComparing(SemanticTutorCandidate::tutorId)
                        .thenComparing(SemanticTutorCandidate::capabilityId))
                .limit(requestedTopK(request))
                .toList();
        return new DeduplicationResult(validHitCount, candidates);
    }

    private SemanticTutorCandidate validateHit(
            SemanticSearchRequest request,
            SemanticSearchHit hit,
            Map<Long, TutorCandidate> authoritativeByTutorId
    ) {
        if (hit == null
                || hit.tutorId() == null
                || hit.userId() == null
                || hit.capabilityId() == null
                || !Objects.equals(hit.subjectId(), request.subjectId())
                || !Objects.equals(hit.levelId(), request.levelId())) {
            return null;
        }
        TutorCandidate tutor = authoritativeByTutorId.get(hit.tutorId());
        if (tutor == null || !supportsTeachingMode(tutor, request.teachingMode())) {
            return null;
        }
        SubjectCapability capability = tutor.subjects() == null ? null : tutor.subjects().stream()
                .filter(item -> Objects.equals(item.registrationId(), hit.capabilityId()))
                .filter(item -> Objects.equals(item.subjectId(), request.subjectId()))
                .filter(item -> item.levels() != null && item.levels().stream()
                        .anyMatch(level -> Objects.equals(level.levelId(), request.levelId())))
                .findFirst()
                .orElse(null);
        if (capability == null) {
            return null;
        }
        return new SemanticTutorCandidate(
                hit.tutorId(),
                hit.userId(),
                hit.capabilityId(),
                hit.subjectId(),
                hit.levelId(),
                request.teachingMode(),
                hit.similarity()
        );
    }

    private boolean supportsTeachingMode(TutorCandidate tutor, TeachingMode teachingMode) {
        return tutor.teachingModes() != null && tutor.teachingModes().stream()
                .filter(StringUtils::hasText)
                .map(String::trim)
                .anyMatch(value -> value.equalsIgnoreCase(teachingMode.name()));
    }

    private SemanticTutorCandidate bestCandidate(SemanticTutorCandidate current, SemanticTutorCandidate next) {
        int similarity = Double.compare(next.semanticSimilarity(), current.semanticSimilarity());
        if (similarity > 0) {
            return next;
        }
        if (similarity < 0) {
            return current;
        }
        return next.capabilityId() < current.capabilityId() ? next : current;
    }

    private record DeduplicationResult(int validHitCount, List<SemanticTutorCandidate> candidates) {
    }
}
