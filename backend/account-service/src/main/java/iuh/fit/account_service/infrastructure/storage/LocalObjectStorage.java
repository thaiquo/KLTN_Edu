package iuh.fit.account_service.infrastructure.storage;

import iuh.fit.account_service.shared.exception.BusinessException;
import iuh.fit.account_service.shared.exception.NotFoundException;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

@Component
@ConditionalOnProperty(name = "storage.provider", havingValue = "local", matchIfMissing = true)
public class LocalObjectStorage implements ObjectStorage {
    private final Path root;

    public LocalObjectStorage(StorageProperties properties) {
        this.root = Path.of(properties.getLocal().getRoot()).toAbsolutePath().normalize();
    }

    @Override
    public void put(String key, byte[] content, String contentType) {
        Path target = resolve(key);
        try {
            Files.createDirectories(target.getParent());
            Files.write(target, content);
        } catch (IOException exception) {
            throw new BusinessException("Could not store file");
        }
    }

    @Override
    public StoredContent get(String key) {
        Path target = resolve(key);
        if (!Files.isRegularFile(target)) throw new NotFoundException("Stored file not found");
        try {
            String contentType = Files.probeContentType(target);
            return new StoredContent(Files.readAllBytes(target), contentType == null ? "application/octet-stream" : contentType);
        } catch (IOException exception) {
            throw new BusinessException("Could not read stored file");
        }
    }

    @Override
    public String url(String key) {
        return resolve(key).toUri().toString();
    }

    private Path resolve(String key) {
        Path target = root.resolve(key).normalize();
        if (!target.startsWith(root)) throw new BusinessException("Invalid storage key");
        return target;
    }
}
