package iuh.fit.notification_service.service;

import iuh.fit.notification_service.config.ChatAttachmentProperties;
import iuh.fit.notification_service.entity.ChatMessageType;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Component
public class ChatAttachmentPolicy {
    public static final Set<String> IMAGE_TYPES = Set.of("image/jpeg", "image/png", "image/webp");
    public static final Set<String> VIDEO_TYPES = Set.of("video/mp4", "video/webm");

    private final ChatAttachmentProperties properties;

    public ChatAttachmentPolicy(ChatAttachmentProperties properties) {
        this.properties = properties;
    }

    public ValidatedAttachmentGroup validate(List<MultipartFile> files) {
        if (files == null || files.isEmpty()) {
            throw badRequest("Vui lòng chọn tệp cần gửi.");
        }
        List<MultipartFile> nonEmpty = files.stream()
                .filter(file -> file != null && !file.isEmpty())
                .toList();
        if (nonEmpty.isEmpty()) {
            throw badRequest("Vui lòng chọn tệp cần gửi.");
        }

        List<String> contentTypes = nonEmpty.stream()
                .map(file -> normalizeContentType(file.getContentType()))
                .toList();
        boolean hasImage = contentTypes.stream().anyMatch(IMAGE_TYPES::contains);
        boolean hasVideo = contentTypes.stream().anyMatch(VIDEO_TYPES::contains);
        boolean hasUnsupported = contentTypes.stream().anyMatch(contentType ->
                !IMAGE_TYPES.contains(contentType) && !VIDEO_TYPES.contains(contentType));

        if (hasUnsupported) {
            throw badRequest("Định dạng tệp chưa được hỗ trợ.");
        }
        if (hasImage && hasVideo) {
            throw badRequest("Không thể gửi ảnh và video trong cùng một lần.");
        }
        if (hasImage && nonEmpty.size() > properties.maxImageFiles()) {
            throw badRequest("Bạn chỉ có thể gửi tối đa 5 ảnh trong một lần.");
        }
        if (hasVideo && nonEmpty.size() > 1) {
            throw badRequest("Chỉ có thể gửi một video trong một lần.");
        }

        List<ValidatedAttachment> attachments = nonEmpty.stream()
                .map(this::validateOne)
                .toList();
        return new ValidatedAttachmentGroup(attachments.getFirst().type(), attachments);
    }

    private ValidatedAttachment validateOne(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw badRequest("Vui lòng chọn tệp cần gửi.");
        }
        String contentType = normalizeContentType(file.getContentType());
        ChatMessageType type = messageType(contentType);
        long maxBytes = type == ChatMessageType.IMAGE ? properties.maxImageBytes() : properties.maxVideoBytes();
        if (file.getSize() > maxBytes) {
            throw badRequest(type == ChatMessageType.IMAGE
                    ? "Mỗi ảnh chỉ được tối đa 10 MB."
                    : "Video chỉ được tối đa 40 MB.");
        }
        try {
            byte[] bytes = file.getBytes();
            if (!hasAllowedSignature(bytes, contentType)) {
                throw badRequest("Định dạng tệp chưa được hỗ trợ.");
            }
            return new ValidatedAttachment(
                    type,
                    sanitizeFilename(file.getOriginalFilename(), type),
                    contentType,
                    bytes,
                    sha256(bytes)
            );
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Không thể đọc tệp đính kèm.", ex);
        }
    }

    private ChatMessageType messageType(String contentType) {
        if (IMAGE_TYPES.contains(contentType)) return ChatMessageType.IMAGE;
        if (VIDEO_TYPES.contains(contentType)) return ChatMessageType.VIDEO;
        throw badRequest("Định dạng tệp chưa được hỗ trợ.");
    }

    private boolean hasAllowedSignature(byte[] bytes, String contentType) {
        if (bytes == null || bytes.length < 4) return false;
        return switch (contentType) {
            case "image/jpeg" -> bytes.length >= 3
                    && (bytes[0] & 0xFF) == 0xFF
                    && (bytes[1] & 0xFF) == 0xD8
                    && (bytes[2] & 0xFF) == 0xFF;
            case "image/png" -> bytes.length >= 8
                    && (bytes[0] & 0xFF) == 0x89
                    && bytes[1] == 0x50
                    && bytes[2] == 0x4E
                    && bytes[3] == 0x47
                    && bytes[4] == 0x0D
                    && bytes[5] == 0x0A
                    && bytes[6] == 0x1A
                    && bytes[7] == 0x0A;
            case "image/webp" -> bytes.length >= 12
                    && ascii(bytes, 0, 4).equals("RIFF")
                    && ascii(bytes, 8, 4).equals("WEBP");
            case "video/mp4" -> bytes.length >= 12 && ascii(bytes, 4, 4).equals("ftyp");
            case "video/webm" -> bytes.length >= 4
                    && (bytes[0] & 0xFF) == 0x1A
                    && (bytes[1] & 0xFF) == 0x45
                    && (bytes[2] & 0xFF) == 0xDF
                    && (bytes[3] & 0xFF) == 0xA3;
            default -> false;
        };
    }

    private String ascii(byte[] bytes, int start, int length) {
        if (bytes.length < start + length) return "";
        StringBuilder builder = new StringBuilder(length);
        for (int i = start; i < start + length; i++) {
            builder.append((char) bytes[i]);
        }
        return builder.toString();
    }

    private String sanitizeFilename(String value, ChatMessageType type) {
        String fallback = type == ChatMessageType.IMAGE ? "image" : "video";
        String filename = value == null ? fallback : value.trim();
        filename = filename.replace('\\', '/');
        filename = filename.substring(filename.lastIndexOf('/') + 1)
                .replace("\u0000", "")
                .replaceAll("[^A-Za-z0-9._-]", "_")
                .replaceAll("_+", "_");
        if (filename.isBlank() || ".".equals(filename) || "..".equals(filename)) return fallback;
        return filename.length() <= 160 ? filename : filename.substring(filename.length() - 160);
    }

    private String normalizeContentType(String contentType) {
        if (contentType == null || contentType.isBlank()) return "application/octet-stream";
        return contentType.split(";", 2)[0].trim().toLowerCase(Locale.ROOT);
    }

    private String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (Exception ex) {
            throw new IllegalStateException("Không thể tính SHA-256 cho tệp chat.", ex);
        }
    }

    private ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    public record ValidatedAttachment(
            ChatMessageType type,
            String originalFilename,
            String contentType,
            byte[] bytes,
            String sha256
    ) {}

    public record ValidatedAttachmentGroup(
            ChatMessageType type,
            List<ValidatedAttachment> attachments
    ) {}
}
