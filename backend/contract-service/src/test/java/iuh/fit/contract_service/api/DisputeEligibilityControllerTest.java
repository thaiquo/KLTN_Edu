package iuh.fit.contract_service.api;

import iuh.fit.contract_service.config.security.ContractUserPrincipal;
import iuh.fit.contract_service.config.security.CurrentUserContext;
import iuh.fit.contract_service.repository.SessionSettlementRepository;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class DisputeEligibilityControllerTest {
    private final SessionSettlementRepository settlements = mock(SessionSettlementRepository.class);
    private final CurrentUserContext users = mock(CurrentUserContext.class);
    private final DisputeEligibilityController controller = new DisputeEligibilityController(settlements, users);

    @Test
    void studentQueryIsScopedAndPageSizeIsBounded() {
        when(users.requireCurrentUser()).thenReturn(
                new ContractUserPrincipal(42L, "student@example.com", "STUDENT", List.of("STUDENT")));
        when(settlements.findEligibleStudentDisputes(
                eq(42L), eq("student@example.com"), any(), eq(7L), eq(9L), any(Pageable.class)))
                .thenAnswer(invocation -> Page.empty(invocation.getArgument(5)));

        var result = controller.eligibleSessions(7L, 9L, 3, 500);

        assertThat(result.getNumber()).isEqualTo(3);
        assertThat(result.getSize()).isEqualTo(50);
        verify(settlements).findEligibleStudentDisputes(
                eq(42L), eq("student@example.com"), any(), eq(7L), eq(9L), any(Pageable.class));
    }

    @Test
    void nonStudentCannotReadStudentEligibility() {
        when(users.requireCurrentUser()).thenReturn(
                new ContractUserPrincipal(2L, "staff@example.com", "STAFF", List.of("STAFF")));

        assertThatThrownBy(() -> controller.eligibleSessions(null, null, 0, 10))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("403");
        verify(settlements, never()).findEligibleStudentDisputes(
                anyLong(), any(), any(), any(), any(), any(Pageable.class));
    }
}
