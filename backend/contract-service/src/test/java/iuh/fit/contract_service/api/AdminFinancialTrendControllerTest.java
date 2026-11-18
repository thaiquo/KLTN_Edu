package iuh.fit.contract_service.api;

import iuh.fit.contract_service.config.security.ContractAccessControl;
import iuh.fit.contract_service.config.security.ContractUserPrincipal;
import iuh.fit.contract_service.config.security.CurrentUserContext;
import iuh.fit.contract_service.service.AdminFinancialTrendService;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AdminFinancialTrendControllerTest {
    @Test
    void delegatesAuthorizationToPlatformFinancialPolicy() {
        AdminFinancialTrendService service = mock(AdminFinancialTrendService.class);
        CurrentUserContext users = mock(CurrentUserContext.class);
        ContractAccessControl access = mock(ContractAccessControl.class);
        ContractUserPrincipal admin = new ContractUserPrincipal(1L, "admin@local.test", "ADMIN", List.of("ADMIN"));
        when(users.requireCurrentUser()).thenReturn(admin);

        new AdminFinancialTrendController(service, users, access).trend(30);

        verify(access).requireCanViewPlatformFinancials(admin);
        verify(service).getTrend(30);
    }
}
