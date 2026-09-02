package iuh.fit.contract_service.document;

import iuh.fit.contract_service.config.ContractStorageProperties;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

@Component
@ConditionalOnProperty(prefix = "contract.storage", name = "provider", havingValue = "local", matchIfMissing = true)
public class LocalContractArtifactStorage implements ContractArtifactStorage {
    private final Path root;

    public LocalContractArtifactStorage(ContractStorageProperties properties) {
        String rootDir = (properties != null && properties.localRoot() != null && !properties.localRoot().isBlank())
                ? properties.localRoot() : "./data/contract-artifacts";
        this.root = Path.of(rootDir).toAbsolutePath().normalize();
    }

    @Override
    public StoredArtifact put(String objectKey, byte[] content, String contentType) {
        Path target = resolve(objectKey);
        try {
            Files.createDirectories(target.getParent());
            Files.write(target, content);
            return new StoredArtifact(objectKey, contentType, content.length);
        } catch (IOException ex) {
            throw new IllegalStateException("Không thể lưu artifact hợp đồng", ex);
        }
    }

    @Override
    public byte[] get(String objectKey) {
        try {
            return Files.readAllBytes(resolve(objectKey));
        } catch (IOException ex) {
            throw new IllegalStateException("Không thể đọc artifact hợp đồng", ex);
        }
    }

    @Override
    public void delete(String objectKey) {
        if (objectKey == null || objectKey.isBlank()) return;
        try {
            Files.deleteIfExists(resolve(objectKey));
        } catch (IOException ex) {
            throw new IllegalStateException("Không thể xóa artifact hợp đồng", ex);
        }
    }

    private Path resolve(String objectKey) {
        if (objectKey == null || objectKey.isBlank()) {
            throw new IllegalArgumentException("Object key không hợp lệ");
        }
        Path target = root.resolve(objectKey.replace('\\', '/')).normalize();
        if (!target.startsWith(root)) {
            throw new IllegalArgumentException("Object key nằm ngoài thư mục lưu trữ");
        }
        return target;
    }
}
