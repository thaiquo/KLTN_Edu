package iuh.fit.ai_service.chatbot.security;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class AiUserContextResolverTest {
    private final AiUserContextResolver resolver = new AiUserContextResolver();

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void resolvesGuestWhenNoAuthenticationExists() {
        AiUserContext context = resolver.currentUser();

        assertThat(context.authenticated()).isFalse();
        assertThat(context.activeRole()).isEqualTo("GUEST");
        assertThat(context.userId()).isNull();
    }

    @Test
    void resolvesCanonicalAuthenticatedContextWithUserId() {
        AiAuthenticatedPrincipal principal = new AiAuthenticatedPrincipal(
                101L,
                "student@gmail.com",
                "student",
                List.of("student", "tutor")
        );
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                principal,
                null,
                List.of(new SimpleGrantedAuthority("ROLE_STUDENT"))
        ));

        AiUserContext context = resolver.currentUser();

        assertThat(context.authenticated()).isTrue();
        assertThat(context.userId()).isEqualTo(101L);
        assertThat(context.email()).isEqualTo("student@gmail.com");
        assertThat(context.activeRole()).isEqualTo("STUDENT");
        assertThat(context.roles()).containsExactly("STUDENT", "TUTOR");
    }
}
