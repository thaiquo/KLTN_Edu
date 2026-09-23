package iuh.fit.learning_service.controller;

import iuh.fit.learning_service.dto.StudentMatchingDtos.StudentMatchingInputRequest;
import iuh.fit.learning_service.dto.StudentMatchingDtos.StudentMatchingInputResponse;
import iuh.fit.learning_service.service.StudentMatchingInputService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/student-matching")
@PreAuthorize("hasRole('STUDENT')")
public class StudentMatchingInputController {
    private final StudentMatchingInputService service;

    public StudentMatchingInputController(StudentMatchingInputService service) {
        this.service = service;
    }

    @PostMapping("/input/validate")
    public StudentMatchingInputResponse validate(@Valid @RequestBody StudentMatchingInputRequest request) {
        return service.validate(request);
    }
}
