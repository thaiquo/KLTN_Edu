package iuh.fit.contract_service.service;

import iuh.fit.contract_service.config.DisputeEvidenceProperties;
import iuh.fit.contract_service.document.ContractArtifactStorage;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class DisputeEvidenceStorageServiceTest {

    @Test
    void storesEvidenceUnderAgreementSessionAndRolePrefix() {
        ContractArtifactStorage storage = mock(ContractArtifactStorage.class);
        DisputeEvidenceStorageService service = new DisputeEvidenceStorageService(
                storage, new DisputeEvidenceProperties(1024));
        UUID agreementId = UUID.randomUUID();
        byte[] bytes = "attendance screenshot".getBytes(StandardCharsets.UTF_8);
        var file = new MockMultipartFile("file", "proof image.png", "image/png", bytes);

        var stored = service.store(agreementId, 7L, "STUDENT", file);

        assertTrue(stored.objectKey().startsWith(
                "disputes/" + agreementId + "/sessions/7/student/"));
        assertTrue(stored.objectKey().endsWith("-proof_image.png"));
        assertEquals("image/png", stored.contentType());
        assertEquals(64, stored.sha256().length());
        verify(storage).put(eq(stored.objectKey()), eq(bytes), eq("image/png"));
    }

    @Test
    void rejectsActiveContentAndOversizedFiles() {
        ContractArtifactStorage storage = mock(ContractArtifactStorage.class);
        DisputeEvidenceStorageService service = new DisputeEvidenceStorageService(
                storage, new DisputeEvidenceProperties(4));

        assertThrows(IllegalArgumentException.class, () -> service.store(
                UUID.randomUUID(), 1L, "TUTOR",
                new MockMultipartFile("file", "attack.html", "text/html", "x".getBytes(StandardCharsets.UTF_8))));
        assertThrows(IllegalArgumentException.class, () -> service.store(
                UUID.randomUUID(), 1L, "TUTOR",
                new MockMultipartFile("file", "large.txt", "text/plain", new byte[5])));
    }
}
