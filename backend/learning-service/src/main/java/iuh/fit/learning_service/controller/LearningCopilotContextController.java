package iuh.fit.learning_service.controller;

import iuh.fit.learning_service.dto.LearningCopilotDtos.LessonContextResponse;
import iuh.fit.learning_service.dto.LearningCopilotDtos.HomeworkFeedbackContextResponse;
import iuh.fit.learning_service.service.LearningCopilotContextService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/internal/ai")
@RequiredArgsConstructor
public class LearningCopilotContextController {
    private final LearningCopilotContextService contextService;

    @GetMapping("/classes/{classId}/sessions/{sessionId}/lesson-context")
    @PreAuthorize("hasRole('TUTOR')")
    public LessonContextResponse lessonContext(
            @PathVariable Long classId,
            @PathVariable Long sessionId
    ) {
        return contextService.lessonContext(classId, sessionId);
    }

    @GetMapping("/classes/{classId}/sessions/{sessionId}/attendances/{attendanceId}/homework-feedback-context")
    @PreAuthorize("hasRole('TUTOR')")
    public HomeworkFeedbackContextResponse homeworkFeedbackContext(
            @PathVariable Long classId,
            @PathVariable Long sessionId,
            @PathVariable Long attendanceId
    ) {
        return contextService.homeworkFeedbackContext(classId, sessionId, attendanceId);
    }
}
