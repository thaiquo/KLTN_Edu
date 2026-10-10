package iuh.fit.learning_service.service;

import iuh.fit.learning_service.config.security.LearningUserPrincipal;
import iuh.fit.learning_service.dto.TutorFollowDtos.*;
import iuh.fit.learning_service.entity.TutorAuthorizationState;
import iuh.fit.learning_service.entity.TutorFollow;
import iuh.fit.learning_service.exception.BadRequestException;
import iuh.fit.learning_service.exception.ForbiddenException;
import iuh.fit.learning_service.exception.ResourceNotFoundException;
import iuh.fit.learning_service.repository.TutorAuthorizationStateRepository;
import iuh.fit.learning_service.repository.TutorFollowRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.List;
import java.util.Locale;

@Service
@Transactional
public class TutorFollowService {

    private final TutorFollowRepository tutorFollowRepository;
    private final TutorAuthorizationStateRepository tutorAuthorizationStateRepository;

    public TutorFollowService(
            TutorFollowRepository tutorFollowRepository,
            TutorAuthorizationStateRepository tutorAuthorizationStateRepository
    ) {
        this.tutorFollowRepository = tutorFollowRepository;
        this.tutorAuthorizationStateRepository = tutorAuthorizationStateRepository;
    }

    public FollowStatusResponse followTutor(Long tutorUserId, LearningUserPrincipal principal) {
        if (principal == null || principal.userId() == null) {
            throw new ForbiddenException("Vui lòng đăng nhập để thực hiện theo dõi");
        }
        String role = principal.activeRole() == null ? "" : principal.activeRole().trim().toUpperCase(Locale.ROOT);
        if (!"STUDENT".equals(role)) {
            throw new ForbiddenException("Chỉ học viên mới có quyền theo dõi gia sư");
        }
        if (tutorUserId == null) {
            throw new BadRequestException("Tutor User ID không được để trống");
        }
        if (principal.userId().equals(tutorUserId)) {
            throw new BadRequestException("Bạn không thể tự theo dõi chính mình");
        }

        validateTutorTarget(tutorUserId);

        tutorFollowRepository.insertIfAbsent(principal.userId(), tutorUserId);

        long followerCount = tutorFollowRepository.countByTutorUserId(tutorUserId);
        return FollowStatusResponse.builder()
                .isFollowed(true)
                .followerCount(followerCount)
                .build();
    }

    public FollowStatusResponse unfollowTutor(Long tutorUserId, LearningUserPrincipal principal) {
        if (principal == null || principal.userId() == null) {
            throw new ForbiddenException("Vui lòng đăng nhập để hủy theo dõi");
        }
        String role = principal.activeRole() == null ? "" : principal.activeRole().trim().toUpperCase(Locale.ROOT);
        if (!"STUDENT".equals(role)) {
            throw new ForbiddenException("Chỉ học viên mới có quyền hủy theo dõi gia sư");
        }
        if (tutorUserId == null) {
            throw new BadRequestException("Tutor User ID không được để trống");
        }

        tutorFollowRepository.deleteByStudentUserIdAndTutorUserId(principal.userId(), tutorUserId);
        long followerCount = tutorFollowRepository.countByTutorUserId(tutorUserId);
        return FollowStatusResponse.builder()
                .isFollowed(false)
                .followerCount(followerCount)
                .build();
    }

    @Transactional(readOnly = true)
    public FollowStatusResponse getFollowStatus(Long tutorUserId, Long currentUserId) {
        if (tutorUserId == null) {
            throw new BadRequestException("Tutor User ID không được để trống");
        }
        long followerCount = tutorFollowRepository.countByTutorUserId(tutorUserId);
        boolean isFollowed = false;
        if (currentUserId != null) {
            isFollowed = tutorFollowRepository.existsByStudentUserIdAndTutorUserId(currentUserId, tutorUserId);
        }
        return FollowStatusResponse.builder()
                .isFollowed(isFollowed)
                .followerCount(followerCount)
                .build();
    }

    @Transactional(readOnly = true)
    public List<FollowingTutorSummaryDto> getFollowingTutors(LearningUserPrincipal principal) {
        if (principal == null || principal.userId() == null) {
            throw new ForbiddenException("Vui lòng đăng nhập để xem danh sách gia sư đang theo dõi");
        }
        String role = principal.activeRole() == null ? "" : principal.activeRole().trim().toUpperCase(Locale.ROOT);
        if (!"STUDENT".equals(role)) {
            throw new ForbiddenException("Chỉ học viên mới có danh sách gia sư theo dõi");
        }
        List<TutorFollow> follows = tutorFollowRepository.findByStudentUserIdOrderByCreatedAtDesc(principal.userId());
        return follows.stream()
                .map(f -> FollowingTutorSummaryDto.builder()
                        .tutorUserId(f.getTutorUserId())
                        .followedAt(f.getCreatedAt())
                        .build())
                .toList();
    }

    @Transactional(readOnly = true)
    public Page<FollowerSummaryDto> getFollowers(Long tutorUserId, Pageable pageable, LearningUserPrincipal principal) {
        if (tutorUserId == null) {
            throw new BadRequestException("Tutor User ID không được để trống");
        }
        if (principal == null || principal.userId() == null) {
            throw new ForbiddenException("Vui lòng đăng nhập để xem danh sách người theo dõi");
        }
        String role = principal.activeRole() == null ? "" : principal.activeRole().trim().toUpperCase(Locale.ROOT);
        boolean isOwner = principal.userId().equals(tutorUserId) && "TUTOR".equals(role);
        boolean isStaffOrAdmin = "STAFF".equals(role) || "ADMIN".equals(role);
        if (!isOwner && !isStaffOrAdmin) {
            throw new ForbiddenException("Bạn không có quyền xem danh sách người theo dõi của gia sư này");
        }

        Page<TutorFollow> page = tutorFollowRepository.findByTutorUserIdOrderByCreatedAtDesc(tutorUserId, pageable);
        return page.map(f -> FollowerSummaryDto.builder()
                .studentUserId(f.getStudentUserId())
                .followedAt(f.getCreatedAt())
                .build());
    }

    @Transactional(readOnly = true)
    public List<Long> getFollowedTutorUserIds(Long studentUserId) {
        if (studentUserId == null) {
            return Collections.emptyList();
        }
        return tutorFollowRepository.findFollowedTutorUserIdsByStudentUserId(studentUserId);
    }

    private void validateTutorTarget(Long tutorUserId) {
        TutorAuthorizationState authState = tutorAuthorizationStateRepository.findById(tutorUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Gia sư không hợp lệ: " + tutorUserId));
        if (!"APPROVED".equalsIgnoreCase(authState.getStatus())) {
            throw new BadRequestException("Gia sư này chưa được phê duyệt hồ sơ giảng dạy");
        }
    }
}
