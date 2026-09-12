package iuh.fit.contract_service.api;

import iuh.fit.contract_service.config.security.CurrentUserContext;
import iuh.fit.contract_service.service.BlockchainRecoveryService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/contracts/transactions")
public class BlockchainRecoveryController {
    private final CurrentUserContext users;
    private final BlockchainRecoveryService recovery;

    public BlockchainRecoveryController(CurrentUserContext users, BlockchainRecoveryService recovery) {
        this.users = users;
        this.recovery = recovery;
    }

    @PostMapping("/{id}/retry")
    public Map<String, Object> retry(@PathVariable UUID id) {
        var user = users.requireCurrentUser();
        if (!user.hasActiveAuthority("ADMIN")) throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        try {
            return Map.of("transactionId", recovery.retry(id, user.userId()), "transactionStatus", "CREATED");
        } catch (IllegalStateException ex) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, ex.getMessage());
        }
    }
}
