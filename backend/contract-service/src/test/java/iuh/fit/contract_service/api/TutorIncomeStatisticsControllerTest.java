package iuh.fit.contract_service.api;

import iuh.fit.contract_service.config.security.ContractUserPrincipal;
import iuh.fit.contract_service.service.TutorIncomeStatisticsService;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.Authentication;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class TutorIncomeStatisticsControllerTest {
    @Test
    void derivesTutorIdentityFromActiveTutorPrincipal() {
        TutorIncomeStatisticsService service = mock(TutorIncomeStatisticsService.class);
        Authentication authentication = mock(Authentication.class);
        when(authentication.getPrincipal()).thenReturn(
                new ContractUserPrincipal(42L, "tutor@local.test", "TUTOR", List.of("TUTOR")));

        new TutorIncomeStatisticsController(service).statistics(authentication, 30);

        verify(service).getStatistics(42L, "tutor@local.test", 30);
    }

    @Test
    void rejectsTutorRoleWhenStudentIsTheActiveRole() {
        TutorIncomeStatisticsService service = mock(TutorIncomeStatisticsService.class);
        Authentication authentication = mock(Authentication.class);
        when(authentication.getPrincipal()).thenReturn(
                new ContractUserPrincipal(42L, "dual@local.test", "STUDENT", List.of("STUDENT", "TUTOR")));

        assertThatThrownBy(() -> new TutorIncomeStatisticsController(service).statistics(authentication, 30))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("403");
    }
}
