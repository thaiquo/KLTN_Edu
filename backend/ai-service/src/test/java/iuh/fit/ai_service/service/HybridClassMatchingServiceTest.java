package iuh.fit.ai_service.service;

import iuh.fit.ai_service.client.LearningPublicClassClient;
import iuh.fit.ai_service.dto.ClassMatchingDtos.ClassMatchingRequest;
import iuh.fit.ai_service.dto.ClassMatchingDtos.ClassMatchingResponse;
import iuh.fit.ai_service.dto.ClassMatchingDtos.ClassSchedule;
import iuh.fit.ai_service.dto.ClassMatchingDtos.LevelBrief;
import iuh.fit.ai_service.dto.ClassMatchingDtos.PublicClassSource;
import iuh.fit.ai_service.dto.ClassMatchingDtos.RegistrationBrief;
import iuh.fit.ai_service.dto.ClassRequirementGroundingDtos.GroundedClassRequirement;
import iuh.fit.ai_service.dto.RequirementAnalysisDtos.Budget;
import iuh.fit.ai_service.dto.RequirementAnalysisDtos.PreferredSchedule;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.CatalogItem;
import iuh.fit.ai_service.dto.TutorMatchingDtos.TeachingMode;
import iuh.fit.ai_service.service.semantic.ClassSemanticSearchDtos.ClassSemanticSearchRequest;
import iuh.fit.ai_service.service.semantic.ClassSemanticSearchDtos.ClassSemanticSearchResult;
import iuh.fit.ai_service.service.semantic.ClassSemanticSearchDtos.ClassSemanticSearchStatus;
import iuh.fit.ai_service.service.semantic.ClassSemanticSearchDtos.SemanticClassCandidate;
import iuh.fit.ai_service.service.semantic.ClassSemanticSearchService;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class HybridClassMatchingServiceTest {
    private static final Long SUBJECT_ID = 5L;
    private static final Long LEVEL_ID = 9L;

    @Test
    void semanticFailureFallsBackToStructuredV1() {
        FakeClassSemanticSearchService semantic = new FakeClassSemanticSearchService(new IllegalStateException("qdrant unavailable"));

        ClassMatchingResponse response = service(classes(), semantic, true).match(request());

        assertThat(response.rankingMode()).isEqualTo("STRUCTURED_V1");
        assertThat(response.results()).extracting("classId").containsExactly(7001L, 7002L, 7003L);
        assertThat(response.results()).allSatisfy(result -> assertThat(result.scoreBreakdown().semantic().applicable()).isFalse());
    }

    @Test
    void semanticCandidateCannotIntroduceIneligibleClass() {
        FakeClassSemanticSearchService semantic = new FakeClassSemanticSearchService(applicable(List.of(
                semanticCandidate(9999L, 0.99),
                semanticCandidate(7003L, 0.88)
        )));

        ClassMatchingResponse response = service(classes(), semantic, true).match(request());

        assertThat(response.results()).extracting("classId").doesNotContain(9999L);
        assertThat(response.results()).extracting("classId").contains(7003L);
    }

    @Test
    void missingSemanticVectorKeepsEligibleClassWithoutPenalty() {
        FakeClassSemanticSearchService semantic = new FakeClassSemanticSearchService(applicable(List.of(
                semanticCandidate(7003L, 0.92),
                semanticCandidate(7001L, 0.86)
        )));

        ClassMatchingResponse response = service(classes(), semantic, true).match(request());

        var withoutVector = response.results().stream()
                .filter(result -> result.classId().equals(7002L))
                .findFirst()
                .orElseThrow();
        assertThat(withoutVector.scoreBreakdown().semantic().applicable()).isTrue();
        assertThat(withoutVector.scoreBreakdown().semantic().used()).isFalse();
        assertThat(withoutVector.scoreBreakdown().semantic().rankBoost()).isEqualByComparingTo("0.0000");
    }

    @Test
    void semanticBoostIsBoundedAndCanOnlyReorderCloseCandidates() {
        FakeClassSemanticSearchService semantic = new FakeClassSemanticSearchService(applicable(List.of(
                semanticCandidate(7003L, 0.92),
                semanticCandidate(7001L, 0.86),
                semanticCandidate(7002L, 0.80)
        )));

        ClassMatchingResponse structured = service(classes(), semantic, false).match(request());
        ClassMatchingResponse hybrid = service(classes(), semantic, true).match(request());

        assertThat(structured.results()).extracting("classId").containsExactly(7001L, 7002L, 7003L);
        assertThat(hybrid.results()).extracting("classId").containsExactly(7001L, 7003L, 7002L);
        assertThat(hybrid.results()).allSatisfy(result -> assertThat(result.matchPercentage()).isBetween(0, 100));
        assertThat(hybrid.results().get(1).scoreBreakdown().semantic().rankBoost()).isLessThanOrEqualTo(BigDecimal.valueOf(3).setScale(4));
    }

    private ClassMatchingService service(List<PublicClassSource> classes, ClassSemanticSearchService semantic, boolean hybridEnabled) {
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
                return classes;
            }
        };
        return new ClassMatchingService(client, semantic, new ClassHybridMatchingProperties(hybridEnabled, 3.0));
    }

    private ClassMatchingRequest request() {
        return new ClassMatchingRequest(new GroundedClassRequirement(
                new CatalogItem(SUBJECT_ID, "MATH", "Toan", null),
                new CatalogItem(LEVEL_ID, "GRADE_12", "Lop 12", null),
                TeachingMode.ONLINE,
                new Budget(BigDecimal.valueOf(200_000), BigDecimal.valueOf(260_000), BigDecimal.valueOf(240_000), "VND", "SESSION", true),
                List.of(new PreferredSchedule(2, "18:00", "21:00", null)),
                "On thi tot nghiep va can nam chac ham so",
                List.of("Ham so"),
                List.of("Lop nho"),
                null
        ), 10);
    }

    private List<PublicClassSource> classes() {
        return List.of(
                publicClass(7001L, BigDecimal.valueOf(230_000), 4.8, 12L, 10L),
                publicClass(7002L, BigDecimal.valueOf(250_000), 4.5, 8L, 10L),
                publicClass(7003L, BigDecimal.valueOf(270_000), 4.7, 10L, 10L),
                publicClass(7004L, BigDecimal.valueOf(240_000), 4.9, 20L, 0L)
        );
    }

    private PublicClassSource publicClass(Long id, BigDecimal price, Double rating, Long reviewCount, Long slots) {
        return new PublicClassSource(
                id,
                16L,
                new RegistrationBrief(16L, 1L, "Hoc thuat", 2L, "THPT", 6L, "Khoa hoc tu nhien",
                        SUBJECT_ID, "Toan", "MATH", BigDecimal.valueOf(200_000), BigDecimal.valueOf(350_000)),
                new LevelBrief(LEVEL_ID, "Lop 12", "GRADE_12"),
                930000L + id,
                "Tutor " + id,
                "Lop " + id,
                "On thi Toan 12",
                TeachingMode.ONLINE,
                null,
                12,
                12L - slots,
                slots,
                false,
                price,
                price.multiply(BigDecimal.valueOf(12)),
                3,
                90,
                LocalDate.now().plusDays(10),
                LocalDate.now().plusMonths(3),
                36,
                "OPEN_REQUEST",
                "PUBLISHED",
                rating,
                reviewCount,
                List.of(new ClassSchedule(1L, 2, "18:30", "20:00")),
                List.of(),
                List.of("Ham so"),
                LocalDateTime.now(),
                LocalDateTime.now()
        );
    }

    private ClassSemanticSearchResult applicable(List<SemanticClassCandidate> candidates) {
        return new ClassSemanticSearchResult(ClassSemanticSearchStatus.APPLICABLE, "hash", 20, 60, candidates.size(), 0, candidates);
    }

    private SemanticClassCandidate semanticCandidate(Long classId, double similarity) {
        return new SemanticClassCandidate(classId, 930000L + classId, 16L, SUBJECT_ID, LEVEL_ID, TeachingMode.ONLINE, similarity);
    }

    private static final class FakeClassSemanticSearchService extends ClassSemanticSearchService {
        private final ClassSemanticSearchResult result;
        private final RuntimeException failure;

        private FakeClassSemanticSearchService(ClassSemanticSearchResult result) {
            super(null, null, null, null, null);
            this.result = result;
            this.failure = null;
        }

        private FakeClassSemanticSearchService(RuntimeException failure) {
            super(null, null, null, null, null);
            this.result = null;
            this.failure = failure;
        }

        @Override
        public ClassSemanticSearchResult search(ClassSemanticSearchRequest request) {
            if (failure != null) {
                throw failure;
            }
            return result;
        }
    }
}
