package iuh.fit.contract_service.document;

import iuh.fit.contract_service.config.ContractStorageProperties;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;

@Component
@ConditionalOnProperty(prefix = "contract.storage", name = "provider", havingValue = "s3")
public class S3ContractArtifactStorage implements ContractArtifactStorage {
    private final ContractStorageProperties properties;
    private final S3Client client;

    public S3ContractArtifactStorage(ContractStorageProperties properties) {
        this.properties = properties;
        var builder = S3Client.builder().region(Region.of(
                StringUtils.hasText(properties.region()) ? properties.region() : "ap-southeast-1"));
        if (StringUtils.hasText(properties.accessKeyId()) && StringUtils.hasText(properties.secretAccessKey())) {
            builder.credentialsProvider(StaticCredentialsProvider.create(
                    AwsBasicCredentials.create(properties.accessKeyId(), properties.secretAccessKey())));
        } else {
            builder.credentialsProvider(DefaultCredentialsProvider.create());
        }
        this.client = builder.build();
    }

    @Override
    public StoredArtifact put(String objectKey, byte[] content, String contentType) {
        ensureConfigured();
        String key = prefixed(objectKey);
        client.putObject(PutObjectRequest.builder()
                        .bucket(properties.bucket()).key(key).contentType(contentType)
                        .contentLength((long) content.length).build(),
                RequestBody.fromBytes(content));
        return new StoredArtifact(objectKey, contentType, content.length);
    }

    @Override
    public byte[] get(String objectKey) {
        ensureConfigured();
        return client.getObjectAsBytes(GetObjectRequest.builder()
                .bucket(properties.bucket()).key(prefixed(objectKey)).build()).asByteArray();
    }

    @Override
    public void delete(String objectKey) {
        if (!StringUtils.hasText(objectKey)) return;
        ensureConfigured();
        client.deleteObject(DeleteObjectRequest.builder()
                .bucket(properties.bucket()).key(prefixed(objectKey)).build());
    }

    private String prefixed(String objectKey) {
        String prefix = properties.keyPrefix();
        return StringUtils.hasText(prefix) ? prefix.replaceAll("/+$", "") + "/" + objectKey : objectKey;
    }

    private void ensureConfigured() {
        if (!StringUtils.hasText(properties.bucket())) {
            throw new IllegalStateException("CONTRACT_STORAGE_BUCKET chưa được cấu hình");
        }
    }
}
