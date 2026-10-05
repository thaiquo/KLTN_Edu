package iuh.fit.notification_service.service.storage;

import iuh.fit.notification_service.config.ChatStorageProperties;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;

@Component
public class S3ChatAttachmentStorage implements ChatAttachmentStorage {
    private final ChatStorageProperties properties;
    private final S3Client client;
    private final S3Presigner presigner;

    public S3ChatAttachmentStorage(ChatStorageProperties properties) {
        this.properties = properties;
        Region region = Region.of(properties.region());
        if (StringUtils.hasText(properties.accessKeyId()) && StringUtils.hasText(properties.secretAccessKey())) {
            var credentials = StaticCredentialsProvider.create(
                    AwsBasicCredentials.create(properties.accessKeyId(), properties.secretAccessKey())
            );
            this.client = S3Client.builder().region(region).credentialsProvider(credentials).build();
            this.presigner = S3Presigner.builder().region(region).credentialsProvider(credentials).build();
        } else {
            this.client = S3Client.builder().region(region).credentialsProvider(DefaultCredentialsProvider.create()).build();
            this.presigner = S3Presigner.builder().region(region).credentialsProvider(DefaultCredentialsProvider.create()).build();
        }
    }

    @Override
    public StoredChatAttachment put(String objectKey, byte[] content, String contentType) {
        ensureConfigured();
        String key = prefixed(objectKey);
        try {
            client.putObject(
                    PutObjectRequest.builder()
                            .bucket(properties.bucket())
                            .key(key)
                            .contentType(contentType)
                            .contentLength((long) content.length)
                            .build(),
                    RequestBody.fromBytes(content)
            );
            return new StoredChatAttachment(objectKey, contentType, content.length);
        } catch (RuntimeException ex) {
            throw new ChatAttachmentStorageException("Could not upload chat attachment", ex);
        }
    }

    @Override
    public String createPresignedGetUrl(String objectKey) {
        if (!StringUtils.hasText(objectKey)) return null;
        ensureConfigured();
        try {
            var get = GetObjectRequest.builder()
                    .bucket(properties.bucket())
                    .key(prefixed(objectKey))
                    .build();
            var presign = GetObjectPresignRequest.builder()
                    .signatureDuration(properties.presignedUrlDuration())
                    .getObjectRequest(get)
                    .build();
            return presigner.presignGetObject(presign).url().toString();
        } catch (RuntimeException ex) {
            throw new ChatAttachmentStorageException("Could not create chat attachment URL", ex);
        }
    }

    @Override
    public void delete(String objectKey) {
        if (!StringUtils.hasText(objectKey)) return;
        ensureConfigured();
        try {
            client.deleteObject(DeleteObjectRequest.builder()
                    .bucket(properties.bucket())
                    .key(prefixed(objectKey))
                    .build());
        } catch (RuntimeException ex) {
            throw new ChatAttachmentStorageException("Could not delete chat attachment", ex);
        }
    }

    private String prefixed(String objectKey) {
        String prefix = properties.keyPrefix();
        return StringUtils.hasText(prefix) ? prefix.replaceAll("/+$", "") + "/" + objectKey : objectKey;
    }

    private void ensureConfigured() {
        if (!"s3".equalsIgnoreCase(properties.provider())) {
            throw new ChatAttachmentStorageException("Unsupported chat storage provider: " + properties.provider());
        }
        if (!StringUtils.hasText(properties.bucket())) {
            throw new ChatAttachmentStorageException("Chat attachment S3 bucket is not configured");
        }
    }
}
