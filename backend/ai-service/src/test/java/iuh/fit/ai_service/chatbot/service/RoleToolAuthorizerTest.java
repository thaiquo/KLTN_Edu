package iuh.fit.ai_service.chatbot.service;

import iuh.fit.ai_service.chatbot.model.ChatTool;
import iuh.fit.ai_service.chatbot.security.AiUserContext;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class RoleToolAuthorizerTest {
    private final RoleToolAuthorizer authorizer = new RoleToolAuthorizer();

    @Test
    void publicMatchingIsAllowedForGuestAndStudent() {
        assertThat(authorizer.isAllowed(AiUserContext.guest(), ChatTool.TUTOR_MATCHING_PUBLIC)).isTrue();
        assertThat(authorizer.isAllowed(AiUserContext.guest(), ChatTool.CLASS_MATCHING_PUBLIC)).isTrue();
        assertThat(authorizer.isAllowed(AiUserContext.guest(), ChatTool.PUBLIC_TUTOR_LOOKUP)).isTrue();
        assertThat(authorizer.isAllowed(AiUserContext.guest(), ChatTool.PUBLIC_CLASS_LOOKUP)).isTrue();
        assertThat(authorizer.isAllowed(student(), ChatTool.TUTOR_MATCHING_PUBLIC)).isTrue();
        assertThat(authorizer.isAllowed(student(), ChatTool.CLASS_MATCHING_PUBLIC)).isTrue();
    }

    @Test
    void privateStudentToolsRequireStudentRole() {
        assertThat(authorizer.isAllowed(AiUserContext.guest(), ChatTool.STUDENT_MY_CLASSES)).isFalse();
        assertThat(authorizer.isAllowed(student(), ChatTool.STUDENT_MY_CLASSES)).isTrue();
    }

    private AiUserContext student() {
        return new AiUserContext(101L, "student@gmail.com", "STUDENT", List.of("STUDENT"), true);
    }
}
