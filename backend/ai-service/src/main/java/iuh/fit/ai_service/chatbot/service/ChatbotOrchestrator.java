package iuh.fit.ai_service.chatbot.service;

import iuh.fit.ai_service.chatbot.dto.ChatbotDtos.ChatResponse;
import iuh.fit.ai_service.chatbot.dto.ChatbotDtos.ChatRequest;
import iuh.fit.ai_service.chatbot.dto.ChatbotDtos.SourceReference;
import iuh.fit.ai_service.chatbot.model.ChatIntent;
import iuh.fit.ai_service.chatbot.model.ChatRole;
import iuh.fit.ai_service.chatbot.service.private_tools.ChatPrivateToolAdapter;
import iuh.fit.ai_service.chatbot.rag.ChatKnowledgeModels.KnowledgeSearchHit;
import iuh.fit.ai_service.chatbot.rag.ChatRagRetriever;
import iuh.fit.ai_service.chatbot.security.AiUserContext;
import iuh.fit.ai_service.service.embedding.EmbeddingException;
import iuh.fit.ai_service.service.GeminiService.GeminiUnavailableException;
import iuh.fit.ai_service.service.semantic.SemanticVectorStoreException;
import org.springframework.stereotype.Service;

import java.text.Normalizer;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class ChatbotOrchestrator {
    private final ChatIntentClassifier intentClassifier;
    private final ChatPromptBuilder promptBuilder;
    private final ChatToolRegistry toolRegistry;
    private final GeminiTextClient geminiTextClient;
    private final ChatRagRetriever ragRetriever;
    private final ChatTutorMatchingAdapter tutorMatchingAdapter;
    private final ChatClassMatchingAdapter classMatchingAdapter;
    private final ChatPublicLookupAdapter publicLookupAdapter;
    private final ChatPrivateToolAdapter privateToolAdapter;

    public ChatbotOrchestrator(
            ChatIntentClassifier intentClassifier,
            ChatPromptBuilder promptBuilder,
            ChatToolRegistry toolRegistry,
            GeminiTextClient geminiTextClient,
            ChatRagRetriever ragRetriever,
            ChatTutorMatchingAdapter tutorMatchingAdapter,
            ChatClassMatchingAdapter classMatchingAdapter,
            ChatPublicLookupAdapter publicLookupAdapter,
            ChatPrivateToolAdapter privateToolAdapter
    ) {
        this.intentClassifier = intentClassifier;
        this.promptBuilder = promptBuilder;
        this.toolRegistry = toolRegistry;
        this.geminiTextClient = geminiTextClient;
        this.ragRetriever = ragRetriever;
        this.tutorMatchingAdapter = tutorMatchingAdapter;
        this.classMatchingAdapter = classMatchingAdapter;
        this.publicLookupAdapter = publicLookupAdapter;
        this.privateToolAdapter = privateToolAdapter;
    }

    public ChatResponse respond(ChatRequest request, AiUserContext userContext) {
        String message = request.message().trim();
        ChatIntent intent = intentClassifier.classify(message);
        String matchingMessage = matchingMessage(message, request, intent);
        intent = continuePendingMatchingIntent(intent, matchingMessage, request);

        if (intent == ChatIntent.PRIVATE_DATA_REQUEST) {
            return new ChatResponse(
                    privateDataMessage(userContext),
                    intent,
                    List.of(),
                    userContext.authenticated()
                            ? List.of()
                            : toolRegistry.publicNavigationActions(userContext, "đăng nhập"),
                    null
            );
        }

        if (intent == ChatIntent.MUTATION_REQUEST) {
            ChatMatchingResult result = privateToolAdapter.mutationDenied(userContext);
            return new ChatResponse(result.message(), intent, List.of(), result.actions(), result.toolResult());
        }

        if (intent == ChatIntent.OUT_OF_SCOPE) {
            return new ChatResponse(
                    "Tôi chỉ hỗ trợ các câu hỏi liên quan đến EduConnect như tìm gia sư, lớp học, tài khoản, hợp đồng, thanh toán ký quỹ và khiếu nại. Với yêu cầu ngoài phạm vi này, tôi chưa thể hỗ trợ.",
                    intent,
                    List.of(),
                    List.of(),
                    null
            );
        }

        if (isAmbiguousMatchingRequest(message, intent)) {
            return new ChatResponse(
                    "Bạn muốn tôi tìm gia sư hay tìm lớp học phù hợp? Bạn có thể nói rõ môn học, trình độ và hình thức học để tôi hỗ trợ tốt hơn.",
                    ChatIntent.GENERAL_KNOWLEDGE,
                    List.of(),
                    List.of(),
                    null
            );
        }

        if (intent == ChatIntent.TUTOR_MATCHING) {
            ChatMatchingResult result = tutorMatchingAdapter.match(matchingMessage, userContext);
            return new ChatResponse(result.message(), intent, List.of(), result.actions(), result.toolResult());
        }

        if (intent == ChatIntent.CLASS_MATCHING) {
            ChatMatchingResult result = classMatchingAdapter.match(matchingMessage, userContext);
            return new ChatResponse(result.message(), intent, List.of(), result.actions(), result.toolResult());
        }

        if (intent == ChatIntent.PUBLIC_TUTOR_LOOKUP) {
            ChatMatchingResult result = publicLookupAdapter.tutorLookup(message, userContext);
            return new ChatResponse(result.message(), intent, List.of(), result.actions(), result.toolResult());
        }

        if (intent == ChatIntent.PUBLIC_CLASS_LOOKUP) {
            ChatMatchingResult result = publicLookupAdapter.classLookup(message, userContext);
            return new ChatResponse(result.message(), intent, List.of(), result.actions(), result.toolResult());
        }

        if (isPrivateReadIntent(intent)) {
            ChatMatchingResult result = privateToolAdapter.respond(message, intent, userContext);
            return new ChatResponse(result.message(), intent, List.of(), result.actions(), result.toolResult());
        }

        List<iuh.fit.ai_service.chatbot.dto.ChatbotDtos.ChatAction> actions =
                intent == ChatIntent.NAVIGATION
                        ? toolRegistry.publicNavigationActions(userContext, message)
                        : List.of();

        boolean shouldUseRag = shouldUseRag(intent, message);
        List<KnowledgeSearchHit> retrievedContext = List.of();
        if (shouldUseRag) {
            try {
                retrievedContext = ragRetriever.retrieve(message, userContext, null);
            } catch (EmbeddingException | SemanticVectorStoreException exception) {
                return new ChatResponse(
                        "Hiện tôi chưa thể truy cập kho kiến thức EduConnect. Bạn có thể thử lại sau.",
                        intent,
                        List.of(),
                        actions,
                        null
                );
            }
            if (retrievedContext.isEmpty()) {
                return new ChatResponse(
                        "Thông tin hiện có của EduConnect chưa mô tả rõ nội dung này.",
                        intent,
                        List.of(),
                        actions,
                        null
                );
            }
        }

        try {
            String answer = geminiTextClient.generateText(
                    promptBuilder.systemInstruction(),
                    shouldUseRag
                            ? promptBuilder.buildGroundedPrompt(message, request.conversation(), request.pageContext(), retrievedContext)
                            : promptBuilder.buildPrompt(message, request.conversation(), request.pageContext()),
                    512
            );
            return new ChatResponse(answer, intent, shouldUseRag ? sources(retrievedContext) : List.of(), actions, null);
        } catch (GeminiUnavailableException exception) {
            return new ChatResponse(fallbackAnswer(intent, message), intent, List.of(), actions, null);
        }
    }

    private String privateDataMessage(AiUserContext userContext) {
        if (userContext.authenticated()) {
            return "Trợ lý chỉ có thể dùng dữ liệu và thao tác được hệ thống hỗ trợ cho vai trò hiện tại. Bạn vui lòng mở đúng trang trong hệ thống để xem lịch học, bài tập, hợp đồng, ví hoặc tin nhắn của mình.";
        }
        return "Bạn cần đăng nhập để xem thông tin cá nhân như lịch học, bài tập, hợp đồng, ví hoặc tin nhắn. Tôi không thể truy cập dữ liệu riêng tư khi bạn đang ở chế độ khách.";
    }

    private String fallbackAnswer(ChatIntent intent, String message) {
        if (intent == ChatIntent.NAVIGATION) {
            return "Bạn có thể dùng các nút gợi ý bên dưới để mở đúng khu vực trong EduConnect.";
        }
        if (message.toLowerCase().contains("đăng ký") || message.toLowerCase().contains("dang ky")) {
            return "Bạn có thể đăng ký tài khoản EduConnect bằng nút Đăng ký, xác minh email OTP, rồi chọn vai trò học viên hoặc đăng ký hồ sơ gia sư nếu muốn dạy học.";
        }
        return "Tôi chưa thể phản hồi từ Gemini lúc này. Bạn có thể thử lại sau ít phút.";
    }

    private boolean shouldUseRag(ChatIntent intent, String message) {
        if (intent == ChatIntent.OUT_OF_SCOPE
                || intent == ChatIntent.PRIVATE_DATA_REQUEST
                || intent == ChatIntent.MUTATION_REQUEST
                || intent == ChatIntent.TUTOR_MATCHING
                || intent == ChatIntent.CLASS_MATCHING
                || intent == ChatIntent.PUBLIC_TUTOR_LOOKUP
                || intent == ChatIntent.PUBLIC_CLASS_LOOKUP
                || isPrivateReadIntent(intent)) {
            return false;
        }
        String normalized = normalize(message);
        List<String> educonnectSpecificHints = List.of(
                "educonnect", "student", "tutor", "guest", "staff", "admin",
                "dang ky", "dang nhap", "quen mat khau", "otp", "profile", "vai tro",
                "gia su", "ho so tutor", "ho so gia su", "xet duyet", "cccd", "cmnd",
                "ai matching", "matching", "tim lop", "tim gia su", "lop hoc cong khai",
                "yeu cau tham gia", "hop dong", "ky quy", "usdc", "sepolia", "vi",
                "thanh toan", "hoan tien", "quyet toan", "khieu nai", "tranh chap",
                "bai tap", "diem danh", "link phong hoc", "tro ly educonnect"
        );
        return educonnectSpecificHints.stream().anyMatch(normalized::contains);
    }

    private boolean isPrivateReadIntent(ChatIntent intent) {
        return intent == ChatIntent.MY_CLASSES
                || intent == ChatIntent.CURRENT_SCHEDULE
                || intent == ChatIntent.HOMEWORK
                || intent == ChatIntent.ENROLLMENT_REQUESTS
                || intent == ChatIntent.CONTRACT_STATUS
                || intent == ChatIntent.PAYMENT_STATUS
                || intent == ChatIntent.SETTLEMENTS
                || intent == ChatIntent.AVAILABILITY;
    }

    private ChatIntent continuePendingMatchingIntent(ChatIntent intent, String matchingMessage, ChatRequest request) {
        if (intent != ChatIntent.GENERAL_KNOWLEDGE && intent != ChatIntent.PRIVATE_DATA_REQUEST) {
            return intent;
        }
        ChatIntent pending = pendingMatchingIntent(request);
        if (pending != null && hasCatalogFollowUp(matchingMessage)) {
            return pending;
        }
        return intent;
    }

    private String matchingMessage(String message, ChatRequest request, ChatIntent intent) {
        ChatIntent pending = pendingMatchingIntent(request);
        if ((intent == ChatIntent.GENERAL_KNOWLEDGE || intent == ChatIntent.PRIVATE_DATA_REQUEST)
                && pending != null
                && hasCatalogFollowUp(message)) {
            String prefix = pending == ChatIntent.TUTOR_MATCHING ? "T\u00ecm gia s\u01b0 " : "T\u00ecm l\u1edbp ";
            return prefix + message;
        }
        return message;
    }

    private ChatIntent pendingMatchingIntent(ChatRequest request) {
        List<iuh.fit.ai_service.chatbot.dto.ChatbotDtos.ChatMessage> conversation = request.conversation();
        if (conversation == null || conversation.isEmpty()) {
            return null;
        }
        for (int index = conversation.size() - 1; index >= 0; index--) {
            var item = conversation.get(index);
            if (item == null || item.content() == null || item.role() != ChatRole.ASSISTANT) {
                continue;
            }
            String normalized = normalize(item.content());
            if (normalized.contains("tim gia su") || normalized.contains("gia su")) {
                return ChatIntent.TUTOR_MATCHING;
            }
            if (normalized.contains("tim lop") || normalized.contains("lop hoc")) {
                return ChatIntent.CLASS_MATCHING;
            }
            if (normalized.contains("mon nao")) {
                ChatIntent previousTarget = previousUserMatchingTarget(conversation, index);
                if (previousTarget != null) {
                    return previousTarget;
                }
            }
        }
        return null;
    }

    private ChatIntent previousUserMatchingTarget(
            List<iuh.fit.ai_service.chatbot.dto.ChatbotDtos.ChatMessage> conversation,
            int beforeIndex
    ) {
        for (int index = beforeIndex - 1; index >= 0; index--) {
            var item = conversation.get(index);
            if (item == null || item.content() == null || item.role() != ChatRole.USER) {
                continue;
            }
            String normalized = normalize(item.content());
            if (normalized.contains("gia su") || normalized.contains("tutor")) {
                return ChatIntent.TUTOR_MATCHING;
            }
            if (normalized.contains("lop") || normalized.contains("class")) {
                return ChatIntent.CLASS_MATCHING;
            }
        }
        return null;
    }

    private boolean hasCatalogFollowUp(String message) {
        String normalized = normalize(message);
        return normalized.contains("mon ")
                || normalized.contains("toan")
                || normalized.contains("ielts")
                || normalized.contains("vat ly")
                || normalized.contains("hoa")
                || normalized.contains("anh")
                || normalized.contains("lop ");
    }

    private boolean isAmbiguousMatchingRequest(String message, ChatIntent intent) {
        if (intent != ChatIntent.GENERAL_KNOWLEDGE) {
            return false;
        }
        String normalized = normalize(message);
        return (normalized.contains("tim") || normalized.contains("goi y") || normalized.contains("de xuat"))
                && normalized.contains("phu hop")
                && !normalized.contains("gia su")
                && !normalized.contains("tutor")
                && !normalized.contains("lop")
                && !normalized.contains("class");
    }

    private List<SourceReference> sources(List<KnowledgeSearchHit> hits) {
        Map<String, SourceReference> deduped = new LinkedHashMap<>();
        for (KnowledgeSearchHit hit : hits == null ? List.<KnowledgeSearchHit>of() : hits) {
            String key = hit.title() + "|" + hit.section();
            deduped.putIfAbsent(key, new SourceReference(hit.title(), hit.section(), "CHATBOT_KNOWLEDGE"));
            if (deduped.size() >= 3) {
                break;
            }
        }
        return List.copyOf(deduped.values());
    }

    private String normalize(String value) {
        if (value == null) {
            return "";
        }
        String noAccent = Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
        return noAccent.toLowerCase(Locale.ROOT)
                .replace("\u0111", "d")
                .replace("\u0110", "d")
                .trim();
    }
}
