package iuh.fit.ai_service.service;

import iuh.fit.ai_service.dto.ClassRequirementAnalysisDtos.AnalyzeClassRequirementRequest;
import iuh.fit.ai_service.dto.ClassRequirementAnalysisDtos.ClassGeminiRequirementExtraction;
import iuh.fit.ai_service.dto.ClassRequirementAnalysisDtos.ExtractionStatus;
import iuh.fit.ai_service.dto.RequirementAnalysisDtos.Budget;
import iuh.fit.ai_service.dto.RequirementAnalysisDtos.PreferredSchedule;
import iuh.fit.ai_service.dto.RequirementAnalysisDtos.TimeOfDayHint;
import iuh.fit.ai_service.dto.TutorMatchingDtos.TeachingMode;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ClassNaturalLanguageRequirementAnalyzerTest {
    @Test
    void completeClassRequirementIsExtracted() {
        var response = analyzer(completeExtraction()).analyze(request());

        assertThat(response.status()).isEqualTo(ExtractionStatus.EXTRACTED);
        assertThat(response.requirement().subjectHint()).isEqualTo("Toán");
        assertThat(response.requirement().levelHint()).isEqualTo("Lớp 12");
        assertThat(response.requirement().teachingMode()).isEqualTo(TeachingMode.ONLINE);
        assertThat(response.requirement().budget().target()).isEqualByComparingTo("250000");
        assertThat(response.requirement().availableSchedules())
                .extracting(PreferredSchedule::dayOfWeek)
                .containsExactly(2, 4, 6);
        assertThat(response.requirement().weakTopics()).containsExactly("Hình học không gian");
        assertThat(response.requirement().classPreferences()).containsExactly("Lớp nhỏ", "Có bài tập sau buổi học");
    }

    @Test
    void missingTeachingModeNeedsClarification() {
        var response = analyzer(completeExtraction().withTeachingMode(null)).analyze(request());

        assertThat(response.status()).isEqualTo(ExtractionStatus.NEEDS_CLARIFICATION);
        assertThat(response.missingRequiredFields()).containsExactly("teachingMode");
    }

    @Test
    void irrelevantInputIsInvalid() {
        var response = analyzer(new TestExtraction(false)).analyze(request());

        assertThat(response.status()).isEqualTo(ExtractionStatus.INVALID);
        assertThat(response.requirement().subjectHint()).isNull();
    }

    private ClassNaturalLanguageRequirementAnalyzer analyzer(TestExtraction extraction) {
        return new ClassNaturalLanguageRequirementAnalyzer(message -> extraction.toDto());
    }

    private AnalyzeClassRequirementRequest request() {
        return new AnalyzeClassRequirementRequest("Em muốn tìm lớp Toán lớp 12 online tối thứ 2, 4, 6.");
    }

    private TestExtraction completeExtraction() {
        return new TestExtraction(true)
                .withSubject("Toán")
                .withLevel("Lớp 12")
                .withTeachingMode(TeachingMode.ONLINE)
                .withBudget(new Budget(null, null, BigDecimal.valueOf(250_000), "VND", "SESSION", true))
                .withSchedules(List.of(
                        new PreferredSchedule(2, null, null, TimeOfDayHint.EVENING),
                        new PreferredSchedule(4, null, null, TimeOfDayHint.EVENING),
                        new PreferredSchedule(6, null, null, TimeOfDayHint.EVENING)
                ))
                .withLearningGoal("Ôn thi tốt nghiệp")
                .withWeakTopics(List.of("Hình học không gian"))
                .withClassPreferences(List.of("Lớp nhỏ", "Có bài tập sau buổi học"));
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
        private List<String> classPreferences = List.of();

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

        TestExtraction withClassPreferences(List<String> classPreferences) {
            this.classPreferences = classPreferences;
            return this;
        }

        ClassGeminiRequirementExtraction toDto() {
            return new ClassGeminiRequirementExtraction(
                    relevant,
                    subjectHint,
                    levelHint,
                    teachingMode,
                    budget,
                    schedules,
                    learningGoal,
                    weakTopics,
                    classPreferences,
                    null,
                    List.of()
            );
        }
    }
}
