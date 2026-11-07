package iuh.fit.account_service.config.security;

import iuh.fit.account_service.dto.roster.StaffDutyDtos.WriteAccess;
import iuh.fit.account_service.service.StaffDutyRosterService;
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
    @Mock StaffDutyRosterService rosterService;
    @Mock FilterChain chain;

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void rejectsStaffMutationOutsideDuty() throws Exception {
        authenticate("ROLE_STAFF");
        when(rosterService.writeAccess("staff@edu.vn"))
                .thenReturn(new WriteAccess(false, "OFF_DUTY", null, null, null));
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/staff/tutor-applications/1/approve");
        MockHttpServletResponse response = new MockHttpServletResponse();

        new StaffDutyWriteFilter(rosterService, true).doFilter(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(403);
        assertThat(response.getContentAsString()).contains("STAFF_OFF_DUTY_READ_ONLY");
        verifyNoInteractions(chain);
    }

    @Test
    void letsAdminMutationPassWithoutDutyCheck() throws Exception {
        authenticate("ROLE_ADMIN");
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/admin/users");
        MockHttpServletResponse response = new MockHttpServletResponse();

        new StaffDutyWriteFilter(rosterService, true).doFilter(request, response, chain);

        verify(chain).doFilter(request, response);
        verifyNoInteractions(rosterService);
    }

    @Test
    void rolloutDisabledDoesNotGateStaffMutation() throws Exception {
        authenticate("ROLE_STAFF");
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/staff/tutor-applications/1/approve");
        MockHttpServletResponse response = new MockHttpServletResponse();

        new StaffDutyWriteFilter(rosterService, false).doFilter(request, response, chain);

        verify(chain).doFilter(request, response);
        verifyNoInteractions(rosterService);
    }

    private void authenticate(String authority) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("staff@edu.vn", null,
                        List.of(new SimpleGrantedAuthority(authority))));
    }
}
