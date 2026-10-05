package iuh.fit.ai_service.controller;

import iuh.fit.ai_service.dto.ClassMatchingDtos.ClassMatchingRequest;
import iuh.fit.ai_service.dto.ClassMatchingDtos.ClassMatchingResponse;
import iuh.fit.ai_service.service.ClassMatchingService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ai/classes")
public class ClassMatchingController {
    private final ClassMatchingService classMatchingService;

    public ClassMatchingController(ClassMatchingService classMatchingService) {
        this.classMatchingService = classMatchingService;
    }

    @PostMapping("/match")
    public ClassMatchingResponse match(@Valid @RequestBody ClassMatchingRequest request) {
        return classMatchingService.match(request);
    }
}
