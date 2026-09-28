package iuh.fit.ai_service.service;

import iuh.fit.ai_service.dto.RequirementAnalysisDtos.GeminiRequirementExtraction;

public interface RequirementExtractionClient {
    GeminiRequirementExtraction extractRequirement(String message);
}
