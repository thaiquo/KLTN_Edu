package iuh.fit.learning_service.service;

import iuh.fit.learning_service.dto.ClassroomMaterialDtos.ClassroomMaterialResponse;
import iuh.fit.learning_service.dto.ClassroomMaterialDtos.PresignedDownloadUrlResponse;
import iuh.fit.learning_service.entity.ClassRoom;
import iuh.fit.learning_service.entity.ClassroomMaterial;
import iuh.fit.learning_service.exception.BadRequestException;
import iuh.fit.learning_service.exception.ResourceNotFoundException;
import iuh.fit.learning_service.repository.ClassRoomRepository;
import iuh.fit.learning_service.repository.ClassroomMaterialRepository;
import iuh.fit.learning_service.service.storage.FileStorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ClassroomMaterialService {

    private final ClassroomMaterialRepository classroomMaterialRepository;
    private final ClassRoomRepository classRoomRepository;
    private final SessionAccessControl sessionAccessControl;
    private final FileStorageService fileStorageService;
    private final LearningStorageCleanupService learningStorageCleanupService;

    @Transactional(readOnly = true)
    public List<ClassroomMaterialResponse> getMaterialsByClassRoomId(Long classId) {
        ClassRoom room = classRoomRepository.findById(classId)
                .orElseThrow(() -> new ResourceNotFoundException("Lớp học không tồn tại: " + classId));
        sessionAccessControl.requireCanView(room);

        return classroomMaterialRepository.findByClassRoom_IdOrderByCreatedAtDesc(classId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public PresignedDownloadUrlResponse getMaterialDownloadUrl(Long classId, Long materialId) {
        ClassRoom room = classRoomRepository.findById(classId)
                .orElseThrow(() -> new ResourceNotFoundException("Lớp học không tồn tại: " + classId));
        // Enrolled students and classroom tutor can download course materials anytime WITHOUT check-in
        sessionAccessControl.requireCanView(room);

        ClassroomMaterial material = classroomMaterialRepository.findById(materialId)
                .orElseThrow(() -> new ResourceNotFoundException("Tài liệu không tồn tại: " + materialId));

        if (!Objects.equals(material.getClassRoom().getId(), classId)) {
            throw new BadRequestException("Tài liệu không thuộc về lớp học này");
        }

        String downloadUrl = fileStorageService.createPresignedGetUrl(material.getFileKey());
        return new PresignedDownloadUrlResponse(downloadUrl, material.getFileName(), material.getContentType());
    }

    @Transactional
    public ClassroomMaterialResponse uploadMaterial(
            Long classId,
            String title,
            String description,
            String externalUrl,
            MultipartFile file
    ) {
        ClassRoom room = classRoomRepository.findById(classId)
                .orElseThrow(() -> new ResourceNotFoundException("Lớp học không tồn tại: " + classId));
        sessionAccessControl.requireTutor(room);

        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Bạn bắt buộc phải chọn file tài liệu để tải lên");
        }

        if (!StringUtils.hasText(title)) {
            title = StringUtils.cleanPath(Objects.requireNonNullElse(file.getOriginalFilename(), "Tài liệu môn học"));
        }

        String originalFilename = StringUtils.cleanPath(Objects.requireNonNullElse(file.getOriginalFilename(), "material"));
        String cleanName = originalFilename.replaceAll("[^a-zA-Z0-9.-]", "_");
        String uuid = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        String fileKey = String.format("classes/%d/materials/%s_%s", classId, uuid, cleanName);

        try {
            fileStorageService.store(fileKey, file.getBytes(), file.getContentType());
        } catch (IOException e) {
            throw new BadRequestException("Không thể đọc nội dung file: " + e.getMessage());
        }

        String currentUserEmail = SecurityContextHolder.getContext().getAuthentication().getName();

        ClassroomMaterial material = new ClassroomMaterial();
        material.setClassRoom(room);
        material.setTitle(title.trim());
        material.setDescription(StringUtils.hasText(description) ? description.trim() : null);
        material.setExternalUrl(StringUtils.hasText(externalUrl) ? externalUrl.trim() : null);
        material.setFileName(originalFilename);
        material.setFileKey(fileKey);
        material.setFileSize(file.getSize());
        material.setContentType(file.getContentType());
        material.setUploadedByEmail(currentUserEmail);

        ClassroomMaterial saved = classroomMaterialRepository.save(material);
        return toResponse(saved);
    }

    @Transactional
    public void deleteMaterial(Long classId, Long materialId) {
        ClassRoom room = classRoomRepository.findById(classId)
                .orElseThrow(() -> new ResourceNotFoundException("Lớp học không tồn tại: " + classId));
        sessionAccessControl.requireTutor(room);

        ClassroomMaterial material = classroomMaterialRepository.findById(materialId)
                .orElseThrow(() -> new ResourceNotFoundException("Tài liệu không tồn tại: " + materialId));

        if (!Objects.equals(material.getClassRoom().getId(), classId)) {
            throw new BadRequestException("Tài liệu không thuộc về lớp học này");
        }

        classroomMaterialRepository.delete(material);
        classroomMaterialRepository.flush();
        learningStorageCleanupService.deleteObjectAfterCommit(material.getFileKey());
    }

    private ClassroomMaterialResponse toResponse(ClassroomMaterial m) {
        return new ClassroomMaterialResponse(
                m.getId(),
                m.getClassRoom().getId(),
                m.getTitle(),
                m.getDescription(),
                m.getExternalUrl(),
                m.getFileName(),
                m.getFileSize(),
                m.getContentType(),
                m.getUploadedByEmail(),
                m.getCreatedAt()
        );
    }
}
