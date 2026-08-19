package iuh.fit.learning_service.controller;

import iuh.fit.learning_service.dto.ClassRoomDtos;
import iuh.fit.learning_service.enums.ClassRoomStatus;
import iuh.fit.learning_service.service.ClassRoomService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/tutor/classes")
@PreAuthorize("hasRole('TUTOR')")
public class TutorClassRoomController {
    private final ClassRoomService service;

    public TutorClassRoomController(ClassRoomService service) {
        this.service = service;
    }

    @GetMapping
    public List<ClassRoomDtos.ClassRoomResponse> getMyClasses(
            Authentication authentication,
            @RequestParam(required = false) ClassRoomStatus status
    ) {
        return service.getMyClasses(authentication.getName(), status);
    }

    @GetMapping("/stats")
    public ClassRoomDtos.ClassRoomStatsResponse getMyClassStats(Authentication authentication) {
        return service.getMyClassStats(authentication.getName());
    }

    @GetMapping("/{id}")
    public ClassRoomDtos.ClassRoomResponse getClassById(
            Authentication authentication,
            @PathVariable Long id
    ) {
        return service.getClassById(authentication.getName(), id);
    }

    @PostMapping
    public ResponseEntity<ClassRoomDtos.ClassRoomResponse> createClass(
            Authentication authentication,
            @Valid @RequestBody ClassRoomDtos.CreateClassRoomRequest request
    ) {
        ClassRoomDtos.ClassRoomResponse response = service.createClass(authentication.getName(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PutMapping("/{id}/details")
    public ResponseEntity<ClassRoomDtos.ClassRoomResponse> updateClassDetails(
            Authentication authentication,
            @PathVariable Long id,
            @Valid @RequestBody ClassRoomDtos.UpdateClassDetailsRequest request
    ) {
        ClassRoomDtos.ClassRoomResponse response = service.updateClassDetails(authentication.getName(), id, request);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/{id}/visibility")
    public ResponseEntity<ClassRoomDtos.ClassRoomResponse> updateVisibility(
            Authentication authentication,
            @PathVariable Long id,
            @Valid @RequestBody ClassRoomDtos.UpdateVisibilityRequest request
    ) {
        ClassRoomDtos.ClassRoomResponse response = service.updateVisibility(authentication.getName(), id, request);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteClass(
            Authentication authentication,
            @PathVariable Long id
    ) {
        service.deleteClass(authentication.getName(), id);
        return ResponseEntity.noContent().build();
    }
}
