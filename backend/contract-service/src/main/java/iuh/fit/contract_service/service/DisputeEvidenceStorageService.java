package iuh.fit.contract_service.service;

import iuh.fit.contract_service.config.DisputeEvidenceProperties;
import iuh.fit.contract_service.document.ContractArtifactStorage;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
public class DisputeEvidenceStorageService {
    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
            "image/jpeg", "image/png", "image/webp", "image/gif",
            "video/mp4", "video/webm", "video/quicktime",
            "audio/mpeg", "audio/mp4", "audio/wav", "audio/x-wav",
            "application/pdf", "text/plain",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    private final ContractArtifactStorage storage;
    private final DisputeEvidenceProperties properties;

    public DisputeEvidenceStorageService(
            ContractArtifactStorage storage,
            DisputeEvidenceProperties properties) {
        this.storage = storage;
        this.properties = properties;
    }

    public StoredEvidence store(
            UUID agreementId,
            Long sessionId,
            String role,
            MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Vui lòng chọn file minh chứng.");
        }
        if (file.getSize() > properties.maxFileBytes()) {
            throw new IllegalArgumentException("File minh chứng vượt quá giới hạn 50 MB.");
        }
        String contentType = normalizeContentType(file.getContentType());
        if (!ALLOWED_CONTENT_TYPES.contains(contentType)) {
            throw new IllegalArgumentException("Định dạng file minh chứng không được hỗ trợ: " + contentType);
        }

        String originalFilename = sanitizeFilename(file.getOriginalFilename());
        String objectKey = "disputes/" + agreementId
                + "/sessions/" + sessionId
                + "/" + role.toLowerCase(Locale.ROOT)
                + "/" + UUID.randomUUID() + "-" + originalFilename;
        try {
            byte[] bytes = file.getBytes();
            storage.put(objectKey, bytes, contentType);
            return new StoredEvidence(objectKey, originalFilename, contentType, bytes.length, sha256(bytes));
        } catch (java.io.IOException ex) {
            throw new IllegalStateException("Không thể đọc file minh chứng.", ex);
        }
    }

    public StoredEvidence storeTermination(
            UUID caseId,
            String role,
            MultipartFile file) {
        validate(file);
        String contentType = normalizeContentType(file.getContentType());
        String originalFilename = sanitizeFilename(file.getOriginalFilename());
        String objectKey = "terminations/" + caseId
                + "/" + role.toLowerCase(Locale.ROOT)
                + "/" + UUID.randomUUID() + "-" + originalFilename;
        try {
            byte[] bytes = file.getBytes();
            storage.put(objectKey, bytes, contentType);
            return new StoredEvidence(objectKey, originalFilename, contentType, bytes.length, sha256(bytes));
        } catch (java.io.IOException ex) {
            throw new IllegalStateException("Không thể đọc file minh chứng.", ex);
        }
    }

    private void validate(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Vui lòng chọn file minh chứng.");
        }
        if (file.getSize() > properties.maxFileBytes()) {
            throw new IllegalArgumentException("File minh chứng vượt quá giới hạn 50 MB.");
        }
        String contentType = normalizeContentType(file.getContentType());
        if (!ALLOWED_CONTENT_TYPES.contains(contentType)) {
            throw new IllegalArgumentException("Định dạng file minh chứng không được hỗ trợ: " + contentType);
        }
    }

    public byte[] read(String objectKey) {
        requireManagedKey(objectKey);
        return storage.get(objectKey);
    }

    public void deleteQuietly(String objectKey) {
        if (!isManagedKey(objectKey)) return;
        try {
            storage.delete(objectKey);
        } catch (RuntimeException ignored) {
            // The business error remains authoritative; orphan cleanup can be audited separately.
        }
    }

    public boolean isManagedKey(String objectKey) {
        return objectKey != null && (objectKey.startsWith("disputes/") || objectKey.startsWith("terminations/"));
    }

    public byte[] readTermination(String objectKey) {
        if (objectKey == null || !objectKey.startsWith("terminations/")) {
            throw new IllegalArgumentException("Minh chứng chấm dứt không hợp lệ.");
        }
        return storage.get(objectKey);
    }

    public String filename(String objectKey) {
        requireManagedKey(objectKey);
        String name = objectKey.substring(objectKey.lastIndexOf('/') + 1);
        return name.length() > 37 && name.charAt(36) == '-' ? name.substring(37) : name;
    }

    private void requireManagedKey(String objectKey) {
        if (!isManagedKey(objectKey)) {
            throw new IllegalArgumentException("Minh chứng này không phải file do EduConnect quản lý.");
        }
    }

    private String normalizeContentType(String contentType) {
        if (contentType == null || contentType.isBlank()) return "application/octet-stream";
        return contentType.split(";", 2)[0].trim().toLowerCase(Locale.ROOT);
    }

    private String sanitizeFilename(String value) {
        String filename = value == null ? "evidence" : value.trim();
        filename = filename.replace('\\', '/');
        filename = filename.substring(filename.lastIndexOf('/') + 1)
                .replaceAll("[^A-Za-z0-9._-]", "_")
                .replaceAll("_+", "_");
        if (filename.isBlank() || ".".equals(filename) || "..".equals(filename)) return "evidence";
        return filename.length() <= 160 ? filename : filename.substring(filename.length() - 160);
    }

    private String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (Exception ex) {
            throw new IllegalStateException("Không thể tính SHA-256 cho minh chứng.", ex);
        }
    }

    public record StoredEvidence(
            String objectKey,
            String originalFilename,
            String contentType,
            long size,
            String sha256) {}
}
