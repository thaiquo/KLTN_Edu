package iuh.fit.contract_service.service;

import com.fasterxml.jackson.annotation.JsonPropertyOrder;

import java.math.BigDecimal;
import java.util.List;

/**
 * Immutable legal terms for a v2 agreement. This object is serialized once,
 * hashed, signed and subsequently used to render the official document.
 */
@JsonPropertyOrder({"schemaVersion", "classroom", "parties", "financial", "platform", "escrowPolicy"})
public record ContractTermsSnapshot(
        String schemaVersion,
        ClassroomTerms classroom,
        PartiesTerms parties,
        FinancialTerms financial,
        PlatformTerms platform,
        EscrowPolicyTerms escrowPolicy
) {
    @JsonPropertyOrder({"name", "description", "learningMode", "meetingPlatform", "meetingLink", "learningAddress", "startDate", "endDate", "durationPerSessionMinutes", "schedules", "syllabus"})
    public record ClassroomTerms(
            String name,
            String description,
            String learningMode,
            String meetingPlatform,
            String meetingLink,
            String learningAddress,
            String startDate,
            String endDate,
            Integer durationPerSessionMinutes,
            List<ScheduleTerms> schedules,
            List<SyllabusTerms> syllabus
    ) {}

    @JsonPropertyOrder({"dayOfWeek", "startTime", "endTime"})
    public record ScheduleTerms(Integer dayOfWeek, String startTime, String endTime) {}

    @JsonPropertyOrder({"order", "title", "description", "expectedSessions"})
    public record SyllabusTerms(Integer order, String title, String description, Integer expectedSessions) {}

    @JsonPropertyOrder({"tutor", "student"})
    public record PartiesTerms(PartyTerms tutor, PartyTerms student) {}

    @JsonPropertyOrder({"fullName", "email", "phone", "walletAddress"})
    public record PartyTerms(String fullName, String email, String phone, String walletAddress) {}

    @JsonPropertyOrder({"pricePerSessionVnd", "totalPriceVnd", "vndPerUsdc", "tokenSymbol", "tokenDecimals", "pricePerSessionUsdcUnits", "totalAmountUsdcUnits", "totalSessions"})
    public record FinancialTerms(
            BigDecimal pricePerSessionVnd,
            BigDecimal totalPriceVnd,
            BigDecimal vndPerUsdc,
            String tokenSymbol,
            Short tokenDecimals,
            String pricePerSessionUsdcUnits,
            String totalAmountUsdcUnits,
            Integer totalSessions
    ) {}

    @JsonPropertyOrder({"chainId", "platformWallet", "escrowContractAddress", "tokenAddress"})
    public record PlatformTerms(Long chainId, String platformWallet, String escrowContractAddress, String tokenAddress) {}

    @JsonPropertyOrder({"paymentWindowHours", "tutorPayoutBps", "platformFeeBps", "settlementRule"})
    public record EscrowPolicyTerms(
            Integer paymentWindowHours,
            Integer tutorPayoutBps,
            Integer platformFeeBps,
            String settlementRule
    ) {}
}
