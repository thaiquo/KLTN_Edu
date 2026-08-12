package iuh.fit.account_service.infrastructure.storage;

import iuh.fit.account_service.shared.exception.BusinessException;
import iuh.fit.account_service.shared.exception.NotFoundException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.core.exception.SdkClientException;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetUrlRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;

@Component
@ConditionalOnProperty(name = "storage.provider", havingValue = "s3")
public class S3ObjectStorage implements ObjectStorage {

    private static final Logger log = LoggerFactory.getLogger(S3ObjectStorage.class);

    private final S3Client client;
    private final String bucket;

    public S3ObjectStorage(S3Client client, StorageProperties properties) {
        this.client = client;
        this.bucket = properties.getS3().getBucket();
    }

    @Override
    public void put(String key, byte[] content, String contentType) {
        try {
            client.putObject(PutObjectRequest.builder().bucket(bucket).key(key).contentType(contentType).build(),
                RequestBody.fromBytes(content));
            log.info("Successfully uploaded file to S3: bucket={}, key={}", bucket, key);
        } catch (S3Exception exception) {
            String details = exception.awsErrorDetails() != null ? exception.awsErrorDetails().errorMessage() : exception.getMessage();
            log.error("Failed to upload object to AWS S3: bucket={}, key={}, error={}", bucket, key, details, exception);
            throw new BusinessException("Could not store file in S3: " + details);
        } catch (SdkClientException exception) {
            log.error("Failed to connect to AWS S3 while uploading: bucket={}, key={}, error={}", bucket, key, exception.getMessage(), exception);
            throw new BusinessException("Could not connect to S3: " + exception.getMessage());
        }
    }

    @Override
    public StoredContent get(String key) {
        try {
            var response = client.getObjectAsBytes(GetObjectRequest.builder().bucket(bucket).key(key).build());
            String contentType = response.response().contentType();
            return new StoredContent(response.asByteArray(), contentType == null ? "application/octet-stream" : contentType);
        } catch (NoSuchKeyException exception) {
            log.warn("S3 Object not found: bucket={}, key={}", bucket, key);
            throw new NotFoundException("Stored file not found");
        } catch (S3Exception exception) {
            String details = exception.awsErrorDetails() != null ? exception.awsErrorDetails().errorMessage() : exception.getMessage();
            log.error("Failed to read object from AWS S3: bucket={}, key={}, error={}", bucket, key, details, exception);
            throw new BusinessException("Could not read file from S3: " + details);
        } catch (SdkClientException exception) {
            log.error("Failed to connect to AWS S3 while reading: bucket={}, key={}, error={}", bucket, key, exception.getMessage(), exception);
            throw new BusinessException("Could not connect to S3: " + exception.getMessage());
        }
    }

    @Override
    public String url(String key) {
        return client.utilities().getUrl(GetUrlRequest.builder().bucket(bucket).key(key).build()).toExternalForm();
    }
}
