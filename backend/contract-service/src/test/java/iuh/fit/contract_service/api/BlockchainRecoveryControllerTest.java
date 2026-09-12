package iuh.fit.contract_service.api;

import iuh.fit.contract_service.config.security.ContractUserPrincipal;
import iuh.fit.contract_service.config.security.CurrentUserContext;
import iuh.fit.contract_service.service.BlockchainRecoveryService;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class BlockchainRecoveryControllerTest {
    @Test
    void onlyActiveAdminCanRetryAndFailuresReturnConflict() {
        var users = mock(CurrentUserContext.class);
        var recovery = mock(BlockchainRecoveryService.class);
        var controller = new BlockchainRecoveryController(users, recovery);
        var id = UUID.randomUUID();
        when(users.requireCurrentUser()).thenReturn(new ContractUserPrincipal(1L, "student@test", "STUDENT", List.of("STUDENT", "ADMIN")));
        assertEquals(403, assertThrows(ResponseStatusException.class, () -> controller.retry(id)).getStatusCode().value());
        verifyNoInteractions(recovery);
        when(users.requireCurrentUser()).thenReturn(new ContractUserPrincipal(9L, "admin@test", "ADMIN", List.of("ADMIN")));
        when(recovery.retry(id, 9L)).thenThrow(new IllegalStateException("Not funded"));
        assertEquals(409, assertThrows(ResponseStatusException.class, () -> controller.retry(id)).getStatusCode().value());
    }
}
