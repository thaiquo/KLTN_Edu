package iuh.fit.contract_service.service;

import iuh.fit.contract_service.api.dto.ContractDocumentViewDto;
import iuh.fit.contract_service.entity.ContractAcceptance;
import iuh.fit.contract_service.entity.ContractAgreement;
import iuh.fit.contract_service.enums.ContractAgreementStatus;
import iuh.fit.contract_service.repository.ContractAcceptanceRepository;
import iuh.fit.contract_service.repository.ContractAgreementRepository;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ContractDocumentQueryServiceTest {

    private final ContractAgreementRepository agreementRepository = mock(ContractAgreementRepository.class);
    private final ContractAcceptanceRepository acceptanceRepository = mock(ContractAcceptanceRepository.class);
    private final ContractDocumentQueryService service = new ContractDocumentQueryService(
            agreementRepository, acceptanceRepository);

    @Test
    void buildsDocumentFromAgreementAndMatchingCurrentAcceptancesOnly() {
        UUID agreementId = UUID.randomUUID();
        OffsetDateTime createdAt = OffsetDateTime.parse("2026-09-01T10:00:00+07:00");
        ContractAgreement agreement = agreement(agreementId, createdAt);
        ContractAcceptance tutor = acceptance(agreementId, 20L, "TUTOR", 1, "0xterms", "0xtutor-signature");
        ContractAcceptance staleStudent = acceptance(agreementId, 10L, "STUDENT", 0, "0xold", "0xold-signature");

        when(agreementRepository.findById(agreementId)).thenReturn(Optional.of(agreement));
        when(acceptanceRepository.findByAgreementId(agreementId)).thenReturn(List.of(tutor, staleStudent));

        ContractDocumentViewDto view = service.findDocumentView(agreementId).orElseThrow();

        assertThat(view.agreementId()).isEqualTo(agreementId.toString());
        assertThat(view.className()).isEqualTo("Toán lớp 2");
        assertThat(view.tutor().fullName()).isEqualTo("Nguyễn Gia Sư");
        assertThat(view.student().fullName()).isEqualTo("Trần Học Viên");
        assertThat(view.financialTerms().totalAmountUsdc()).isEqualTo("12.000000");
        assertThat(view.financialTerms().pricePerSessionUsdc()).isEqualTo("1.000000");
        assertThat(view.financialTerms().pricePerSessionVnd()).isEqualTo("25000.00");
        assertThat(view.tutorSignature().signed()).isTrue();
        assertThat(view.tutorSignature().signature()).isEqualTo("0xtutor-signature");
        assertThat(view.studentSignature().signed()).isFalse();
        assertThat(view.studentSignature().signature()).isNull();
    }

    @Test
    void neverGeneratesMissingHumanReadableValuesOrSignatures() {
        UUID agreementId = UUID.randomUUID();
        ContractAgreement agreement = agreement(agreementId, OffsetDateTime.now());
        agreement.setClassName(null);
        agreement.setTutorName("Gia sư");
        agreement.setStudentName("student@example.com");
        agreement.setTutorPhone(null);
        agreement.setStudentWallet("0x0000000000000000000000000000000000000000");

        when(agreementRepository.findById(agreementId)).thenReturn(Optional.of(agreement));
        when(acceptanceRepository.findByAgreementId(agreementId)).thenReturn(List.of());

        ContractDocumentViewDto view = service.findDocumentView(agreementId).orElseThrow();

        assertThat(view.className()).isNull();
        assertThat(view.tutor().fullName()).isNull();
        assertThat(view.student().fullName()).isNull();
        assertThat(view.tutor().phone()).isNull();
        assertThat(view.student().walletAddress()).isNull();
        assertThat(view.tutorSignature().signed()).isFalse();
        assertThat(view.studentSignature().signed()).isFalse();
    }

    @Test
    void documentContractDoesNotExposeInternalDatabaseIds() {
        assertThat(componentNames(ContractDocumentViewDto.class))
                .doesNotContain("classroomId", "studentId", "tutorId");
        assertThat(componentNames(ContractDocumentViewDto.PartyDto.class))
                .doesNotContain("userId", "id");
        assertThat(componentNames(ContractDocumentViewDto.SignatureProofDto.class))
                .doesNotContain("userId", "id");
    }

    private List<String> componentNames(Class<?> recordType) {
        return Stream.of(recordType.getRecordComponents())
                .map(component -> component.getName())
                .toList();
    }

    private ContractAgreement agreement(UUID id, OffsetDateTime createdAt) {
        return ContractAgreement.builder()
                .id(id)
                .onchainAgreementId("0xonchain")
                .classroomId(30L)
                .className("Toán lớp 2")
                .studentId(10L)
                .studentName("Trần Học Viên")
                .studentEmail("student@example.com")
                .studentPhone("0900000001")
                .studentWallet("0x0000000000000000000000000000000000000010")
                .tutorId(20L)
                .tutorName("Nguyễn Gia Sư")
                .tutorEmail("tutor@example.com")
                .tutorPhone("0900000002")
                .tutorWallet("0x0000000000000000000000000000000000000020")
                .platformWallet("0x0000000000000000000000000000000000000030")
                .chainId(11155111L)
                .escrowContractAddress("0x0000000000000000000000000000000000000040")
                .tokenAddress("0x0000000000000000000000000000000000000050")
                .tokenSymbol("USDC")
                .tokenDecimals((short) 6)
                .termsJson("{\"source\":\"database\"}")
                .termsHash("0xterms")
                .contractVersion(1)
                .totalPriceVnd(new BigDecimal("300000.00"))
                .vndPerUsdc(new BigDecimal("25000.000000"))
                .totalAmountUsdcUnits(new BigInteger("12000000"))
                .pricePerSessionUsdcUnits(new BigInteger("1000000"))
                .totalSessions(12)
                .status(ContractAgreementStatus.PENDING_STUDENT_ACCEPTANCE)
                .createdAt(createdAt)
                .updatedAt(createdAt)
                .version(0L)
                .build();
    }

    private ContractAcceptance acceptance(
            UUID agreementId, Long userId, String role, int version, String termsHash, String signature) {
        return ContractAcceptance.builder()
                .id(UUID.randomUUID())
                .agreementId(agreementId)
                .userId(userId)
                .role(role)
                .walletAddress("0x0000000000000000000000000000000000000001")
                .acceptedAt(OffsetDateTime.now())
                .termsHash(termsHash)
                .signature(signature)
                .contractVersion(version)
                .build();
    }
}
