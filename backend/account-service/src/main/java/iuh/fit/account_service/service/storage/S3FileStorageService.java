package iuh.fit.account_service.service.storage;

import iuh.fit.account_service.config.StorageProperties;
import iuh.fit.account_service.exception.StorageException;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;

@Service
public class S3FileStorageService implements FileStorageService {

    private final StorageProperties properties;
    private final S3Client s3Client;
    private final S3Presigner presigner;

    public S3FileStorageService(StorageProperties properties) {
        this.properties = properties;
        Region region = resolveRegion(properties);

        if (hasExplicitCredentials(properties)) {
            var credentials = StaticCredentialsProvider.create(
                    AwsBasicCredentials.create(properties.getAccessKeyId(), properties.getSecretAccessKey())
            );
            this.s3Client = S3Client.builder()
                    .region(region)
                    .credentialsProvider(credentials)
                    .build();
            this.presigner = S3Presigner.builder()
                    .region(region)
                    .credentialsProvider(credentials)
                    .build();
        } else {
            this.s3Client = S3Client.builder()
                    .region(region)
                    .credentialsProvider(DefaultCredentialsProvider.create())
                    .build();
            this.presigner = S3Presigner.builder()
                    .region(region)
                    .credentialsProvider(DefaultCredentialsProvider.create())
                    .build();
        }
    }

    @Override
    public StoredFile store(String fileKey, byte[] content, String contentType) {
        ensureS3Configured();

        try {
            PutObjectRequest request = PutObjectRequest.builder()
                    .bucket(properties.getBucket())
                    .key(fileKey)
                    .contentType(contentType)
                    .contentLength((long) content.length)
                    .build();

            s3Client.putObject(request, RequestBody.fromBytes(content));
            return new StoredFile(fileKey, contentType, content.length);
        } catch (RuntimeException ex) {
            throw new StorageException("Could not upload file to storage", ex);
        }
    }

    @Override
    public String createPresignedGetUrl(String fileKey) {
        if (!StringUtils.hasText(fileKey)) {
            return null;
        }
        ensureS3Configured();

        try {
            GetObjectRequest getObjectRequest = GetObjectRequest.builder()
                    .bucket(properties.getBucket())
                    .key(fileKey)
                    .build();
            GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                    .signatureDuration(properties.getPresignedUrlDuration())
                    .getObjectRequest(getObjectRequest)
                    .build();

            return presigner.presignGetObject(presignRequest).url().toString();
        } catch (RuntimeException ex) {
            throw new StorageException("Could not create file access URL", ex);
        }
    }

    @Override
    public void delete(String fileKey) {
        if (!StringUtils.hasText(fileKey)) {
            return;
        }
        ensureS3Configured();

        try {
            DeleteObjectRequest request = DeleteObjectRequest.builder()
                    .bucket(properties.getBucket())
                    .key(fileKey)
                    .build();
            s3Client.deleteObject(request);
        } catch (RuntimeException ex) {
            throw new StorageException("Could not delete file from storage", ex);
        }
    }

    private void ensureS3Configured() {
        if (!"s3".equalsIgnoreCase(properties.getProvider())) {
            throw new StorageException("Unsupported storage provider: " + properties.getProvider());
        }

        if (!StringUtils.hasText(properties.getBucket())) {
            throw new StorageException("S3 bucket is not configured");
        }
    }

    private Region resolveRegion(StorageProperties properties) {
        String region = StringUtils.hasText(properties.getRegion()) ? properties.getRegion() : "ap-southeast-1";
        return Region.of(region);
    }

    private boolean hasExplicitCredentials(StorageProperties properties) {
        return StringUtils.hasText(properties.getAccessKeyId())
                && StringUtils.hasText(properties.getSecretAccessKey());
    }
}
