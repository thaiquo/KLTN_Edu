package iuh.fit.contract_service.blockchain;

import java.util.Map;

public record DecodedEscrowEvent(
        EscrowEventType type,
        String agreementId,
        String sessionId,
        Map<String, String> attributes) {
    public DecodedEscrowEvent {
        attributes = Map.copyOf(attributes);
    }
}
