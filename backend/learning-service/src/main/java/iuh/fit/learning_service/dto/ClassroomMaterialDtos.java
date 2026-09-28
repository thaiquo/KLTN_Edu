package iuh.fit.learning_service.dto;

import java.time.LocalDateTime;

public class ClassroomMaterialDtos {

    public record ClassroomMaterialResponse(
            Long id,
            Long classRoomId,
            String title,
            String description,
            String externalUrl,
            String fileName,
            Long fileSize,
            String contentType,
            String uploadedByEmail,
            LocalDateTime createdAt
    ) {}

    public record PresignedDownloadUrlResponse(
            String downloadUrl,
            String fileName,
            String contentType
    ) {}
}
