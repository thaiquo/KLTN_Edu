package iuh.fit.learning_service.controller;

import iuh.fit.learning_service.dto.ClassRoomDtos;
import iuh.fit.learning_service.service.ClassRoomService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
@RestController
@RequestMapping("/api/public/classes")
public class PublicClassRoomController {
    private final ClassRoomService service;

    public PublicClassRoomController(ClassRoomService service) {
        this.service = service;
    }

    @GetMapping
    public ClassRoomDtos.PublicClassSearchResponse getPublicClasses(
            @RequestParam(required = false) Long programTypeId,
            @RequestParam(required = false) Long educationLevelId,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) Long subjectId,
            @RequestParam(required = false) Long levelId,
            @RequestParam(required = false) List<Long> levelIds,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String mode,
            @RequestParam(required = false) String teachingMode,
            @RequestParam(required = false) String tutorEmail,
            @RequestParam(required = false) Long tutorProfileId,
            @RequestParam(required = false) BigDecimal minPrice,
            @RequestParam(required = false) BigDecimal maxPrice,
            @RequestParam(required = false) Integer weekday,
            @RequestParam(required = false) List<Integer> weekdays,
            @RequestParam(required = false) String startTime,
            @RequestParam(required = false) String endTime,
            @RequestParam(required = false) Boolean availableOnly,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "12") int size,
            @RequestParam(defaultValue = "newest") String sort
    ) {
        return service.searchPublicClasses(
                programTypeId,
                educationLevelId,
                categoryId,
                subjectId,
                levelId,
                levelIds,
                keyword,
                teachingMode != null && !teachingMode.isBlank() ? teachingMode : mode,
                tutorEmail,
                tutorProfileId,
                minPrice,
                maxPrice,
                weekday,
                weekdays,
                startTime,
                endTime,
                availableOnly,
                page,
                size,
                sort
        );
    }

    @GetMapping("/semantic-source")
    public ClassRoomDtos.PublicClassSemanticSourceResponse getSemanticSource(
            @RequestParam(required = false) List<Long> ids,
            @RequestParam(required = false) Long subjectId,
            @RequestParam(required = false) Long levelId,
            @RequestParam(required = false) String mode,
            @RequestParam(required = false) String teachingMode,
            @RequestParam(required = false) Boolean availableOnly,
            @RequestParam(required = false) Integer max
    ) {
        return service.getPublicClassSemanticSources(
                ids,
                subjectId,
                levelId,
                teachingMode != null && !teachingMode.isBlank() ? teachingMode : mode,
                availableOnly,
                max
        );
    }

    @GetMapping("/{id}")
    public ClassRoomDtos.ClassRoomResponse getPublicClassById(@PathVariable Long id) {
        return service.getPublicClassById(id);
    }

    @GetMapping("/{id}/share")
    public ClassRoomDtos.ClassRoomResponse getShareablePublicClassById(@PathVariable Long id) {
        return service.getShareablePublicClassById(id);
    }

    @PostMapping("/{id}/verify-key")
    public ResponseEntity<ClassRoomDtos.VerifyJoinKeyResponse> verifyJoinKey(
            @PathVariable Long id,
            @Valid @RequestBody ClassRoomDtos.VerifyJoinKeyRequest request
    ) {
        ClassRoomDtos.VerifyJoinKeyResponse response = service.verifyJoinKey(id, request.joinKey());
        return ResponseEntity.ok(response);
    }
}
