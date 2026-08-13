package iuh.fit.account_service.controller;

import iuh.fit.account_service.dto.tutor.SubjectResponse;
import iuh.fit.account_service.dto.tutor.SubjectCategoryResponse;
import iuh.fit.account_service.dto.tutor.SubjectGroupResponse;
import iuh.fit.account_service.service.SubjectService;
import org.springframework.web.bind.annotation.GetMapping;
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
    public List<SubjectResponse> getSubjects(
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) Long groupId,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Integer limit
    ) {
        return subjectService.getSubjects(categoryId, groupId, keyword, limit);
    }

    @GetMapping("/categories")
    public List<SubjectCategoryResponse> getCategories() {
        return subjectService.getCategories();
    }

    @GetMapping("/groups")
    public List<SubjectGroupResponse> getGroups(@RequestParam(required = false) Long categoryId) {
        return subjectService.getGroups(categoryId);
    }
}
