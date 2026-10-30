package iuh.fit.learning_service.service;

import iuh.fit.learning_service.enums.CommunityModerationStatus;
import org.springframework.stereotype.Component;
import java.util.List;

@Component
public class CommunityModerationPolicy {
    public enum Recommendation { ALLOW, NEEDS_EDIT, NEEDS_REVIEW, REJECT }
    public enum Risk { LOW, MEDIUM, HIGH }
    public enum Category { SPAM, HARASSMENT, PROFANITY, SEXUAL_INAPPROPRIATE, SCAM_FRAUD, OTHER_UNSAFE }
    public record Result(Recommendation recommendation, Risk riskLevel, List<Category> categories,
                         String reason, String model, String promptVersion, String generatedAt) {}

    public CommunityModerationStatus map(Result result) {
        if (result == null || result.recommendation() == null || result.riskLevel() == null
                || result.categories() == null || result.categories().stream().anyMatch(java.util.Objects::isNull)
                || result.reason() == null || result.reason().isBlank() || result.reason().length() > 500
                || result.promptVersion() == null || result.promptVersion().isBlank()
                || result.promptVersion().length() > 100) return CommunityModerationStatus.FAILED;
        if (result.recommendation() == Recommendation.ALLOW && result.riskLevel() == Risk.LOW
                && result.categories().isEmpty()) return CommunityModerationStatus.ALLOWED;
        if (result.recommendation() == Recommendation.REJECT && result.riskLevel() == Risk.HIGH
                && !result.categories().isEmpty()) return CommunityModerationStatus.REJECTED;
        if (result.recommendation() == Recommendation.NEEDS_EDIT) return CommunityModerationStatus.NEEDS_EDIT;
        return CommunityModerationStatus.NEEDS_REVIEW;
    }
}
