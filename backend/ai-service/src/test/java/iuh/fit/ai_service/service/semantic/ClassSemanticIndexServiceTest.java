package iuh.fit.ai_service.service.semantic;

import iuh.fit.ai_service.client.LearningPublicClassClient;
import iuh.fit.ai_service.dto.ClassMatchingDtos.ChapterBrief;
import iuh.fit.ai_service.dto.ClassMatchingDtos.ClassSchedule;
import iuh.fit.ai_service.dto.ClassMatchingDtos.LevelBrief;
import iuh.fit.ai_service.dto.ClassMatchingDtos.PublicClassSource;
import iuh.fit.ai_service.dto.ClassMatchingDtos.RegistrationBrief;
import iuh.fit.ai_service.dto.TutorMatchingDtos.TeachingMode;
import iuh.fit.ai_service.service.embedding.EmbeddingProperties;
import iuh.fit.ai_service.service.embedding.EmbeddingService;
import iuh.fit.ai_service.service.embedding.EmbeddingVector;
import iuh.fit.ai_service.service.semantic.ClassSemanticIndexDtos.ClassSyncResult;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class ClassSemanticIndexServiceTest {

    @Test
    void pointIdIsDeterministic() {
        assertThat(SemanticPointIds.publicClass(7001L)).isEqualTo(SemanticPointIds.publicClass(7001L));
    }

    @Test
    void syncIndexesThenSkipsUnchangedDocumentAndRemovesStalePoint() {
        FakeClassVectorStore store = new FakeClassVectorStore();
        store.payloads.put("stale", payload(9999L, "stale-hash"));
        ClassSemanticIndexService service = service(store, List.of(publicClass("On thi Toan 12")));

        ClassSyncResult first = service.sync(null);
        ClassSyncResult second = service.sync(null);

        assertThat(first.indexed()).isEqualTo(1);
        assertThat(first.staleRemoved()).isEqualTo(1);
        assertThat(second.indexed()).isZero();
        assertThat(second.skipped()).isEqualTo(1);
        assertThat(store.upserts).isEqualTo(1);
        assertThat(store.deleted).containsExactly("stale");
    }

    @Test
    void changedDocumentUpdatesExistingPoint() {
        FakeClassVectorStore store = new FakeClassVectorStore();
        service(store, List.of(publicClass("On thi Toan 12"))).sync(null);

        ClassSyncResult changed = service(store, List.of(publicClass("On thi Toan 12 nang cao"))).sync(null);

        assertThat(changed.indexed()).isEqualTo(1);
        assertThat(changed.skipped()).isZero();
        assertThat(store.upserts).isEqualTo(2);
    }

    @Test
    void payloadExcludesPrivateFields() {
        FakeClassVectorStore store = new FakeClassVectorStore();
        service(store, List.of(publicClass("On thi Toan 12"))).sync(null);

        Map<String, Object> payload = store.payloads.values().iterator().next().toMap();

        assertThat(payload.keySet())
                .contains("classId", "registrationId", "subjectId", "levelId", "teachingMode", "status")
                .doesNotContain("meetingLink", "joinKey", "tutorEmail", "reviewedByEmail", "payment");
    }

    private ClassSemanticIndexService service(FakeClassVectorStore store, List<PublicClassSource> sources) {
        LearningPublicClassClient client = new LearningPublicClassClient(RestClient.builder(), "http://localhost:8082") {
            @Override
            public List<PublicClassSource> findSemanticSources(
                    List<Long> ids,
                    Long subjectId,
                    Long levelId,
                    TeachingMode teachingMode,
                    boolean availableOnly,
                    Integer max
            ) {
                return sources;
            }
        };
        EmbeddingService embedding = text -> new EmbeddingVector(vector(768));
        return new ClassSemanticIndexService(
                client,
                new ClassSemanticDocumentBuilder(),
                embedding,
                new EmbeddingProperties("gemini", "gemini-embedding-2", 768, "key"),
                store
        );
    }

    private PublicClassSource publicClass(String title) {
        return new PublicClassSource(
                7001L,
                16L,
                new RegistrationBrief(16L, 1L, "Hoc thuat", 2L, "THPT", 6L, "Khoa hoc tu nhien",
                        5L, "Toan", "MATH", BigDecimal.valueOf(200_000), BigDecimal.valueOf(350_000)),
                new LevelBrief(9L, "Lop 12", "GRADE_12"),
                930001L,
                "Nguyen Minh Anh",
                title,
                "On thi tot nghiep mon Toan",
                TeachingMode.ONLINE,
                null,
                12,
                2L,
                10L,
                false,
                BigDecimal.valueOf(250_000),
                BigDecimal.valueOf(3_000_000),
                3,
                90,
                LocalDate.now().plusDays(10),
                LocalDate.now().plusMonths(3),
                36,
                "OPEN_REQUEST",
                "PUBLISHED",
                4.8,
                12L,
                List.of(new ClassSchedule(1L, 2, "18:30", "20:00")),
                List.of(new ChapterBrief(1L, "Ham so", "Khao sat ham so", 4, 1)),
                List.of("Ham so"),
                LocalDateTime.now(),
                LocalDateTime.now()
        );
    }

    private ClassSemanticPayload payload(Long classId, String hash) {
        return new ClassSemanticPayload(
                classId,
                930001L,
                16L,
                5L,
                9L,
                "ONLINE",
                "PUBLISHED",
                SemanticConstants.DOCUMENT_VERSION,
                "gemini-embedding-2",
                768,
                hash,
                java.time.Instant.now()
        );
    }

    private List<Float> vector(int size) {
        return java.util.stream.IntStream.range(0, size)
                .mapToObj(index -> index / 1000.0f)
                .toList();
    }

    private static final class FakeClassVectorStore implements ClassSemanticVectorStore {
        private final Map<String, ClassSemanticPayload> payloads = new LinkedHashMap<>();
        private final List<String> deleted = new java.util.ArrayList<>();
        private int upserts;

        @Override
        public void initializeCollection() {
        }

        @Override
        public ClassSemanticPayload getPayload(String pointId) {
            return payloads.get(pointId);
        }

        @Override
        public void upsert(String pointId, EmbeddingVector vector, ClassSemanticPayload payload) {
            upserts++;
            payloads.put(pointId, payload);
        }

        @Override
        public void delete(String pointId) {
            deleted.add(pointId);
            payloads.remove(pointId);
        }

        @Override
        public List<ClassSemanticStoredPoint> listPayloads() {
            return payloads.entrySet().stream()
                    .map(entry -> new ClassSemanticStoredPoint(entry.getKey(), entry.getValue()))
                    .toList();
        }

        @Override
        public List<ClassSemanticSearchHit> search(EmbeddingVector queryVector, ClassSemanticSearchFilter filter, int limit) {
            return List.of();
        }
    }
}
