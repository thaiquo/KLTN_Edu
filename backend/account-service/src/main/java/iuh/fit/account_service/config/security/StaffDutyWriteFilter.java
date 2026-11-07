package iuh.fit.account_service.config.security;

import iuh.fit.account_service.service.StaffDutyRosterService;
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
    private final StaffDutyRosterService rosterService;
    private final boolean enforcementEnabled;

    public StaffDutyWriteFilter(
            StaffDutyRosterService rosterService,
            @Value("${staff.duty.enforcement-enabled:false}") boolean enforcementEnabled
    ) {
        this.rosterService = rosterService;
        this.enforcementEnabled = enforcementEnabled;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (!enforcementEnabled
                || SAFE_METHODS.contains(request.getMethod())
                || exempt(request.getRequestURI())
                || authentication == null
                || authentication.getAuthorities().stream().noneMatch(a -> "ROLE_STAFF".equals(a.getAuthority()))) {
            chain.doFilter(request, response);
            return;
        }
        if (!rosterService.writeAccess(authentication.getName()).allowed()) {
            reject(response);
            return;
        }
        chain.doFilter(request, response);
    }

    private boolean exempt(String uri) {
        return uri.startsWith("/api/auth/")
                || uri.startsWith("/api/internal/")
                || uri.startsWith("/api/staff/duty/");
    }

    private void reject(HttpServletResponse response) throws IOException {
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("""
                {"status":403,"code":"STAFF_OFF_DUTY_READ_ONLY","message":"Ngoài ca trực, Staff chỉ được xem dữ liệu."}
                """);
    }
}
