package iuh.fit.ai_service.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import iuh.fit.ai_service.chatbot.security.AiUserContext;
import iuh.fit.ai_service.chatbot.security.AiUserContextResolver;
import iuh.fit.ai_service.chatbot.service.GeminiTextClient;
import iuh.fit.ai_service.client.LearningCopilotContextClient;
import iuh.fit.ai_service.dto.LearningCopilotDtos.HomeworkFeedbackContextResponse;
import iuh.fit.ai_service.dto.LearningCopilotDtos.HomeworkFeedbackDraftRequest;
import iuh.fit.ai_service.dto.LearningCopilotDtos.HomeworkFeedbackDraftResponse;
import iuh.fit.ai_service.exception.LearningCopilotException;
import iuh.fit.ai_service.service.GeminiService.GeminiUnavailableException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class HomeworkFeedbackDraftServiceTest {
    private LearningCopilotContextClient contextClient;
    private GeminiTextClient geminiTextClient;
    private AiUserContextResolver userContextResolver;
    private HomeworkFeedbackDraftService service;

    @BeforeEach
    void setUp() {
        contextClient = mock(LearningCopilotContextClient.class);
        geminiTextClient = mock(GeminiTextClient.class);
        userContextResolver = mock(AiUserContextResolver.class);
        service = new HomeworkFeedbackDraftService(contextClient, geminiTextClient, userContextResolver, new ObjectMapper());
    }

    @Test
    void authorizedTutorGetsStructuredDraftWithoutAttachmentContent() {
        when(userContextResolver.currentUser()).thenReturn(tutor());
        when(contextClient.homeworkFeedbackContext(42L, 4L, 99L)).thenReturn(context());
        when(geminiTextClient.generateText(anyString(), anyString(), eq(700))).thenReturn(validJson());

        HomeworkFeedbackDraftResponse response = service.generate(request());

        assertThat(response.promptVersion()).isEqualTo("homework-feedback-v1");
        assertThat(response.feedback().strengths()).containsExactly("Đã nắm được công thức chính");
        assertThat(response.warnings()).singleElement().matches(value -> value.contains("không đọc"));
        assertThat(Arrays.stream(HomeworkFeedbackDraftResponse.class.getRecordComponents()).map(component -> component.getName()))
                .doesNotContain("score", "gradeScore");

        ArgumentCaptor<String> promptCaptor = ArgumentCaptor.forClass(String.class);
        verify(geminiTextClient).generateText(anyString(), promptCaptor.capture(), eq(700));
        assertThat(promptCaptor.getValue())
                .contains("Toán")
                .contains("Sai một số bước tính")
                .doesNotContain("https://")
                .doesNotContain("submissionFile")
                .doesNotContain("attachment");
    }

    @Test
    void studentIsDeniedBeforeCallingLearningOrGemini() {
        when(userContextResolver.currentUser()).thenReturn(new AiUserContext(910001L, "student@gmail.com", "STUDENT", List.of("STUDENT"), true));

        assertThatThrownBy(() -> service.generate(request()))
                .isInstanceOf(LearningCopilotException.class)
                .hasMessageContaining("Tutor role is required");
        verifyNoInteractions(contextClient, geminiTextClient);
    }

    @Test
    void otherTutorIsDeniedWhenLearningContextRejectsOwnership() {
        when(userContextResolver.currentUser()).thenReturn(tutor());
        when(contextClient.homeworkFeedbackContext(42L, 4L, 99L)).thenThrow(new LearningCopilotException(
                LearningCopilotException.Reason.FORBIDDEN, "Tutor is not allowed to grade this homework"));

        assertThatThrownBy(() -> service.generate(request()))
                .isInstanceOf(LearningCopilotException.class)
                .hasMessageContaining("not allowed");
        verifyNoInteractions(geminiTextClient);
    }

    @Test
    void missingEvaluationSignalsAreRejectedWithoutAnyRemoteCall() {
        when(userContextResolver.currentUser()).thenReturn(tutor());

        assertThatThrownBy(() -> service.generate(new HomeworkFeedbackDraftRequest(42L, 4L, 99L, "", List.of(), "")))
                .isInstanceOf(LearningCopilotException.class)
                .hasMessageContaining("nhập điểm");
        verifyNoInteractions(contextClient, geminiTextClient);
    }

    @Test
    void malformedGeminiResponseIsHandled() {
        when(userContextResolver.currentUser()).thenReturn(tutor());
        when(contextClient.homeworkFeedbackContext(42L, 4L, 99L)).thenReturn(context());
        when(geminiTextClient.generateText(anyString(), anyString(), eq(700))).thenReturn("not json");

        assertThatThrownBy(() -> service.generate(request()))
                .isInstanceOf(GeminiUnavailableException.class)
                .hasMessageContaining("malformed homework feedback JSON");
    }

    @Test
    void geminiUnavailableIsPropagatedWithoutMutation() {
        when(userContextResolver.currentUser()).thenReturn(tutor());
        when(contextClient.homeworkFeedbackContext(42L, 4L, 99L)).thenReturn(context());
        when(geminiTextClient.generateText(anyString(), anyString(), eq(700)))
                .thenThrow(new GeminiUnavailableException("Gemini unavailable"));

        assertThatThrownBy(() -> service.generate(request()))
                .isInstanceOf(GeminiUnavailableException.class)
                .hasMessageContaining("unavailable");
        verify(contextClient).homeworkFeedbackContext(42L, 4L, 99L);
    }

    @Test
    void duplicateIdeasAcrossStructuredSectionsAreRemovedBeforeReturning() {
        when(userContextResolver.currentUser()).thenReturn(tutor());
        when(contextClient.homeworkFeedbackContext(42L, 4L, 99L)).thenReturn(context());
        when(geminiTextClient.generateText(anyString(), anyString(), eq(700))).thenReturn("""
                {"feedback":{"summary":"","strengths":["Đã nắm được kiến thức trọng tâm"],"improvements":["Đã nắm được kiến thức trọng tâm","Cần kiểm tra kỹ bước tính"],"nextSteps":["Rà soát phép tính trước khi nộp"],"finalComment":"Em hãy kiểm tra kỹ từng bước trước khi nộp bài nhé."}}
                """);

        HomeworkFeedbackDraftResponse response = service.generate(request());

        assertThat(response.feedback().strengths()).containsExactly("Đã nắm được kiến thức trọng tâm");
        assertThat(response.feedback().improvements()).containsExactly("Cần kiểm tra kỹ bước tính");
        assertThat(response.feedback().nextSteps()).containsExactly("Rà soát phép tính trước khi nộp");
        assertThat(response.feedback().finalComment()).doesNotContain("Đã nắm được kiến thức trọng tâm");
    }

    @Test
    void multipleTagsAndTutorNotesAreEvidenceNotRepeatedVerbatimInPromptInstructions() {
        when(userContextResolver.currentUser()).thenReturn(tutor());
        when(contextClient.homeworkFeedbackContext(42L, 4L, 99L)).thenReturn(context());
        when(geminiTextClient.generateText(anyString(), anyString(), eq(700))).thenReturn(validJson());

        service.generate(new HomeworkFeedbackDraftRequest(42L, 4L, 99L, "6.5",
                List.of("Đã nắm được kiến thức trọng tâm, cần rèn luyện tính toán cẩn thận hơn.", "Trình bày rõ ràng."),
                "Sai câu 2, tính ẩu"));

        ArgumentCaptor<String> promptCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> systemCaptor = ArgumentCaptor.forClass(String.class);
        verify(geminiTextClient).generateText(systemCaptor.capture(), promptCaptor.capture(), eq(700));
        assertThat(promptCaptor.getValue()).contains("Sai câu 2, tính ẩu").contains("6.5");
        assertThat(systemCaptor.getValue()).contains("không được lặp lại nguyên văn");
    }

    @Test
    void finalCommentIsLimitedToTwoSentencesAndMojibakeIsRejected() {
        when(userContextResolver.currentUser()).thenReturn(tutor());
        when(contextClient.homeworkFeedbackContext(42L, 4L, 99L)).thenReturn(context());
        when(geminiTextClient.generateText(anyString(), anyString(), eq(700))).thenReturn("""
                {"feedback":{"summary":"","strengths":[],"improvements":[],"nextSteps":[],"finalComment":"Em đã cố gắng. Hãy kiểm tra kỹ hơn. Chúc em tiến bộ."}}
                """);

        assertThat(service.generate(request()).feedback().finalComment())
                .isEqualTo("Em đã cố gắng. Hãy kiểm tra kỹ hơn.");

        when(geminiTextClient.generateText(anyString(), anyString(), eq(700))).thenReturn("""
                {"feedback":{"summary":"","strengths":[],"improvements":[],"nextSteps":[],"finalComment":"Nội dung bị Ã¢ lỗi."}}
                """);
        assertThatThrownBy(() -> service.generate(request()))
                .isInstanceOf(GeminiUnavailableException.class)
                .hasMessageContaining("malformed homework feedback JSON");
    }

    private HomeworkFeedbackDraftRequest request() {
        return new HomeworkFeedbackDraftRequest(42L, 4L, 99L, "7.5",
                List.of("Đã nắm được kiến thức trọng tâm"), "Sai một số bước tính, trình bày chưa rõ");
    }

    private HomeworkFeedbackContextResponse context() {
        return new HomeworkFeedbackContextResponse(42L, 4L, 99L,
                "Bài luyện tập hàm số", "Hoàn thành các bài vận dụng.", "Toán", "Lớp 12");
    }

    private AiUserContext tutor() {
        return new AiUserContext(920001L, "tutor@gmail.com", "TUTOR", List.of("TUTOR"), true);
    }

    private String validJson() {
        return """
                {"feedback":{"summary":"Em đã có nền tảng tốt.","strengths":["Đã nắm được công thức chính"],"improvements":["Cần cẩn thận hơn ở các bước tính"],"nextSteps":["Xem lại câu 2"],"finalComment":"Em hãy kiểm tra kỹ từng bước tính và trình bày rõ hơn."}}
                """;
    }
}
