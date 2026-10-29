package iuh.fit.account_service.dto.support;

import iuh.fit.account_service.enums.SupportTicketCategory;
import iuh.fit.account_service.enums.SupportTicketStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public final class SupportTicketDtos {
    private SupportTicketDtos() {}
    public record CreateRequest(@NotNull SupportTicketCategory category,
            @NotBlank @Size(max = 180) String subject,
            @NotBlank @Size(max = 5000) String description) {}
    public record MessageRequest(@NotBlank @Size(max = 5000) String message) {}
    public record StatusRequest(@NotNull SupportTicketStatus status, @Size(max = 2000) String reason) {}
    public record EscalateRequest(@NotBlank @Size(max = 2000) String reason) {}
    public record Summary(UUID id, SupportTicketCategory category, String subject, SupportTicketStatus status,
            Long creatorId, String creatorName, String creatorRole, Long assigneeId, String assigneeName,
            LocalDateTime escalatedAt, LocalDateTime createdAt, LocalDateTime updatedAt, Long version) {}
    public record Message(Long id, Long actorId, String actorName, String actorRole, String message, LocalDateTime createdAt) {}
    public record History(Long id, Long actorId, String actorName, String actorRole, String action,
            String fromStatus, String toStatus, String reason, LocalDateTime createdAt) {}
    public record Detail(Summary summary, String description, List<Message> messages, List<History> history) {}
}
