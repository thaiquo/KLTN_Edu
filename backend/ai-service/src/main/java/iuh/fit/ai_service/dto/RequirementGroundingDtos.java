package iuh.fit.ai_service.dto;

import iuh.fit.ai_service.dto.RequirementAnalysisDtos.Budget;
import iuh.fit.ai_service.dto.RequirementAnalysisDtos.ExtractedRequirement;
import iuh.fit.ai_service.dto.RequirementAnalysisDtos.PreferredSchedule;
import iuh.fit.ai_service.dto.TutorMatchingDtos.TeachingMode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public final class RequirementGroundingDtos {
    private RequirementGroundingDtos() {
    }

    public enum GroundingStatus {
        GROUNDED,
        NEEDS_CLARIFICATION,
        NOT_FOUND,
        INVALID
    }

    public enum ClarificationField {
        SUBJECT,
        LEVEL,
        TEACHING_MODE,
        SCHEDULE,
        LOCATION,
        BUDGET
    }

    public enum ClarificationReason {
        MISSING,
        AMBIGUOUS,
        NOT_FOUND,
        INVALID_RELATIONSHIP,
        OPTIONAL_REFINEMENT
    }

    public record GroundRequirementRequest(
            @Valid @NotNull(message = "requirement is required")
            ExtractedRequirement requirement
    ) {
    }

    public record GroundRequirementResponse(
            GroundingStatus status,
            boolean coreMatchingReady,
            GroundedRequirement requirement,
            List<Clarification> clarifications
    ) {
    }

    public record GroundedRequirement(
            CatalogItem subject,
            CatalogItem level,
            TeachingMode teachingMode,
            Budget budget,
            List<PreferredSchedule> preferredSchedules,
            String learningGoal,
            List<String> weakTopics,
            List<String> tutorPreferences,
            String locationHint,
            GroundedLocation location
    ) {
    }

    public record GroundedLocation(
            String provinceCode,
            String provinceName,
            String communeCode,
            String communeName,
            String originalHint
    ) {
    }

    public record CatalogItem(
            Long id,
            String code,
            String name,
            CatalogContext context
    ) {
    }

    public record CatalogContext(
            CatalogReference programType,
            CatalogReference educationLevel,
            CatalogReference category
    ) {
    }

    public record CatalogReference(Long id, String code, String name) {
    }

    public record Clarification(
            ClarificationField field,
            ClarificationReason reason,
            boolean blocking,
            String question,
            List<ClarificationOption> options,
            boolean freeTextAllowed
    ) {
    }

    public record ClarificationOption(
            String value,
            Long id,
            String code,
            String name,
            CatalogContext context
    ) {
    }

    public record LearningCatalogSnapshot(List<LearningSubject> subjects) {
    }

    public record LearningSubject(
            Long id,
            String code,
            String name,
            String description,
            LearningCategory category,
            List<LearningLevel> levels
    ) {
    }

    public record LearningCategory(
            Long id,
            String code,
            String name,
            LearningOption programType,
            LearningOption educationLevel
    ) {
    }

    public record LearningOption(Long id, String code, String name, String description) {
    }

    public record LearningLevel(Long id, String code, String name, String type, String description) {
    }

    public record LocationSnapshot(List<LocationProvince> provinces) {
    }

    public record LocationProvince(
            String code,
            String name,
            List<LocationCommune> communes
    ) {
    }

    public record LocationCommune(
            String code,
            String name,
            String provinceCode,
            String provinceName
    ) {
    }
}
