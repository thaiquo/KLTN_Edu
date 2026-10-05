package iuh.fit.ai_service.service;

import iuh.fit.ai_service.dto.RequirementAnalysisDtos.AnalyzeRequirementRequest;
import iuh.fit.ai_service.dto.RequirementAnalysisDtos.AnalyzeRequirementResponse;
import iuh.fit.ai_service.dto.RequirementAnalysisDtos.ExtractionStatus;
import iuh.fit.ai_service.dto.TutorMatchingDtos.TeachingMode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = {
        "jwt.secret=0123456789ABCDEF0123456789ABCDEF",
        "gemini.api-key=${GEMINI_API_KEY:}",
        "gemini.model=${GEMINI_MODEL:gemini-3.5-flash}"
})
@EnabledIfEnvironmentVariable(named = "RUN_GEMINI_ANALYZE", matches = "true")
class GeminiRuntimeAnalyzeTest {
    @Autowired
    private NaturalLanguageRequirementAnalyzer analyzer;

    @Test
    void analyzesCompleteVietnameseRequirementWithRealGemini() {
        AnalyzeRequirementResponse response = analyzer.analyze(new AnalyzeRequirementRequest("""
                Em học lớp 12, đang mất gốc Toán và yếu tích phân.
                Em muốn học online tối thứ 2 và thứ 4,
                ngân sách khoảng 250 nghìn một buổi.
                Em muốn gia sư dạy chậm, kiên nhẫn và dễ hiểu
                để ôn thi tốt nghiệp.
                """));

        assertThat(response.status()).isEqualTo(ExtractionStatus.EXTRACTED);
        assertThat(response.requirement().subjectHint()).isNotBlank();
        assertThat(response.requirement().levelHint()).isNotBlank();
        assertThat(response.requirement().teachingMode()).isEqualTo(TeachingMode.ONLINE);
        assertThat(response.requirement().preferredSchedules()).hasSizeGreaterThanOrEqualTo(2);
        assertThat(response.requirement().weakTopics()).isNotEmpty();
        assertThat(response.requirement().tutorPreferences()).isNotEmpty();
    }

    @Test
    void asksClarificationWhenRequiredConceptsAreMissingWithRealGemini() {
        AnalyzeRequirementResponse response = analyzer.analyze(new AnalyzeRequirementRequest(
                "Em muốn tìm gia sư Toán để cải thiện điểm."
        ));

        assertThat(response.status()).isEqualTo(ExtractionStatus.NEEDS_CLARIFICATION);
        assertThat(response.requirement().subjectHint()).isNotBlank();
        assertThat(response.missingRequiredFields()).contains("level", "teachingMode");
    }

    @Test
    void rejectsIrrelevantInputWithRealGemini() {
        AnalyzeRequirementResponse response = analyzer.analyze(new AnalyzeRequirementRequest(
                "Viết cho tôi một bài thơ về mùa hè."
        ));

        assertThat(response.status()).isEqualTo(ExtractionStatus.INVALID);
    }
}
