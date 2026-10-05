package iuh.fit.ai_service.service.semantic;

import iuh.fit.ai_service.client.TutorCandidateClient;
import iuh.fit.ai_service.dto.TutorMatchingDtos.Level;
import iuh.fit.ai_service.dto.TutorMatchingDtos.SubjectCapability;
import iuh.fit.ai_service.dto.TutorMatchingDtos.TeachingMode;
import iuh.fit.ai_service.dto.TutorMatchingDtos.TutorCandidate;
import iuh.fit.ai_service.service.embedding.EmbeddingVector;
import iuh.fit.ai_service.service.semantic.StudentSemanticSearchDtos.SemanticSearchRequest;
import iuh.fit.ai_service.service.semantic.StudentSemanticSearchDtos.SemanticSearchStatus;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClientException;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class StudentSemanticSearchServiceTest {

    @Test
    void nonSemanticRequestSkipsEmbeddingAndQdrant() {
        FakeEmbeddingService embedding = new FakeEmbeddingService();
        FakeStore store = new FakeStore();
        StudentSemanticSearchService service = service(embedding, store, new FakeTutorClient());

        var result = service.search(new SemanticSearchRequest(
                5L,
                "Spring Boot",
                9L,
                "Do an backend",
                TeachingMode.ONLINE,
                null,
                List.of(),
                List.of(),
                7
        ));

        assertThat(result.status()).isEqualTo(SemanticSearchStatus.NOT_APPLICABLE);
        assertThat(result.requestedTopK()).isEqualTo(7);
        assertThat(result.candidates()).isEmpty();
        assertThat(embedding.calls).isZero();
        assertThat(store.initialized).isFalse();
        assertThat(store.searchCalls).isZero();
    }

    @Test
    void searchPassesHardScopeAndReturnsValidatedDeduplicatedCandidates() {
        FakeStore store = new FakeStore();
        store.hits = List.of(
                hit("a-low", 920001L, 920001L, 16L, 5L, 9L, 0.81),
                hit("a-best", 920001L, 920001L, 17L, 5L, 9L, 0.88),
                hit("b", 920002L, 920002L, 18L, 5L, 9L, 0.84),
                hit("stale-missing-capability", 920002L, 920002L, 99L, 5L, 9L, 0.99),
                hit("wrong-level", 920003L, 920003L, 19L, 5L, 10L, 0.90)
        );
        FakeTutorClient client = new FakeTutorClient();
        client.candidates = List.of(
                candidate(920001L, 16L, 17L),
                candidate(920002L, 18L),
                candidate(920003L, 19L)
        );
        StudentSemanticSearchService service = service(new FakeEmbeddingService(), store, client);

        var result = service.search(semanticRequest(2));

        assertThat(result.status()).isEqualTo(SemanticSearchStatus.APPLICABLE);
        assertThat(result.requestedTopK()).isEqualTo(2);
        assertThat(result.qdrantRequestedLimit()).isEqualTo(6);
        assertThat(result.qdrantHitCount()).isEqualTo(5);
        assertThat(result.rejectedHitCount()).isEqualTo(2);
        assertThat(result.candidates())
                .extracting("tutorId")
                .containsExactly(920001L, 920002L);
        assertThat(result.candidates().getFirst().capabilityId()).isEqualTo(17L);
        assertThat(result.candidates().getFirst().semanticSimilarity()).isEqualTo(0.88);
        assertThat(store.filter).isEqualTo(new SemanticSearchFilter(5L, 9L, TeachingMode.ONLINE));
        assertThat(store.limit).isEqualTo(6);
        assertThat(client.subjectId).isEqualTo(5L);
        assertThat(client.levelId).isEqualTo(9L);
        assertThat(client.teachingMode).isEqualTo(TeachingMode.ONLINE);
    }

    @Test
    void equalSimilarityKeepsLowerCapabilityIdForSameTutor() {
        FakeStore store = new FakeStore();
        store.hits = List.of(
                hit("a-17", 920001L, 920001L, 17L, 5L, 9L, 0.88),
                hit("a-16", 920001L, 920001L, 16L, 5L, 9L, 0.88)
        );
        FakeTutorClient client = new FakeTutorClient();
        client.candidates = List.of(candidate(920001L, 16L, 17L));
        StudentSemanticSearchService service = service(new FakeEmbeddingService(), store, client);

        var result = service.search(semanticRequest(5));

        assertThat(result.candidates()).hasSize(1);
        assertThat(result.candidates().getFirst().capabilityId()).isEqualTo(16L);
    }

    @Test
    void allStaleHitsReturnEmptyValidatedCandidates() {
        FakeStore store = new FakeStore();
        store.hits = List.of(hit("stale", 920001L, 920001L, 99L, 5L, 9L, 0.91));
        FakeTutorClient client = new FakeTutorClient();
        client.candidates = List.of(candidate(920001L, 16L));
        StudentSemanticSearchService service = service(new FakeEmbeddingService(), store, client);

        var result = service.search(semanticRequest(null));

        assertThat(result.qdrantHitCount()).isEqualTo(1);
        assertThat(result.rejectedHitCount()).isEqualTo(1);
        assertThat(result.candidates()).isEmpty();
    }

    @Test
    void meaningfulTutorPreferenceMakesSemanticSearchApplicable() {
        FakeEmbeddingService embedding = new FakeEmbeddingService();
        FakeStore store = new FakeStore();
        FakeTutorClient client = new FakeTutorClient();
        client.candidates = List.of(candidate(920001L, 16L));
        store.hits = List.of(hit("a", 920001L, 920001L, 16L, 5L, 9L, 0.82));
        StudentSemanticSearchService service = service(embedding, store, client);

        var result = service.search(new SemanticSearchRequest(
                5L,
                "Spring Boot",
                9L,
                "Do an backend",
                TeachingMode.ONLINE,
                " ",
                List.of(" "),
                List.of("can giai thich cham"),
                null
        ));

        assertThat(result.status()).isEqualTo(SemanticSearchStatus.APPLICABLE);
        assertThat(embedding.calls).isEqualTo(1);
    }

    @Test
    void missingHardScopeForApplicableSearchFailsBeforeProviderCall() {
        FakeEmbeddingService embedding = new FakeEmbeddingService();
        StudentSemanticSearchService service = service(embedding, new FakeStore(), new FakeTutorClient());

        assertThatThrownBy(() -> service.search(new SemanticSearchRequest(
                5L,
                "Spring Boot",
                null,
                null,
                TeachingMode.ONLINE,
                "Can hoc Spring Security",
                List.of(),
                List.of(),
                null
        ))).isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("subjectId, levelId, and teachingMode");
        assertThat(embedding.calls).isZero();
    }

    @Test
    void qdrantUnavailableIsNotFabricated() {
        FakeStore store = new FakeStore();
        store.fail = true;
        StudentSemanticSearchService service = service(new FakeEmbeddingService(), store, new FakeTutorClient());

        assertThatThrownBy(() -> service.search(semanticRequest(null)))
                .isInstanceOf(SemanticVectorStoreException.class);
    }

    @Test
    void embeddingFailureIsNotFabricated() {
        FakeEmbeddingService embedding = new FakeEmbeddingService();
        embedding.fail = true;
        StudentSemanticSearchService service = service(embedding, new FakeStore(), new FakeTutorClient());

        assertThatThrownBy(() -> service.search(semanticRequest(null)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("embedding unavailable");
    }

    @Test
    void authoritativeServiceFailureIsControlled() {
        FakeTutorClient client = new FakeTutorClient();
        client.fail = true;
        FakeStore store = new FakeStore();
        store.hits = List.of(hit("a", 920001L, 920001L, 16L, 5L, 9L, 0.82));
        StudentSemanticSearchService service = service(new FakeEmbeddingService(), store, client);

        assertThatThrownBy(() -> service.search(semanticRequest(null)))
                .isInstanceOf(SemanticAuthoritativeValidationException.class);
    }

    private StudentSemanticSearchService service(
            FakeEmbeddingService embedding,
            FakeStore store,
            FakeTutorClient tutorClient
    ) {
        return new StudentSemanticSearchService(
                new StudentSemanticQueryBuilder(),
                embedding,
                store,
                tutorClient,
                new QdrantProperties("http://localhost:6333", "tutor_capabilities_v1", 768, 20)
        );
    }

    private SemanticSearchRequest semanticRequest(Integer topK) {
        return new SemanticSearchRequest(
                5L,
                "Spring Boot",
                9L,
                "Do an backend",
                TeachingMode.ONLINE,
                "Em yeu Spring Security va JWT.",
                List.of("JWT"),
                List.of("huong dan do an"),
                topK
        );
    }

    private static SemanticSearchHit hit(
            String pointId,
            Long tutorId,
            Long userId,
            Long capabilityId,
            Long subjectId,
            Long levelId,
            double score
    ) {
        return new SemanticSearchHit(pointId, tutorId, userId, capabilityId, subjectId, levelId, score);
    }

    private static TutorCandidate candidate(Long tutorId, Long... capabilityIds) {
        List<SubjectCapability> subjects = java.util.Arrays.stream(capabilityIds)
                .map(capabilityId -> new SubjectCapability(
                        capabilityId,
                        5L,
                        "Spring Boot",
                        6L,
                        "Lap trinh backend",
                        List.of(new Level(9L, "Do an backend")),
                        5,
                        BigDecimal.valueOf(250_000),
                        BigDecimal.valueOf(350_000),
                        "Spring Security va JWT"
                ))
                .toList();
        return new TutorCandidate(
                tutorId,
                tutorId,
                "Tutor " + tutorId,
                null,
                "Backend tutor",
                true,
                null,
                Set.of("ONLINE", "OFFLINE"),
                subjects,
                BigDecimal.valueOf(250_000),
                List.of(),
                4.8,
                12L,
                3L,
                null
        );
    }

    private static List<Float> vector(int size) {
        return java.util.stream.IntStream.range(0, size)
                .mapToObj(index -> index / 1000.0f)
                .toList();
    }

    private static final class FakeEmbeddingService implements iuh.fit.ai_service.service.embedding.EmbeddingService {
        private int calls;
        private boolean fail;

        @Override
        public EmbeddingVector embed(String text) {
            calls++;
            if (fail) {
                throw new IllegalStateException("embedding unavailable");
            }
            return new EmbeddingVector(vector(768));
        }
    }

    private static final class FakeTutorClient implements TutorCandidateClient {
        private List<TutorCandidate> candidates = List.of();
        private boolean fail;
        private Long subjectId;
        private Long levelId;
        private TeachingMode teachingMode;

        @Override
        public List<TutorCandidate> findCandidates(Long subjectId, Long levelId, TeachingMode teachingMode) {
            if (fail) {
                throw new RestClientException("account unavailable");
            }
            this.subjectId = subjectId;
            this.levelId = levelId;
            this.teachingMode = teachingMode;
            return candidates;
        }
    }

    private static final class FakeStore implements SemanticVectorStore {
        private SemanticSearchFilter filter;
        private int limit;
        private int searchCalls;
        private boolean initialized;
        private boolean fail;
        private List<SemanticSearchHit> hits = List.of();

        @Override
        public void initializeCollection() {
            initialized = true;
            if (fail) {
                throw new SemanticVectorStoreException("Qdrant unavailable");
            }
        }

        @Override
        public SemanticPayload getPayload(String pointId) {
            return null;
        }

        @Override
        public void upsert(String pointId, EmbeddingVector vector, SemanticPayload payload) {
        }

        @Override
        public void delete(String pointId) {
        }

        @Override
        public List<SemanticSearchHit> search(EmbeddingVector queryVector, SemanticSearchFilter filter, int limit) {
            searchCalls++;
            this.filter = filter;
            this.limit = limit;
            return hits;
        }
    }
}
