package iuh.fit.contract_service.api;

import iuh.fit.contract_service.config.security.CurrentUserContext;
import iuh.fit.contract_service.service.TerminationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController @RequestMapping("/api/contracts/terminations") @RequiredArgsConstructor
public class TerminationController {
    private final TerminationService service;
    private final CurrentUserContext users;
    public record Request(UUID agreementId, boolean wholeClass, String reason, String signature, String signerWallet, Long requestedAtTimestamp) {}
    public record Action(String action, String reason) {}
    @GetMapping public List<TerminationService.View> list() { return service.list(users.requireCurrentUser()); }
    @PostMapping public TerminationService.View request(@RequestBody Request body) {
        return service.request(body.agreementId(), body.wholeClass(), body.reason(), body.signature(), body.signerWallet(), body.requestedAtTimestamp(), users.requireCurrentUser());
    }
    @PostMapping("/{id}/actions") public TerminationService.View act(@PathVariable UUID id, @RequestBody Action body) {
        return service.act(id, body.action(), body.reason(), users.requireCurrentUser());
    }
}
