package iuh.fit.ai_service.chatbot.service;

import iuh.fit.ai_service.chatbot.dto.ChatbotDtos.ChatAction;
import iuh.fit.ai_service.chatbot.model.ChatTool;
import iuh.fit.ai_service.chatbot.model.NavigationAction;
import iuh.fit.ai_service.chatbot.security.AiUserContext;
import org.springframework.stereotype.Component;

import java.text.Normalizer;
import java.util.List;
import java.util.Locale;

@Component
public class ChatToolRegistry {
    private final RoleToolAuthorizer authorizer;

    public ChatToolRegistry(RoleToolAuthorizer authorizer) {
        this.authorizer = authorizer;
    }

    public List<ChatAction> publicNavigationActions(AiUserContext userContext, String message) {
        if (!authorizer.isAllowed(userContext, ChatTool.NAVIGATE_PUBLIC)) {
            return List.of();
        }
        String lower = normalize(message);
        if (lower.contains("dang ky")) {
            return List.of(new ChatAction(NavigationAction.OPEN_REGISTER, "Đăng ký tài khoản"));
        }
        if (lower.contains("dang nhap") || lower.contains("login")) {
            return List.of(new ChatAction(NavigationAction.OPEN_LOGIN, "Đăng nhập"));
        }
        if (lower.contains("gia su")) {
            return List.of(new ChatAction(NavigationAction.OPEN_TUTOR_MARKETPLACE, "Xem gia sư"));
        }
        if (lower.contains("lop")) {
            return List.of(new ChatAction(NavigationAction.OPEN_CLASS_MARKETPLACE, "Xem lớp học"));
        }
        return List.of(new ChatAction(NavigationAction.OPEN_HOME, "Về trang chủ"));
    }

    public List<ChatAction> privateNavigationAction(AiUserContext userContext, ChatTool tool, NavigationAction action, String label) {
        if (!authorizer.isAllowed(userContext, tool)) {
            return List.of();
        }
        return List.of(new ChatAction(action, label));
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
