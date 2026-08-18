package iuh.fit.learning_service.controller;

import iuh.fit.learning_service.dto.TeachingCatalogDtos;
import iuh.fit.learning_service.service.TeachingCatalogService;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/teaching-catalog")
public class TeachingCatalogController {
    private final TeachingCatalogService service;

    public TeachingCatalogController(TeachingCatalogService service) { this.service = service; }

    @GetMapping("/program-types")
    public List<TeachingCatalogDtos.Option> programTypes() { return service.programTypes(); }

    @GetMapping("/education-levels")
    public List<TeachingCatalogDtos.Option> educationLevels() { return service.educationLevels(); }

    @GetMapping("/categories")
    public List<TeachingCatalogDtos.CategoryOption> categories(@RequestParam Long programTypeId,
                                                               @RequestParam(required = false) Long educationLevelId) {
        return service.categories(programTypeId, educationLevelId);
    }

    @GetMapping("/subjects")
    public List<TeachingCatalogDtos.SubjectOption> subjects(@RequestParam Long categoryId) { return service.subjects(categoryId); }

    @GetMapping("/levels")
    public List<TeachingCatalogDtos.LevelOption> levels(@RequestParam Long subjectId) { return service.levels(subjectId); }
}
