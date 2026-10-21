package iuh.fit.account_service.controller;

import iuh.fit.account_service.repository.UserRepository;
import iuh.fit.account_service.repository.UserRoleRepository;
import iuh.fit.account_service.exception.UnauthorizedException;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

class InternalContractSnapshotControllerTest {
    private final UserRepository users = mock(UserRepository.class);
    private final UserRoleRepository roles = mock(UserRoleRepository.class);
    private final InternalContractSnapshotController controller = new InternalContractSnapshotController(
            users, roles, "0123456789abcdef0123456789abcdef");

    @Test
    void missingOrInvalidServiceTokenIsRejectedBeforeUserLookup() {
        for (String token : new String[] {null, "", "invalid"}) {
            assertThatThrownBy(() -> controller.user(1L, token))
                    .isInstanceOf(UnauthorizedException.class);
        }
        verifyNoInteractions(users, roles);
    }
}
