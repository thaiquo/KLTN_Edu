package iuh.fit.account_service.infrastructure.storage;

import iuh.fit.account_service.shared.exception.BusinessException;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.zip.ZipInputStream;

@Service
public class TutorCertificateStorageService {
    private static final long MAX_SIZE = 5L * 1024 * 1024;
    private static final Set<String> ALLOWED_TYPES = Set.of(
        "application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif",
        "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    private final ObjectStorage objectStorage;

    public TutorCertificateStorageService(ObjectStorage objectStorage) {
        this.objectStorage = objectStorage;
    }

    public StoredObject store(UUID userId, MultipartFile file) {
        if (file == null || file.isEmpty()) throw new BusinessException("Certificate file is required");
        if (file.getSize() > MAX_SIZE) throw new BusinessException("Certificate file must not exceed 5 MB");
        String contentType = resolveContentType(file);
        if (!ALLOWED_TYPES.contains(contentType)) throw new BusinessException("Only images, PDF, Word and Excel files are accepted");
        byte[] bytes = read(file);
        validateSignature(bytes, contentType);

        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        String originalName = sanitize(file.getOriginalFilename());
        String key = "tutor-applications/%s/certificates/%d/%02d/%s-%s".formatted(
            userId, today.getYear(), today.getMonthValue(), UUID.randomUUID(), originalName);
        objectStorage.put(key, bytes, contentType);
        return new StoredObject(key, objectStorage.url(key), originalName, contentType, bytes.length);
    }

    public StoredContent read(String key) { return objectStorage.get(key); }

    public String url(String key) { return objectStorage.url(key); }

    public boolean belongsTo(UUID userId, String key) {
        return key != null && key.startsWith("tutor-applications/" + userId + "/certificates/");
    }

    private byte[] read(MultipartFile file) {
        try { return file.getBytes(); }
        catch (IOException exception) { throw new BusinessException("Could not read certificate file"); }
    }

    private void validateSignature(byte[] bytes, String contentType) {
        boolean valid = switch (contentType) {
            case "application/pdf" -> startsWith(bytes, new int[]{0x25, 0x50, 0x44, 0x46});
            case "image/png" -> startsWith(bytes, new int[]{0x89, 0x50, 0x4E, 0x47});
            case "image/jpeg" -> startsWith(bytes, new int[]{0xFF, 0xD8, 0xFF});
            case "image/gif" -> startsWith(bytes, new int[]{0x47, 0x49, 0x46, 0x38});
            case "image/webp" -> startsWith(bytes, new int[]{0x52, 0x49, 0x46, 0x46})
                && bytes.length >= 12 && bytes[8] == 0x57 && bytes[9] == 0x45 && bytes[10] == 0x42 && bytes[11] == 0x50;
            case "application/msword", "application/vnd.ms-excel" -> startsWith(bytes, new int[]{0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1});
            case "application/vnd.openxmlformats-officedocument.wordprocessingml.document" -> hasOfficeFolder(bytes, "word/");
            case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" -> hasOfficeFolder(bytes, "xl/");
            default -> false;
        };
        if (!valid) throw new BusinessException("File content does not match its declared type");
    }

    private boolean startsWith(byte[] bytes, int[] signature) {
        if (bytes.length < signature.length) return false;
        for (int index = 0; index < signature.length; index++) {
            if ((bytes[index] & 0xFF) != signature[index]) return false;
        }
        return true;
    }

    private boolean hasOfficeFolder(byte[] bytes, String folder) {
        if (!startsWith(bytes, new int[]{0x50, 0x4B, 0x03, 0x04})) return false;
        try (ZipInputStream zip = new ZipInputStream(new java.io.ByteArrayInputStream(bytes))) {
            for (var entry = zip.getNextEntry(); entry != null; entry = zip.getNextEntry()) {
                if (entry.getName().startsWith(folder)) return true;
            }
            return false;
        } catch (IOException exception) {
            return false;
        }
    }

    private String resolveContentType(MultipartFile file) {
        String declared = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);
        if (ALLOWED_TYPES.contains(declared)) return declared;

        String filename = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase(Locale.ROOT);
        if (filename.endsWith(".pdf")) return "application/pdf";
        if (filename.endsWith(".png")) return "image/png";
        if (filename.endsWith(".jpg") || filename.endsWith(".jpeg")) return "image/jpeg";
        if (filename.endsWith(".webp")) return "image/webp";
        if (filename.endsWith(".gif")) return "image/gif";
        if (filename.endsWith(".doc")) return "application/msword";
        if (filename.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        if (filename.endsWith(".xls")) return "application/vnd.ms-excel";
        if (filename.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        return declared;
    }

    private String sanitize(String value) {
        String source = value == null || value.isBlank() ? "certificate" : value;
        String ascii = Normalizer.normalize(source, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        String safe = ascii.replaceAll("[^A-Za-z0-9._-]", "-").replaceAll("-+", "-");
        return safe.length() > 120 ? safe.substring(safe.length() - 120) : safe;
    }
}
