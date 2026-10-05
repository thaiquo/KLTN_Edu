package iuh.fit.notification_service.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties(prefix = "chat.storage")
public record ChatStorageProperties(
        String provider,
        String bucket,
        String region,
        String accessKeyId,
        String secretAccessKey,
        String keyPrefix,
        Duration presignedUrlDuration
) {
    public ChatStorageProperties {
        if (provider == null || provider.isBlank()) provider = "s3";
        if (region == null || region.isBlank()) region = "ap-southeast-1";
        if (keyPrefix == null) keyPrefix = "dev";
        if (presignedUrlDuration == null) presignedUrlDuration = Duration.ofMinutes(10);
    }
}
