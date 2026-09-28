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
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class TutorMatchingServiceTest {
    private static final Long SUBJECT_ID = 10L;
    private static final Long LEVEL_ID = 100L;

    @Test
    void correctSubjectLevelAndModeIsEligible() {
        TutorMatchingResponse response = service(List.of(candidate(1L))).match(defaultRequest());

        assertThat(response.totalCandidates()).isEqualTo(1);
        assertThat(response.eligibleCandidates()).isEqualTo(1);
        assertThat(response.results()).hasSize(1);
        assertThat(response.results().getFirst().matchedSubject().subjectId()).isEqualTo(SUBJECT_ID);
        assertThat(response.results().getFirst().matchedSubject().levelId()).isEqualTo(LEVEL_ID);
    }

    @Test
    void wrongSubjectIsExcluded() {
        TutorCandidate candidate = candidate(1L, capability(99L, LEVEL_ID));

        TutorMatchingResponse response = service(List.of(candidate)).match(defaultRequest());

        assertThat(response.totalCandidates()).isEqualTo(1);
        assertThat(response.results()).isEmpty();
    }

    @Test
    void wrongLevelIsExcluded() {
        TutorCandidate candidate = candidate(1L, capability(SUBJECT_ID, 999L));

        TutorMatchingResponse response = service(List.of(candidate)).match(defaultRequest());

        assertThat(response.results()).isEmpty();
    }

    @Test
    void unsupportedTeachingModeIsExcluded() {
        TutorCandidate candidate = candidateBuilder(1L)
                .teachingModes(Set.of("OFFLINE"))
                .build();

        TutorMatchingResponse response = service(List.of(candidate)).match(defaultRequest());

        assertThat(response.results()).isEmpty();
    }

    @Test
    void unapprovedTutorIsExcluded() {
        TutorCandidate candidate = candidateBuilder(1L)
                .approved(false)
                .build();

        TutorMatchingResponse response = service(List.of(candidate)).match(defaultRequest());

        assertThat(response.results()).isEmpty();
    }

    @Test
    void exactBudgetMatchGetsStrongBudgetScore() {
        TutorCandidate candidate = candidateBuilder(1L)
                .capability(capability(BigDecimal.valueOf(200_000), BigDecimal.valueOf(250_000)))
                .build();

        var result = service(List.of(candidate)).match(defaultRequest()).results().getFirst();

        assertThat(result.scoreBreakdown().budget().normalizedScore()).isGreaterThanOrEqualTo(0.95);
    }

    @Test
    void partialBudgetOverlapGetsUsefulBudgetScore() {
        TutorCandidate candidate = candidateBuilder(1L)
                .capability(capability(BigDecimal.valueOf(240_000), BigDecimal.valueOf(280_000)))
                .build();

        var result = service(List.of(candidate)).match(defaultRequest()).results().getFirst();

        assertThat(result.scoreBreakdown().budget().normalizedScore()).isBetween(0.85, 1.0);
    }

    @Test
    void slightlyOutsideBudgetStaysEligibleWithLowerScore() {
        TutorCandidate candidate = candidateBuilder(1L)
                .capability(capability(BigDecimal.valueOf(260_000), BigDecimal.valueOf(300_000)))
                .build();

        var result = service(List.of(candidate)).match(defaultRequest()).results().getFirst();

        assertThat(result.scoreBreakdown().budget().normalizedScore()).isEqualTo(0.70);
        assertThat(result.matchPercentage()).isGreaterThan(0);
    }

    @Test
    void farOutsideBudgetIsVeryLowButNotHardExcluded() {
        TutorCandidate candidate = candidateBuilder(1L)
                .capability(capability(BigDecimal.valueOf(500_000), BigDecimal.valueOf(700_000)))
                .build();

        var result = service(List.of(candidate)).match(defaultRequest()).results().getFirst();

        assertThat(result.scoreBreakdown().budget().normalizedScore()).isEqualTo(0.05);
    }

    @Test
    void fullScheduleCoverageGetsFullScheduleScore() {
        TutorCandidate candidate = candidateBuilder(1L)
                .availability(List.of(slot(2, "17:00", "21:00")))
                .build();

        var result = service(List.of(candidate)).match(defaultRequest()).results().getFirst();

        assertThat(result.scoreBreakdown().schedule().normalizedScore()).isEqualTo(1.0);
    }

    @Test
    void partialScheduleCompatibilityGetsPartialScore() {
        TutorCandidate candidate = candidateBuilder(1L)
                .availability(List.of(slot(2, "19:00", "21:00")))
                .build();

        var result = service(List.of(candidate)).match(defaultRequest()).results().getFirst();

        assertThat(result.scoreBreakdown().schedule().normalizedScore()).isBetween(0.1, 0.8);
    }

    @Test
    void noScheduleCompatibilityGetsZeroScheduleScore() {
        TutorCandidate candidate = candidateBuilder(1L)
                .availability(List.of(slot(3, "17:00", "21:00")))
                .build();

        var result = service(List.of(candidate)).match(defaultRequest()).results().getFirst();

        assertThat(result.scoreBreakdown().schedule().normalizedScore()).isZero();
    }

    @Test
    void multipleStudentSchedulesAverageCoverage() {
        TutorCandidate candidate = candidateBuilder(1L)
                .availability(List.of(slot(2, "17:00", "21:00")))
                .build();
        TutorMatchingRequest request = requestBuilder()
                .preferredSchedules(List.of(schedule(2, "18:00", "20:00"), schedule(4, "18:00", "20:00")))
                .build();

        var result = service(List.of(candidate)).match(request).results().getFirst();

        assertThat(result.scoreBreakdown().schedule().normalizedScore()).isEqualTo(0.5);
    }

    @Test
    void onlineLocationIsNotPenalized() {
        TutorCandidate candidate = candidateBuilder(1L)
                .location(new SafeLocation(null, null, null, null, null))
                .build();

        var result = service(List.of(candidate)).match(defaultRequest()).results().getFirst();

        assertThat(result.scoreBreakdown().location().normalizedScore()).isEqualTo(1.0);
    }

    @Test
    void offlineSameCommuneScoresHighest() {
        var result = service(List.of(candidate(1L)))
                .match(offlineRequest("79", "26734"))
                .results()
                .getFirst();

        assertThat(result.scoreBreakdown().location().normalizedScore()).isEqualTo(1.0);
    }

    @Test
    void offlineSameProvinceDifferentCommuneScoresPartial() {
        var result = service(List.of(candidate(1L)))
                .match(offlineRequest("79", "99999"))
                .results()
                .getFirst();

        assertThat(result.scoreBreakdown().location().normalizedScore()).isEqualTo(0.75);
    }

    @Test
    void offlineLocationMismatchScoresLow() {
        var result = service(List.of(candidate(1L)))
                .match(offlineRequest("01", null))
                .results()
                .getFirst();

        assertThat(result.scoreBreakdown().location().normalizedScore()).isEqualTo(0.15);
    }

    @Test
    void zeroReviewsReceiveNeutralRatingTreatment() {
        TutorCandidate candidate = candidateBuilder(1L)
                .rating(0.0, 0L)
                .build();

        var result = service(List.of(candidate)).match(defaultRequest()).results().getFirst();

        assertThat(result.scoreBreakdown().ratingConfidence().normalizedScore()).isEqualTo(0.58);
        assertThat(result.missingData()).contains("reviews");
    }

    @Test
    void confidenceAwareRatingPrefersManyStrongReviewsOverSinglePerfectReview() {
        TutorCandidate singlePerfect = candidateBuilder(1L)
                .name("Single Perfect")
                .rating(5.0, 1L)
                .build();
        TutorCandidate manyStrong = candidateBuilder(2L)
                .name("Many Strong")
                .rating(4.8, 30L)
                .build();

        TutorMatchingResponse response = service(List.of(singlePerfect, manyStrong)).match(defaultRequest());

        assertThat(response.results().getFirst().tutorId()).isEqualTo(2L);
        assertThat(response.results().getFirst().scoreBreakdown().ratingConfidence().weightedScore())
                .isGreaterThan(response.results().get(1).scoreBreakdown().ratingConfidence().weightedScore());
    }

    @Test
    void missingOptionalSoftDataKeepsCandidateWithControlledScores() {
        TutorCandidate candidate = candidateBuilder(1L)
                .availability(List.of())
                .location(null)
                .rating(null, null)
                .capability(capabilityWithMissingSoftData())
                .build();

        var result = service(List.of(candidate)).match(offlineRequest("79", null)).results().getFirst();

        assertThat(result.missingData()).contains("tutorAvailability", "tutorLocation", "reviews", "experienceYears", "tutorTuition");
        assertThat(result.matchPercentage()).isBetween(0, 100);
    }

    @Test
    void noExactCandidateReturnsEmptyInsteadOfRelaxingHardRules() {
        TutorCandidate wrongSubject = candidate(1L, capability(99L, LEVEL_ID));

        TutorMatchingResponse response = service(List.of(wrongSubject)).match(defaultRequest());

        assertThat(response.results()).isEmpty();
        assertThat(response.relaxedCriteria()).isEmpty();
    }

    @Test
    void rankingTieBreakIsStableByTutorId() {
        TutorCandidate second = candidateBuilder(2L).name("Same").build();
        TutorCandidate first = candidateBuilder(1L).name("Same").build();

        TutorMatchingResponse response = service(List.of(second, first)).match(defaultRequest());

        assertThat(response.results()).extracting("tutorId").containsExactly(1L, 2L);
    }

    @Test
    void percentageAlwaysStaysInsideZeroToOneHundred() {
        TutorMatchingResponse response = service(List.of(candidate(1L))).match(defaultRequest());

        assertThat(response.results().getFirst().matchPercentage()).isBetween(0, 100);
    }

    @Test
    void scoreBreakdownWeightsAreConsistentWithFinalPercentage() {
        var result = service(List.of(candidate(1L))).match(defaultRequest()).results().getFirst();
        BigDecimal sum = result.scoreBreakdown().schedule().weightedScore()
                .add(result.scoreBreakdown().budget().weightedScore())
                .add(result.scoreBreakdown().location().weightedScore())
                .add(result.scoreBreakdown().experience().weightedScore())
                .add(result.scoreBreakdown().ratingConfidence().weightedScore());

        assertThat(result.scoreBreakdown().rawScore()).isEqualByComparingTo(sum);
        assertThat(result.scoreBreakdown().weights())
                .containsEntry("schedule", 30)
                .containsEntry("budget", 25)
                .containsEntry("location", 20)
                .containsEntry("experience", 12)
                .containsEntry("ratingConfidence", 13);
    }

    @Test
    void matchingReasonsAreSupportedByFacts() {
        var result = service(List.of(candidate(1L))).match(offlineRequest("79", "26734")).results().getFirst();

        assertThat(result.matchingReasons())
                .contains("Dạy đúng môn và cấp độ học đã chọn.")
                .contains("Hỗ trợ hình thức học OFFLINE.")
                .contains("Phù hợp khu vực học trực tiếp.");
    }

    private TutorMatchingService service(List<TutorCandidate> candidates) {
        TutorCandidateClient client = (subjectId, levelId, teachingMode) -> candidates;
        return new TutorMatchingService(client);
    }

    private TutorMatchingRequest defaultRequest() {
        return requestBuilder().build();
    }

    private TutorMatchingRequest offlineRequest(String provinceCode, String communeCode) {
        return requestBuilder()
                .teachingMode(TeachingMode.OFFLINE)
                .provinceCode(provinceCode)
                .communeCode(communeCode)
                .build();
    }

    private RequestBuilder requestBuilder() {
        return new RequestBuilder();
    }

    private PreferredScheduleRequest schedule(int dayOfWeek, String startTime, String endTime) {
        return new PreferredScheduleRequest(dayOfWeek, startTime, endTime);
    }

    private AvailabilitySlot slot(int dayOfWeek, String startTime, String endTime) {
        return new AvailabilitySlot(1L, dayOfWeek, startTime, endTime);
    }

    private TutorCandidate candidate(Long id) {
        return candidateBuilder(id).build();
    }

    private TutorCandidate candidate(Long id, SubjectCapability capability) {
        return candidateBuilder(id).capability(capability).build();
    }

    private CandidateBuilder candidateBuilder(Long id) {
        return new CandidateBuilder(id);
    }

    private SubjectCapability capability(Long subjectId, Long levelId) {
        return new SubjectCapability(
                1000L + subjectId,
                subjectId,
                "Toán",
                30L,
                "Tự nhiên",
                List.of(new Level(levelId, "Lớp 12")),
                5,
                BigDecimal.valueOf(200_000),
                BigDecimal.valueOf(250_000),
                "Ôn thi và củng cố kiến thức"
        );
    }

    private SubjectCapability capability(BigDecimal tuitionMin, BigDecimal tuitionMax) {
        return new SubjectCapability(
                1000L,
                SUBJECT_ID,
                "Toán",
                30L,
                "Tự nhiên",
                List.of(new Level(LEVEL_ID, "Lớp 12")),
                5,
                tuitionMin,
                tuitionMax,
                "Ôn thi và củng cố kiến thức"
        );
    }

    private SubjectCapability capabilityWithMissingSoftData() {
        return new SubjectCapability(
                1000L,
                SUBJECT_ID,
                "Toán",
                30L,
                "Tự nhiên",
                List.of(new Level(LEVEL_ID, "Lớp 12")),
                null,
                null,
                null,
                null
        );
    }

    private final class RequestBuilder {
        private TeachingMode teachingMode = TeachingMode.ONLINE;
        private BigDecimal budgetMin = BigDecimal.valueOf(200_000);
        private BigDecimal budgetMax = BigDecimal.valueOf(250_000);
        private String provinceCode;
        private String communeCode;
        private List<PreferredScheduleRequest> preferredSchedules = List.of(schedule(2, "18:00", "20:00"));

        RequestBuilder teachingMode(TeachingMode teachingMode) {
            this.teachingMode = teachingMode;
            return this;
        }

        RequestBuilder provinceCode(String provinceCode) {
            this.provinceCode = provinceCode;
            return this;
        }

        RequestBuilder communeCode(String communeCode) {
            this.communeCode = communeCode;
            return this;
        }

        RequestBuilder preferredSchedules(List<PreferredScheduleRequest> preferredSchedules) {
            this.preferredSchedules = preferredSchedules;
            return this;
        }

        TutorMatchingRequest build() {
            return new TutorMatchingRequest(
                    SUBJECT_ID,
                    LEVEL_ID,
                    teachingMode,
                    budgetMin,
                    budgetMax,
                    provinceCode,
                    communeCode,
                    preferredSchedules,
                    "Muốn học chắc kiến thức nền"
            );
        }
    }

    private final class CandidateBuilder {
        private final Long id;
        private String name;
        private boolean approved = true;
        private SafeLocation location = new SafeLocation("79", "TP. Hồ Chí Minh", "26734", "Phường 1", null);
        private Set<String> teachingModes = new LinkedHashSet<>(Set.of("ONLINE", "OFFLINE"));
        private SubjectCapability capability = TutorMatchingServiceTest.this.capability(SUBJECT_ID, LEVEL_ID);
        private List<AvailabilitySlot> availability = List.of(slot(2, "17:00", "21:00"));
        private Double averageRating = 4.8;
        private Long reviewCount = 30L;

        CandidateBuilder(Long id) {
            this.id = id;
            this.name = "Tutor " + id;
        }

        CandidateBuilder name(String name) {
            this.name = name;
            return this;
        }

        CandidateBuilder approved(boolean approved) {
            this.approved = approved;
            return this;
        }

        CandidateBuilder location(SafeLocation location) {
            this.location = location;
            return this;
        }

        CandidateBuilder teachingModes(Set<String> teachingModes) {
            this.teachingModes = teachingModes;
            return this;
        }

        CandidateBuilder capability(SubjectCapability capability) {
            this.capability = capability;
            return this;
        }

        CandidateBuilder availability(List<AvailabilitySlot> availability) {
            this.availability = availability;
            return this;
        }

        CandidateBuilder rating(Double averageRating, Long reviewCount) {
            this.averageRating = averageRating;
            this.reviewCount = reviewCount;
            return this;
        }

        TutorCandidate build() {
            return new TutorCandidate(
                    id,
                    920000L + id,
                    name,
                    null,
                    "Bio",
                    approved,
                    location,
                    teachingModes,
                    new ArrayList<>(List.of(capability)),
                    capability.tuitionMin(),
                    availability,
                    averageRating,
                    reviewCount,
                    2L,
                    null
            );
        }
    }
}
