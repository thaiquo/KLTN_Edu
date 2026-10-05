package iuh.fit.notification_service.dto;

import lombok.Builder;

import java.util.List;

@Builder
public record ChatMessagePageDto(
        List<ChatMessageDto> content,
        int page,
        int size,
        long totalElements,
        int totalPages,
        boolean last,
        String order
) {
}
