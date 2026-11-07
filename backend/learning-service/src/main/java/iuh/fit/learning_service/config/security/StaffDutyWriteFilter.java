package iuh.fit.learning_service.config.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Set;

@Component
public class StaffDutyWriteFilter extends OncePerRequestFilter {
    private static final Set<String> SAFE_METHODS = Set.of("GET", "HEAD", "OPTIONS");
    private final StaffDutyAccessClient accessClient;
    private final boolean enforcementEnabled;

    public StaffDutyWriteFilter(
            StaffDutyAccessClient accessClient,
            @Value("${staff.duty.enforcement-enabled:false}") boolean enforcementEnabled
    ) {
        this.accessClient = accessClient;
        this.enforcementEnabled = enforcementEnabled;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (!enforcementEnabled
                || SAFE_METHODS.contains(request.getMethod())
                || request.getRequestURI().startsWith("/api/learning/internal/")
                || authentication == null
                || !isActiveStaff(authentication)) {
            chain.doFilter(request, response);
            return;
        }
        try {
            if (!accessClient.isWriteAllowed(authentication.getName())) {
                reject(response, 403, "STAFF_OFF_DUTY_READ_ONLY", "Ngoài ca trực, Staff chỉ được xem dữ liệu.");
                return;
            }
        } catch (RuntimeException exception) {
            reject(response, 503, "STAFF_DUTY_CHECK_UNAVAILABLE", "Không thể xác minh ca trực. Vui lòng thử lại.");
            return;
        }
        chain.doFilter(request, response);
    }

    private boolean isActiveStaff(Authentication authentication) {
        return authentication.getPrincipal() instanceof LearningUserPrincipal principal
                && "STAFF".equalsIgnoreCase(principal.activeRole())
                && authentication.getAuthorities().stream()
                .anyMatch(a -> "ROLE_STAFF".equals(a.getAuthority()));
    }

    private void reject(HttpServletResponse response, int status, String code, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write(String.format(
                "{\"status\":%d,\"code\":\"%s\",\"message\":\"%s\"}", status, code, message));
    }
}
