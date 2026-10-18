package iuh.fit.ai_service.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import iuh.fit.ai_service.chatbot.security.AiUserContext;
import iuh.fit.ai_service.chatbot.security.AiUserContextResolver;
import iuh.fit.ai_service.chatbot.service.GeminiTextClient;
import iuh.fit.ai_service.client.LearningCopilotContextClient;
import iuh.fit.ai_service.dto.LearningCopilotDtos.ChapterItem;
import iuh.fit.ai_service.dto.LearningCopilotDtos.LessonContextResponse;
import iuh.fit.ai_service.dto.LearningCopilotDtos.LessonDraftRequest;
import iuh.fit.ai_service.dto.LearningCopilotDtos.LessonDraftResponse;
import iuh.fit.ai_service.dto.LearningCopilotDtos.LessonPlan;
import iuh.fit.ai_service.dto.LearningCopilotDtos.OutlineItem;
import iuh.fit.ai_service.dto.LearningCopilotDtos.SourceSummary;
import iuh.fit.ai_service.exception.LearningCopilotException;
import iuh.fit.ai_service.service.GeminiService.GeminiUnavailableException;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class LessonPlanDraftService {
    private static final String PROMPT_VERSION = "lesson-plan-v1";

    private final LearningCopilotContextClient contextClient;
    private final GeminiTextClient geminiTextClient;
    private final AiUserContextResolver userContextResolver;
    private final ObjectMapper objectMapper;

    public LessonPlanDraftService(
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

    public LessonDraftResponse generate(LessonDraftRequest request) {
        AiUserContext user = userContextResolver.currentUser();
        if (!user.authenticated() || !user.hasActiveRole("TUTOR")) {
            throw new LearningCopilotException(
                    LearningCopilotException.Reason.FORBIDDEN,
                    "Tutor role is required"
            );
        }

        LessonContextResponse context = contextClient.lessonContext(request.classId(), request.sessionId());
        Integer durationMinutes = resolveDurationMinutes(context);
        String prompt = buildPrompt(context, durationMinutes);
        String raw = geminiTextClient.generateText(systemInstruction(), prompt, 1024);
        LessonPlan lessonPlan = parseLessonPlan(raw);

        List<String> warnings = new ArrayList<>();
        if (context.warnings() != null) {
            warnings.addAll(context.warnings());
        }
        if (durationMinutes == null) {
            warnings.add("Không tính được thời lượng buổi học từ giờ bắt đầu/kết thúc; dùng thời lượng lớp làm tham chiếu.");
        }

        return new LessonDraftResponse(
                UUID.randomUUID(),
                PROMPT_VERSION,
                Instant.now(),
                lessonPlan,
                new SourceSummary(
                        context.classId(),
                        context.sessionId(),
                        context.className(),
                        context.subject(),
                        context.level(),
                        context.learningMode(),
                        durationMinutes
                ),
                warnings.stream().filter(StringUtils::hasText).distinct().toList()
        );
    }

    private String systemInstruction() {
        return """
                Bạn là trợ lý soạn giáo án cho gia sư EduConnect.
                Chỉ trả về JSON hợp lệ, không bọc markdown.
                Viết bằng tiếng Việt có dấu, thực tế, ngắn gọn và có thể chỉnh sửa.
                Không nói rằng bạn đã đọc file PDF/DOC/hình ảnh vì hệ thống chỉ cung cấp dữ liệu text/metadata.
                Không tự tạo bài tập chính thức; homeworkSuggestion chỉ là gợi ý tham khảo để gia sư quyết định.
                """;
    }

    private String buildPrompt(LessonContextResponse context, Integer durationMinutes) {
        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("classId", context.classId());
            payload.put("sessionId", context.sessionId());
            payload.put("className", context.className());
            payload.put("classDescription", context.classDescription());
            payload.put("subject", context.subject());
            payload.put("level", context.level());
            payload.put("learningMode", context.learningMode());
            payload.put("durationMinutes", durationMinutes);
            payload.put("sessionsPerWeek", context.sessionsPerWeek());
            payload.put("schedules", context.schedules());
            payload.put("chapters", context.chapters());
            payload.put("currentSession", sessionPayload(context.currentSession()));
            payload.put("previousSessions", context.previousSessions() == null
                    ? List.of()
                    : context.previousSessions().stream().map(this::sessionPayload).toList());
            payload.put("studentCount", context.studentCount());
            payload.put("warnings", context.warnings());

            String contextJson = objectMapper.writeValueAsString(payload);
            return """
                    Dựa trên context lớp học sau, hãy tạo bản nháp giáo án cho đúng một buổi học.
                    Ưu tiên subject/level hiện tại, bám sát chương học, tránh lặp lại các chủ đề đã hoàn thành.
                    Nếu context thiếu, vẫn tạo bản nháp hữu ích và nêu cảnh báo gián tiếp trong nội dung phù hợp.

                    Context JSON:
                    %s

                    Trả về JSON theo schema:
                    {
                      "lessonPlan": {
                        "title": "string",
                        "objectives": ["string"],
                        "outline": [
                          {"title": "string", "durationMinutes": 10, "description": "string"}
                        ],
                        "warmup": "string",
                        "practiceActivities": ["string"],
                        "keyPoints": ["string"],
                        "homeworkSuggestion": "string",
                        "nextSessionSuggestion": "string"
                      }
                    }
                    """.formatted(contextJson);
        } catch (Exception exception) {
            throw new GeminiUnavailableException("Unable to prepare lesson draft prompt.", exception);
        }
    }

    private Map<String, Object> sessionPayload(iuh.fit.ai_service.dto.LearningCopilotDtos.LessonSessionItem session) {
        if (session == null) {
            return Map.of();
        }
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("sessionId", session.sessionId());
        payload.put("sequenceNumber", session.sequenceNumber());
        payload.put("topic", session.topic());
        payload.put("sessionDate", session.sessionDate() == null ? null : session.sessionDate().toString());
        payload.put("startTime", session.startTime());
        payload.put("endTime", session.endTime());
        payload.put("status", session.status());
        payload.put("assignmentTitle", session.assignmentTitle());
        payload.put("assignmentDescription", session.assignmentDescription());
        return payload;
    }

    private Integer resolveDurationMinutes(LessonContextResponse context) {
        if (context.currentSession() != null
                && StringUtils.hasText(context.currentSession().startTime())
                && StringUtils.hasText(context.currentSession().endTime())) {
            try {
                LocalTime start = LocalTime.parse(context.currentSession().startTime());
                LocalTime end = LocalTime.parse(context.currentSession().endTime());
                long minutes = Duration.between(start, end).toMinutes();
                if (minutes > 0 && minutes <= 480) {
                    return (int) minutes;
                }
            } catch (DateTimeParseException ignored) {
                // Fallback to class duration below.
            }
        }
        return context.durationPerSessionMinutes();
    }

    private LessonPlan parseLessonPlan(String raw) {
        try {
            String json = stripCodeFence(raw);
            JsonNode root = objectMapper.readTree(json);
            JsonNode planNode = root.has("lessonPlan") ? root.get("lessonPlan") : root;
            String title = text(planNode, "title", "Giáo án buổi học");
            List<String> objectives = stringList(planNode.get("objectives"), 5);
            List<OutlineItem> outline = outline(planNode.get("outline"));
            String warmup = text(planNode, "warmup", "");
            List<String> practiceActivities = stringList(planNode.get("practiceActivities"), 6);
            List<String> keyPoints = stringList(planNode.get("keyPoints"), 6);
            String homeworkSuggestion = text(planNode, "homeworkSuggestion", "");
            String nextSessionSuggestion = text(planNode, "nextSessionSuggestion", "");
            return new LessonPlan(
                    title,
                    objectives,
                    outline,
                    warmup,
                    practiceActivities,
                    keyPoints,
                    homeworkSuggestion,
                    nextSessionSuggestion
            );
        } catch (Exception exception) {
            throw new GeminiUnavailableException("Gemini returned malformed lesson draft JSON.", exception);
        }
    }

    private String stripCodeFence(String raw) {
        String value = raw == null ? "" : raw.trim();
        if (value.startsWith("```")) {
            value = value.replaceFirst("^```(?:json)?\\s*", "");
            value = value.replaceFirst("\\s*```$", "");
        }
        if (!StringUtils.hasText(value)) {
            throw new GeminiUnavailableException("Gemini returned an empty lesson draft response.");
        }
        return value;
    }

    private List<OutlineItem> outline(JsonNode node) {
        if (node == null || !node.isArray()) {
            return List.of();
        }
        List<OutlineItem> items = new ArrayList<>();
        for (JsonNode item : node) {
            if (items.size() >= 8) {
                break;
            }
            items.add(new OutlineItem(
                    text(item, "title", "Hoạt động"),
                    positiveInt(item.get("durationMinutes")),
                    text(item, "description", "")
            ));
        }
        return items;
    }

    private List<String> stringList(JsonNode node, int max) {
        if (node == null || !node.isArray()) {
            return List.of();
        }
        List<String> values = new ArrayList<>();
        for (JsonNode item : node) {
            if (values.size() >= max) {
                break;
            }
            String value = item.asText("").trim();
            if (StringUtils.hasText(value)) {
                values.add(value);
            }
        }
        return values;
    }

    private String text(JsonNode node, String field, String fallback) {
        if (node == null || node.get(field) == null) {
            return fallback;
        }
        String value = node.get(field).asText("").trim();
        return StringUtils.hasText(value) ? value : fallback;
    }

    private Integer positiveInt(JsonNode node) {
        if (node == null || !node.canConvertToInt()) {
            return null;
        }
        int value = node.asInt();
        return value > 0 ? value : null;
    }
}
