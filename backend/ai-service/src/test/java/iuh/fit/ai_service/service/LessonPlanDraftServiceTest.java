package iuh.fit.ai_service.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import iuh.fit.ai_service.chatbot.security.AiUserContext;
import iuh.fit.ai_service.chatbot.security.AiUserContextResolver;
import iuh.fit.ai_service.chatbot.service.GeminiTextClient;
import iuh.fit.ai_service.client.LearningCopilotContextClient;
import iuh.fit.ai_service.dto.LearningCopilotDtos.ChapterItem;
import iuh.fit.ai_service.dto.LearningCopilotDtos.LessonContextResponse;
import iuh.fit.ai_service.dto.LearningCopilotDtos.LessonDraftRequest;
import iuh.fit.ai_service.dto.LearningCopilotDtos.LessonDraftResponse;
import iuh.fit.ai_service.dto.LearningCopilotDtos.LessonSessionItem;
import iuh.fit.ai_service.dto.LearningCopilotDtos.ScheduleItem;
import iuh.fit.ai_service.exception.LearningCopilotException;
import iuh.fit.ai_service.service.GeminiService.GeminiUnavailableException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

class LessonPlanDraftServiceTest {
    private LearningCopilotContextClient contextClient;
    private GeminiTextClient geminiTextClient;
    private AiUserContextResolver userContextResolver;
    private LessonPlanDraftService service;

    @BeforeEach
    void setUp() {
        contextClient = mock(LearningCopilotContextClient.class);
        geminiTextClient = mock(GeminiTextClient.class);
        userContextResolver = mock(AiUserContextResolver.class);
        service = new LessonPlanDraftService(
                contextClient,
                geminiTextClient,
                userContextResolver,
                new ObjectMapper()
        );
    }

    @Test
    void tutorRoleCanGenerateDraftFromLearningContext() {
        when(userContextResolver.currentUser()).thenReturn(tutor());
        when(contextClient.lessonContext(42L, 3L)).thenReturn(context());
        when(geminiTextClient.generateText(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.eq(1024)))
                .thenReturn(validGeminiJson());

        LessonDraftResponse response = service.generate(new LessonDraftRequest(42L, 3L));

        assertThat(response.promptVersion()).isEqualTo("lesson-plan-v1");
        assertThat(response.lessonPlan().title()).contains("Khoảng cách");
        assertThat(response.lessonPlan().outline()).hasSize(2);
        assertThat(response.sourceSummary().durationMinutes()).isEqualTo(90);
        verify(contextClient).lessonContext(42L, 3L);
    }

    @Test
    void studentRoleIsDeniedBeforeCallingLearningOrGemini() {
        when(userContextResolver.currentUser()).thenReturn(new AiUserContext(
                910001L,
                "student1@gmail.com",
                "STUDENT",
                List.of("STUDENT"),
                true
        ));

        assertThatThrownBy(() -> service.generate(new LessonDraftRequest(42L, 3L)))
                .isInstanceOf(LearningCopilotException.class)
                .hasMessageContaining("Tutor role is required");
        verifyNoInteractions(contextClient, geminiTextClient);
    }

    @Test
    void requestDtoDoesNotAcceptFrontendIdentityFields() {
        assertThat(Arrays.stream(LessonDraftRequest.class.getRecordComponents()).map(component -> component.getName()))
                .containsExactly("classId", "sessionId")
                .doesNotContain("userId", "tutorId", "tutorEmail", "email");
    }

    @Test
    void learningContextIsPassedToPrompt() {
        when(userContextResolver.currentUser()).thenReturn(tutor());
        when(contextClient.lessonContext(42L, 3L)).thenReturn(context());
        when(geminiTextClient.generateText(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.eq(1024)))
                .thenReturn(validGeminiJson());

        service.generate(new LessonDraftRequest(42L, 3L));

        ArgumentCaptor<String> promptCaptor = ArgumentCaptor.forClass(String.class);
        verify(geminiTextClient).generateText(org.mockito.ArgumentMatchers.anyString(), promptCaptor.capture(), org.mockito.ArgumentMatchers.eq(1024));
        assertThat(promptCaptor.getValue())
                .contains("Toán")
                .contains("Lớp 12")
                .contains("Khoảng cách từ điểm đến mặt phẳng")
                .contains("Vector trong không gian")
                .contains("\"durationMinutes\":90");
    }

    @Test
    void malformedGeminiJsonReturnsControlledUnavailableError() {
        when(userContextResolver.currentUser()).thenReturn(tutor());
        when(contextClient.lessonContext(42L, 3L)).thenReturn(context());
        when(geminiTextClient.generateText(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.eq(1024)))
                .thenReturn("not json");

        assertThatThrownBy(() -> service.generate(new LessonDraftRequest(42L, 3L)))
                .isInstanceOf(GeminiUnavailableException.class)
                .hasMessageContaining("malformed lesson draft JSON");
    }

    @Test
    void geminiUnavailableIsPropagatedSafely() {
        when(userContextResolver.currentUser()).thenReturn(tutor());
        when(contextClient.lessonContext(42L, 3L)).thenReturn(context());
        when(geminiTextClient.generateText(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.eq(1024)))
                .thenThrow(new GeminiUnavailableException("Gemini 503 high demand"));

        assertThatThrownBy(() -> service.generate(new LessonDraftRequest(42L, 3L)))
                .isInstanceOf(GeminiUnavailableException.class)
                .hasMessageContaining("Gemini 503");
    }

    @Test
    void learningForbiddenIsPropagatedWithoutCallingGemini() {
        when(userContextResolver.currentUser()).thenReturn(tutor());
        when(contextClient.lessonContext(42L, 3L)).thenThrow(new LearningCopilotException(
                LearningCopilotException.Reason.FORBIDDEN,
                "Tutor is not allowed to use this class session"
        ));

        assertThatThrownBy(() -> service.generate(new LessonDraftRequest(42L, 3L)))
                .isInstanceOf(LearningCopilotException.class)
                .hasMessageContaining("not allowed");
        verifyNoInteractions(geminiTextClient);
    }

    @Test
    void serviceHasNoLearningMutationClientCalls() {
        when(userContextResolver.currentUser()).thenReturn(tutor());
        when(contextClient.lessonContext(42L, 3L)).thenReturn(context());
        when(geminiTextClient.generateText(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.eq(1024)))
                .thenReturn(validGeminiJson());

        service.generate(new LessonDraftRequest(42L, 3L));

        verify(contextClient).lessonContext(42L, 3L);
        verifyNoMoreInteractions(contextClient);
    }

    private AiUserContext tutor() {
        return new AiUserContext(920001L, "tutor1@gmail.com", "TUTOR", List.of("TUTOR"), true);
    }

    private LessonContextResponse context() {
        return new LessonContextResponse(
                42L,
                3L,
                "Toán 12 hình học không gian",
                "Luyện dựng hình, vector và khoảng cách.",
                "Toán",
                "Lớp 12",
                "ONLINE",
                2,
                90,
                List.of(new ScheduleItem(2, "18:30", "20:00")),
                List.of(new ChapterItem("Khoảng cách và góc trong không gian", "Luyện khoảng cách điểm, đường, mặt.", 6, 2)),
                new LessonSessionItem(3L, 3, "Khoảng cách từ điểm đến mặt phẳng", LocalDate.of(2026, 10, 14), "18:30", "20:00", "SCHEDULED", null, null),
                List.of(
                        new LessonSessionItem(1L, 1, "Dựng hình và quan hệ vuông góc", LocalDate.of(2026, 10, 10), "18:30", "20:00", "COMPLETED", "Bài 1", "Luyện dựng hình"),
                        new LessonSessionItem(2L, 2, "Vector trong không gian", LocalDate.of(2026, 10, 12), "18:30", "20:00", "COMPLETED", "Bài 2", "Luyện vector")
                ),
                1,
                List.of()
        );
    }

    private String validGeminiJson() {
        return """
                {
                  "lessonPlan": {
                    "title": "Khoảng cách từ điểm đến mặt phẳng",
                    "objectives": ["Nhận diện đường vuông góc", "Tính được khoảng cách cơ bản"],
                    "outline": [
                      {"title": "Ôn nhanh kiến thức", "durationMinutes": 15, "description": "Nhắc lại quan hệ vuông góc."},
                      {"title": "Luyện bài vận dụng", "durationMinutes": 60, "description": "Giải bài theo từng bước."}
                    ],
                    "warmup": "Một bài dựng hình ngắn.",
                    "practiceActivities": ["Làm bài mẫu", "Tự giải bài tương tự"],
                    "keyPoints": ["Xác định chân đường vuông góc", "Kiểm tra giả thiết"],
                    "homeworkSuggestion": "Làm 3 bài khoảng cách cơ bản.",
                    "nextSessionSuggestion": "Chuyển sang góc giữa đường và mặt."
                  }
                }
                """;
    }
}
