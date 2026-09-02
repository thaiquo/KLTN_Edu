package iuh.fit.contract_service.api.dto;

import java.time.OffsetDateTime;

/**
 * Immutable read model used to render a contract document. Every value comes
 * from the agreement snapshot or an acceptance linked to that agreement.
 */
public record ContractDocumentViewDto(
        String agreementId,
        String onchainAgreementId,
        String className,
        PartyDto tutor,
        PartyDto student,
        PlatformDto platform,
        FinancialTermsDto financialTerms,
        LearningTermsDto learningTerms,
        EscrowPolicyDto escrowPolicy,
        String termsHash,
        String termsJson,
        Integer contractVersion,
        String status,
        OffsetDateTime createdAt,
        OffsetDateTime paymentDeadline,
        SignatureProofDto tutorSignature,
        SignatureProofDto studentSignature
) {
    public record PartyDto(
            String fullName,
            String email,
            String phone,
            String walletAddress
    ) {}

    public record PlatformDto(
            String walletAddress,
            Long chainId,
            String escrowContractAddress,
            String tokenAddress
    ) {}

    public record FinancialTermsDto(
            String tokenSymbol,
            Short tokenDecimals,
            String totalAmountUsdc,
            String pricePerSessionUsdc,
            String totalPriceVnd,
            String pricePerSessionVnd,
            String vndPerUsdc,
            Integer totalSessions
    ) {}

    public record LearningTermsDto(
            String learningMode,
            String meetingPlatform,
            String meetingLink,
            String learningAddress,
            String courseStartDate,
            String courseEndDate,
            Integer durationPerSessionMinutes,
            java.util.List<ScheduleDto> schedules,
            java.util.List<SyllabusDto> syllabus
    ) {}

    public record ScheduleDto(Integer dayOfWeek, String startTime, String endTime) {}

    public record SyllabusDto(Integer order, String title, String description, Integer expectedSessions) {}

    public record EscrowPolicyDto(
            Integer paymentWindowHours,
            Integer tutorPayoutBps,
            Integer platformFeeBps,
            String settlementRule
    ) {}

    public record SignatureProofDto(
            boolean signed,
            String role,
            String walletAddress,
            String signature,
            OffsetDateTime acceptedAt,
            String termsHash,
            Integer contractVersion
    ) {}
}
