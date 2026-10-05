package iuh.fit.ai_service.service;

import iuh.fit.ai_service.client.LearningCatalogClient;
import iuh.fit.ai_service.dto.ClassRequirementAnalysisDtos.ClassExtractedRequirement;
import iuh.fit.ai_service.dto.ClassRequirementGroundingDtos.GroundClassRequirementRequest;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.ClarificationField;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.GroundingStatus;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.LearningCatalogSnapshot;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.LearningCategory;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.LearningLevel;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.LearningOption;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.LearningSubject;
import iuh.fit.ai_service.dto.TutorMatchingDtos.TeachingMode;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ClassRequirementGroundingServiceTest {
    private final StubCatalogClient catalogClient = new StubCatalogClient();
    private final ClassRequirementGroundingService service = new ClassRequirementGroundingService(catalogClient);

    @Test
    void exactSubjectAndLevelGroundRealCatalogIds() {
        var response = service.ground(request(requirement("Toán học", "Lớp 12", TeachingMode.ONLINE)));

        assertThat(response.status()).isEqualTo(GroundingStatus.GROUNDED);
        assertThat(response.coreSearchReady()).isTrue();
        assertThat(response.requirement().subject().id()).isEqualTo(5L);
        assertThat(response.requirement().level().id()).isEqualTo(9L);
        assertThat(response.clarifications()).isEmpty();
    }

    @Test
    void missingTeachingModeKeepsGroundedCatalogAndAsksClarification() {
        var response = service.ground(request(requirement("Toán", "Lớp 12", null)));

        assertThat(response.status()).isEqualTo(GroundingStatus.NEEDS_CLARIFICATION);
        assertThat(response.requirement().subject().id()).isEqualTo(5L);
        assertThat(response.requirement().level().id()).isEqualTo(9L);
        assertThat(response.clarifications()).anySatisfy(clarification -> {
            assertThat(clarification.field()).isEqualTo(ClarificationField.TEACHING_MODE);
            assertThat(clarification.question()).isEqualTo("Bạn muốn học lớp trực tuyến hay trực tiếp?");
        });
    }

    @Test
    void invalidSubjectLevelRelationshipDoesNotReturnMismatchedLevel() {
        var response = service.ground(request(requirement("Toán", "IELTS 6.5", TeachingMode.ONLINE)));

        assertThat(response.status()).isEqualTo(GroundingStatus.INVALID);
        assertThat(response.requirement().subject().id()).isEqualTo(5L);
        assertThat(response.requirement().level()).isNull();
    }

    private GroundClassRequirementRequest request(ClassExtractedRequirement requirement) {
        return new GroundClassRequirementRequest(requirement);
    }

    private ClassExtractedRequirement requirement(String subjectHint, String levelHint, TeachingMode mode) {
        return new ClassExtractedRequirement(subjectHint, levelHint, mode, null, List.of(), null, List.of(), List.of(), null);
    }

    private LearningCatalogSnapshot defaultSnapshot() {
        LearningCategory category = new LearningCategory(
                6L,
                "ACADEMIC",
                "Academic",
                new LearningOption(1L, "ACADEMIC", "Academic", null),
                new LearningOption(2L, "HIGH_SCHOOL", "High school", null)
        );
        return new LearningCatalogSnapshot(List.of(
                new LearningSubject(5L, "MATH", "Toan", null, category, List.of(
                        new LearningLevel(7L, "GRADE_10", "Lop 10", "GRADE", null),
                        new LearningLevel(9L, "GRADE_12", "Lop 12", "GRADE", null)
                )),
                new LearningSubject(6L, "ENGLISH", "Tieng Anh", null, category, List.of(
                        new LearningLevel(11L, "IELTS_65", "IELTS 6.5", "CERTIFICATE", null)
                ))
        ));
    }

    private final class StubCatalogClient implements LearningCatalogClient {
        @Override
        public LearningCatalogSnapshot groundingSnapshot() {
            return defaultSnapshot();
        }
    }
}
