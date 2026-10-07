package iuh.fit.learning_service.service.storage;

import iuh.fit.learning_service.config.StorageProperties;
import iuh.fit.learning_service.exception.StorageException;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

@Service
@ConditionalOnProperty(prefix = "app.storage", name = "provider", havingValue = "local")
public class LocalFileStorageService implements FileStorageService {

    private final Path root;

    public LocalFileStorageService(StorageProperties properties) {
        String rootDir = (properties != null && StringUtils.hasText(properties.getLocalRoot()))
                ? properties.getLocalRoot() : "./data/learning-storage";
        this.root = Path.of(rootDir).toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.root);
        } catch (IOException e) {
            throw new StorageException("Cannot create storage directory: " + this.root, e);
        }
    }

    @Override
    public StoredFile store(String fileKey, byte[] content, String contentType) {
        Path target = resolve(fileKey);
        try {
            Files.createDirectories(target.getParent());
            Files.write(target, content);
            return new StoredFile(fileKey, contentType, content.length);
        } catch (IOException ex) {
            throw new StorageException("Could not store file locally", ex);
        }
    }

    @Override
    public String createPresignedGetUrl(String fileKey) {
        if (!StringUtils.hasText(fileKey)) {
            return null;
        }
        return "/api/storage/files?key=" + URLEncoder.encode(fileKey, StandardCharsets.UTF_8);
    }

    @Override
    public byte[] getBytes(String fileKey) {
        Path target = resolve(fileKey);
        try {
            return Files.readAllBytes(target);
        } catch (IOException ex) {
            throw new StorageException("Could not read file locally: " + fileKey, ex);
        }
    }

    @Override
    public void delete(String fileKey) {
        if (!StringUtils.hasText(fileKey)) {
            return;
        }
        Path target = resolve(fileKey);
        try {
            Files.deleteIfExists(target);
        } catch (IOException ex) {
            throw new StorageException("Could not delete file locally", ex);
        }
    }

    private Path resolve(String fileKey) {
        if (!StringUtils.hasText(fileKey)) {
            throw new IllegalArgumentException("File key cannot be empty");
        }
        Path target = root.resolve(fileKey.replace('\\', '/')).normalize();
        if (!target.startsWith(root)) {
            throw new IllegalArgumentException("File key is outside the storage directory");
        }
        return target;
    }
}
