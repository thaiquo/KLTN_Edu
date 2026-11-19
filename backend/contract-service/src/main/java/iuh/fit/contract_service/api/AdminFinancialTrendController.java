package iuh.fit.contract_service.api;

import iuh.fit.contract_service.config.security.ContractAccessControl;
import iuh.fit.contract_service.config.security.CurrentUserContext;
import iuh.fit.contract_service.dto.AdminFinancialTrendResponse;
import iuh.fit.contract_service.service.AdminFinancialTrendService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/contracts/admin/financial-trend")
public class AdminFinancialTrendController {
    private final AdminFinancialTrendService service;
    private final CurrentUserContext users;
    private final ContractAccessControl accessControl;

    public AdminFinancialTrendController(AdminFinancialTrendService service, CurrentUserContext users,
                                         ContractAccessControl accessControl) {
        this.service = service;
        this.users = users;
        this.accessControl = accessControl;
    }

    @GetMapping
    public AdminFinancialTrendResponse trend(@RequestParam(defaultValue = "30") int rangeDays) {
        accessControl.requireCanViewPlatformFinancials(users.requireCurrentUser());
        try {
            return service.getTrend(rangeDays);
        } catch (IllegalArgumentException error) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, error.getMessage(), error);
        }
    }
}
