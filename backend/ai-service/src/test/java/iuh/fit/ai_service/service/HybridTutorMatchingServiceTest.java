package iuh.fit.ai_service.service;

import iuh.fit.ai_service.client.TutorCandidateClient;
import iuh.fit.ai_service.dto.TutorMatchingDtos.AvailabilitySlot;
import iuh.fit.ai_service.dto.TutorMatchingDtos.Level;
import iuh.fit.ai_service.dto.TutorMatchingDtos.PreferredScheduleRequest;
import iuh.fit.ai_service.dto.TutorMatchingDtos.SafeLocation;
import iuh.fit.ai_service.dto.TutorMatchingDtos.SubjectCapability;
import iuh.fit.ai_service.dto.TutorMatchingDtos.TeachingMode;
import iuh.fit.ai_service.dto.TutorMatchingDtos.TutorCandidate;
import iuh.fit.ai_service.dto.TutorMatchingDtos.TutorMatchingRequest;
import iuh.fit.ai_service.dto.TutorMatchingDtos.TutorMatchingResponse;
import iuh.fit.ai_service.service.semantic.StudentSemanticSearchDtos.SemanticSearchRequest;
import iuh.fit.ai_service.service.semantic.StudentSemanticSearchDtos.SemanticSearchResult;
import iuh.fit.ai_service.service.semantic.StudentSemanticSearchDtos.SemanticSearchStatus;
import iuh.fit.ai_service.service.semantic.StudentSemanticSearchDtos.SemanticTutorCandidate;
import iuh.fit.ai_service.service.semantic.StudentSemanticSearchService;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class HybridTutorMatchingServiceTest {
    private static final Long SUBJECT_ID = 10L;
    private static final Long LEVEL_ID = 100L;

    @Test
    void semanticNotApplicablePreservesV1RankingAndPercentages() {
        List<TutorCandidate> candidates = evaluationCandidates();
        FakeSemanticSearchService semantic = new FakeSemanticSearchService(notApplicable());

        TutorMatchingResponse v1 = v1Service(candidates).match(requestWithoutSemanticContext());
        TutorMatchingResponse hybrid = hybridService(candidates, semantic).match(requestWithoutSemanticContext());

        assertThat(hybrid.results()).extracting("tutorId")
                .containsExactlyElementsOf(v1.results().stream().map(result -> result.tutorId()).toList());
        assertThat(hybrid.results()).extracting("matchPercentage")
                .containsExactlyElementsOf(v1.results().stream().map(result -> result.matchPercentage()).toList());
        assertThat(semantic.calls).isEqualTo(1);
    }

    @Test
    void semanticFailureFallsBackToV1() {
        List<TutorCandidate> candidates = evaluationCandidates();
        FakeSemanticSearchService semantic = new FakeSemanticSearchService(new IllegalStateException("qdrant unavailable"));

        TutorMatchingResponse v1 = v1Service(candidates).match(semanticRequest());
        TutorMatchingResponse hybrid = hybridService(candidates, semantic).match(semanticRequest());

        assertThat(hybrid.results()).extracting("tutorId")
                .containsExactlyElementsOf(v1.results().stream().map(result -> result.tutorId()).toList());
        assertThat(hybrid.results()).allSatisfy(result ->
                assertThat(result.scoreBreakdown().semantic().applicable()).isFalse()
        );
    }

    @Test
    void semanticCandidateCannotIntroduceIneligibleTutor() {
        List<TutorCandidate> candidates = evaluationCandidates();
        FakeSemanticSearchService semantic = new FakeSemanticSearchService(applicable(List.of(
                semanticCandidate(999L, 0.99),
                semanticCandidate(3L, 0.88)
        )));

        TutorMatchingResponse hybrid = hybridService(candidates, semantic).match(semanticRequest());

        assertThat(hybrid.results()).extracting("tutorId").doesNotContain(999L);
        assertThat(hybrid.results()).extracting("tutorId").contains(3L);
    }

    @Test
    void missingSemanticVectorKeepsTutorEligibleWithoutNegativePenalty() {
        List<TutorCandidate> candidates = evaluationCandidates();
        FakeSemanticSearchService semantic = new FakeSemanticSearchService(applicable(List.of(
                semanticCandidate(3L, 0.88),
                semanticCandidate(1L, 0.84)
        )));

        TutorMatchingResponse hybrid = hybridService(candidates, semantic).match(semanticRequest());

        assertThat(hybrid.results()).extracting("tutorId").contains(2L);
        var tutorWithoutVector = hybrid.results().stream()
                .filter(result -> result.tutorId().equals(2L))
                .findFirst()
                .orElseThrow();
        assertThat(tutorWithoutVector.scoreBreakdown().semantic().applicable()).isTrue();
        assertThat(tutorWithoutVector.scoreBreakdown().semantic().used()).isFalse();
        assertThat(tutorWithoutVector.scoreBreakdown().semantic().rankBoost()).isEqualByComparingTo("0.0000");
        assertThat(tutorWithoutVector.matchingReasons()).noneMatch(reason -> reason.toLowerCase().contains("semantic"));
    }

    @Test
    void controlledEvaluationShowsConservativeHybridReordering() {
        List<TutorCandidate> candidates = evaluationCandidates();
        FakeSemanticSearchService semantic = new FakeSemanticSearchService(applicable(List.of(
                semanticCandidate(3L, 0.88),
                semanticCandidate(1L, 0.84),
                semanticCandidate(4L, 0.83),
                semanticCandidate(2L, 0.81)
        )));

        TutorMatchingResponse v1 = v1Service(candidates).match(semanticRequest());
        TutorMatchingResponse hybrid = hybridService(candidates, semantic).match(semanticRequest());

        assertThat(v1.results()).extracting("tutorId").containsExactly(1L, 2L, 3L, 4L);
        assertThat(hybrid.results()).extracting("tutorId").containsExactly(1L, 3L, 2L, 4L);
        assertThat(hybrid.results().get(1).scoreBreakdown().semantic().rankBoost()).isGreaterThan(BigDecimal.ZERO);
        assertThat(hybrid.results().getLast().tutorId()).isEqualTo(4L);
        assertThat(hybrid.results()).allSatisfy(result -> assertThat(result.matchPercentage()).isBetween(0, 100));
        assertThat(hybrid.results()).allSatisfy(result -> assertThat(result.matchPercentage())
                .isNotEqualTo((int) Math.round(result.scoreBreakdown().semantic().normalizedSignal() == null
                        ? -1.0
                        : result.scoreBreakdown().semantic().normalizedSignal() * 100)));
    }

    @Test
    void stableTieBreakUsesV1SignalsThenTutorId() {
        List<TutorCandidate> candidates = List.of(
                candidate(2L, "Tie B", 5, BigDecimal.valueOf(200_000), BigDecimal.valueOf(250_000),
                        List.of(slot(2, "17:00", "21:00")), 4.8, 30L),
                candidate(1L, "Tie A", 5, BigDecimal.valueOf(200_000), BigDecimal.valueOf(250_000),
                        List.of(slot(2, "17:00", "21:00")), 4.8, 30L)
        );
        FakeSemanticSearchService semantic = new FakeSemanticSearchService(applicable(List.of(
                semanticCandidate(1L, 0.84),
                semanticCandidate(2L, 0.84)
        )));

        TutorMatchingResponse hybrid = hybridService(candidates, semantic).match(semanticRequest());

        assertThat(hybrid.results()).extracting("tutorId").containsExactly(1L, 2L);
    }

    private TutorMatchingService v1Service(List<TutorCandidate> candidates) {
        TutorCandidateClient client = (subjectId, levelId, teachingMode) -> candidates;
        return new TutorMatchingService(client, null, new HybridMatchingProperties(false, 3.0));
    }

    private TutorMatchingService hybridService(List<TutorCandidate> candidates, StudentSemanticSearchService semantic) {
        TutorCandidateClient client = (subjectId, levelId, teachingMode) -> candidates;
        return new TutorMatchingService(client, semantic, new HybridMatchingProperties(true, 3.0));
    }

    private SemanticSearchResult notApplicable() {
        return new SemanticSearchResult(SemanticSearchStatus.NOT_APPLICABLE, null, 20, 0, 0, 0, List.of());
    }

    private SemanticSearchResult applicable(List<SemanticTutorCandidate> candidates) {
        return new SemanticSearchResult(SemanticSearchStatus.APPLICABLE, "hash", 20, 60, candidates.size(), 0, candidates);
    }

    private SemanticTutorCandidate semanticCandidate(Long tutorId, double similarity) {
        return new SemanticTutorCandidate(tutorId, 920000L + tutorId, 1000L, SUBJECT_ID, LEVEL_ID, TeachingMode.ONLINE, similarity);
    }

    private TutorMatchingRequest semanticRequest() {
        return new TutorMatchingRequest(
                SUBJECT_ID,
                LEVEL_ID,
                TeachingMode.ONLINE,
                BigDecimal.valueOf(200_000),
                BigDecimal.valueOf(250_000),
                null,
                null,
                List.of(schedule(2, "18:00", "20:00")),
                "Muon on Spring Security va JWT",
                List.of("JWT"),
                List.of("giai thich cham")
        );
    }

    private TutorMatchingRequest requestWithoutSemanticContext() {
        return new TutorMatchingRequest(
                SUBJECT_ID,
                LEVEL_ID,
                TeachingMode.ONLINE,
                BigDecimal.valueOf(200_000),
                BigDecimal.valueOf(250_000),
                null,
                null,
                List.of(schedule(2, "18:00", "20:00")),
                null,
                List.of(),
                List.of()
        );
    }

    private List<TutorCandidate> evaluationCandidates() {
        return List.of(
                candidate(1L, "V1 strong semantic strong", 5, BigDecimal.valueOf(200_000), BigDecimal.valueOf(250_000),
                        List.of(slot(2, "17:00", "21:00")), 4.8, 30L),
                candidate(2L, "V1 strong semantic weak", 4, BigDecimal.valueOf(200_000), BigDecimal.valueOf(250_000),
                        List.of(slot(2, "17:00", "21:00")), 4.6, 10L),
                candidate(3L, "V1 slightly weaker semantic very strong", 4, BigDecimal.valueOf(200_000), BigDecimal.valueOf(250_000),
                        List.of(slot(2, "17:00", "21:00")), 4.2, 5L),
                candidate(4L, "V1 weak semantic strong", 1, BigDecimal.valueOf(500_000), BigDecimal.valueOf(650_000),
                        List.of(slot(5, "08:00", "10:00")), 4.9, 40L)
        );
    }

    private TutorCandidate candidate(
            Long id,
            String name,
            Integer experienceYears,
            BigDecimal tuitionMin,
            BigDecimal tuitionMax,
            List<AvailabilitySlot> availability,
            Double averageRating,
            Long reviewCount
    ) {
        SubjectCapability capability = new SubjectCapability(
                1000L,
                SUBJECT_ID,
                "Spring Boot",
                30L,
                "Backend",
                List.of(new Level(LEVEL_ID, "Do an backend")),
                experienceYears,
                tuitionMin,
                tuitionMax,
                "Spring Security va JWT"
        );
        return new TutorCandidate(
                id,
                920000L + id,
                name,
                null,
                "Bio",
                true,
                new SafeLocation("79", "TP.HCM", "26734", "Phuong 1", null),
                Set.of("ONLINE", "OFFLINE"),
                new ArrayList<>(List.of(capability)),
                tuitionMin,
                availability,
                averageRating,
                reviewCount,
                2L,
                null
        );
    }

    private PreferredScheduleRequest schedule(int dayOfWeek, String startTime, String endTime) {
        return new PreferredScheduleRequest(dayOfWeek, startTime, endTime);
    }

    private AvailabilitySlot slot(int dayOfWeek, String startTime, String endTime) {
        return new AvailabilitySlot(1L, dayOfWeek, startTime, endTime);
    }

    private static final class FakeSemanticSearchService extends StudentSemanticSearchService {
        private final SemanticSearchResult result;
        private final RuntimeException failure;
        private int calls;

        private FakeSemanticSearchService(SemanticSearchResult result) {
            super(null, null, null, null, null);
            this.result = result;
            this.failure = null;
        }

        private FakeSemanticSearchService(RuntimeException failure) {
            super(null, null, null, null, null);
            this.result = null;
            this.failure = failure;
        }

        @Override
        public SemanticSearchResult search(SemanticSearchRequest request) {
            calls++;
            if (failure != null) {
                throw failure;
            }
            return result;
        }
    }
}
