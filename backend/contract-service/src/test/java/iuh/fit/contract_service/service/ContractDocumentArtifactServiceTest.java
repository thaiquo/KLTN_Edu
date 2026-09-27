package iuh.fit.contract_service.service;

import iuh.fit.contract_service.api.dto.ContractDocumentViewDto;
import iuh.fit.contract_service.config.ContractDocumentProperties;
import iuh.fit.contract_service.document.ContractArtifactStorage;
import iuh.fit.contract_service.document.ContractDocxRenderer;
import iuh.fit.contract_service.document.DocumentConverter;
import iuh.fit.contract_service.entity.ContractDocumentArtifact;
import iuh.fit.contract_service.enums.ContractDocumentArtifactStatus;
import iuh.fit.contract_service.repository.ContractDocumentArtifactRepository;
import iuh.fit.contract_service.repository.EscrowPaymentRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.web3j.crypto.Hash;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ContractDocumentArtifactServiceTest {
    @Mock ContractDocumentQueryService queryService;
    @Mock ContractDocumentArtifactRepository artifactRepository;
    @Mock EscrowPaymentRepository paymentRepository;
    @Mock ContractDocxRenderer renderer;
    @Mock DocumentConverter converter;
    @Mock ContractArtifactStorage storage;

    @Test
    void waitingPaymentCannotBePublishedAsOfficialArtifact() {
        UUID agreementId = UUID.randomUUID();
        when(queryService.findDocumentView(agreementId)).thenReturn(Optional.of(view(agreementId, "WAITING_PAYMENT")));

        assertThatThrownBy(() -> service().finalizeDocument(agreementId))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("sau khi hợp đồng đã kích hoạt");
        verify(renderer, never()).render(anyMap());
    }

    @Test
    void cancelledSignedAgreementCanRecoverItsImmutableArtifact() {
        UUID agreementId = UUID.randomUUID();
        when(queryService.findDocumentView(agreementId)).thenReturn(Optional.of(view(agreementId, "CANCELLED")));
        when(artifactRepository.findByAgreementIdAndContractVersion(agreementId, 1)).thenReturn(Optional.empty());
        when(paymentRepository.findByAgreementId(agreementId)).thenReturn(Optional.empty());
        when(renderer.render(anyMap())).thenReturn(new byte[]{1, 2, 3});
        when(converter.docxToPdf(any(), any())).thenReturn(new byte[]{4, 5, 6});
        when(artifactRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        ContractDocumentArtifact artifact = service().finalizeDocument(agreementId);

        assertThat(artifact.getStatus()).isEqualTo(ContractDocumentArtifactStatus.READY);
        assertThat(artifact.getTemplateVersion()).isEqualTo("EDUCONNECT_HOP_DONG_TEMPLATE_V1_1_20260923");
        ArgumentCaptor<Map<String, Object>> model = ArgumentCaptor.forClass(Map.class);
        verify(renderer).render(model.capture());
        assertThat(model.getValue().get("agreementStatus")).isEqualTo("ĐÃ CHẤM DỨT (CANCELLED)");
        assertThat(model.getValue().get("meetingLink")).isEqualTo("https://meet.example/room");
        assertThat(model.getValue().get("learningAddress")).isEqualTo("Không áp dụng");
        assertThat(model.getValue().get("tutorAddress")).isEqualTo("TP. Hồ Chí Minh");
        assertThat(model.getValue().get("studentDateOfBirth")).isEqualTo("01/01/2005");
        assertThat(model.getValue().get("studentAddress")).isEqualTo("TP. Hồ Chí Minh");
    }

    private ContractDocumentArtifactService service() {
        ContractDocumentProperties properties = new ContractDocumentProperties(
                "classpath:contract-templates/EDUCONNECT_HOP_DONG_TEMPLATE_V1.docx",
                "EDUCONNECT_HOP_DONG_TEMPLATE_V1_1_20260923",
                "http://localhost:3000/forms/libreoffice/convert",
                Duration.ofSeconds(5), Duration.ofSeconds(60),
                10_485_760L, 20_971_520L,
                "http://localhost:5173/contracts/verify",
                "EduConnect", "Hệ thống EduConnect", "ngocquocthai.004@gmail.com");
        return new ContractDocumentArtifactService(queryService, artifactRepository, paymentRepository,
                renderer, converter, storage, properties);
    }

    private ContractDocumentViewDto view(UUID agreementId, String status) {
        String termsJson = "{}";
        var tutor = new ContractDocumentViewDto.PartyDto(
                "Gia sư", "tutor@example.com", "0900000001", "0x1111111111111111111111111111111111111111",
                null, "TP. Hồ Chí Minh");
        var student = new ContractDocumentViewDto.PartyDto(
                "Học viên", "student@example.com", "0900000002", "0x2222222222222222222222222222222222222222",
                "2005-01-01", "TP. Hồ Chí Minh");
        var tutorSignature = new ContractDocumentViewDto.SignatureProofDto(
                true, "TUTOR", tutor.walletAddress(), "0xtutorsignature", OffsetDateTime.now(), Hash.sha3String(termsJson), 1);
        var studentSignature = new ContractDocumentViewDto.SignatureProofDto(
                true, "STUDENT", student.walletAddress(), "0xstudentsignature", OffsetDateTime.now(), Hash.sha3String(termsJson), 1);
        return new ContractDocumentViewDto(
                agreementId.toString(), "0xagreement", "Toán 12", tutor, student,
                new ContractDocumentViewDto.PlatformDto(
                        "0x3333333333333333333333333333333333333333", 11155111L,
                        "0x4444444444444444444444444444444444444444",
                        "0x5555555555555555555555555555555555555555"),
                new ContractDocumentViewDto.FinancialTermsDto(
                        "USDC", (short) 6, "10", "1", "250000", "25000", "25000", 10),
                new ContractDocumentViewDto.LearningTermsDto(
                        "ONLINE", "Google Meet", "https://meet.example/room", null,
                        "2026-09-01", "2026-10-01", 60,
                        List.of(new ContractDocumentViewDto.ScheduleDto(2, "18:00", "19:00")), List.of()),
                new ContractDocumentViewDto.EscrowPolicyDto(24, 8500, 1500, "settlement policy"),
                Hash.sha3String(termsJson), termsJson, 1, status, OffsetDateTime.now(), OffsetDateTime.now(),
                tutorSignature, studentSignature);
    }
}
