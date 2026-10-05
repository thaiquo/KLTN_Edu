package iuh.fit.ai_service.service.semantic;

import iuh.fit.ai_service.dto.TutorMatchingDtos.Level;
import iuh.fit.ai_service.dto.TutorMatchingDtos.SafeLocation;
import iuh.fit.ai_service.dto.TutorMatchingDtos.SubjectCapability;
import iuh.fit.ai_service.dto.TutorMatchingDtos.TeachingMode;
import iuh.fit.ai_service.dto.TutorMatchingDtos.TutorCandidate;
import iuh.fit.ai_service.service.embedding.EmbeddingProperties;
import iuh.fit.ai_service.service.embedding.EmbeddingService;
import iuh.fit.ai_service.service.embedding.EmbeddingVector;
import iuh.fit.ai_service.service.semantic.TutorSemanticIndexDtos.SyncResult;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class TutorSemanticIndexServiceTest {

    @Test
    void pointIdIsDeterministic() {
        String first = SemanticPointIds.tutorCapability(920001L, 10L, 5L, 9L);
        String second = SemanticPointIds.tutorCapability(920001L, 10L, 5L, 9L);

        assertThat(first).isEqualTo(second);
    }

    @Test
    void syncIndexesThenSkipsUnchangedDocument() {
        FakeVectorStore store = new FakeVectorStore();
        TutorSemanticIndexService service = service(store, "Spring Security và JWT");

        SyncResult first = service.sync(null);
        SyncResult second = service.sync(null);

        assertThat(first.indexed()).isEqualTo(1);
        assertThat(first.skipped()).isZero();
        assertThat(second.indexed()).isZero();
        assertThat(second.skipped()).isEqualTo(1);
        assertThat(store.upserts).isEqualTo(1);
        assertThat(store.payloads.values().iterator().next().documentHash()).isNotBlank();
    }

    @Test
    void changedDocumentUpdatesExistingPoint() {
        FakeVectorStore store = new FakeVectorStore();

        service(store, "Spring Security và JWT").sync(null);
        SyncResult changed = service(store, "Spring Security, JWT và phân quyền theo vai trò").sync(null);

        assertThat(changed.indexed()).isEqualTo(1);
        assertThat(changed.skipped()).isZero();
        assertThat(store.upserts).isEqualTo(2);
    }

    @Test
    void deleteUsesDeterministicPointId() {
        FakeVectorStore store = new FakeVectorStore();
        TutorSemanticIndexService service = service(store, "Spring Security và JWT");

        service.delete(920001L, 10L, 5L, 9L);

        assertThat(store.deletedPointId).isEqualTo(SemanticPointIds.tutorCapability(920001L, 10L, 5L, 9L));
    }

    @Test
    void payloadExcludesPrivateFields() {
        FakeVectorStore store = new FakeVectorStore();
        service(store, "Spring Security và JWT").sync(null);

        Map<String, Object> payload = store.payloads.values().iterator().next().toMap();

        assertThat(payload.keySet())
                .contains("tutorId", "userId", "capabilityId", "subjectId", "levelId", "teachingModes")
                .doesNotContain("email", "phone", "exactAddress", "kyc", "contract", "payment");
    }

    private TutorSemanticIndexService service(FakeVectorStore store, String description) {
        return new TutorSemanticIndexService(
                () -> List.of(candidate(description)),
                new TutorSemanticDocumentBuilder(),
                fakeEmbedding(),
                new EmbeddingProperties("gemini", "gemini-embedding-2", 768, "key"),
                store
        );
    }

    private EmbeddingService fakeEmbedding() {
        return text -> new EmbeddingVector(vector(768));
    }

    private TutorCandidate candidate(String description) {
        SubjectCapability capability = new SubjectCapability(
                10L,
                5L,
                "Spring Boot",
                2L,
                "Công nghệ thông tin",
                List.of(new Level(9L, "Đồ án backend")),
                5,
                BigDecimal.valueOf(200000),
                BigDecimal.valueOf(350000),
                description
        );
        return new TutorCandidate(
                920001L,
                910001L,
                "Tutor Dev",
                null,
                "Mentor backend Java Spring",
                true,
                new SafeLocation(null, null, null, null, null),
                Set.of("ONLINE", "OFFLINE"),
                List.of(capability),
                BigDecimal.valueOf(200000),
                List.of(),
                4.8,
                12L,
                3L,
                LocalDateTime.now()
        );
    }

    private List<Float> vector(int size) {
        return java.util.stream.IntStream.range(0, size)
                .mapToObj(index -> index / 1000.0f)
                .toList();
    }

    private static final class FakeVectorStore implements SemanticVectorStore {
        private final Map<String, SemanticPayload> payloads = new LinkedHashMap<>();
        private int upserts;
        private String deletedPointId;

        @Override
        public void initializeCollection() {
        }

        @Override
        public SemanticPayload getPayload(String pointId) {
            return payloads.get(pointId);
        }

        @Override
        public void upsert(String pointId, EmbeddingVector vector, SemanticPayload payload) {
            upserts++;
            payloads.put(pointId, payload);
        }

        @Override
        public void delete(String pointId) {
            deletedPointId = pointId;
            payloads.remove(pointId);
        }

        @Override
        public List<SemanticSearchHit> search(EmbeddingVector queryVector, SemanticSearchFilter filter, int limit) {
            return List.of();
        }
    }
}
