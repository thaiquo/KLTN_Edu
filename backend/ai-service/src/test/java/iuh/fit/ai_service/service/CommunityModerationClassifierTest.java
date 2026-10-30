package iuh.fit.ai_service.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import iuh.fit.ai_service.chatbot.service.GeminiTextClient;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import java.util.stream.Stream;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

class CommunityModerationClassifierTest {
    GeminiTextClient provider = mock(GeminiTextClient.class);
    CommunityModerationClassifier classifier = new CommunityModerationClassifier(provider, new ObjectMapper(), "test-model");

    static Stream<Arguments> intentCases() {
        return Stream.of(
                Arguments.of("Em muốn học xác suất thông qua ví dụ chơi bài", "ALLOW"),
                Arguments.of("Phân tích xác suất bằng bộ bài", "ALLOW"),
                Arguments.of("Em cần gia sư biết đánh bài", "NEEDS_EDIT"),
                Arguments.of("Em muốn học đánh bài với người dạy", "NEEDS_EDIT"),
                Arguments.of("Em cần gia sư tổ chức cờ bạc", "REJECT"),
                Arguments.of("Em muốn học cách tổ chức sòng bạc", "REJECT"),
                Arguments.of("Em muốn học giáo dục giới tính", "ALLOW"),
                Arguments.of("Em muốn học kiến thức về sức khỏe sinh sản", "ALLOW"),
                Arguments.of("Em cần người dạy về tình dục an toàn trong môn giáo dục sức khỏe", "ALLOW"),
                Arguments.of("Phân tích tác hại của việc tổ chức cờ bạc", "ALLOW"),
                Arguments.of("Giáo dục phòng chống mại dâm", "ALLOW"),
                Arguments.of("Em cần người chỉ mấy trò người lớn", "NEEDS_REVIEW"),
                Arguments.of("Em muốn học mấy thứ 18+", "NEEDS_REVIEW"),
                Arguments.of("Em muốn tìm hiểu chuyện người lớn để chuẩn bị bài giáo dục giới tính", "ALLOW"),
                Arguments.of("Em cần người chỉ cách kiếm tiền bằng đánh bài", "NEEDS_REVIEW"),
                Arguments.of("Em muốn học về tình dục", "NEEDS_EDIT"),
                Arguments.of("Em cần người mở phòng đồi trụy tình dục", "REJECT"),
                Arguments.of("Em tìm dịch vụ tình dục", "REJECT"),
                Arguments.of("Em cần người cung cấp dịch vụ tình dục", "REJECT"));
    }

    @ParameterizedTest
    @MethodSource("intentCases")
    void appliesDeterministicIntentPolicyWithoutCallingProvider(String content, String expected) {
        var result = classifier.classify(new CommunityModerationClassifier.Request(
                "STUDENT_FIND_TUTOR", "Nhu cầu học tập", content));
        assertEquals(expected, result.recommendation().name());
        assertEquals("deterministic-policy", result.model());
        verifyNoInteractions(provider);
    }

    @ParameterizedTest
    @CsvSource({"ALLOW,LOW,", "NEEDS_EDIT,MEDIUM,HARASSMENT", "NEEDS_REVIEW,MEDIUM,OTHER_UNSAFE", "REJECT,HIGH,SPAM",
            "REJECT,HIGH,HARASSMENT", "REJECT,HIGH,PROFANITY", "REJECT,HIGH,SEXUAL_INAPPROPRIATE",
            "REJECT,HIGH,SCAM_FRAUD"})
    void acceptsTypedProviderResults(String decision, String risk, String category) {
        String categories = category == null ? "[]" : "[\"" + category + "\"]";
        when(provider.generateText(anyString(), anyString(), anyInt())).thenReturn(
                "{\"recommendation\":\"" + decision + "\",\"riskLevel\":\"" + risk
                        + "\",\"categories\":" + categories + ",\"reason\":\"Nội dung đã được kiểm tra.\"}");
        var result = classifier.classify(new CommunityModerationClassifier.Request("TUTOR_POLL", "Bài viết", "Nội dung cần kiểm tra"));
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
