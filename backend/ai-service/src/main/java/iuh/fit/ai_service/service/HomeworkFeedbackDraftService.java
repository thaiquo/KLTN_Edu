package iuh.fit.ai_service.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import iuh.fit.ai_service.chatbot.security.AiUserContext;
import iuh.fit.ai_service.chatbot.security.AiUserContextResolver;
import iuh.fit.ai_service.chatbot.service.GeminiTextClient;
import iuh.fit.ai_service.client.LearningCopilotContextClient;
import iuh.fit.ai_service.dto.LearningCopilotDtos.HomeworkFeedback;
import iuh.fit.ai_service.dto.LearningCopilotDtos.HomeworkFeedbackContextResponse;
import iuh.fit.ai_service.dto.LearningCopilotDtos.HomeworkFeedbackDraftRequest;
import iuh.fit.ai_service.dto.LearningCopilotDtos.HomeworkFeedbackDraftResponse;
import iuh.fit.ai_service.exception.LearningCopilotException;
import iuh.fit.ai_service.service.GeminiService.GeminiUnavailableException;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class HomeworkFeedbackDraftService {
    private static final String PROMPT_VERSION = "homework-feedback-v1";
    private static final String FILE_SAFETY_WARNING =
            "AI không đọc hoặc kiểm tra tệp bài nộp; nội dung chỉ dựa trên đánh giá của gia sư.";

    private final LearningCopilotContextClient contextClient;
    private final GeminiTextClient geminiTextClient;
    private final AiUserContextResolver userContextResolver;
    private final ObjectMapper objectMapper;

    public HomeworkFeedbackDraftService(
            LearningCopilotContextClient contextClient,
            GeminiTextClient geminiTextClient,
            AiUserContextResolver userContextResolver,
            ObjectMapper objectMapper
    ) {
        this.contextClient = contextClient;
        this.geminiTextClient = geminiTextClient;
        this.userContextResolver = userContextResolver;
        this.objectMapper = objectMapper;
    }

    public HomeworkFeedbackDraftResponse generate(HomeworkFeedbackDraftRequest request) {
        AiUserContext user = userContextResolver.currentUser();
        if (!user.authenticated() || !user.hasActiveRole("TUTOR")) {
            throw new LearningCopilotException(LearningCopilotException.Reason.FORBIDDEN, "Tutor role is required");
        }
        if (!hasSignal(request)) {
            throw new LearningCopilotException(
                    LearningCopilotException.Reason.BAD_REQUEST,
                    "Vui lòng nhập điểm hoặc chọn/ghi một số nhận xét trước khi dùng AI."
            );
        }

        HomeworkFeedbackContextResponse context = contextClient.homeworkFeedbackContext(
                request.classId(), request.sessionId(), request.attendanceId()
        );
        String raw = geminiTextClient.generateText(systemInstruction(), buildPrompt(context, request), 700);
        HomeworkFeedback feedback = parseFeedback(raw);

        return new HomeworkFeedbackDraftResponse(
                UUID.randomUUID(),
                PROMPT_VERSION,
                Instant.now(),
                feedback,
                List.of(FILE_SAFETY_WARNING)
        );
    }

    private boolean hasSignal(HomeworkFeedbackDraftRequest request) {
        return StringUtils.hasText(request.score())
                || StringUtils.hasText(request.tutorNotes())
                || (request.selectedFeedback() != null && request.selectedFeedback().stream().anyMatch(StringUtils::hasText));
    }

    private String systemInstruction() {
        return """
                Bạn là trợ lý hỗ trợ gia sư EduConnect viết nhận xét bài tập.
                Chỉ trả về JSON hợp lệ, không bọc markdown. Viết tiếng Việt có dấu, tôn trọng,
                cụ thể và ngắn gọn.
                Bạn chưa đọc, chưa kiểm tra và không được suy luận từ bất kỳ tệp bài nộp nào.
                Chỉ dùng metadata bài tập và tín hiệu đánh giá do gia sư cung cấp.
                Không tự chấm điểm, không đề xuất hoặc thay đổi điểm, không khẳng định học viên sai/đúng
                ở một câu cụ thể nếu gia sư không nói rõ. Không bịa ưu điểm hay lỗi sai.
                Nhận xét nhanh và ghi chú của gia sư là bằng chứng, không được lặp lại nguyên văn ở nhiều phần.
                Mỗi phần phải nêu một ý riêng. finalComment chỉ là lời nhận xét hoàn chỉnh ngắn, không tóm tắt
                hoặc lặp lại toàn bộ ưu điểm và điểm cần cải thiện. Không tạo văn bản lỗi mã hóa.
                """;
    }

    private String buildPrompt(HomeworkFeedbackContextResponse context, HomeworkFeedbackDraftRequest request) {
        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("homeworkTitle", context.homeworkTitle());
            payload.put("homeworkDescription", context.homeworkDescription());
            payload.put("subject", context.subject());
            payload.put("level", context.level());
            payload.put("tutorSelectedScore", trim(request.score()));
            payload.put("selectedFeedback", normalizedSignals(request.selectedFeedback(), 3));
            payload.put("tutorNotes", trim(request.tutorNotes()));

            return """
                    Viết bản nháp nhận xét bài tập dựa duy nhất trên JSON bên dưới.
                    Điểm (nếu có) do gia sư chọn chỉ dùng để điều chỉnh giọng điệu; tuyệt đối không nói
                    rằng bạn cho điểm, không đề xuất điểm và không thay đổi điểm.
                    Không nói bạn đã xem tệp bài nộp. Nếu dữ liệu không đủ, hãy giữ nhận xét khiêm tốn,
                    không bịa chi tiết. Không lặp lại nguyên văn tag/ghi chú của gia sư ở nhiều trường.
                    Không diễn đạt lại cùng một ý ở strengths, improvements, nextSteps và finalComment.
                    finalComment tối đa hai câu, tự nhiên để gia sư chèn trực tiếp vào ô nhận xét.

                    Context JSON:
                    %s

                    Trả về JSON theo schema:
                    {
                      "feedback": {
                        "summary": "tối đa một câu, chỉ dùng khi có thông tin mới",
                        "strengths": ["tối đa 2 ý, không trùng phần khác"],
                        "improvements": ["tối đa 2 ý, không trùng phần khác"],
                        "nextSteps": ["tối đa 2 ý"],
                        "finalComment": "tối đa hai câu, không tóm tắt lại các bullet"
                      }
                    }
                    """.formatted(objectMapper.writeValueAsString(payload));
        } catch (Exception exception) {
            throw new GeminiUnavailableException("Unable to prepare homework feedback prompt.", exception);
        }
    }

    private HomeworkFeedback parseFeedback(String raw) {
        try {
            JsonNode root = objectMapper.readTree(stripCodeFence(raw));
            JsonNode feedback = root.has("feedback") ? root.get("feedback") : root;
            String finalComment = text(feedback, "finalComment");
            if (!StringUtils.hasText(finalComment)) {
                throw new IllegalArgumentException("finalComment is required");
            }
            List<String> usedIdeas = new ArrayList<>();
            List<String> strengths = distinctIdeas(strings(feedback.get("strengths"), 2), usedIdeas);
            List<String> improvements = distinctIdeas(strings(feedback.get("improvements"), 2), usedIdeas);
            List<String> nextSteps = distinctIdeas(strings(feedback.get("nextSteps"), 2), usedIdeas);
            return new HomeworkFeedback(
                    conciseSentence(text(feedback, "summary")),
                    strengths,
                    improvements,
                    nextSteps,
                    conciseFinalComment(finalComment, usedIdeas)
            );
        } catch (Exception exception) {
            throw new GeminiUnavailableException("Gemini returned malformed homework feedback JSON.", exception);
        }
    }

    private String stripCodeFence(String raw) {
        String value = raw == null ? "" : raw.trim();
        if (value.startsWith("```")) {
            value = value.replaceFirst("^```(?:json)?\\s*", "");
            value = value.replaceFirst("\\s*```$", "");
        }
        if (!StringUtils.hasText(value)) {
            throw new GeminiUnavailableException("Gemini returned an empty homework feedback response.");
        }
        return value;
    }

    private List<String> strings(JsonNode node, int max) {
        if (node == null || !node.isArray()) {
            return List.of();
        }
        List<String> values = new ArrayList<>();
        for (JsonNode item : node) {
            String value = trim(item.asText(""));
            ensureVietnameseText(value);
            if (StringUtils.hasText(value) && !values.contains(value)) {
                values.add(value);
            }
            if (values.size() >= max) {
                break;
            }
        }
        return values;
    }

    private List<String> normalizedSignals(List<String> values, int max) {
        if (values == null) {
            return List.of();
        }
        return values.stream().map(this::trim).filter(StringUtils::hasText).distinct().limit(max).toList();
    }

    private String text(JsonNode node, String field) {
        String value = node == null || node.get(field) == null ? "" : trim(node.get(field).asText(""));
        ensureVietnameseText(value);
        return value;
    }

    private String trim(String value) {
        return value == null ? "" : value.trim();
    }

    private List<String> distinctIdeas(List<String> values, List<String> usedIdeas) {
        List<String> result = new ArrayList<>();
        for (String value : values) {
            if (usedIdeas.stream().noneMatch(existing -> sameIdea(existing, value))) {
                result.add(value);
                usedIdeas.add(value);
            }
        }
        return result;
    }

    private String conciseSentence(String value) {
        return sentences(value, 1);
    }

    private String conciseFinalComment(String value, List<String> usedIdeas) {
        String concise = sentences(value, 2);
        if (!StringUtils.hasText(concise)) {
            throw new IllegalArgumentException("finalComment is required");
        }
        // Reject exact or near-copy output rather than persisting a redundant AI draft.
        if (usedIdeas.stream().anyMatch(existing -> sameIdea(existing, concise))) {
            throw new IllegalArgumentException("finalComment duplicates a structured feedback item");
        }
        return concise;
    }

    private String sentences(String value, int max) {
        if (!StringUtils.hasText(value)) {
            return "";
        }
        String[] parts = value.trim().split("(?<=[.!?])\\s+");
        StringBuilder result = new StringBuilder();
        for (int index = 0; index < Math.min(parts.length, max); index++) {
            if (StringUtils.hasText(parts[index])) {
                if (result.length() > 0) result.append(' ');
                result.append(parts[index].trim());
            }
        }
        return result.toString();
    }

    private boolean sameIdea(String left, String right) {
        String normalizedLeft = normalizeIdea(left);
        String normalizedRight = normalizeIdea(right);
        if (normalizedLeft.equals(normalizedRight)) {
            return true;
        }
        String[] leftTokens = normalizedLeft.split(" ");
        String[] rightTokens = normalizedRight.split(" ");
        List<String> leftMeaningful = java.util.Arrays.stream(leftTokens).filter(token -> token.length() > 3).distinct().toList();
        List<String> rightMeaningful = java.util.Arrays.stream(rightTokens).filter(token -> token.length() > 3).distinct().toList();
        if (leftMeaningful.isEmpty() || rightMeaningful.isEmpty()) {
            return false;
        }
        long overlap = leftMeaningful.stream().filter(rightMeaningful::contains).count();
        return (double) overlap / Math.min(leftMeaningful.size(), rightMeaningful.size()) >= 0.8;
    }

    private String normalizeIdea(String value) {
        String decomposed = Normalizer.normalize(value == null ? "" : value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
        return decomposed.toLowerCase().replaceAll("[^a-z0-9]+", " ").trim().replaceAll("\\s+", " ");
    }

    private void ensureVietnameseText(String value) {
        if (StringUtils.hasText(value) && (value.contains("Ã") || value.contains("�"))) {
            throw new IllegalArgumentException("Gemini returned malformed Vietnamese text");
        }
    }
}
