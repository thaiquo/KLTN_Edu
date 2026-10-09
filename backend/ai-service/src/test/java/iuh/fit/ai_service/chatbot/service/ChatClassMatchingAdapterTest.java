package iuh.fit.ai_service.chatbot.service;

import iuh.fit.ai_service.chatbot.security.AiUserContext;
import iuh.fit.ai_service.dto.ClassMatchingDtos.ClassMatchResult;
import iuh.fit.ai_service.dto.ClassMatchingDtos.ClassMatchingResponse;
import iuh.fit.ai_service.dto.ClassMatchingDtos.MatchedClassLevel;
import iuh.fit.ai_service.dto.ClassMatchingDtos.MatchedClassSubject;
import iuh.fit.ai_service.dto.ClassRequirementAnalysisDtos.AnalyzeClassRequirementRequest;
import iuh.fit.ai_service.dto.ClassRequirementAnalysisDtos.AnalyzeClassRequirementResponse;
import iuh.fit.ai_service.dto.ClassRequirementAnalysisDtos.ClassExtractedRequirement;
import iuh.fit.ai_service.dto.ClassRequirementAnalysisDtos.ExtractionStatus;
import iuh.fit.ai_service.dto.ClassRequirementGroundingDtos.GroundClassRequirementRequest;
import iuh.fit.ai_service.dto.ClassRequirementGroundingDtos.GroundClassRequirementResponse;
import iuh.fit.ai_service.dto.ClassRequirementGroundingDtos.GroundedClassRequirement;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.CatalogItem;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.GroundingStatus;
import iuh.fit.ai_service.dto.TutorMatchingDtos.TeachingMode;
import iuh.fit.ai_service.service.ClassMatchingService;
import iuh.fit.ai_service.service.ClassNaturalLanguageRequirementAnalyzer;
import iuh.fit.ai_service.service.ClassRequirementGroundingService;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ChatClassMatchingAdapterTest {
    private final ClassNaturalLanguageRequirementAnalyzer analyzer = mock(ClassNaturalLanguageRequirementAnalyzer.class);
    private final ClassRequirementGroundingService groundingService = mock(ClassRequirementGroundingService.class);
    private final ClassMatchingService matchingService = mock(ClassMatchingService.class);
    private final RoleToolAuthorizer authorizer = new RoleToolAuthorizer();
    private final ChatToolRegistry toolRegistry = new ChatToolRegistry(authorizer);
    private final ChatCatalogHintResolver catalogHintResolver = mock(ChatCatalogHintResolver.class);
    private final ChatClassMatchingAdapter adapter = new ChatClassMatchingAdapter(
            analyzer,
            groundingService,
            matchingService,
            toolRegistry,
            authorizer,
            catalogHintResolver
    );

    @Test
    void returnsPublicSafeClassMatchesInMatchingOrder() {
        when(analyzer.analyze(any(AnalyzeClassRequirementRequest.class))).thenReturn(new AnalyzeClassRequirementResponse(
                ExtractionStatus.EXTRACTED,
                new ClassExtractedRequirement("IELTS", "B1", TeachingMode.ONLINE, null, List.of(), null, List.of(), List.of(), null),
                List.of(),
                List.of()
        ));
        when(groundingService.ground(any(GroundClassRequirementRequest.class))).thenReturn(new GroundClassRequirementResponse(
                GroundingStatus.GROUNDED,
                true,
                new GroundedClassRequirement(
                        new CatalogItem(7L, "IELTS", "IELTS", null),
                        new CatalogItem(10L, "B1", "B1", null),
                        TeachingMode.ONLINE,
                        null,
                        List.of(),
                        null,
                        List.of(),
                        List.of(),
                        null
                ),
                List.of()
        ));
        when(matchingService.match(any())).thenReturn(new ClassMatchingResponse(
                null,
                2,
                2,
                "HYBRID_V2",
                List.of(classMatch(21L, "Lớp IELTS tối"), classMatch(22L, "Lớp IELTS cuối tuần"))
        ));

        ChatMatchingResult result = adapter.match("Tìm lớp IELTS online phù hợp", guest());

        assertThat(result.toolResult()).containsEntry("type", "CLASS_MATCHES");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = (List<Map<String, Object>>) result.toolResult().get("items");
        assertThat(items).extracting(item -> item.get("classId")).containsExactly(21L, 22L);
        assertThat(items.getFirst()).containsEntry("title", "Lớp IELTS tối");
        assertThat(items.getFirst()).doesNotContainKeys("scoreBreakdown", "meetingLink", "joinKey", "tutorEmail");
    }

    private ClassMatchResult classMatch(Long classId, String title) {
        return new ClassMatchResult(
                classId,
                301L,
                401L,
                "Gia sư B",
                title,
                "Lớp công khai.",
                TeachingMode.ONLINE,
                null,
                new MatchedClassSubject(7L, "IELTS", 2L, "Ngoại ngữ"),
                new MatchedClassLevel(10L, "B1"),
                BigDecimal.valueOf(250000),
                3,
                90,
                null,
                null,
                24,
                4L,
                4.7,
                8L,
                List.of(),
                List.of("IELTS", "Speaking"),
                91,
                null,
                List.of("Đúng môn học", "Lịch học phù hợp"),
                List.of()
        );
    }

    private AiUserContext guest() {
        return AiUserContext.guest();
    }
}
