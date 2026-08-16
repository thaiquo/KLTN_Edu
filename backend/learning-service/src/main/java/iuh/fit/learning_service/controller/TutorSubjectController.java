package iuh.fit.learning_service.controller;

import iuh.fit.learning_service.dto.TutorSubjectDtos;
import iuh.fit.learning_service.service.TutorSubjectService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/tutor-subjects")
public class TutorSubjectController {
    private final TutorSubjectService tutorSubjectService;

    public TutorSubjectController(TutorSubjectService tutorSubjectService) {
        this.tutorSubjectService = tutorSubjectService;
    }

    @GetMapping
    public List<TutorSubjectDtos.Response> getTutorSubjects(@RequestParam List<Long> tutorProfileIds) {
        return tutorSubjectService.getActiveByProfileIds(tutorProfileIds);
    }

    @GetMapping("/by-profile/{tutorProfileId}")
    public List<TutorSubjectDtos.Response> getTutorSubjects(@PathVariable Long tutorProfileId) {
        return tutorSubjectService.getActiveByProfileId(tutorProfileId);
    }
}
