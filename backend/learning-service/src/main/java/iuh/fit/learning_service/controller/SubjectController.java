package iuh.fit.learning_service.controller;

import iuh.fit.learning_service.dto.SubjectDtos;
import iuh.fit.learning_service.service.SubjectService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/subjects")
public class SubjectController {
    private final SubjectService subjectService;

    public SubjectController(SubjectService subjectService) {
        this.subjectService = subjectService;
    }

    @GetMapping
    public List<SubjectDtos.SubjectResponse> getSubjects(
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) Long groupId,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Integer limit
    ) {
        return subjectService.getSubjects(categoryId, groupId, keyword, limit);
    }

    @GetMapping("/{subjectId}")
    public SubjectDtos.SubjectResponse getSubject(@PathVariable Long subjectId) {
        return subjectService.getActiveSubject(subjectId);
    }

    @GetMapping("/categories")
    public List<SubjectDtos.CategoryResponse> getCategories() {
        return subjectService.getCategories();
    }

    @GetMapping("/groups")
    public List<SubjectDtos.GroupResponse> getGroups(@RequestParam(required = false) Long categoryId) {
        return subjectService.getGroups(categoryId);
    }
}
