package iuh.fit.account_service.service;

import iuh.fit.account_service.config.FilePolicyProperties;
import iuh.fit.account_service.entity.TutorApplication;
import iuh.fit.account_service.entity.TutorDocument;
import iuh.fit.account_service.entity.User;
import iuh.fit.account_service.enums.TutorApplicationStatus;
import iuh.fit.account_service.enums.TutorDocumentType;
import iuh.fit.account_service.enums.CredentialValidityType;
import iuh.fit.account_service.exception.ConflictException;
import iuh.fit.account_service.exception.FileValidationException;
import iuh.fit.account_service.exception.ResourceNotFoundException;
import iuh.fit.account_service.exception.StorageException;
import iuh.fit.account_service.repository.TutorApplicationRepository;
import iuh.fit.account_service.repository.TutorDocumentRepository;
import iuh.fit.account_service.repository.UserRepository;
import iuh.fit.account_service.service.storage.FileStorageService;
import iuh.fit.account_service.service.storage.StoredFile;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.util.unit.DataSize;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class TutorDocumentServiceTest {

    private final TutorApplicationRepository tutorApplicationRepository = mock(TutorApplicationRepository.class);
    private final TutorDocumentRepository tutorDocumentRepository = mock(TutorDocumentRepository.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final FileStorageService fileStorageService = mock(FileStorageService.class);
    private TutorDocumentService service;
    private User user;
    private TutorApplication application;

    @BeforeEach
    void setUp() {
        service = new TutorDocumentService(
                tutorApplicationRepository,
                tutorDocumentRepository,
                userRepository,
                fileStorageService,
                filePolicy()
        );

        user = new User();
        ReflectionTestUtils.setField(user, "id", 7L);
        user.setEmail("test@example.com");

        application = new TutorApplication();
        ReflectionTestUtils.setField(application, "id", 20L);
        application.setUser(user);
        application.setStatus(TutorApplicationStatus.DRAFT);

        when(userRepository.findByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(user));
        when(tutorApplicationRepository.findByUserId(7L)).thenReturn(Optional.of(application));
        when(fileStorageService.store(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.anyString()))
                .thenAnswer(invocation -> new StoredFile(invocation.getArgument(0), invocation.getArgument(2), ((byte[]) invocation.getArgument(1)).length));
    }

    @Test
    void uploadValidIdentityStoresFileAndMetadata() {
        when(tutorDocumentRepository.save(org.mockito.ArgumentMatchers.any(TutorDocument.class)))
                .thenAnswer(invocation -> {
                    TutorDocument document = invocation.getArgument(0);
                    ReflectionTestUtils.setField(document, "id", 99L);
                    return document;
                });

        var response = service.uploadMyDocument(" test@example.com ", TutorDocumentType.IDENTITY_FRONT, png("front.png"));

        assertThat(response.getId()).isEqualTo(99L);
        assertThat(response.getDocumentType()).isEqualTo(TutorDocumentType.IDENTITY_FRONT);
        assertThat(response.getOriginalFilename()).isEqualTo("front.png");
        assertThat(response.getContentType()).isEqualTo("image/png");
        verify(fileStorageService).store(
                org.mockito.ArgumentMatchers.startsWith("tutor-applications/20/documents/"),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.eq("image/png")
        );
    }

    @Test
    void uploadValidIdentityJpegAllowed() {
        when(tutorDocumentRepository.save(org.mockito.ArgumentMatchers.any(TutorDocument.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        var response = service.uploadMyDocument("test@example.com", TutorDocumentType.IDENTITY_BACK, jpg("back.jpg"));

        assertThat(response.getDocumentType()).isEqualTo(TutorDocumentType.IDENTITY_BACK);
        assertThat(response.getContentType()).isEqualTo("image/jpeg");
        verify(fileStorageService).store(
                org.mockito.ArgumentMatchers.startsWith("tutor-applications/20/documents/"),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.eq("image/jpeg")
        );
    }

    @Test
    void uploadValidCertificatePdfAllowed() {
        when(tutorDocumentRepository.save(org.mockito.ArgumentMatchers.any(TutorDocument.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        var response = service.uploadMyDocument(
                "test@example.com",
                TutorDocumentType.CERTIFICATE,
                pdf("cert.pdf"),
                "IELTS",
                "British Council",
                LocalDate.now().minusMonths(1),
                CredentialValidityType.EXPIRES,
                LocalDate.now().plusYears(1),
                "ABC-123"
        );

        assertThat(response.getDocumentType()).isEqualTo(TutorDocumentType.CERTIFICATE);
        assertThat(response.getContentType()).isEqualTo("application/pdf");
        assertThat(response.getTitle()).isEqualTo("IELTS");
        assertThat(response.isExpired()).isFalse();
    }

    @Test
    void certificateExpiresRequiresExpiryDate() {
        assertThatThrownBy(() -> service.uploadMyDocument(
                "test@example.com",
                TutorDocumentType.CERTIFICATE,
                pdf("cert.pdf"),
                "IELTS",
                "British Council",
                LocalDate.now().minusMonths(1),
                CredentialValidityType.EXPIRES,
                null,
                null
        )).isInstanceOf(FileValidationException.class)
                .hasMessage("Credential expiry date is required");
    }

    @Test
    void degreeForcesDoesNotExpireAndClearsExpiryDate() {
        when(tutorDocumentRepository.save(org.mockito.ArgumentMatchers.any(TutorDocument.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        var response = service.uploadMyDocument(
                "test@example.com",
                TutorDocumentType.DEGREE,
                pdf("degree.pdf"),
                "Bachelor",
                "IUH",
                LocalDate.now().minusYears(1),
                CredentialValidityType.EXPIRES,
                LocalDate.now().minusDays(1),
                null
        );

        assertThat(response.getValidityType()).isEqualTo(CredentialValidityType.DOES_NOT_EXPIRE);
        assertThat(response.getExpiryDate()).isNull();
        assertThat(response.isExpired()).isFalse();
    }

    @Test
    void rejectInvalidMimeType() {
        MockMultipartFile file = new MockMultipartFile("file", "bad.txt", "text/plain", "hello".getBytes());

        assertThatThrownBy(() -> service.uploadMyDocument("test@example.com", TutorDocumentType.CERTIFICATE, file))
                .isInstanceOf(FileValidationException.class)
                .hasMessage("File extension is not allowed");
    }

    @Test
    void rejectFakePdfWithInvalidSignature() {
        MockMultipartFile file = new MockMultipartFile("file", "cert.pdf", "application/pdf", "not really a pdf".getBytes());

        assertThatThrownBy(() -> service.uploadMyDocument(
                "test@example.com",
                TutorDocumentType.CERTIFICATE,
                file,
                "IELTS",
                "British Council",
                LocalDate.now().minusMonths(1),
                CredentialValidityType.EXPIRES,
                LocalDate.now().plusYears(1),
                null
        ))
                .isInstanceOf(FileValidationException.class)
                .hasMessage("PDF signature is invalid");
    }

    @Test
    void storageFailureDoesNotPersistMetadata() {
        doThrow(new StorageException("S3 put failed")).when(fileStorageService).store(
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.anyString()
        );

        assertThatThrownBy(() -> service.uploadMyDocument("test@example.com", TutorDocumentType.IDENTITY_FRONT, png("front.png")))
                .isInstanceOf(StorageException.class)
                .hasMessage("S3 put failed");

        verify(tutorDocumentRepository, never()).save(org.mockito.ArgumentMatchers.any(TutorDocument.class));
    }

    @Test
    void rejectOversizedFile() {
        MockMultipartFile file = new MockMultipartFile("file", "front.png", "image/png", new byte[6 * 1024 * 1024]);

        assertThatThrownBy(() -> service.uploadMyDocument("test@example.com", TutorDocumentType.IDENTITY_FRONT, file))
                .isInstanceOf(FileValidationException.class)
                .hasMessage("File is too large");
    }

    @Test
    void pendingApplicationBlocksUpload() {
        application.setStatus(TutorApplicationStatus.PENDING);

        assertThatThrownBy(() -> service.uploadMyDocument("test@example.com", TutorDocumentType.IDENTITY_FRONT, png("front.png")))
                .isInstanceOf(ConflictException.class)
                .hasMessage("Tutor application is not editable in current status");
    }

    @Test
    void maxCertificateCountRejected() {
        when(tutorDocumentRepository.countByTutorApplication_IdAndDocumentType(20L, TutorDocumentType.CERTIFICATE)).thenReturn(10L);

        assertThatThrownBy(() -> service.uploadMyDocument(
                "test@example.com",
                TutorDocumentType.CERTIFICATE,
                pdf("cert.pdf"),
                "IELTS",
                "British Council",
                LocalDate.now().minusMonths(1),
                CredentialValidityType.EXPIRES,
                LocalDate.now().plusYears(1),
                null
        ))
                .isInstanceOf(ConflictException.class)
                .hasMessage("Maximum certificate document count reached");
    }

    @Test
    void listDocumentsUsesCurrentApplication() {
        TutorDocument document = document(1L, TutorDocumentType.PASSPORT, "passport.png");
        when(tutorDocumentRepository.findByTutorApplication_IdOrderByUploadedAtDesc(20L)).thenReturn(List.of(document));

        var response = service.listMyDocuments("test@example.com");

        assertThat(response).hasSize(1);
        assertThat(response.get(0).getDocumentType()).isEqualTo(TutorDocumentType.PASSPORT);
    }

    @Test
    void deleteSuccessDeletesStorageThenMetadata() {
        TutorDocument document = document(1L, TutorDocumentType.PASSPORT, "passport.png");
        when(tutorDocumentRepository.findByIdAndTutorApplication_Id(1L, 20L)).thenReturn(Optional.of(document));

        service.deleteMyDocument("test@example.com", 1L);

        verify(fileStorageService).delete(document.getFileKey());
        verify(tutorDocumentRepository).delete(document);
    }

    @Test
    void ownershipPreventsDeletingOtherApplicationDocument() {
        when(tutorDocumentRepository.findByIdAndTutorApplication_Id(77L, 20L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.deleteMyDocument("test@example.com", 77L))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("Tutor document not found");
    }

    private FilePolicyProperties filePolicy() {
        FilePolicyProperties properties = new FilePolicyProperties();
        properties.getIdentity().setAllowedContentTypes(List.of("image/jpeg", "image/png"));
        properties.getIdentity().setAllowedExtensions(List.of("jpg", "jpeg", "png"));
        properties.getIdentity().setMaxSize(DataSize.ofMegabytes(5));
        properties.getCertificate().setAllowedContentTypes(List.of("image/jpeg", "image/png", "application/pdf"));
        properties.getCertificate().setAllowedExtensions(List.of("jpg", "jpeg", "png", "pdf"));
        properties.getCertificate().setMaxSize(DataSize.ofMegabytes(10));
        properties.setMaxCertificateCount(10);
        return properties;
    }

    private MockMultipartFile png(String name) {
        return new MockMultipartFile("file", name, "image/png", new byte[] {
                (byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n', 1
        });
    }

    private MockMultipartFile jpg(String name) {
        return new MockMultipartFile("file", name, "image/jpeg", new byte[] {
                (byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 1
        });
    }

    private MockMultipartFile pdf(String name) {
        return new MockMultipartFile("file", name, "application/pdf", "%PDF-1.4 test".getBytes());
    }

    private TutorDocument document(Long id, TutorDocumentType type, String filename) {
        TutorDocument document = new TutorDocument();
        ReflectionTestUtils.setField(document, "id", id);
        document.setTutorApplication(application);
        document.setDocumentType(type);
        document.setOriginalFilename(filename);
        document.setContentType("image/png");
        document.setFileKey("tutor-applications/20/documents/test.png");
        document.setFileSize(10L);
        return document;
    }
}
