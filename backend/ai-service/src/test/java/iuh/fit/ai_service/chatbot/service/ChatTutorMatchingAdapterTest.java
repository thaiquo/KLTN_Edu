package iuh.fit.ai_service.chatbot.service;

import iuh.fit.ai_service.chatbot.security.AiUserContext;
import iuh.fit.ai_service.dto.RequirementAnalysisDtos.AnalyzeRequirementRequest;
import iuh.fit.ai_service.dto.RequirementAnalysisDtos.AnalyzeRequirementResponse;
import iuh.fit.ai_service.dto.RequirementAnalysisDtos.ExtractedRequirement;
import iuh.fit.ai_service.dto.RequirementAnalysisDtos.ExtractionStatus;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.CatalogItem;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.Clarification;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.ClarificationField;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.ClarificationReason;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.GroundRequirementRequest;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.GroundRequirementResponse;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.GroundedRequirement;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.GroundingStatus;
import iuh.fit.ai_service.dto.TutorMatchingDtos.MatchedSubject;
import iuh.fit.ai_service.dto.TutorMatchingDtos.TutorMatchResult;
import iuh.fit.ai_service.dto.TutorMatchingDtos.TutorMatchingResponse;
import iuh.fit.ai_service.dto.TutorMatchingDtos.TeachingMode;
import iuh.fit.ai_service.service.CatalogGroundingService;
import iuh.fit.ai_service.service.NaturalLanguageRequirementAnalyzer;
import iuh.fit.ai_service.service.TutorMatchingService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class ChatTutorMatchingAdapterTest {
    private final NaturalLanguageRequirementAnalyzer analyzer = mock(NaturalLanguageRequirementAnalyzer.class);
    private final CatalogGroundingService groundingService = mock(CatalogGroundingService.class);
    private final TutorMatchingService matchingService = mock(TutorMatchingService.class);
    private final RoleToolAuthorizer authorizer = new RoleToolAuthorizer();
    private final ChatToolRegistry toolRegistry = new ChatToolRegistry(authorizer);
    private final ChatCatalogHintResolver catalogHintResolver = mock(ChatCatalogHintResolver.class);
    private final ChatTutorMatchingAdapter adapter = new ChatTutorMatchingAdapter(
            analyzer,
            groundingService,
            matchingService,
            toolRegistry,
            authorizer,
            catalogHintResolver
    );

    @Test
    void returnsPublicSafeTutorMatchesInMatchingOrder() {
        when(analyzer.analyze(any(AnalyzeRequirementRequest.class))).thenReturn(new AnalyzeRequirementResponse(
                ExtractionStatus.EXTRACTED,
                new ExtractedRequirement("Toán", "Lớp 12", TeachingMode.ONLINE, null, List.of(), null, List.of(), List.of(), null),
                List.of(),
                List.of()
        ));
        when(groundingService.ground(any(GroundRequirementRequest.class))).thenReturn(new GroundRequirementResponse(
                GroundingStatus.GROUNDED,
                true,
                new GroundedRequirement(
                        new CatalogItem(5L, "MATH", "Toán", null),
                        new CatalogItem(9L, "GRADE_12", "Lớp 12", null),
                        TeachingMode.ONLINE,
                        null,
                        List.of(),
                        null,
                        List.of(),
                        List.of(),
                        null,
                        null
                ),
                List.of()
        ));
        when(matchingService.match(any())).thenReturn(new TutorMatchingResponse(
                null,
                2,
                2,
                List.of(),
                List.of(tutor(11L, 9001L, "Gia sư A", 94), tutor(12L, 9002L, "Gia sư B", 88))
        ));

        ChatMatchingResult result = adapter.match("Tìm gia sư Toán lớp 12 online", guest());

        assertThat(result.toolResult()).containsEntry("type", "TUTOR_MATCHES");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = (List<Map<String, Object>>) result.toolResult().get("items");
        assertThat(items).extracting(item -> item.get("tutorId")).containsExactly(11L, 12L);
        assertThat(items.getFirst()).containsEntry("displayName", "Gia sư A");
        assertThat(items.getFirst()).containsKeys("scoreBreakdown", "mismatchReasons");
        assertThat(items.getFirst()).doesNotContainKeys("userId", "location");
    }

    @Test
    void doesNotAskSubjectAgainWhenMessageAlreadyContainsSubject() {
        when(analyzer.analyze(any(AnalyzeRequirementRequest.class))).thenReturn(new AnalyzeRequirementResponse(
                ExtractionStatus.INVALID,
                null,
                List.of("subject"),
                List.of()
        ));
        when(catalogHintResolver.subjectHint(any())).thenReturn(java.util.Optional.of(new ChatCatalogHintResolver.SubjectHint(5L, "To\u00e1n")));
        ChatMatchingResult result = adapter.match("T\u00f4i mu\u1ed1n t\u00ecm gia s\u01b0 d\u1ea1y to\u00e1n", guest());

        assertThat(result.message()).doesNotContain("m\u00f4n n\u00e0o");
        assertThat(result.toolResult()).containsEntry("type", "TUTOR_MATCHES");
        verifyNoInteractions(groundingService);
    }

    @Test
    void treatsOnlineAndOfflineAsAcceptedAlternativesAndDoesNotRequireBudget() {
        when(analyzer.analyze(any(AnalyzeRequirementRequest.class))).thenReturn(new AnalyzeRequirementResponse(
                ExtractionStatus.EXTRACTED,
                new ExtractedRequirement(
                        "Toán",
                        "Lớp 12",
                        null,
                        null,
                        List.of(),
                        "Ôn thi THPT Quốc gia theo lộ trình nâng cao",
                        List.of("giải đề", "vận dụng nhiều bước suy luận"),
                        List.of(),
                        null
                ),
                List.of(),
                List.of()
        ));
        when(catalogHintResolver.subjectHint(any())).thenReturn(java.util.Optional.of(new ChatCatalogHintResolver.SubjectHint(
                5L,
                "Toán",
                List.of(new ChatCatalogHintResolver.LevelHint(9L, "GRADE_12", "Lớp 12"))
        )));
        when(matchingService.match(any())).thenReturn(new TutorMatchingResponse(
                null,
                1,
                1,
                List.of(),
                List.of(tutor(920003L, 920003L, "Lê Hoàng Nam", 93))
        ));

        ChatMatchingResult result = adapter.match(
                "Tôi muốn tìm gia sư dạy toán lớp 12 và ôn thi THPT quốc gia, tôi có thể học trực tiếp và online, có thể ưu tiên T2 và T4, kinh nghiệm trên 3 năm.",
                guest()
        );

        assertThat(result.message()).isEqualTo("Tôi tìm được một vài gia sư phù hợp nhất cho môn Toán.");
        assertThat(result.message()).doesNotContain("Ã");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = (List<Map<String, Object>>) result.toolResult().get("items");
        assertThat(items).extracting(item -> item.get("displayName")).contains("Lê Hoàng Nam");

        ArgumentCaptor<iuh.fit.ai_service.dto.TutorMatchingDtos.TutorMatchingRequest> captor =
                ArgumentCaptor.forClass(iuh.fit.ai_service.dto.TutorMatchingDtos.TutorMatchingRequest.class);
        verify(matchingService, atLeastOnce()).match(captor.capture());
        assertThat(captor.getAllValues()).extracting(iuh.fit.ai_service.dto.TutorMatchingDtos.TutorMatchingRequest::teachingMode)
                .containsExactlyInAnyOrder(TeachingMode.ONLINE, TeachingMode.OFFLINE);
        assertThat(captor.getAllValues()).allSatisfy(request -> {
            assertThat(request.budgetMin()).isNull();
            assertThat(request.budgetMax()).isNull();
        });
    }

    private TutorMatchResult tutor(Long tutorId, Long userId, String name, int matchPercentage) {
        return new TutorMatchResult(
                tutorId,
                userId,
                name,
                null,
                "Kinh nghiệm dạy học.",
                null,
                Set.of("ONLINE"),
                new MatchedSubject(101L, 5L, "Toán", 9L, "Lớp 12", 2L, "THPT", 3, BigDecimal.valueOf(200000), BigDecimal.valueOf(300000), null),
                BigDecimal.valueOf(200000),
                List.of(),
                4.8,
                12L,
                3L,
                matchPercentage,
                null,
                List.of("Phù hợp môn học", "Có kinh nghiệm"),
                List.of(),
                List.of(),
                List.of()
        );
    }

    private AiUserContext guest() {
        return AiUserContext.guest();
    }
}
