package iuh.fit.account_service.modules.tutor.dto;
import java.time.Instant;
import java.util.UUID;
public record TutorApplicationEventResponse(UUID id, UUID actorId, String eventType, String detail, Instant createdAt) {}
