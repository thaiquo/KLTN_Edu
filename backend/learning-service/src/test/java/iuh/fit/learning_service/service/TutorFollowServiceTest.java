package iuh.fit.learning_service.service;

import iuh.fit.learning_service.config.security.LearningUserPrincipal;
import iuh.fit.learning_service.dto.TutorFollowDtos.FollowStatusResponse;
import iuh.fit.learning_service.dto.TutorFollowDtos.FollowerSummaryDto;
import iuh.fit.learning_service.dto.TutorFollowDtos.FollowingTutorSummaryDto;
import iuh.fit.learning_service.entity.TutorAuthorizationState;
import iuh.fit.learning_service.entity.TutorFollow;
import iuh.fit.learning_service.exception.BadRequestException;
import iuh.fit.learning_service.exception.ForbiddenException;
import iuh.fit.learning_service.exception.ResourceNotFoundException;
import iuh.fit.learning_service.repository.TutorAuthorizationStateRepository;
import iuh.fit.learning_service.repository.TutorFollowRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.never;

@ExtendWith(MockitoExtension.class)
class TutorFollowServiceTest {

    @Mock
    private TutorFollowRepository tutorFollowRepository;

    @Mock
    private TutorAuthorizationStateRepository tutorAuthorizationStateRepository;

    @InjectMocks
    private TutorFollowService tutorFollowService;

    private LearningUserPrincipal studentPrincipal;
    private LearningUserPrincipal tutorPrincipal;

    @BeforeEach
    void setUp() {
        studentPrincipal = new LearningUserPrincipal("student@example.com", 101L, "STUDENT");
        tutorPrincipal = new LearningUserPrincipal("tutor@example.com", 202L, "TUTOR");
    }

    @Test
    @DisplayName("followTutor: student follows approved tutor")
    void followTutor_Success_WhenStudent() {
        Long tutorUserId = 202L;
        TutorAuthorizationState state = approvedTutorState(tutorUserId);

        when(tutorAuthorizationStateRepository.findById(tutorUserId)).thenReturn(Optional.of(state));
        when(tutorFollowRepository.insertIfAbsent(101L, tutorUserId)).thenReturn(1);
        when(tutorFollowRepository.countByTutorUserId(tutorUserId)).thenReturn(1L);

        FollowStatusResponse response = tutorFollowService.followTutor(tutorUserId, studentPrincipal);

        assertThat(response).isNotNull();
        assertThat(response.getIsFollowed()).isTrue();
        assertThat(response.getFollowerCount()).isEqualTo(1L);
        verify(tutorFollowRepository).insertIfAbsent(101L, tutorUserId);
    }

    @Test
    @DisplayName("followTutor: rejects non-student actor")
    void followTutor_Forbidden_WhenNotStudent() {
        Long tutorUserId = 202L;

        assertThatThrownBy(() -> tutorFollowService.followTutor(tutorUserId, tutorPrincipal))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("Chỉ học viên mới có quyền");
        verifyNoInteractions(tutorFollowRepository);
    }

    @Test
    @DisplayName("followTutor: rejects self-follow")
    void followTutor_BadRequest_WhenSelfFollow() {
        LearningUserPrincipal sameUserStudent = new LearningUserPrincipal("user@example.com", 202L, "STUDENT");

        assertThatThrownBy(() -> tutorFollowService.followTutor(202L, sameUserStudent))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("không thể tự theo dõi");
        verifyNoInteractions(tutorFollowRepository);
    }

    @Test
    @DisplayName("followTutor: rejects user without approved tutor projection")
    void followTutor_NotFound_WhenTutorAuthorizationMissing() {
        Long nonTutorUserId = 404L;
        when(tutorAuthorizationStateRepository.findById(nonTutorUserId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> tutorFollowService.followTutor(nonTutorUserId, studentPrincipal))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Gia sư không hợp lệ");
        verify(tutorFollowRepository, never()).insertIfAbsent(any(), any());
    }

    @Test
    @DisplayName("followTutor: rejects tutor not approved")
    void followTutor_BadRequest_WhenTutorNotApproved() {
        Long tutorUserId = 202L;
        TutorAuthorizationState state = new TutorAuthorizationState();
        state.setUserId(tutorUserId);
        state.setStatus("REJECTED");
        when(tutorAuthorizationStateRepository.findById(tutorUserId)).thenReturn(Optional.of(state));

        assertThatThrownBy(() -> tutorFollowService.followTutor(tutorUserId, studentPrincipal))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("chưa được phê duyệt");
        verify(tutorFollowRepository, never()).insertIfAbsent(any(), any());
    }

    @Test
    @DisplayName("followTutor: idempotent when already followed")
    void followTutor_Idempotent_WhenAlreadyFollowed() {
        Long tutorUserId = 202L;
        when(tutorAuthorizationStateRepository.findById(tutorUserId)).thenReturn(Optional.of(approvedTutorState(tutorUserId)));
        when(tutorFollowRepository.insertIfAbsent(101L, tutorUserId)).thenReturn(0);
        when(tutorFollowRepository.countByTutorUserId(tutorUserId)).thenReturn(1L);

        FollowStatusResponse response = tutorFollowService.followTutor(tutorUserId, studentPrincipal);

        assertThat(response.getIsFollowed()).isTrue();
        assertThat(response.getFollowerCount()).isEqualTo(1L);
        verify(tutorFollowRepository).insertIfAbsent(101L, tutorUserId);
    }

    @Test
    @DisplayName("unfollowTutor: student unfollows idempotently")
    void unfollowTutor_Success_WhenStudent() {
        Long tutorUserId = 202L;
        when(tutorFollowRepository.countByTutorUserId(tutorUserId)).thenReturn(0L);

        FollowStatusResponse response = tutorFollowService.unfollowTutor(tutorUserId, studentPrincipal);

        assertThat(response.getIsFollowed()).isFalse();
        assertThat(response.getFollowerCount()).isEqualTo(0L);
        verify(tutorFollowRepository).deleteByStudentUserIdAndTutorUserId(101L, tutorUserId);
    }

    @Test
    @DisplayName("unfollowTutor: rejects non-student actor")
    void unfollowTutor_Forbidden_WhenNotStudent() {
        Long tutorUserId = 202L;

        assertThatThrownBy(() -> tutorFollowService.unfollowTutor(tutorUserId, tutorPrincipal))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("Chỉ học viên mới có quyền");
    }

    @Test
    @DisplayName("getFollowStatus: returns followed flag and follower count")
    void getFollowStatus_Success() {
        Long tutorUserId = 202L;
        when(tutorFollowRepository.countByTutorUserId(tutorUserId)).thenReturn(5L);
        when(tutorFollowRepository.existsByStudentUserIdAndTutorUserId(101L, tutorUserId)).thenReturn(true);

        FollowStatusResponse response = tutorFollowService.getFollowStatus(tutorUserId, 101L);

        assertThat(response.getIsFollowed()).isTrue();
        assertThat(response.getFollowerCount()).isEqualTo(5L);
    }

    @Test
    @DisplayName("getFollowingTutors: returns current student's followed tutors")
    void getFollowingTutors_Success_WhenStudent() {
        TutorFollow f1 = new TutorFollow(101L, 202L);
        TutorFollow f2 = new TutorFollow(101L, 203L);
        when(tutorFollowRepository.findByStudentUserIdOrderByCreatedAtDesc(101L)).thenReturn(List.of(f1, f2));

        List<FollowingTutorSummaryDto> list = tutorFollowService.getFollowingTutors(studentPrincipal);

        assertThat(list).hasSize(2);
        assertThat(list.get(0).getTutorUserId()).isEqualTo(202L);
        assertThat(list.get(1).getTutorUserId()).isEqualTo(203L);
    }

    @Test
    @DisplayName("getFollowers: tutor owner reads follower list")
    void getFollowers_Success_WhenTutorOwner() {
        Long tutorUserId = 202L;
        Pageable pageable = PageRequest.of(0, 10);
        TutorFollow f = new TutorFollow(101L, tutorUserId);
        when(tutorFollowRepository.findByTutorUserIdOrderByCreatedAtDesc(tutorUserId, pageable))
                .thenReturn(new PageImpl<>(List.of(f), pageable, 1));

        Page<FollowerSummaryDto> followers = tutorFollowService.getFollowers(tutorUserId, pageable, tutorPrincipal);

        assertThat(followers.getTotalElements()).isEqualTo(1);
        assertThat(followers.getContent().get(0).getStudentUserId()).isEqualTo(101L);
    }

    private TutorAuthorizationState approvedTutorState(Long tutorUserId) {
        TutorAuthorizationState state = new TutorAuthorizationState();
        state.setUserId(tutorUserId);
        state.setStatus("APPROVED");
        return state;
    }
}
