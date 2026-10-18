package iuh.fit.ai_service.controller;

import iuh.fit.ai_service.dto.LearningCopilotDtos.LessonDraftRequest;
import iuh.fit.ai_service.dto.LearningCopilotDtos.LessonDraftResponse;
import iuh.fit.ai_service.dto.LearningCopilotDtos.HomeworkFeedbackDraftRequest;
import iuh.fit.ai_service.dto.LearningCopilotDtos.HomeworkFeedbackDraftResponse;
import iuh.fit.ai_service.service.HomeworkFeedbackDraftService;
import iuh.fit.ai_service.service.LessonPlanDraftService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ai/learning-copilot")
public class LearningCopilotController {
    private final LessonPlanDraftService lessonPlanDraftService;
    private final HomeworkFeedbackDraftService homeworkFeedbackDraftService;

    public LearningCopilotController(
            LessonPlanDraftService lessonPlanDraftService,
            HomeworkFeedbackDraftService homeworkFeedbackDraftService
    ) {
        this.lessonPlanDraftService = lessonPlanDraftService;
        this.homeworkFeedbackDraftService = homeworkFeedbackDraftService;
    }

    @PostMapping("/lesson-draft")
    public LessonDraftResponse lessonDraft(@Valid @RequestBody LessonDraftRequest request) {
        return lessonPlanDraftService.generate(request);
    }

    @PostMapping("/homework-feedback-draft")
    public HomeworkFeedbackDraftResponse homeworkFeedbackDraft(
            @Valid @RequestBody HomeworkFeedbackDraftRequest request
    ) {
        return homeworkFeedbackDraftService.generate(request);
    }
}
