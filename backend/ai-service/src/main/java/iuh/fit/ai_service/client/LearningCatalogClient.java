package iuh.fit.ai_service.client;

import iuh.fit.ai_service.dto.RequirementGroundingDtos.LearningCatalogSnapshot;

public interface LearningCatalogClient {
    LearningCatalogSnapshot groundingSnapshot();
}
