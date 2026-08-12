package iuh.fit.account_service.infrastructure.storage;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;

@Configuration
@EnableConfigurationProperties(StorageProperties.class)
public class StorageConfiguration {

    @Bean
    @ConditionalOnProperty(name = "storage.provider", havingValue = "s3")
    S3Client s3Client(StorageProperties properties) {
        if (!StringUtils.hasText(properties.getS3().getBucket())) {
            throw new IllegalStateException("AWS_S3_BUCKET is required when STORAGE_PROVIDER=s3");
        }
        boolean hasAccessKey = StringUtils.hasText(properties.getS3().getAccessKey());
        boolean hasSecretKey = StringUtils.hasText(properties.getS3().getSecretKey());
        if (hasAccessKey != hasSecretKey) {
            throw new IllegalStateException("AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be configured together");
        }
        var builder = S3Client.builder().region(Region.of(properties.getS3().getRegion()));
        if (hasAccessKey) {
            builder.credentialsProvider(StaticCredentialsProvider.create(
                AwsBasicCredentials.create(properties.getS3().getAccessKey().trim(), properties.getS3().getSecretKey().trim())
            ));
        }
        return builder.build();
    }
}
