package iuh.fit.learning_service.config.security;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import iuh.fit.learning_service.entity.TutorAuthorizationState;
import iuh.fit.learning_service.repository.TutorAuthorizationStateRepository;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

import javax.crypto.SecretKey;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class CookieJwtAuthenticationFilterTest {

    private static final String SECRET = "0123456789abcdef0123456789abcdef";

    private final TutorAuthorizationStateRepository tutorAuthorizationStateRepository =
            mock(TutorAuthorizationStateRepository.class);
    private final CookieJwtAuthenticationFilter filter =
            new CookieJwtAuthenticationFilter(SECRET, tutorAuthorizationStateRepository);

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void accessTokenCookieAuthenticatesRequest() throws ServletException, IOException {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new Cookie("access_token", tutorToken(Date.from(Instant.now().plusSeconds(900)))));
        when(tutorAuthorizationStateRepository.findById(99L)).thenReturn(Optional.of(tutorState("APPROVED")));

        filter.doFilter(request, new MockHttpServletResponse(), new MockFilterChain());

        var authentication = SecurityContextHolder.getContext().getAuthentication();
        assertThat(authentication).isNotNull();
        assertThat(authentication.getName()).isEqualTo("tutor@example.com");
        assertThat(authentication.getAuthorities())
                .extracting("authority")
                .containsExactlyInAnyOrder("ROLE_STUDENT", "ROLE_TUTOR");
    }

    @Test
    void pendingTutorCookieAuthenticatesWithoutFullTutorAuthority() throws ServletException, IOException {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new Cookie("access_token", tutorToken(Date.from(Instant.now().plusSeconds(900)))));
        when(tutorAuthorizationStateRepository.findById(99L)).thenReturn(Optional.of(tutorState("PENDING")));

        filter.doFilter(request, new MockHttpServletResponse(), new MockFilterChain());

        var authentication = SecurityContextHolder.getContext().getAuthentication();
        assertThat(authentication).isNotNull();
        assertThat(authentication.getAuthorities())
                .extracting("authority")
                .containsExactly("ROLE_STUDENT");
    }

    @Test
    void rejectedTutorCookieAuthenticatesWithoutFullTutorAuthority() throws ServletException, IOException {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new Cookie("access_token", tutorToken(Date.from(Instant.now().plusSeconds(900)))));
        when(tutorAuthorizationStateRepository.findById(99L)).thenReturn(Optional.of(tutorState("REJECTED")));

        filter.doFilter(request, new MockHttpServletResponse(), new MockFilterChain());

        var authentication = SecurityContextHolder.getContext().getAuthentication();
        assertThat(authentication).isNotNull();
        assertThat(authentication.getAuthorities())
                .extracting("authority")
                .containsExactly("ROLE_STUDENT");
    }

    @Test
    void tutorCookieWithoutAuthorizationProjectionUsesApprovedSignedTutorStatusFallback() throws ServletException, IOException {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new Cookie("access_token", tutorToken(Date.from(Instant.now().plusSeconds(900)))));
        when(tutorAuthorizationStateRepository.findById(99L)).thenReturn(Optional.empty());

        filter.doFilter(request, new MockHttpServletResponse(), new MockFilterChain());

        var authentication = SecurityContextHolder.getContext().getAuthentication();
        assertThat(authentication).isNotNull();
        assertThat(authentication.getAuthorities())
                .extracting("authority")
                .containsExactlyInAnyOrder("ROLE_STUDENT", "ROLE_TUTOR");
    }

    @Test
    void tutorCookieWithoutProjectionAndApprovedTutorStatusMissingDoesNotReceiveFullTutorAuthority() throws ServletException, IOException {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new Cookie("access_token", tutorToken(Date.from(Instant.now().plusSeconds(900)), "PENDING")));
        when(tutorAuthorizationStateRepository.findById(99L)).thenReturn(Optional.empty());

        filter.doFilter(request, new MockHttpServletResponse(), new MockFilterChain());

        var authentication = SecurityContextHolder.getContext().getAuthentication();
        assertThat(authentication).isNotNull();
        assertThat(authentication.getAuthorities())
                .extracting("authority")
                .containsExactly("ROLE_STUDENT");
    }

    @Test
    void rejectedProjectionOverridesApprovedSignedTutorStatus() throws ServletException, IOException {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new Cookie("access_token", tutorToken(Date.from(Instant.now().plusSeconds(900)), "APPROVED")));
        when(tutorAuthorizationStateRepository.findById(99L)).thenReturn(Optional.of(tutorState("REJECTED")));

        filter.doFilter(request, new MockHttpServletResponse(), new MockFilterChain());

        var authentication = SecurityContextHolder.getContext().getAuthentication();
        assertThat(authentication).isNotNull();
        assertThat(authentication.getAuthorities())
                .extracting("authority")
                .containsExactly("ROLE_STUDENT");
    }

    @Test
    void missingCookieDoesNotAuthenticateRequest() throws ServletException, IOException {
        filter.doFilter(new MockHttpServletRequest(), new MockHttpServletResponse(), new MockFilterChain());

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    void invalidCookieDoesNotAuthenticateRequest() throws ServletException, IOException {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new Cookie("access_token", "not-a-jwt"));

        filter.doFilter(request, new MockHttpServletResponse(), new MockFilterChain());

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    void expiredCookieDoesNotAuthenticateRequest() throws ServletException, IOException {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new Cookie("access_token", tutorToken(Date.from(Instant.now().minusSeconds(60)))));

        filter.doFilter(request, new MockHttpServletResponse(), new MockFilterChain());

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    void bearerOnlyRequestDoesNotAuthenticateRequest() throws ServletException, IOException {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer " + tutorToken(Date.from(Instant.now().plusSeconds(900))));

        filter.doFilter(request, new MockHttpServletResponse(), new MockFilterChain());

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    void legacyTokenCookieDoesNotAuthenticateRequest() throws ServletException, IOException {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new Cookie("token", tutorToken(Date.from(Instant.now().plusSeconds(900)))));

        filter.doFilter(request, new MockHttpServletResponse(), new MockFilterChain());

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    private String tutorToken(Date expiration) {
        return tutorToken(expiration, "APPROVED");
    }

    private String tutorToken(Date expiration, String tutorStatus) {
        SecretKey secretKey = Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));
        return Jwts.builder()
                .subject("tutor@example.com")
                .claim("userId", 99L)
                .claim("roles", List.of("STUDENT", "TUTOR"))
                .claim("activeRole", "TUTOR")
                .claim("tutorStatus", tutorStatus)
                .issuedAt(new Date())
                .expiration(expiration)
                .signWith(secretKey)
                .compact();
    }

    private TutorAuthorizationState tutorState(String status) {
        TutorAuthorizationState state = new TutorAuthorizationState();
        state.setUserId(99L);
        state.setStatus(status);
        return state;
    }
}
