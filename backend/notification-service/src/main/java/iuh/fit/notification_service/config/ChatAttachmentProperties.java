package iuh.fit.notification_service.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "chat.attachment")
public record ChatAttachmentProperties(
        int maxImageFiles,
        long maxImageBytes,
        long maxVideoBytes
) {
    public ChatAttachmentProperties {
        if (maxImageFiles <= 0) maxImageFiles = 5;
        if (maxImageBytes <= 0) maxImageBytes = 10L * 1024L * 1024L;
        if (maxVideoBytes <= 0) maxVideoBytes = 40L * 1024L * 1024L;
    }
}
