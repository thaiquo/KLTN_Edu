package iuh.fit.learning_service.config.security;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class StaffDutyWriteFilterTest {
    @Mock StaffDutyAccessClient client;
    @Mock FilterChain chain;

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void rejectsActiveStaffMutationOutsideDuty() throws Exception {
        authenticate("STAFF");
        when(client.isWriteAllowed("staff@edu.vn")).thenReturn(false);
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/admin/classes/1/approve");
        MockHttpServletResponse response = new MockHttpServletResponse();

        new StaffDutyWriteFilter(client, true).doFilter(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(403);
        assertThat(response.getContentAsString()).contains("STAFF_OFF_DUTY_READ_ONLY");
        verifyNoInteractions(chain);
    }

    @Test
    void activeAdminWithStaffRoleIsNotDutyGated() throws Exception {
        authenticate("ADMIN");
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/admin/classes/1/approve");
        MockHttpServletResponse response = new MockHttpServletResponse();

        new StaffDutyWriteFilter(client, true).doFilter(request, response, chain);

        verify(chain).doFilter(request, response);
        verifyNoInteractions(client);
    }

    @Test
    void rolloutDisabledDoesNotGateActiveStaff() throws Exception {
        authenticate("STAFF");
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/admin/classes/1/approve");
        MockHttpServletResponse response = new MockHttpServletResponse();

        new StaffDutyWriteFilter(client, false).doFilter(request, response, chain);

        verify(chain).doFilter(request, response);
        verifyNoInteractions(client);
    }

    private void authenticate(String activeRole) {
        var principal = new LearningUserPrincipal("staff@edu.vn", 1L, activeRole);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, List.of(
                        new SimpleGrantedAuthority("ROLE_STAFF"),
                        new SimpleGrantedAuthority("ROLE_ADMIN"))));
    }
}
