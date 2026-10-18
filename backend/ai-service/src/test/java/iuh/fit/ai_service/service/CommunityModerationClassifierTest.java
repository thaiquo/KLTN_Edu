package iuh.fit.ai_service.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import iuh.fit.ai_service.chatbot.service.GeminiTextClient;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CommunityModerationClassifierTest {
    GeminiTextClient provider = mock(GeminiTextClient.class);
    CommunityModerationClassifier classifier = new CommunityModerationClassifier(provider, new ObjectMapper(), "test-model");

    @ParameterizedTest
    @CsvSource({"ALLOW,LOW,", "NEEDS_EDIT,MEDIUM,HARASSMENT", "REJECT,HIGH,SPAM",
            "REJECT,HIGH,HARASSMENT", "REJECT,HIGH,PROFANITY", "REJECT,HIGH,SEXUAL_INAPPROPRIATE",
            "REJECT,HIGH,SCAM_FRAUD"})
    void acceptsTypedProviderResults(String decision, String risk, String category) {
        String categories = category == null ? "[]" : "[\"" + category + "\"]";
        when(provider.generateText(anyString(), anyString(), anyInt())).thenReturn(
                "{\"recommendation\":\"" + decision + "\",\"riskLevel\":\"" + risk
                        + "\",\"categories\":" + categories + ",\"reason\":\"Nội dung đã được kiểm tra.\"}");
        var result = classifier.classify(new CommunityModerationClassifier.Request("TUTOR_POLL", "Giáo dục", "giáo dục giới tính"));
        assertEquals(decision, result.recommendation().name());
        var prompt = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(provider).generateText(prompt.capture(), anyString(), anyInt());
        assertTrue(prompt.getValue().contains("bài toán xác suất cá cược"));
        assertTrue(prompt.getValue().contains("cách nhận biết lừa đảo"));
    }

    @Test void malformedAndUnknownResultsFail() {
        var request = new CommunityModerationClassifier.Request("STUDENT_FIND_TUTOR", "test", "test");
        when(provider.generateText(anyString(), anyString(), anyInt())).thenReturn("{", "{\"recommendation\":\"UNKNOWN\",\"riskLevel\":\"LOW\",\"categories\":[],\"reason\":\"ok\"}", "{}");
        for (int i = 0; i < 3; i++) assertThrows(GeminiService.GeminiUnavailableException.class, () -> classifier.classify(request));
    }

    @Test void acceptsProviderJsonCodeFenceWithoutRelaxingJsonValidation() {
        var request = new CommunityModerationClassifier.Request("STUDENT_FIND_TUTOR", "test", "test");
        when(provider.generateText(anyString(), anyString(), anyInt())).thenReturn(
                "```json\n{\"recommendation\":\"ALLOW\",\"riskLevel\":\"LOW\",\"categories\":[],\"reason\":\"Nội dung phù hợp.\"}\n```",
                "```json\n{\"recommendation\":\"ALLOW\"} trailing\n```");
        assertEquals(CommunityModerationClassifier.Recommendation.ALLOW, classifier.classify(request).recommendation());
        assertThrows(GeminiService.GeminiUnavailableException.class, () -> classifier.classify(request));
    }
}
