package iuh.fit.account_service.service;

import iuh.fit.account_service.config.FilePolicyProperties;
import iuh.fit.account_service.dto.tutorapplication.TutorDocumentDownloadResponse;
import iuh.fit.account_service.dto.tutorapplication.TutorDocumentResponse;
import iuh.fit.account_service.entity.TutorApplication;
import iuh.fit.account_service.entity.TutorDocument;
import iuh.fit.account_service.entity.User;
import iuh.fit.account_service.enums.CredentialValidityType;
import iuh.fit.account_service.enums.TutorApplicationStatus;
import iuh.fit.account_service.enums.TutorDocumentType;
import iuh.fit.account_service.enums.TutorDocumentVerificationStatus;
import iuh.fit.account_service.util.HashUtils;
import iuh.fit.account_service.exception.ConflictException;
import iuh.fit.account_service.exception.FileValidationException;
import iuh.fit.account_service.exception.ResourceNotFoundException;
import iuh.fit.account_service.exception.StorageException;
import iuh.fit.account_service.repository.TutorApplicationRepository;
import iuh.fit.account_service.repository.TutorDocumentRepository;
import iuh.fit.account_service.repository.UserRepository;
import iuh.fit.account_service.service.storage.FileStorageService;
import iuh.fit.account_service.util.EmailNormalizer;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class TutorDocumentService {

    private static final Set<TutorDocumentType> IDENTITY_TYPES = Set.of(
            TutorDocumentType.IDENTITY_FRONT,
            TutorDocumentType.IDENTITY_BACK,
            TutorDocumentType.PASSPORT
    );
    private static final Map<String, String> CONTENT_TYPE_BY_EXTENSION = Map.ofEntries(
            Map.entry("jpg", "image/jpeg"),
            Map.entry("jpeg", "image/jpeg"),
            Map.entry("png", "image/png"),
            Map.entry("gif", "image/gif"),
            Map.entry("webp", "image/webp"),
            Map.entry("pdf", "application/pdf"),
            Map.entry("doc", "application/msword"),
            Map.entry("docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
            Map.entry("xls", "application/vnd.ms-excel"),
            Map.entry("xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    );

    private final TutorApplicationRepository tutorApplicationRepository;
    private final TutorDocumentRepository tutorDocumentRepository;
    private final UserRepository userRepository;
    private final FileStorageService fileStorageService;
    private final FilePolicyProperties filePolicyProperties;

    public TutorDocumentService(
            TutorApplicationRepository tutorApplicationRepository,
            TutorDocumentRepository tutorDocumentRepository,
            UserRepository userRepository,
            FileStorageService fileStorageService,
            FilePolicyProperties filePolicyProperties
    ) {
        this.tutorApplicationRepository = tutorApplicationRepository;
        this.tutorDocumentRepository = tutorDocumentRepository;
        this.userRepository = userRepository;
        this.fileStorageService = fileStorageService;
        this.filePolicyProperties = filePolicyProperties;
    }

    @Transactional(readOnly = true)
    public List<TutorDocumentResponse> listMyDocuments(String email) {
        TutorApplication application = getApplication(email);
        return tutorDocumentRepository.findByTutorApplication_IdOrderByUploadedAtDesc(application.getId())
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public TutorDocumentResponse uploadMyDocument(String email, TutorDocumentType documentType, MultipartFile file) {
        return uploadMyDocument(email, documentType, file, null, null, null, null, null, null);
    }

    @Transactional
    public TutorDocumentResponse uploadMyDocument(
            String email,
            TutorDocumentType documentType,
            MultipartFile file,
            String title,
            String issuer,
            LocalDate issueDate,
            CredentialValidityType validityType,
            LocalDate expiryDate,
            String credentialNumber
    ) {
        TutorApplication application = getApplication(email);
        ensureEditable(application);
        validateEvidenceCount(application, documentType);
        validateFile(documentType, file);
        CredentialMetadata metadata = validateCredentialMetadata(
                documentType,
                title,
                issuer,
                issueDate,
                validityType,
                expiryDate,
                credentialNumber
        );

        String originalFilename = sanitizeFilename(file.getOriginalFilename());
        String extension = extensionOf(originalFilename);

        byte[] content = readBytes(file);
        String sha256 = HashUtils.calculateSha256(content);
        String contentType = resolveContentType(file.getContentType(), extension, content);

        // Duplicate detection scoped to this application (same bytes = skip upload, reuse record)
        if (sha256 != null) {
            var existing = tutorDocumentRepository.findFirstByTutorApplication_IdAndSha256Hash(
                    application.getId(), sha256);
            if (existing.isPresent()) {
                return toResponse(existing.get());
            }
        }

        String fileKey = "tutor-applications/%d/documents/%s.%s".formatted(
                application.getId(),
                UUID.randomUUID(),
                extension
        );

        fileStorageService.store(fileKey, content, contentType);

        try {
            TutorDocument document = new TutorDocument();
            document.setTutorApplication(application);
            document.setDocumentType(documentType);
            document.setFileKey(fileKey);
            document.setOriginalFilename(originalFilename);
            document.setContentType(contentType);
            document.setFileSize((long) content.length);
            document.setSha256Hash(sha256);
            document.setVerificationStatus(TutorDocumentVerificationStatus.PENDING);
            document.setUploadedAt(LocalDateTime.now());
            document.setTitle(metadata.title());
            document.setIssuer(metadata.issuer());
            document.setIssueDate(metadata.issueDate());
            document.setValidityType(metadata.validityType());
            document.setExpiryDate(metadata.expiryDate());
            document.setCredentialNumber(metadata.credentialNumber());
            return toResponse(tutorDocumentRepository.save(document));
        } catch (RuntimeException ex) {
            try {
                fileStorageService.delete(fileKey);
            } catch (RuntimeException cleanupError) {
                ex.addSuppressed(cleanupError);
            }
            throw ex;
        }
    }

    @Transactional(readOnly = true)
    public TutorDocumentDownloadResponse createDownloadUrl(String email, Long documentId) {
        TutorApplication application = getApplication(email);
        TutorDocument document = tutorDocumentRepository.findByIdAndTutorApplication_Id(documentId, application.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Tutor document not found"));
        return new TutorDocumentDownloadResponse(fileStorageService.createPresignedGetUrl(document.getFileKey()));
    }

    @Transactional
    public void deleteMyDocument(String email, Long documentId) {
        TutorApplication application = getApplication(email);
        ensureEditable(application);
        TutorDocument document = tutorDocumentRepository.findByIdAndTutorApplication_Id(documentId, application.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Tutor document not found"));

        fileStorageService.delete(document.getFileKey());
        tutorDocumentRepository.delete(document);
    }

    private void validateEvidenceCount(TutorApplication application, TutorDocumentType documentType) {
        if (!isEvidenceType(documentType)) {
            return;
        }
        long count = tutorDocumentRepository.countByTutorApplication_IdAndDocumentType(application.getId(), TutorDocumentType.CERTIFICATE)
                + tutorDocumentRepository.countByTutorApplication_IdAndDocumentType(application.getId(), TutorDocumentType.DEGREE)
                + tutorDocumentRepository.countByTutorApplication_IdAndDocumentType(application.getId(), TutorDocumentType.WORK_EXPERIENCE)
                + tutorDocumentRepository.countByTutorApplication_IdAndDocumentType(application.getId(), TutorDocumentType.PORTFOLIO)
                + tutorDocumentRepository.countByTutorApplication_IdAndDocumentType(application.getId(), TutorDocumentType.OTHER);
        if (count >= filePolicyProperties.getMaxCertificateCount()) {
            throw new ConflictException("Maximum certificate document count reached");
        }
    }

    private CredentialMetadata validateCredentialMetadata(
            TutorDocumentType documentType,
            String title,
            String issuer,
            LocalDate issueDate,
            CredentialValidityType validityType,
            LocalDate expiryDate,
            String credentialNumber
    ) {
        if (!isEvidenceType(documentType)) {
            return new CredentialMetadata(null, null, null, null, null, null);
        }

        String normalizedTitle = requiredText(title, "Evidence title is required");
        String normalizedIssuer = normalizeBlankToNull(issuer);
        if (issueDate != null && issueDate.isAfter(LocalDate.now())) {
            throw new FileValidationException("Evidence issue date cannot be in the future");
        }

        CredentialValidityType nextValidityType = documentType == TutorDocumentType.CERTIFICATE && validityType != null
                ? validityType
                : CredentialValidityType.DOES_NOT_EXPIRE;

        LocalDate nextExpiryDate = expiryDate;
        if (nextValidityType == CredentialValidityType.EXPIRES && nextExpiryDate == null) {
            throw new FileValidationException("Credential expiry date is required");
        }
        if (nextValidityType == CredentialValidityType.DOES_NOT_EXPIRE) {
            nextExpiryDate = null;
        }

        return new CredentialMetadata(
                normalizedTitle,
                normalizedIssuer,
                issueDate,
                nextValidityType,
                nextExpiryDate,
                normalizeBlankToNull(credentialNumber)
        );
    }

    private void validateFile(TutorDocumentType documentType, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new FileValidationException("File is required");
        }

        FilePolicyProperties.FileRule rule = IDENTITY_TYPES.contains(documentType)
                ? filePolicyProperties.getIdentity()
                : filePolicyProperties.getCertificate();
        String originalFilename = sanitizeFilename(file.getOriginalFilename());
        String extension = extensionOf(originalFilename);
        byte[] bytes = readBytes(file);
        String contentType = resolveContentType(file.getContentType(), extension, bytes);

        if (!rule.getAllowedExtensions().contains(extension)) {
            throw new FileValidationException("File extension is not allowed");
        }
        if (!rule.getAllowedContentTypes().contains(contentType)) {
            throw new FileValidationException("File type is not allowed");
        }
        if (file.getSize() > rule.getMaxSize().toBytes()) {
            throw new FileValidationException("File is too large");
        }
        validateMagicBytes(contentType, bytes);
    }

    private void validateMagicBytes(String contentType, byte[] bytes) {
        if (contentType == null || bytes == null || bytes.length == 0) {
            return;
        }
        switch (contentType) {
            case "application/pdf":
                if (bytes.length < 4 || bytes[0] != '%' || bytes[1] != 'P' || bytes[2] != 'D' || bytes[3] != 'F') {
                    throw new FileValidationException("PDF signature is invalid");
                }
                break;
            case "image/png":
                if (bytes.length < 8 || bytes[0] != (byte) 0x89 || bytes[1] != 'P' || bytes[2] != 'N' || bytes[3] != 'G') {
                    throw new FileValidationException("PNG signature is invalid");
                }
                break;
            case "image/jpeg":
                if (bytes.length < 3 || bytes[0] != (byte) 0xFF || bytes[1] != (byte) 0xD8 || bytes[2] != (byte) 0xFF) {
                    throw new FileValidationException("JPEG signature is invalid");
                }
                break;
            case "image/gif":
                if (bytes.length < 4 || bytes[0] != 'G' || bytes[1] != 'I' || bytes[2] != 'F' || bytes[3] != '8') {
                    throw new FileValidationException("GIF signature is invalid");
                }
                break;
            case "image/webp":
                if (bytes.length < 12 || bytes[0] != 'R' || bytes[1] != 'I' || bytes[2] != 'F' || bytes[3] != 'F'
                        || bytes[8] != 'W' || bytes[9] != 'E' || bytes[10] != 'B' || bytes[11] != 'P') {
                    throw new FileValidationException("WebP signature is invalid");
                }
                break;
            default:
                // Office formats (doc, docx, xls, xlsx) and octet-stream: skip magic byte check
                break;
        }
    }

    private TutorApplication getApplication(String email) {
        User user = userRepository.findByEmailIgnoreCase(EmailNormalizer.normalize(email))
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return tutorApplicationRepository.findByUserId(user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Tutor application not found"));
    }

    private void ensureEditable(TutorApplication application) {
        if (application.getStatus() != TutorApplicationStatus.DRAFT
                && application.getStatus() != TutorApplicationStatus.REJECTED) {
            throw new ConflictException("Tutor application is not editable in current status");
        }
    }

    private TutorDocumentResponse toResponse(TutorDocument document) {
        return new TutorDocumentResponse(
                document.getId(),
                document.getDocumentType(),
                document.getOriginalFilename(),
                document.getContentType(),
                document.getFileSize(),
                document.getVerificationStatus(),
                document.getUploadedAt(),
                document.getTitle(),
                document.getIssuer(),
                document.getIssueDate(),
                document.getValidityType(),
                document.getExpiryDate(),
                document.getCredentialNumber(),
                isExpired(document)
        );
    }

    private boolean isExpired(TutorDocument document) {
        return document.getValidityType() == CredentialValidityType.EXPIRES
                && document.getExpiryDate() != null
                && document.getExpiryDate().isBefore(LocalDate.now());
    }

    private boolean isEvidenceType(TutorDocumentType documentType) {
        return documentType == TutorDocumentType.CERTIFICATE
                || documentType == TutorDocumentType.DEGREE
                || documentType == TutorDocumentType.WORK_EXPERIENCE
                || documentType == TutorDocumentType.PORTFOLIO
                || documentType == TutorDocumentType.OTHER;
    }

    private byte[] readBytes(MultipartFile file) {
        try {
            return file.getBytes();
        } catch (IOException ex) {
            throw new StorageException("Could not read uploaded file", ex);
        }
    }

    private String sanitizeFilename(String filename) {
        String clean = StringUtils.cleanPath(filename == null ? "document" : filename);
        clean = clean.replace("\\", "_").replace("/", "_");
        return clean.length() > 255 ? clean.substring(clean.length() - 255) : clean;
    }

    private String extensionOf(String filename) {
        int dot = filename.lastIndexOf('.');
        if (dot < 0 || dot == filename.length() - 1) {
            throw new FileValidationException("File extension is required");
        }
        return filename.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    private String normalizeContentType(String contentType) {
        return contentType == null ? "" : contentType.toLowerCase(Locale.ROOT);
    }

    private String resolveContentType(String suppliedContentType, String extension, byte[] bytes) {
        String detectedContentType = detectContentType(bytes, extension);
        if (!detectedContentType.isBlank()) {
            return detectedContentType;
        }
        String inferredContentType = CONTENT_TYPE_BY_EXTENSION.getOrDefault(extension, "");
        if (!inferredContentType.isBlank()) {
            return inferredContentType;
        }
        return normalizeContentType(suppliedContentType);
    }

    private String detectContentType(byte[] bytes, String extension) {
        if (bytes == null || bytes.length == 0) {
            return "";
        }
        if (hasPrefix(bytes, (byte) 0x89, (byte) 'P', (byte) 'N', (byte) 'G', (byte) '\r', (byte) '\n', (byte) 0x1A, (byte) '\n')) {
            return "image/png";
        }
        if (hasPrefix(bytes, (byte) 0xFF, (byte) 0xD8, (byte) 0xFF)) {
            return "image/jpeg";
        }
        if (hasPrefix(bytes, (byte) 'G', (byte) 'I', (byte) 'F', (byte) '8')) {
            return "image/gif";
        }
        if (bytes.length >= 12
                && hasPrefix(bytes, (byte) 'R', (byte) 'I', (byte) 'F', (byte) 'F')
                && bytes[8] == 'W' && bytes[9] == 'E' && bytes[10] == 'B' && bytes[11] == 'P') {
            return "image/webp";
        }
        if (hasPrefix(bytes, (byte) '%', (byte) 'P', (byte) 'D', (byte) 'F')) {
            return "application/pdf";
        }
        if (hasPrefix(bytes, (byte) 'P', (byte) 'K', (byte) 3, (byte) 4)) {
            if ("docx".equals(extension)) {
                return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
            }
            if ("xlsx".equals(extension)) {
                return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            }
            return "";
        }
        if (hasPrefix(bytes, (byte) 0xD0, (byte) 0xCF, (byte) 0x11, (byte) 0xE0, (byte) 0xA1, (byte) 0xB1, (byte) 0x1A, (byte) 0xE1)) {
            if ("doc".equals(extension)) {
                return "application/msword";
            }
            if ("xls".equals(extension)) {
                return "application/vnd.ms-excel";
            }
        }
        return "";
    }

    private boolean hasPrefix(byte[] bytes, byte... prefix) {
        if (bytes.length < prefix.length) {
            return false;
        }
        for (int i = 0; i < prefix.length; i++) {
            if (bytes[i] != prefix[i]) {
                return false;
            }
        }
        return true;
    }

    private String requiredText(String value, String message) {
        String normalized = normalizeBlankToNull(value);
        if (normalized == null) {
            throw new FileValidationException(message);
        }
        return normalized;
    }

    private String normalizeBlankToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isBlank() ? null : trimmed;
    }

    private record CredentialMetadata(
            String title,
            String issuer,
            LocalDate issueDate,
            CredentialValidityType validityType,
            LocalDate expiryDate,
            String credentialNumber
    ) {}
}
