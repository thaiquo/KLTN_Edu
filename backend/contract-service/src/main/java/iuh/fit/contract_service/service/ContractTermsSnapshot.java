package iuh.fit.contract_service.service;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.math.BigDecimal;
import java.util.List;

/**
 * Immutable legal terms for an agreement snapshot. This object is serialized once,
 * hashed, signed and subsequently used to render the official document.
 */
@JsonPropertyOrder({"schemaVersion", "classroom", "parties", "financial", "platform", "escrowPolicy", "trialPolicy"})
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
public record ContractTermsSnapshot(
        String schemaVersion,
        ClassroomTerms classroom,
        PartiesTerms parties,
        FinancialTerms financial,
        PlatformTerms platform,
        EscrowPolicyTerms escrowPolicy,
        @JsonInclude(JsonInclude.Include.NON_NULL)
        TrialPolicyTerms trialPolicy
) {
    public static final String SCHEMA_VERSION_V2 = "contract-terms-v2";
    public static final String SCHEMA_VERSION_V3 = "contract-terms-v3";
    public static final String SCHEMA_VERSION_V4 = "contract-terms-v4";
    public static final String SCHEMA_VERSION_V5 = "contract-terms-v5";

    public ContractTermsSnapshot(
            String schemaVersion,
            ClassroomTerms classroom,
            PartiesTerms parties,
            FinancialTerms financial,
            PlatformTerms platform,
            EscrowPolicyTerms escrowPolicy) {
        this(schemaVersion, classroom, parties, financial, platform, escrowPolicy, null);
    }
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

    @JsonPropertyOrder({"fullName", "email", "phone", "walletAddress", "dateOfBirth", "address"})
    public record PartyTerms(
            String fullName,
            String email,
            String phone,
            String walletAddress,
            String dateOfBirth,
            String address
    ) {}

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

    @JsonPropertyOrder({"paymentWindowHours", "tutorPayoutBps", "platformFeeBps", "settlementRule", "studentTerminationRule"})
    public record EscrowPolicyTerms(
            Integer paymentWindowHours,
            Integer tutorPayoutBps,
            Integer platformFeeBps,
            String settlementRule,
            @JsonInclude(JsonInclude.Include.NON_NULL)
            String studentTerminationRule
    ) {
        public EscrowPolicyTerms(Integer paymentWindowHours, Integer tutorPayoutBps,
                                 Integer platformFeeBps, String settlementRule) {
            this(paymentWindowHours, tutorPayoutBps, platformFeeBps, settlementRule, null);
        }
    }

    @JsonPropertyOrder({
            "enabled", "version", "trialSessionSequence", "nextSessionSequence",
            "trialSessionStartAt", "nextSessionStartAt", "initialTrialDeadline",
            "scheduleFingerprint", "eligibilityRule", "scheduleChangeRule",
            "fundingRule", "automaticContinuation", "autoApprovedOptOut", "refundRule"
    })
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record TrialPolicyTerms(
            Boolean enabled,
            Integer version,
            Integer trialSessionSequence,
            Integer nextSessionSequence,
            String trialSessionStartAt,
            String nextSessionStartAt,
            String initialTrialDeadline,
            String scheduleFingerprint,
            String eligibilityRule,
            String scheduleChangeRule,
            String fundingRule,
            Boolean automaticContinuation,
            Boolean autoApprovedOptOut,
            String refundRule
    ) {}
}
