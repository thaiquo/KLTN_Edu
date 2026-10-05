package iuh.fit.ai_service.controller;

import iuh.fit.ai_service.dto.ClassRequirementGroundingDtos.GroundClassRequirementRequest;
import iuh.fit.ai_service.dto.ClassRequirementGroundingDtos.GroundClassRequirementResponse;
import iuh.fit.ai_service.service.ClassRequirementGroundingService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ai/classes")
public class ClassRequirementGroundingController {
    private final ClassRequirementGroundingService groundingService;

    public ClassRequirementGroundingController(ClassRequirementGroundingService groundingService) {
        this.groundingService = groundingService;
    }

    @PostMapping("/ground")
    public GroundClassRequirementResponse ground(@Valid @RequestBody GroundClassRequirementRequest request) {
        return groundingService.ground(request);
    }
}
