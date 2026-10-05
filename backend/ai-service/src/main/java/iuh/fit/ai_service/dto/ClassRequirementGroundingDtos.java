package iuh.fit.ai_service.dto;

import iuh.fit.ai_service.dto.ClassRequirementAnalysisDtos.ClassExtractedRequirement;
import iuh.fit.ai_service.dto.RequirementAnalysisDtos.Budget;
import iuh.fit.ai_service.dto.RequirementAnalysisDtos.PreferredSchedule;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.CatalogItem;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.Clarification;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.GroundingStatus;
import iuh.fit.ai_service.dto.TutorMatchingDtos.TeachingMode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public final class ClassRequirementGroundingDtos {
    private ClassRequirementGroundingDtos() {
    }

    public record GroundClassRequirementRequest(
            @Valid @NotNull(message = "requirement is required")
            ClassExtractedRequirement requirement
    ) {
    }

    public record GroundClassRequirementResponse(
            GroundingStatus status,
            boolean coreSearchReady,
            GroundedClassRequirement requirement,
            List<Clarification> clarifications
    ) {
    }

    public record GroundedClassRequirement(
            CatalogItem subject,
            CatalogItem level,
            TeachingMode teachingMode,
            Budget budget,
            List<PreferredSchedule> availableSchedules,
            String learningGoal,
            List<String> weakTopics,
            List<String> classPreferences,
            String locationHint
    ) {
    }
}
