package iuh.fit.ai_service.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import iuh.fit.ai_service.chatbot.service.GeminiTextClient;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CommunityRewriteAssistantTest {
    private final GeminiTextClient provider = mock(GeminiTextClient.class);
    private final CommunityRewriteAssistant assistant = new CommunityRewriteAssistant(provider, new ObjectMapper());
    private final CommunityRewriteAssistant.Request request = new CommunityRewriteAssistant.Request(
            "STUDENT_FIND_TUTOR", "Tìm gia sư Toán", "Cần học Toán nhưng nội dung chưa phù hợp",
            "NEEDS_EDIT", List.of("PROFANITY"), "Vui lòng dùng ngôn ngữ phù hợp.");

    @Test void parsesPlainAndCodeFencedStructuredResults() {
        String json = "{\"canRewrite\":true,\"suggestedTitle\":\"Tìm gia sư Toán\","
                + "\"suggestedContent\":\"Mình cần gia sư hỗ trợ ôn Toán.\","
                + "\"summaryOfChanges\":\"Đã điều chỉnh ngôn từ.\"}";
        when(provider.generateText(anyString(), anyString(), anyInt())).thenReturn(json, "```json\n" + json + "\n```");
        assertTrue(assistant.rewrite(request).canRewrite());
        assertEquals("Tìm gia sư Toán", assistant.rewrite(request).suggestedTitle());
    }

    @Test void rejectsMalformedMissingAndExtraFields() {
        when(provider.generateText(anyString(), anyString(), anyInt())).thenReturn(
                "{", "{\"canRewrite\":true,\"suggestedTitle\":\"x\",\"summaryOfChanges\":\"x\"}",
                "{\"canRewrite\":true,\"suggestedTitle\":\"x\",\"suggestedContent\":\"y\","
                        + "\"summaryOfChanges\":\"z\",\"inventedPrice\":100000}");
        for (int i = 0; i < 3; i++) {
            assertThrows(GeminiService.GeminiUnavailableException.class, () -> assistant.rewrite(request));
        }
    }

    @Test void rejectsInventedContactOrPaymentFacts() {
        when(provider.generateText(anyString(), anyString(), anyInt())).thenReturn(
                "{\"canRewrite\":true,\"suggestedTitle\":\"Tìm gia sư\","
                        + "\"suggestedContent\":\"Liên hệ 0901234567 và chuyển khoản trước.\","
                        + "\"summaryOfChanges\":\"Đã sửa.\"}");
        assertThrows(GeminiService.GeminiUnavailableException.class, () -> assistant.rewrite(request));
    }

    @Test void controlledCannotRewriteResultIsAccepted() {
        when(provider.generateText(anyString(), anyString(), anyInt())).thenReturn(
                "{\"canRewrite\":false,\"suggestedTitle\":\"\",\"suggestedContent\":\"\","
                        + "\"summaryOfChanges\":\"Không thể giữ lại ý định giáo dục an toàn.\"}");
        var result = assistant.rewrite(request);
        assertFalse(result.canRewrite());
        assertNull(result.suggestedTitle());
    }

    @Test void rejectedIntentNeverReachesProvider() {
        var rejected = new CommunityRewriteAssistant.Request(
                "STUDENT_FIND_TUTOR", "Nội dung bị từ chối", "Tìm dịch vụ không phù hợp",
                "REJECTED", List.of("OTHER_UNSAFE"), "Mục đích không phù hợp");
        assertThrows(IllegalArgumentException.class, () -> assistant.rewrite(rejected));
        verifyNoInteractions(provider);
    }

    @Test void needsReviewIntentNeverReachesProvider() {
        var needsReview = new CommunityRewriteAssistant.Request(
                "STUDENT_FIND_TUTOR", "Nội dung chưa rõ", "Em muốn học mấy thứ 18+",
                "NEEDS_REVIEW", List.of("OTHER_UNSAFE"), "Cần người kiểm duyệt");
        assertThrows(IllegalArgumentException.class, () -> assistant.rewrite(needsReview));
        verifyNoInteractions(provider);
    }
}
