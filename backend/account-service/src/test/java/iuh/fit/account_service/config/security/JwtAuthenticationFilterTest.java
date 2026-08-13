package iuh.fit.account_service.config.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.http.Cookie;
import io.jsonwebtoken.JwtException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UsernameNotFoundException;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class JwtAuthenticationFilterTest {

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void validJwtForDisabledAccountDoesNotAuthenticateRequest() throws Exception {
        JwtService jwtService = mock(JwtService.class);
        CustomUserDetailsService userDetailsService = mock(CustomUserDetailsService.class);
        JwtAuthenticationFilter filter = new JwtAuthenticationFilter(jwtService, userDetailsService);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/protected");
        request.setCookies(new Cookie("access_token", "token"));
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        when(jwtService.isTokenValid("token")).thenReturn(true);
        when(jwtService.extractEmail("token")).thenReturn("test@gmail.com");
        when(userDetailsService.loadUserByUsername("test@gmail.com")).thenReturn(
                new User("test@gmail.com", "password", false, true, true, true, List.of())
        );

        filter.doFilter(request, response, chain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(chain).doFilter(request, response);
    }

    @Test
    void staleJwtReferencingDeletedUserLetsPublicRegisterContinueAsGuest() throws Exception {
        JwtService jwtService = mock(JwtService.class);
        CustomUserDetailsService userDetailsService = mock(CustomUserDetailsService.class);
        JwtAuthenticationFilter filter = new JwtAuthenticationFilter(jwtService, userDetailsService);
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/register");
        request.setCookies(new Cookie("access_token", "stale-token"));
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        when(jwtService.isTokenValid("stale-token")).thenReturn(true);
        when(jwtService.extractEmail("stale-token")).thenReturn("deleted@example.com");
        when(userDetailsService.loadUserByUsername("deleted@example.com"))
                .thenThrow(new UsernameNotFoundException("User not found"));

        filter.doFilter(request, response, chain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(chain).doFilter(request, response);
    }

    @Test
    void staleJwtReferencingDeletedUserLeavesProtectedMeUnauthenticatedForSecurityEntryPoint() throws Exception {
        JwtService jwtService = mock(JwtService.class);
        CustomUserDetailsService userDetailsService = mock(CustomUserDetailsService.class);
        JwtAuthenticationFilter filter = new JwtAuthenticationFilter(jwtService, userDetailsService);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/users/me");
        request.setCookies(new Cookie("access_token", "stale-token"));
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        when(jwtService.isTokenValid("stale-token")).thenReturn(true);
        when(jwtService.extractEmail("stale-token")).thenReturn("deleted@example.com");
        when(userDetailsService.loadUserByUsername("deleted@example.com"))
                .thenThrow(new UsernameNotFoundException("User not found"));

        filter.doFilter(request, response, chain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(chain).doFilter(request, response);
    }

    @Test
    void jwtValidationExceptionContinuesRequestAsGuest() throws Exception {
        JwtService jwtService = mock(JwtService.class);
        CustomUserDetailsService userDetailsService = mock(CustomUserDetailsService.class);
        JwtAuthenticationFilter filter = new JwtAuthenticationFilter(jwtService, userDetailsService);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/subjects");
        request.setCookies(new Cookie("access_token", "invalid-token"));
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        when(jwtService.isTokenValid("invalid-token")).thenThrow(new JwtException("Invalid JWT"));

        filter.doFilter(request, response, chain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(chain).doFilter(request, response);
    }
}
