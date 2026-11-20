package iuh.fit.learning_service.controller;

import iuh.fit.learning_service.config.security.LearningUserPrincipal;
import iuh.fit.learning_service.service.TutorStatisticsService;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.Authentication;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class TutorStatisticsControllerTest {
    @Test
    void derivesTutorIdentityFromAuthenticatedPrincipalInsteadOfRequestParameters() {
        TutorStatisticsService service = mock(TutorStatisticsService.class);
        Authentication authentication = mock(Authentication.class);
        when(authentication.getPrincipal()).thenReturn(new LearningUserPrincipal("tutor@local.test", 42L, "TUTOR"));

        new TutorStatisticsController(service).statistics(authentication, 30);

        verify(service).getStatistics("tutor@local.test", 42L, 30);
    }
}
