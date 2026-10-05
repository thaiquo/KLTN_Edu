package iuh.fit.ai_service.service;

import iuh.fit.ai_service.dto.ClassRequirementAnalysisDtos.ClassGeminiRequirementExtraction;

public interface ClassRequirementExtractionClient {
    ClassGeminiRequirementExtraction extractClassRequirement(String message);
}
