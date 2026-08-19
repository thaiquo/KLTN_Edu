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
    public List<ClassRoomDtos.ClassRoomResponse> getPublicClasses(
            @RequestParam(required = false) Long programTypeId,
            @RequestParam(required = false) Long educationLevelId,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) Long subjectId,
            @RequestParam(required = false) Long levelId,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String mode,
            @RequestParam(required = false) String tutorEmail,
            @RequestParam(required = false) Long tutorProfileId,
            @RequestParam(required = false) BigDecimal minPrice,
            @RequestParam(required = false) BigDecimal maxPrice
    ) {
        return service.getPublicClasses(
                programTypeId,
                educationLevelId,
                categoryId,
                subjectId,
                levelId,
                keyword,
                mode,
                tutorEmail,
                tutorProfileId,
                minPrice,
                maxPrice
        );
    }

    @GetMapping("/{id}")
    public ClassRoomDtos.ClassRoomResponse getPublicClassById(@PathVariable Long id) {
        return service.getPublicClassById(id);
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
