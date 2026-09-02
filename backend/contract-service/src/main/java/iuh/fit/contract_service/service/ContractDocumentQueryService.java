package iuh.fit.contract_service.service;

import iuh.fit.contract_service.api.dto.ContractDocumentViewDto;
import iuh.fit.contract_service.entity.ContractAcceptance;
import iuh.fit.contract_service.entity.ContractAgreement;
import iuh.fit.contract_service.repository.ContractAcceptanceRepository;
import iuh.fit.contract_service.repository.ContractAgreementRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

@Service
public class ContractDocumentQueryService {

    private final ContractAgreementRepository agreementRepository;
    private final ContractAcceptanceRepository acceptanceRepository;

    public ContractDocumentQueryService(
            ContractAgreementRepository agreementRepository,
            ContractAcceptanceRepository acceptanceRepository) {
        this.agreementRepository = agreementRepository;
        this.acceptanceRepository = acceptanceRepository;
    }

    @Transactional(readOnly = true)
    public Optional<ContractDocumentViewDto> findDocumentView(UUID agreementId) {
        return agreementRepository.findById(agreementId).map(this::toDocumentView);
    }

    private ContractDocumentViewDto toDocumentView(ContractAgreement agreement) {
        List<ContractAcceptance> currentAcceptances = acceptanceRepository.findByAgreementId(agreement.getId())
                .stream()
                .filter(acceptance -> agreement.getContractVersion() == null || acceptance.getContractVersion() == null || agreement.getContractVersion().equals(acceptance.getContractVersion()))
                .filter(acceptance -> acceptance.getTermsHash() == null || agreement.getTermsHash() == null || agreement.getTermsHash().equalsIgnoreCase(acceptance.getTermsHash()))
                .sorted(Comparator.comparing(ContractAcceptance::getAcceptedAt).reversed())
                .toList();

        ContractAcceptance tutorAcceptance = findAcceptance(
                currentAcceptances, "TUTOR").orElse(null);
        ContractAcceptance studentAcceptance = findAcceptance(
                currentAcceptances, "STUDENT").orElse(null);

        int decimals = agreement.getTokenDecimals();
        BigDecimal totalAmountUsdc = new BigDecimal(agreement.getTotalAmountUsdcUnits())
                .movePointLeft(decimals);
        BigDecimal pricePerSessionUsdc = new BigDecimal(agreement.getPricePerSessionUsdcUnits())
                .movePointLeft(decimals);
        BigDecimal pricePerSessionVnd = agreement.getTotalSessions() > 0
                ? agreement.getTotalPriceVnd().divide(
                        BigDecimal.valueOf(agreement.getTotalSessions()), 2, RoundingMode.HALF_UP)
                : null;

        return new ContractDocumentViewDto(
                agreement.getId().toString(),
                agreement.getOnchainAgreementId(),
                generatedLabelOrNull(agreement.getClassName(), "Lớp học"),
                new ContractDocumentViewDto.PartyDto(
                        generatedLabelOrNull(agreement.getTutorName(), "Gia sư"),
                        nullIfBlank(agreement.getTutorEmail()),
                        nullIfBlank(agreement.getTutorPhone()),
                        walletOrNull(agreement.getTutorWallet())),
                new ContractDocumentViewDto.PartyDto(
                        generatedLabelOrNull(agreement.getStudentName(), "Học viên"),
                        nullIfBlank(agreement.getStudentEmail()),
                        nullIfBlank(agreement.getStudentPhone()),
                        walletOrNull(agreement.getStudentWallet())),
                new ContractDocumentViewDto.PlatformDto(
                        nullIfBlank(agreement.getPlatformWallet()),
                        agreement.getChainId(),
                        nullIfBlank(agreement.getEscrowContractAddress()),
                        nullIfBlank(agreement.getTokenAddress())),
                new ContractDocumentViewDto.FinancialTermsDto(
                        agreement.getTokenSymbol(),
                        agreement.getTokenDecimals(),
                        totalAmountUsdc.toPlainString(),
                        pricePerSessionUsdc.toPlainString(),
                        agreement.getTotalPriceVnd().toPlainString(),
                        pricePerSessionVnd != null ? pricePerSessionVnd.toPlainString() : null,
                        agreement.getVndPerUsdc().toPlainString(),
                        agreement.getTotalSessions()),
                agreement.getTermsHash(),
                agreement.getTermsJson(),
                agreement.getContractVersion(),
                agreement.getStatus().name(),
                agreement.getCreatedAt(),
                agreement.getPaymentDeadline(),
                toSignatureProof(tutorAcceptance, "TUTOR"),
                toSignatureProof(studentAcceptance, "STUDENT"));
    }

    private Optional<ContractAcceptance> findAcceptance(
            List<ContractAcceptance> acceptances, String role) {
        return acceptances.stream()
                .filter(acceptance -> role.equalsIgnoreCase(acceptance.getRole()))
                .findFirst();
    }

    private ContractDocumentViewDto.SignatureProofDto toSignatureProof(
            ContractAcceptance acceptance, String role) {
        if (acceptance == null) {
            return new ContractDocumentViewDto.SignatureProofDto(
                    false, role, null, null, null, null, null);
        }
        return new ContractDocumentViewDto.SignatureProofDto(
                true,
                acceptance.getRole(),
                nullIfBlank(acceptance.getWalletAddress()),
                nullIfBlank(acceptance.getSignature()),
                acceptance.getAcceptedAt(),
                acceptance.getTermsHash(),
                acceptance.getContractVersion());
    }

    private String generatedLabelOrNull(String value, String generatedPrefix) {
        String normalized = nullIfBlank(value);
        String lowerPrefix = generatedPrefix.toLowerCase(Locale.ROOT);
        if (normalized == null || normalized.contains("@") || normalized.equalsIgnoreCase(generatedPrefix)
                || normalized.toLowerCase(Locale.ROOT).startsWith(lowerPrefix + " #")) {
            return null;
        }
        return normalized;
    }

    private String walletOrNull(String value) {
        String normalized = nullIfBlank(value);
        return "0x0000000000000000000000000000000000000000".equalsIgnoreCase(normalized)
                ? null
                : normalized;
    }

    private String nullIfBlank(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
