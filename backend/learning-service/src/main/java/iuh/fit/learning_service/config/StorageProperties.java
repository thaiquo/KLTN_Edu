package iuh.fit.learning_service.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.time.Duration;

@Component
@ConfigurationProperties(prefix = "app.storage")
public class StorageProperties {

    private String provider = "s3";
    private String bucket;
    private String region = "ap-southeast-1";
    private String accessKeyId;
    private String secretAccessKey;
    private String keyPrefix = "dev";
    private Duration presignedUrlDuration = Duration.ofMinutes(10);
    private String localRoot = "./data/learning-storage";

    public String getProvider() {
        return provider;
    }

    public void setProvider(String provider) {
        this.provider = provider;
    }

    public String getBucket() {
        return bucket;
    }

    public void setBucket(String bucket) {
        this.bucket = bucket;
    }

    public String getRegion() {
        return region;
    }

    public void setRegion(String region) {
        this.region = region;
    }

    public String getAccessKeyId() {
        return accessKeyId;
    }

    public void setAccessKeyId(String accessKeyId) {
        this.accessKeyId = accessKeyId;
    }

    public String getSecretAccessKey() {
        return secretAccessKey;
    }

    public void setSecretAccessKey(String secretAccessKey) {
        this.secretAccessKey = secretAccessKey;
    }

    public String getKeyPrefix() {
        return keyPrefix;
    }

    public void setKeyPrefix(String keyPrefix) {
        this.keyPrefix = keyPrefix;
    }

    public Duration getPresignedUrlDuration() {
        return presignedUrlDuration;
    }

    public void setPresignedUrlDuration(Duration presignedUrlDuration) {
        this.presignedUrlDuration = presignedUrlDuration;
    }

    public String getLocalRoot() {
        return localRoot;
    }

    public void setLocalRoot(String localRoot) {
        this.localRoot = localRoot;
    }
}
