package iuh.fit.authservice.infrastructure.security;

import iuh.fit.authservice.infrastructure.config.CookieProperties;
import iuh.fit.authservice.modules.auth.entity.Account;
import iuh.fit.authservice.modules.auth.repository.AccountRepository;
import iuh.fit.authservice.shared.enums.AccountStatus;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Arrays;
import java.util.Optional;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final AccountRepository accountRepository;
    private final CookieProperties cookieProperties;

    public JwtAuthenticationFilter(JwtService jwtService,
                                   AccountRepository accountRepository,
                                   CookieProperties cookieProperties) {
        this.jwtService = jwtService;
        this.accountRepository = accountRepository;
        this.cookieProperties = cookieProperties;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
        throws ServletException, IOException {

        if (SecurityContextHolder.getContext().getAuthentication() == null) {
            extractCookie(request, cookieProperties.getAccessTokenName())
                .filter(jwtService::isValidAccessToken)
                .flatMap(token -> loadPrincipal(token, request))
                .ifPresent(authentication -> SecurityContextHolder.getContext().setAuthentication(authentication));
        }

        filterChain.doFilter(request, response);
    }

    private Optional<String> extractCookie(HttpServletRequest request, String name) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return Optional.empty();
        }
        return Arrays.stream(cookies)
            .filter(cookie -> name.equals(cookie.getName()))
            .map(Cookie::getValue)
            .findFirst();
    }

    private Optional<UsernamePasswordAuthenticationToken> loadPrincipal(String token, HttpServletRequest request) {
        return accountRepository.findById(jwtService.extractAccountId(token))
            .filter(account -> account.getStatus() == AccountStatus.ACTIVE)
            .filter(account -> account.getTokenVersion() == jwtService.extractTokenVersion(token))
            .map(account -> buildAuthentication(account, request));
    }

    private UsernamePasswordAuthenticationToken buildAuthentication(Account account, HttpServletRequest request) {
        AuthPrincipal principal = new AuthPrincipal(account.getId(), account.getEmail(), account.getRole(), account.getTokenVersion());
        UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
            principal,
            null,
            principal.authorities()
        );
        authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
        return authentication;
    }
}