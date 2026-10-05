package iuh.fit.notification_service.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "chat_attachments")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChatAttachment {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "message_id", nullable = false)
    private ChatMessage message;

    @Column(name = "object_key", nullable = false, columnDefinition = "TEXT")
    private String objectKey;

    @Column(name = "original_name", length = 255)
    private String originalName;

    @Column(name = "content_type", nullable = false, length = 100)
    private String contentType;

    @Column(name = "size", nullable = false)
    private Long size;

    @Column(name = "sha256", nullable = false, length = 64)
    private String sha256;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (this.id == null) {
            this.id = UUID.randomUUID();
        }
        if (this.createdAt == null) {
            this.createdAt = OffsetDateTime.now();
        }
    }
}
