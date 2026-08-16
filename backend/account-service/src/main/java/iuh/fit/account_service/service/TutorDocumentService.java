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
import java.util.Set;
import java.util.UUID;

@Service
public class TutorDocumentService {

    private static final Set<TutorDocumentType> IDENTITY_TYPES = Set.of(
            TutorDocumentType.IDENTITY_FRONT,
            TutorDocumentType.IDENTITY_BACK,
            TutorDocumentType.PASSPORT
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
        validateCertificateCount(application, documentType);
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
        String contentType = normalizeContentType(file.getContentType());

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

    private void validateCertificateCount(TutorApplication application, TutorDocumentType documentType) {
        if (!isCertificateType(documentType)) {
            return;
        }
        long count = tutorDocumentRepository.countByTutorApplication_IdAndDocumentType(application.getId(), TutorDocumentType.CERTIFICATE)
                + tutorDocumentRepository.countByTutorApplication_IdAndDocumentType(application.getId(), TutorDocumentType.DEGREE);
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
        if (!isCertificateType(documentType)) {
            return new CredentialMetadata(null, null, null, null, null, null);
        }

        String normalizedTitle = requiredText(title, "Credential title is required");
        String normalizedIssuer = requiredText(issuer, "Credential issuer is required");
        if (issueDate == null) {
            throw new FileValidationException("Credential issue date is required");
        }
        if (issueDate.isAfter(LocalDate.now())) {
            throw new FileValidationException("Credential issue date cannot be in the future");
        }

        CredentialValidityType nextValidityType = documentType == TutorDocumentType.DEGREE
                ? CredentialValidityType.DOES_NOT_EXPIRE
                : validityType;
        if (nextValidityType == null) {
            throw new FileValidationException("Credential validity type is required");
        }

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
        String contentType = normalizeContentType(file.getContentType());

        if (!rule.getAllowedExtensions().contains(extension)) {
            throw new FileValidationException("File extension is not allowed");
        }
        if (!rule.getAllowedContentTypes().contains(contentType)) {
            throw new FileValidationException("File type is not allowed");
        }
        if (file.getSize() > rule.getMaxSize().toBytes()) {
            throw new FileValidationException("File is too large");
        }
        validateMagicBytes(contentType, readBytes(file));
    }

    private void validateMagicBytes(String contentType, byte[] bytes) {
        if ("application/pdf".equals(contentType)) {
            if (bytes.length < 4 || bytes[0] != '%' || bytes[1] != 'P' || bytes[2] != 'D' || bytes[3] != 'F') {
                throw new FileValidationException("PDF signature is invalid");
            }
            return;
        }
        if ("image/png".equals(contentType)) {
            if (bytes.length < 8 || bytes[0] != (byte) 0x89 || bytes[1] != 'P' || bytes[2] != 'N' || bytes[3] != 'G') {
                throw new FileValidationException("PNG signature is invalid");
            }
            return;
        }
        if ("image/jpeg".equals(contentType)) {
            if (bytes.length < 3 || bytes[0] != (byte) 0xFF || bytes[1] != (byte) 0xD8 || bytes[2] != (byte) 0xFF) {
                throw new FileValidationException("JPEG signature is invalid");
            }
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

    private boolean isCertificateType(TutorDocumentType documentType) {
        return documentType == TutorDocumentType.CERTIFICATE || documentType == TutorDocumentType.DEGREE;
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
