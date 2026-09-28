package iuh.fit.ai_service.controller;

import iuh.fit.ai_service.dto.RequirementAnalysisDtos.AnalyzeRequirementRequest;
import iuh.fit.ai_service.dto.RequirementAnalysisDtos.AnalyzeRequirementResponse;
import iuh.fit.ai_service.service.NaturalLanguageRequirementAnalyzer;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ai/matching")
public class RequirementAnalysisController {
    private final NaturalLanguageRequirementAnalyzer analyzer;

    public RequirementAnalysisController(NaturalLanguageRequirementAnalyzer analyzer) {
        this.analyzer = analyzer;
    }

    @PostMapping("/analyze")
    public AnalyzeRequirementResponse analyze(@Valid @RequestBody AnalyzeRequirementRequest request) {
        return analyzer.analyze(request);
    }
}
