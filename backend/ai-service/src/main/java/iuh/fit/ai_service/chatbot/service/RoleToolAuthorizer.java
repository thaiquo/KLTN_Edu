package iuh.fit.ai_service.chatbot.service;

import iuh.fit.ai_service.chatbot.model.ChatTool;
import iuh.fit.ai_service.chatbot.security.AiUserContext;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.Set;

@Component
public class RoleToolAuthorizer {
    private static final Map<String, Set<ChatTool>> ALLOWLIST = Map.of(
            "GUEST", publicTools(),
            "STUDENT", studentTools(),
            "TUTOR", tutorTools(),
            "STAFF", publicTools(),
            "ADMIN", publicTools()
    );

    public boolean isAllowed(AiUserContext userContext, ChatTool tool) {
        String role = userContext == null ? "GUEST" : userContext.activeRole();
        return ALLOWLIST.getOrDefault(role, ALLOWLIST.get("GUEST")).contains(tool);
    }

    private static Set<ChatTool> publicTools() {
        return Set.of(
                ChatTool.PUBLIC_INFO,
                ChatTool.NAVIGATE_PUBLIC,
                ChatTool.TUTOR_MATCHING_PUBLIC,
                ChatTool.CLASS_MATCHING_PUBLIC,
                ChatTool.PUBLIC_TUTOR_LOOKUP,
                ChatTool.PUBLIC_CLASS_LOOKUP
        );
    }

    private static Set<ChatTool> studentTools() {
        Set<ChatTool> tools = new java.util.HashSet<>(publicTools());
        tools.addAll(Set.of(
                ChatTool.STUDENT_MY_CLASSES,
                ChatTool.STUDENT_SCHEDULE,
                ChatTool.STUDENT_HOMEWORK,
                ChatTool.STUDENT_ENROLLMENT_REQUESTS,
                ChatTool.STUDENT_CONTRACTS,
                ChatTool.STUDENT_PAYMENT_STATUS
        ));
        return Set.copyOf(tools);
    }

    private static Set<ChatTool> tutorTools() {
        Set<ChatTool> tools = new java.util.HashSet<>(publicTools());
        tools.addAll(Set.of(
                ChatTool.TUTOR_MY_CLASSES,
                ChatTool.TUTOR_SCHEDULE,
                ChatTool.TUTOR_ENROLLMENT_REQUESTS,
                ChatTool.TUTOR_PENDING_HOMEWORK,
                ChatTool.TUTOR_CONTRACTS,
                ChatTool.TUTOR_SETTLEMENTS,
                ChatTool.TUTOR_AVAILABILITY
        ));
        return Set.copyOf(tools);
    }
}
