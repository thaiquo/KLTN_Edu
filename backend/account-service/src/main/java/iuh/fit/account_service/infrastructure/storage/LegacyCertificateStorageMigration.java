package iuh.fit.account_service.infrastructure.storage;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.nio.file.Files;
import java.nio.file.Path;

@Component
@ConditionalOnProperty(name = "storage.provider", havingValue = "s3")
public class LegacyCertificateStorageMigration implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(LegacyCertificateStorageMigration.class);

    private final ObjectStorage objectStorage;
    private final JdbcTemplate jdbcTemplate;
    private final Path localRoot;

    public LegacyCertificateStorageMigration(ObjectStorage objectStorage,
                                             JdbcTemplate jdbcTemplate,
                                             StorageProperties properties) {
        this.objectStorage = objectStorage;
        this.jdbcTemplate = jdbcTemplate;
        this.localRoot = Path.of(properties.getLocal().getRoot()).toAbsolutePath().normalize();
    }

    @Override
    public void run(ApplicationArguments args) {
        var certificates = jdbcTemplate.query(
            "select file_key, content_type from account.certificates where file_url = file_key",
            (resultSet, rowNumber) -> new LegacyCertificate(
                resultSet.getString("file_key"), resultSet.getString("content_type")));

        int migrated = 0;
        for (LegacyCertificate certificate : certificates) {
            Path source = localRoot.resolve(certificate.key()).normalize();
            if (!source.startsWith(localRoot) || !Files.isRegularFile(source)) {
                log.warn("Legacy certificate cannot be migrated because its local file is missing: key={}", certificate.key());
                continue;
            }
            try {
                objectStorage.put(certificate.key(), Files.readAllBytes(source), certificate.contentType());
                migrated += jdbcTemplate.update(
                    "update account.certificates set file_url = ? where file_key = ? and file_url = file_key",
                    objectStorage.url(certificate.key()), certificate.key());
            } catch (Exception exception) {
                log.error("Failed to migrate legacy certificate to S3: key={}", certificate.key(), exception);
            }
        }
        if (!certificates.isEmpty()) {
            log.info("Legacy certificate S3 migration completed: discovered={}, migrated={}", certificates.size(), migrated);
        }
    }

    private record LegacyCertificate(String key, String contentType) {
    }
}
