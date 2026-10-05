package iuh.fit.ai_service.service.semantic;

import iuh.fit.ai_service.client.LearningPublicClassClient;
import iuh.fit.ai_service.dto.ClassMatchingDtos.PublicClassSource;
import iuh.fit.ai_service.dto.TutorMatchingDtos.TeachingMode;
import iuh.fit.ai_service.service.embedding.EmbeddingService;
import iuh.fit.ai_service.service.embedding.EmbeddingVector;
import iuh.fit.ai_service.service.semantic.ClassSemanticQueryBuilder.ClassSemanticQueryInput;
import iuh.fit.ai_service.service.semantic.ClassSemanticSearchDtos.ClassSemanticSearchRequest;
import iuh.fit.ai_service.service.semantic.ClassSemanticSearchDtos.ClassSemanticSearchResult;
import iuh.fit.ai_service.service.semantic.ClassSemanticSearchDtos.ClassSemanticSearchStatus;
import iuh.fit.ai_service.service.semantic.ClassSemanticSearchDtos.SemanticClassCandidate;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClientException;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
public class ClassSemanticSearchService {
    private final ClassSemanticQueryBuilder queryBuilder;
    private final EmbeddingService embeddingService;
    private final ClassSemanticVectorStore vectorStore;
    private final LearningPublicClassClient publicClassClient;
    private final ClassQdrantProperties properties;

    public ClassSemanticSearchService(
            ClassSemanticQueryBuilder queryBuilder,
            EmbeddingService embeddingService,
            ClassSemanticVectorStore vectorStore,
            LearningPublicClassClient publicClassClient,
            ClassQdrantProperties properties
    ) {
        this.queryBuilder = queryBuilder;
        this.embeddingService = embeddingService;
        this.vectorStore = vectorStore;
        this.publicClassClient = publicClassClient;
        this.properties = properties;
    }

    public ClassSemanticSearchResult search(ClassSemanticSearchRequest request) {
        int topK = requestedTopK(request);
        if (!hasMeaningfulSemanticContext(request)) {
            return new ClassSemanticSearchResult(
                    ClassSemanticSearchStatus.NOT_APPLICABLE,
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
        String query = queryBuilder.build(new ClassSemanticQueryInput(
                request.subjectName(),
                request.levelName(),
                request.learningGoal(),
                request.weakTopics(),
                request.classPreferences()
        ));
        EmbeddingVector vector = embeddingService.embed(query);
        int qdrantLimit = Math.max(topK, topK * 3);
        List<ClassSemanticSearchHit> hits = vectorStore.search(
                vector,
                new ClassSemanticSearchFilter(request.subjectId(), request.levelId(), request.teachingMode()),
                qdrantLimit
        );
        List<PublicClassSource> authoritative = findAuthoritativeCandidates(request);
        Map<Long, PublicClassSource> authoritativeByClassId = new LinkedHashMap<>();
        for (PublicClassSource source : authoritative) {
            if (source != null && source.id() != null) {
                authoritativeByClassId.putIfAbsent(source.id(), source);
            }
        }
        DeduplicationResult deduplicated = deduplicateValidCandidates(request, hits, authoritativeByClassId);
        return new ClassSemanticSearchResult(
                ClassSemanticSearchStatus.APPLICABLE,
                SemanticHash.sha256(query),
                topK,
                qdrantLimit,
                hits.size(),
                hits.size() - deduplicated.validHitCount(),
                deduplicated.candidates()
        );
    }

    private int requestedTopK(ClassSemanticSearchRequest request) {
        return request == null || request.topK() == null || request.topK() <= 0 ? properties.topK() : request.topK();
    }

    private boolean hasMeaningfulSemanticContext(ClassSemanticSearchRequest request) {
        if (request == null) {
            return false;
        }
        return StringUtils.hasText(request.learningGoal())
                || hasTextItem(request.weakTopics())
                || hasTextItem(request.classPreferences());
    }

    private boolean hasTextItem(List<String> values) {
        return values != null && values.stream().anyMatch(StringUtils::hasText);
    }

    private void validateHardScope(ClassSemanticSearchRequest request) {
        if (request.subjectId() == null || request.levelId() == null || request.teachingMode() == null) {
            throw new IllegalArgumentException("Class semantic retrieval requires subjectId, levelId, and teachingMode.");
        }
    }

    private List<PublicClassSource> findAuthoritativeCandidates(ClassSemanticSearchRequest request) {
        try {
            return publicClassClient.findSemanticSources(null, request.subjectId(), request.levelId(), request.teachingMode(), true, null);
        } catch (RestClientException exception) {
            throw new SemanticAuthoritativeValidationException("Authoritative class validation is unavailable.", exception);
        }
    }

    private DeduplicationResult deduplicateValidCandidates(
            ClassSemanticSearchRequest request,
            List<ClassSemanticSearchHit> hits,
            Map<Long, PublicClassSource> authoritativeByClassId
    ) {
        Map<Long, SemanticClassCandidate> bestByClass = new LinkedHashMap<>();
        int validHitCount = 0;
        for (ClassSemanticSearchHit hit : hits == null ? List.<ClassSemanticSearchHit>of() : hits) {
            SemanticClassCandidate candidate = validateHit(request, hit, authoritativeByClassId);
            if (candidate == null) {
                continue;
            }
            validHitCount++;
            bestByClass.merge(candidate.classId(), candidate, this::bestCandidate);
        }
        List<SemanticClassCandidate> candidates = bestByClass.values().stream()
                .sorted(Comparator.comparingDouble(SemanticClassCandidate::semanticSimilarity).reversed()
                        .thenComparing(SemanticClassCandidate::classId))
                .limit(requestedTopK(request))
                .toList();
        return new DeduplicationResult(validHitCount, candidates);
    }

    private SemanticClassCandidate validateHit(
            ClassSemanticSearchRequest request,
            ClassSemanticSearchHit hit,
            Map<Long, PublicClassSource> authoritativeByClassId
    ) {
        if (hit == null
                || hit.classId() == null
                || !Objects.equals(hit.subjectId(), request.subjectId())
                || !Objects.equals(hit.levelId(), request.levelId())) {
            return null;
        }
        PublicClassSource source = authoritativeByClassId.get(hit.classId());
        if (!isAuthoritativeMatch(request, source)) {
            return null;
        }
        return new SemanticClassCandidate(
                hit.classId(),
                hit.tutorProfileId(),
                hit.registrationId(),
                hit.subjectId(),
                hit.levelId(),
                request.teachingMode(),
                hit.similarity()
        );
    }

    private boolean isAuthoritativeMatch(ClassSemanticSearchRequest request, PublicClassSource source) {
        if (source == null || source.registration() == null || source.level() == null || source.learningMode() == null) {
            return false;
        }
        String status = source.status();
        boolean publicStatus = "PUBLISHED".equalsIgnoreCase(status) || "ACTIVE".equalsIgnoreCase(status);
        return publicStatus
                && Objects.equals(source.registration().subjectId(), request.subjectId())
                && Objects.equals(source.level().id(), request.levelId())
                && source.learningMode() == request.teachingMode()
                && source.availableSlots() != null
                && source.availableSlots() > 0;
    }

    private SemanticClassCandidate bestCandidate(SemanticClassCandidate current, SemanticClassCandidate next) {
        return next.semanticSimilarity() > current.semanticSimilarity() ? next : current;
    }

    private record DeduplicationResult(int validHitCount, List<SemanticClassCandidate> candidates) {
    }
}
