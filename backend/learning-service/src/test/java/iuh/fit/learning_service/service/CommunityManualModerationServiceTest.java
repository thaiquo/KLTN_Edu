package iuh.fit.learning_service.service;

import iuh.fit.learning_service.config.security.LearningUserPrincipal;
import iuh.fit.learning_service.dto.CommunityModerationDtos.Action;
import iuh.fit.learning_service.dto.CommunityModerationDtos.ActionRequest;
import iuh.fit.learning_service.entity.CommunityPost;
import iuh.fit.learning_service.enums.CommunityModerationStatus;
import iuh.fit.learning_service.enums.PostStatus;
import iuh.fit.learning_service.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CommunityManualModerationServiceTest {
    @Mock CommunityPostRepository posts; @Mock CommunityPostReportRepository reports;
    @Mock CommunityModerationHistoryRepository history; @Mock CommunityPostPendingRevisionRepository pending;
    CommunityManualModerationService service; CommunityPost post;

    @BeforeEach void setUp() {
        service = new CommunityManualModerationService(posts, reports, history, pending);
        post = new CommunityPost(); post.setId(9L); post.setTitle("Post"); post.setContent("Content");
        post.setAuthorId(2L); post.setAuthorName("Student"); post.setAuthorRole("STUDENT");
        post.setStatus(PostStatus.OPEN); post.setModerationStatus(CommunityModerationStatus.FAILED); post.setContentRevision(3L);
        lenient().when(posts.findByIdForUpdate(9L)).thenReturn(Optional.of(post));
        lenient().when(posts.findById(9L)).thenReturn(Optional.of(post));
        lenient().when(pending.findByPostIdForUpdate(9L)).thenReturn(Optional.empty());
        lenient().when(reports.findByPostIdOrderByCreatedAtAscIdAsc(9L)).thenReturn(List.of());
        lenient().when(history.findByPostIdOrderByCreatedAtAscIdAsc(9L)).thenReturn(List.of());
    }

    @Test void staffHideInvalidatesInFlightAiRevisionAndWritesAudit() {
        var actor = new LearningUserPrincipal("staff@test.vn", 5L, "STAFF");
        var result = service.decide(9L, new ActionRequest(Action.HIDE, "Nội dung vi phạm", 3L), actor);
        assertThat(result.post().postStatus()).isEqualTo(PostStatus.HIDDEN);
        assertThat(result.post().contentRevision()).isEqualTo(4L);
        verify(history).save(any());
        verify(reports).resolveOpen(eq(9L), any(), eq(5L), eq("STAFF"), any());
    }

    @Test void staleManualDecisionIsRejected() {
        var actor = new LearningUserPrincipal("admin@test.vn", 1L, "ADMIN");
        assertThatThrownBy(() -> service.decide(9L, new ActionRequest(Action.APPROVE, "Đã kiểm tra", 2L), actor))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode().value()).isEqualTo(409));
        verify(history, never()).save(any());
    }
}
