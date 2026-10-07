package iuh.fit.learning_service.controller;

import iuh.fit.learning_service.dto.ClassroomMaterialDtos.ClassroomMaterialResponse;
import iuh.fit.learning_service.dto.ClassroomMaterialDtos.PresignedDownloadUrlResponse;
import iuh.fit.learning_service.service.ClassroomMaterialService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/classes/{classId}/materials")
@PreAuthorize("isAuthenticated()")
@RequiredArgsConstructor
public class ClassroomMaterialController {

    private final ClassroomMaterialService classroomMaterialService;

    /**
     * Lấy danh sách tài liệu môn học của lớp.
     * Học viên trong lớp hoặc Gia sư vào xem bất kỳ lúc nào mà không cần điểm danh.
     */
    @GetMapping
    public ResponseEntity<List<ClassroomMaterialResponse>> getMaterials(@PathVariable Long classId) {
        List<ClassroomMaterialResponse> materials = classroomMaterialService.getMaterialsByClassRoomId(classId);
        return ResponseEntity.ok(materials);
    }

    /**
     * Lấy Presigned URL để tải tài liệu môn học về máy.
     * Học viên trong lớp được tải trực tiếp mà không cần điểm danh buổi học nào.
     */
    @GetMapping("/{materialId}/download-url")
    public ResponseEntity<PresignedDownloadUrlResponse> getMaterialDownloadUrl(
            @PathVariable Long classId,
            @PathVariable Long materialId
    ) {
        PresignedDownloadUrlResponse response = classroomMaterialService.getMaterialDownloadUrl(classId, materialId);
        return ResponseEntity.ok(response);
    }

    /**
     * Gia sư tải lên tài liệu môn học mới (lưu file trực tiếp lên S3).
     */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ClassroomMaterialResponse> uploadMaterial(
            @PathVariable Long classId,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "title", required = false) String title,
            @RequestParam(value = "description", required = false) String description,
            @RequestParam(value = "externalUrl", required = false) String externalUrl
    ) {
        ClassroomMaterialResponse response = classroomMaterialService.uploadMaterial(
                classId, title, description, externalUrl, file
        );
        return ResponseEntity.ok(response);
    }

    /**
     * Gia sư xóa tài liệu môn học (đồng thời xóa file trên S3).
     */
    @DeleteMapping("/{materialId}")
    public ResponseEntity<Void> deleteMaterial(
            @PathVariable Long classId,
            @PathVariable Long materialId
    ) {
        classroomMaterialService.deleteMaterial(classId, materialId);
        return ResponseEntity.noContent().build();
    }
}
