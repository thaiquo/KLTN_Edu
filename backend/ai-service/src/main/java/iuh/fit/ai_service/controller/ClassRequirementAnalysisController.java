package iuh.fit.ai_service.controller;

import iuh.fit.ai_service.dto.ClassRequirementAnalysisDtos.AnalyzeClassRequirementRequest;
import iuh.fit.ai_service.dto.ClassRequirementAnalysisDtos.AnalyzeClassRequirementResponse;
import iuh.fit.ai_service.service.ClassNaturalLanguageRequirementAnalyzer;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ai/classes")
public class ClassRequirementAnalysisController {
    private final ClassNaturalLanguageRequirementAnalyzer analyzer;

    public ClassRequirementAnalysisController(ClassNaturalLanguageRequirementAnalyzer analyzer) {
        this.analyzer = analyzer;
    }

    @PostMapping("/analyze")
    public AnalyzeClassRequirementResponse analyze(@Valid @RequestBody AnalyzeClassRequirementRequest request) {
        return analyzer.analyze(request);
    }
}
