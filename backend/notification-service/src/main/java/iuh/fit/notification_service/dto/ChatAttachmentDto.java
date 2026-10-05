package iuh.fit.notification_service.dto;

import lombok.*;

import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChatAttachmentDto {
    private UUID id;
    private String fileName;
    private String contentType;
    private Long size;
    private String url;
}
