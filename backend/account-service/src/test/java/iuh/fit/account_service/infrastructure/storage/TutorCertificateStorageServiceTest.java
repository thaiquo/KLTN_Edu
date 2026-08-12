package iuh.fit.account_service.infrastructure.storage;

import iuh.fit.account_service.shared.exception.BusinessException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;

import java.io.ByteArrayOutputStream;
import java.nio.file.Path;
import java.util.UUID;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TutorCertificateStorageServiceTest {

    @TempDir
    Path storageRoot;

    @Test
    void store_shouldCreateOwnedCertificateKeyAndPersistContent() {
        StorageProperties properties = new StorageProperties();
        properties.getLocal().setRoot(storageRoot.toString());
        TutorCertificateStorageService service = new TutorCertificateStorageService(new LocalObjectStorage(properties));
        UUID userId = UUID.randomUUID();
        byte[] content = "%PDF-1.4 test".getBytes();

        StoredObject stored = service.store(userId,
            new MockMultipartFile("file", "my certificate.pdf", "application/pdf", content));

        assertThat(stored.key()).startsWith("tutor-applications/" + userId + "/certificates/");
        assertThat(stored.url()).startsWith("file:");
        assertThat(service.belongsTo(userId, stored.key())).isTrue();
        assertThat(service.read(stored.key()).bytes()).isEqualTo(content);
    }

    @Test
    void store_shouldRejectContentWhoseSignatureDoesNotMatchMimeType() {
        StorageProperties properties = new StorageProperties();
        properties.getLocal().setRoot(storageRoot.toString());
        TutorCertificateStorageService service = new TutorCertificateStorageService(new LocalObjectStorage(properties));

        assertThatThrownBy(() -> service.store(UUID.randomUUID(),
            new MockMultipartFile("file", "fake.pdf", "application/pdf", "not-a-pdf".getBytes())))
            .isInstanceOf(BusinessException.class)
            .hasMessage("File content does not match its declared type");
    }

    @Test
    void store_shouldAcceptModernWordAndExcelDocuments() throws Exception {
        StorageProperties properties = new StorageProperties();
        properties.getLocal().setRoot(storageRoot.toString());
        TutorCertificateStorageService service = new TutorCertificateStorageService(new LocalObjectStorage(properties));
        UUID userId = UUID.randomUUID();

        StoredObject word = service.store(userId, new MockMultipartFile(
            "file", "certificate.docx",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            officeFile("word/document.xml")));
        StoredObject excel = service.store(userId, new MockMultipartFile(
            "file", "scores.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            officeFile("xl/workbook.xml")));

        assertThat(word.originalFileName()).isEqualTo("certificate.docx");
        assertThat(excel.originalFileName()).isEqualTo("scores.xlsx");
    }

    private byte[] officeFile(String entryName) throws Exception {
        ByteArrayOutputStream result = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(result)) {
            zip.putNextEntry(new ZipEntry(entryName));
            zip.write("<document/>".getBytes());
            zip.closeEntry();
        }
        return result.toByteArray();
    }
}
