package iuh.fit.contract_service.api;

import iuh.fit.contract_service.config.security.ContractUserPrincipal;
import iuh.fit.contract_service.dto.TutorIncomeStatisticsSourceResponse;
import iuh.fit.contract_service.service.TutorIncomeStatisticsService;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/contracts/tutor/statistics/source")
public class TutorIncomeStatisticsController {
    private final TutorIncomeStatisticsService service;

    public TutorIncomeStatisticsController(TutorIncomeStatisticsService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasRole('TUTOR')")
    public TutorIncomeStatisticsSourceResponse statistics(
            Authentication authentication,
            @RequestParam(defaultValue = "30") int rangeDays
    ) {
        if (authentication == null || !(authentication.getPrincipal() instanceof ContractUserPrincipal principal)
                || !principal.hasActiveAuthority("TUTOR")) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Tutor permission required");
        }
        return service.getStatistics(principal.userId(), principal.email(), rangeDays);
    }
}
