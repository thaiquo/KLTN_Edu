package iuh.fit.ai_service.controller;

import iuh.fit.ai_service.dto.RequirementGroundingDtos.GroundRequirementRequest;
import iuh.fit.ai_service.dto.RequirementGroundingDtos.GroundRequirementResponse;
import iuh.fit.ai_service.service.CatalogGroundingService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ai/matching")
public class RequirementGroundingController {
    private final CatalogGroundingService groundingService;

    public RequirementGroundingController(CatalogGroundingService groundingService) {
        this.groundingService = groundingService;
    }

    @PostMapping("/ground")
    public GroundRequirementResponse ground(@Valid @RequestBody GroundRequirementRequest request) {
        return groundingService.ground(request);
    }
}
