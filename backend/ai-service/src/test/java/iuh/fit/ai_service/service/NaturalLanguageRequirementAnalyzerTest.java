package iuh.fit.ai_service.service;

import iuh.fit.ai_service.dto.RequirementAnalysisDtos.AnalyzeRequirementRequest;
import iuh.fit.ai_service.dto.RequirementAnalysisDtos.Budget;
import iuh.fit.ai_service.dto.RequirementAnalysisDtos.ExtractionStatus;
import iuh.fit.ai_service.dto.RequirementAnalysisDtos.GeminiRequirementExtraction;
import iuh.fit.ai_service.dto.RequirementAnalysisDtos.PreferredSchedule;
import iuh.fit.ai_service.dto.RequirementAnalysisDtos.TimeOfDayHint;
import iuh.fit.ai_service.dto.TutorMatchingDtos.TeachingMode;
import iuh.fit.ai_service.service.GeminiService.GeminiUnavailableException;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class NaturalLanguageRequirementAnalyzerTest {
    @Test
    void completeVietnameseRequirementIsExtracted() {
        var response = analyzer(completeExtraction()).analyze(request());

        assertThat(response.status()).isEqualTo(ExtractionStatus.EXTRACTED);
        assertThat(response.requirement().subjectHint()).isEqualTo("Toán");
        assertThat(response.requirement().levelHint()).isEqualTo("Lớp 12");
        assertThat(response.requirement().teachingMode()).isEqualTo(TeachingMode.ONLINE);
        assertThat(response.requirement().budget().target()).isEqualByComparingTo("250000");
        assertThat(response.requirement().preferredSchedules()).hasSize(2);
        assertThat(response.requirement().learningGoal()).isNotBlank();
    }

    @Test
    void missingLevelNeedsClarification() {
        var extraction = completeExtraction(null, null, null, null, null).withLevel(null);

        var response = analyzer(extraction).analyze(request());

        assertThat(response.status()).isEqualTo(ExtractionStatus.NEEDS_CLARIFICATION);
        assertThat(response.missingRequiredFields()).containsExactly("level");
    }

    @Test
    void missingTeachingModeNeedsClarification() {
        var response = analyzer(completeExtraction().withTeachingMode(null)).analyze(request());

        assertThat(response.status()).isEqualTo(ExtractionStatus.NEEDS_CLARIFICATION);
        assertThat(response.missingRequiredFields()).containsExactly("teachingMode");
    }

    @Test
    void missingMultipleRequiredFieldsAreReportedDeterministically() {
        var extraction = completeExtraction()
                .withSubject(null)
                .withLevel(null)
                .withTeachingMode(null);

        var response = analyzer(extraction).analyze(request());

        assertThat(response.status()).isEqualTo(ExtractionStatus.NEEDS_CLARIFICATION);
        assertThat(response.missingRequiredFields()).containsExactly("subject", "level", "teachingMode");
    }

    @Test
    void budgetRangeIsPreserved() {
        var response = analyzer(completeExtraction().withBudget(new Budget(
                BigDecimal.valueOf(200_000),
                BigDecimal.valueOf(300_000),
                null,
                "VND",
                "SESSION",
                false
        ))).analyze(request());

        assertThat(response.requirement().budget().min()).isEqualByComparingTo("200000");
        assertThat(response.requirement().budget().max()).isEqualByComparingTo("300000");
        assertThat(response.requirement().budget().target()).isNull();
    }

    @Test
    void maxBudgetExpressionIsPreservedWithoutInventingMinimum() {
        var response = analyzer(completeExtraction().withBudget(new Budget(
                null,
                BigDecimal.valueOf(300_000),
                null,
                "VND",
                "SESSION",
                false
        ))).analyze(request());

        assertThat(response.requirement().budget().min()).isNull();
        assertThat(response.requirement().budget().max()).isEqualByComparingTo("300000");
    }

    @Test
    void approximateBudgetUsesTargetWithoutInventingRange() {
        var response = analyzer(completeExtraction()).analyze(request());

        assertThat(response.requirement().budget().min()).isNull();
        assertThat(response.requirement().budget().max()).isNull();
        assertThat(response.requirement().budget().target()).isEqualByComparingTo("250000");
        assertThat(response.requirement().budget().approximate()).isTrue();
    }

    @Test
    void exactScheduleKeepsExactTimes() {
        var response = analyzer(completeExtraction().withSchedules(List.of(
                new PreferredSchedule(2, "18:30", "20:30", null)
        ))).analyze(request());

        assertThat(response.requirement().preferredSchedules().getFirst().dayOfWeek()).isEqualTo(2);
        assertThat(response.requirement().preferredSchedules().getFirst().startTime()).isEqualTo("18:30");
        assertThat(response.requirement().preferredSchedules().getFirst().endTime()).isEqualTo("20:30");
    }

    @Test
    void approximateEveningScheduleDoesNotInventTimes() {
        var response = analyzer(completeExtraction().withSchedules(List.of(
                new PreferredSchedule(2, null, null, TimeOfDayHint.EVENING)
        ))).analyze(request());

        assertThat(response.requirement().preferredSchedules().getFirst().dayOfWeek()).isEqualTo(2);
        assertThat(response.requirement().preferredSchedules().getFirst().startTime()).isNull();
        assertThat(response.requirement().preferredSchedules().getFirst().timeOfDayHint()).isEqualTo(TimeOfDayHint.EVENING);
    }

    @Test
    void multipleDaysArePreserved() {
        var response = analyzer(completeExtraction()).analyze(request());

        assertThat(response.requirement().preferredSchedules())
                .extracting(PreferredSchedule::dayOfWeek)
                .containsExactly(2, 4);
    }

    @Test
    void weakTopicsAndTutorPreferencesAreSeparatedFromGoal() {
        var response = analyzer(completeExtraction()).analyze(request());

        assertThat(response.requirement().learningGoal()).isEqualTo("Ôn thi tốt nghiệp");
        assertThat(response.requirement().weakTopics()).containsExactly("Tích phân");
        assertThat(response.requirement().tutorPreferences())
                .containsExactly("Dạy chậm", "Kiên nhẫn", "Giải thích dễ hiểu");
    }

    @Test
    void irrelevantInputIsInvalid() {
        var response = analyzer(new TestExtraction(false)).analyze(request());

        assertThat(response.status()).isEqualTo(ExtractionStatus.INVALID);
        assertThat(response.requirement().subjectHint()).isNull();
    }

    @Test
    void promptInjectionWithoutLegitimateRequirementIsInvalid() {
        var response = analyzer(new TestExtraction(false)
                .withAmbiguousFields(List.of("promptInjection"))).analyze(request());

        assertThat(response.status()).isEqualTo(ExtractionStatus.INVALID);
        assertThat(response.ambiguousFields()).containsExactly("promptInjection");
    }

    @Test
    void invalidGeminiMoneyAndScheduleOutputIsSanitized() {
        var extraction = completeExtraction()
                .withBudget(new Budget(
                        BigDecimal.valueOf(-100),
                        BigDecimal.valueOf(20_000_000),
                        null,
                        "USD",
                        "HOUR",
                        false
                ))
                .withSchedules(List.of(
                        new PreferredSchedule(9, "99:99", "18:00", TimeOfDayHint.EVENING),
                        new PreferredSchedule(2, "20:00", "18:00", null)
                ));

        var response = analyzer(extraction).analyze(request());

        assertThat(response.requirement().budget()).isNull();
        assertThat(response.requirement().preferredSchedules()).containsExactly(
                new PreferredSchedule(null, null, null, TimeOfDayHint.EVENING),
                new PreferredSchedule(2, null, null, null)
        );
    }

    @Test
    void duplicateListItemsAndSchedulesAreCollapsed() {
        var extraction = completeExtraction()
                .withWeakTopics(List.of("Tích phân", "Tích phân", "  "))
                .withSchedules(List.of(
                        new PreferredSchedule(2, null, null, TimeOfDayHint.EVENING),
                        new PreferredSchedule(2, null, null, TimeOfDayHint.EVENING)
                ));

        var response = analyzer(extraction).analyze(request());

        assertThat(response.requirement().weakTopics()).containsExactly("Tích phân");
        assertThat(response.requirement().preferredSchedules()).hasSize(1);
    }

    @Test
    void providerFailureIsNotConvertedToFakeExtraction() {
        RequirementExtractionClient failingClient = message -> {
            throw new GeminiUnavailableException("Gemini 503 high demand");
        };
        NaturalLanguageRequirementAnalyzer analyzer = new NaturalLanguageRequirementAnalyzer(failingClient);

        assertThatThrownBy(() -> analyzer.analyze(request()))
                .isInstanceOf(GeminiUnavailableException.class)
                .hasMessageContaining("503");
    }

    private NaturalLanguageRequirementAnalyzer analyzer(TestExtraction extraction) {
        return new NaturalLanguageRequirementAnalyzer(message -> extraction.toDto());
    }

    private AnalyzeRequirementRequest request() {
        return new AnalyzeRequirementRequest("Em học lớp 12, mất gốc Toán và muốn học online.");
    }

    private TestExtraction completeExtraction() {
        return completeExtraction(null, null, null, null, null);
    }

    private TestExtraction completeExtraction(String subject, String level, TeachingMode mode, Budget budget,
                                              List<PreferredSchedule> schedules) {
        return new TestExtraction(true)
                .withSubject(subject == null ? "Toán" : subject)
                .withLevel(level == null ? "Lớp 12" : level)
                .withTeachingMode(mode == null ? TeachingMode.ONLINE : mode)
                .withBudget(budget == null
                        ? new Budget(null, null, BigDecimal.valueOf(250_000), "VND", "SESSION", true)
                        : budget)
                .withSchedules(schedules == null
                        ? List.of(
                        new PreferredSchedule(2, null, null, TimeOfDayHint.EVENING),
                        new PreferredSchedule(4, null, null, TimeOfDayHint.EVENING)
                )
                        : schedules)
                .withLearningGoal("Ôn thi tốt nghiệp")
                .withWeakTopics(List.of("Tích phân"))
                .withTutorPreferences(List.of("Dạy chậm", "Kiên nhẫn", "Giải thích dễ hiểu"));
    }

    private static final class TestExtraction {
        private final boolean relevant;
        private String subjectHint;
        private String levelHint;
        private TeachingMode teachingMode;
        private Budget budget;
        private List<PreferredSchedule> schedules = List.of();
        private String learningGoal;
        private List<String> weakTopics = List.of();
        private List<String> tutorPreferences = List.of();
        private List<String> ambiguousFields = List.of();

        private TestExtraction(boolean relevant) {
            this.relevant = relevant;
        }

        TestExtraction withSubject(String subjectHint) {
            this.subjectHint = subjectHint;
            return this;
        }

        TestExtraction withLevel(String levelHint) {
            this.levelHint = levelHint;
            return this;
        }

        TestExtraction withTeachingMode(TeachingMode teachingMode) {
            this.teachingMode = teachingMode;
            return this;
        }

        TestExtraction withBudget(Budget budget) {
            this.budget = budget;
            return this;
        }

        TestExtraction withSchedules(List<PreferredSchedule> schedules) {
            this.schedules = schedules;
            return this;
        }

        TestExtraction withLearningGoal(String learningGoal) {
            this.learningGoal = learningGoal;
            return this;
        }

        TestExtraction withWeakTopics(List<String> weakTopics) {
            this.weakTopics = weakTopics;
            return this;
        }

        TestExtraction withTutorPreferences(List<String> tutorPreferences) {
            this.tutorPreferences = tutorPreferences;
            return this;
        }

        TestExtraction withAmbiguousFields(List<String> ambiguousFields) {
            this.ambiguousFields = ambiguousFields;
            return this;
        }

        GeminiRequirementExtraction toDto() {
            return new GeminiRequirementExtraction(
                    relevant,
                    subjectHint,
                    levelHint,
                    teachingMode,
                    budget,
                    schedules,
                    learningGoal,
                    weakTopics,
                    tutorPreferences,
                    null,
                    ambiguousFields
            );
        }
    }
}
