package iuh.fit.contract_service.service;

import iuh.fit.contract_service.entity.ContractAcceptance;
import iuh.fit.contract_service.entity.ContractAgreement;
import iuh.fit.contract_service.enums.ContractAgreementStatus;
import iuh.fit.contract_service.repository.ContractAcceptanceRepository;
import iuh.fit.contract_service.repository.ContractAgreementRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.web3j.crypto.Hash;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ContractSignatureServiceTest {

    @Mock
    private ContractAgreementRepository agreementRepository;

    @Mock
    private ContractAcceptanceRepository acceptanceRepository;

    @Mock
    private NotificationDispatcher notificationDispatcher;

    @Mock
    private Eip712VerificationService verificationService;

    @Mock
    private AgreementRegistrationWorkflowService registrationWorkflowService;

    @Test
    void studentSignatureStopsAtPreparingBlockchainAndInitiatesRegistration() {
        UUID agreementId = UUID.randomUUID();
        ContractAgreement agreement = agreement(agreementId);
        ContractAcceptance tutorAcceptance = ContractAcceptance.builder()
                .id(UUID.randomUUID())
                .agreementId(agreementId)
                .userId(2L)
                .role("TUTOR")
                .walletAddress(agreement.getTutorWallet())
                .signature("0x" + "b".repeat(130))
                .acceptedAt(OffsetDateTime.now())
                .termsHash(agreement.getTermsHash())
                .contractVersion(agreement.getContractVersion())
                .build();

        when(agreementRepository.findById(agreementId)).thenReturn(Optional.of(agreement));
        when(verificationService.verifySignature(
                eq(agreement.getStudentWallet()),
                anyString(),
                eq(agreementId.toString()),
                eq(agreement.getTutorWallet()),
                eq(agreement.getStudentWallet()),
                eq(agreement.getTotalAmountUsdcUnits()),
                eq(agreement.getTermsHash()),
                anyLong(),
                eq(31_337L),
                eq(agreement.getEscrowContractAddress()))).thenReturn(true);
        when(acceptanceRepository.findByAgreementId(agreementId)).thenReturn(List.of(tutorAcceptance));
        when(agreementRepository.saveAndFlush(any(ContractAgreement.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ContractAgreement saved = service().signAgreement(
                agreementId,
                1L,
                "student@example.com",
                "STUDENT",
                agreement.getStudentWallet(),
                "0x" + "a".repeat(130),
                null,
                "127.0.0.1",
                "JUnit");

        assertEquals(ContractAgreementStatus.PREPARING_BLOCKCHAIN, saved.getStatus());
        assertNull(saved.getPaymentDeadline());
        verify(registrationWorkflowService).initiateRegistration(agreementId);
        verify(notificationDispatcher, never()).sendAsync(
                any(), any(), any(), any(), eq("AGREEMENT_WAITING_PAYMENT"), any(), any());

        ArgumentCaptor<ContractAcceptance> acceptanceCaptor = ArgumentCaptor.forClass(ContractAcceptance.class);
        verify(acceptanceRepository).save(acceptanceCaptor.capture());
        assertEquals("STUDENT", acceptanceCaptor.getValue().getRole());
    }

    private ContractSignatureService service() {
        return new ContractSignatureService(
                agreementRepository,
                acceptanceRepository,
                notificationDispatcher,
                verificationService,
                registrationWorkflowService);
    }

    private ContractAgreement agreement(UUID id) {
        OffsetDateTime now = OffsetDateTime.now();
        return ContractAgreement.builder()
                .id(id)
                .onchainAgreementId(Hash.sha3String("EDUCONNECT:AGREEMENT:" + id))
                .classroomId(10L)
                .studentId(1L)
                .tutorId(2L)
                .studentEmail("student@example.com")
                .tutorEmail("tutor@example.com")
                .studentWallet("0x0000000000000000000000000000000000000001")
                .tutorWallet("0x0000000000000000000000000000000000000002")
                .platformWallet("0x0000000000000000000000000000000000000003")
                .chainId(31_337L)
                .escrowContractAddress("0x0000000000000000000000000000000000000004")
                .tokenAddress("0x0000000000000000000000000000000000000005")
                .tokenSymbol("USDC")
                .tokenDecimals((short) 6)
                .termsJson("{}")
                .termsHash(Hash.sha3String("terms-v1"))
                .contractVersion(1)
                .totalPriceVnd(new BigDecimal("1000000.00"))
                .vndPerUsdc(new BigDecimal("25000.00"))
                .totalAmountUsdcUnits(BigInteger.valueOf(40_000_000L))
                .pricePerSessionUsdcUnits(BigInteger.valueOf(4_000_000L))
                .totalSessions(10)
                .status(ContractAgreementStatus.PENDING_STUDENT_ACCEPTANCE)
                .version(0L)
                .createdAt(now)
                .updatedAt(now)
                .build();
    }
}
