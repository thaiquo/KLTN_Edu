package iuh.fit.learning_service.controller;

import iuh.fit.learning_service.service.CommunityManualModerationService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.Page;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class CommunityModerationControllerAuthorizationTest {
    private AnnotationConfigApplicationContext context;
    private CommunityModerationController controller;

    @BeforeEach
    void setUp() {
        context = new AnnotationConfigApplicationContext(TestConfig.class);
        controller = context.getBean(CommunityModerationController.class);
        when(context.getBean(CommunityManualModerationService.class)
                .queue(isNull(), anyBoolean(), isNull(), any()))
                .thenReturn(Page.empty());
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        context.close();
    }

    @Test
    void staffCanRetrieveModerationQueue() {
        authenticate("ROLE_STAFF");
        assertThatCode(() -> controller.queue(null, false, null, 0, 10)).doesNotThrowAnyException();
    }

    @Test
    void adminCanRetrieveModerationQueue() {
        authenticate("ROLE_ADMIN");
        assertThatCode(() -> controller.queue(null, false, null, 0, 10)).doesNotThrowAnyException();
    }

    @Test
    void studentCannotRetrieveModerationQueue() {
        authenticate("ROLE_STUDENT");
        assertThatThrownBy(() -> controller.queue(null, false, null, 0, 10))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void unauthenticatedCallerCannotRetrieveModerationQueue() {
        assertThatThrownBy(() -> controller.queue(null, false, null, 0, 10))
                .isInstanceOf(AuthenticationCredentialsNotFoundException.class);
    }

    private void authenticate(String authority) {
        SecurityContextHolder.getContext().setAuthentication(
                UsernamePasswordAuthenticationToken.authenticated(
                        "operator@example.com", "n/a", List.of(new SimpleGrantedAuthority(authority))));
    }

    @Configuration
    @EnableMethodSecurity
    static class TestConfig {
        @Bean
        CommunityManualModerationService moderationService() {
            return mock(CommunityManualModerationService.class);
        }

        @Bean
        CommunityModerationController moderationController(CommunityManualModerationService service) {
            return new CommunityModerationController(service);
        }
    }
}
