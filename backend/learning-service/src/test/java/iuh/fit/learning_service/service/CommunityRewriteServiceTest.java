package iuh.fit.learning_service.service;

import iuh.fit.learning_service.config.security.LearningUserPrincipal;
import iuh.fit.learning_service.dto.CommunityPostDtos.AiRewritePostRequest;
import iuh.fit.learning_service.entity.CommunityPost;
import iuh.fit.learning_service.entity.CommunityPostPendingRevision;
import iuh.fit.learning_service.enums.CommunityModerationStatus;
import iuh.fit.learning_service.enums.PostStatus;
import iuh.fit.learning_service.enums.PostType;
import iuh.fit.learning_service.exception.ConflictException;
import iuh.fit.learning_service.exception.ForbiddenException;
import iuh.fit.learning_service.repository.CommunityPostPendingRevisionRepository;
import iuh.fit.learning_service.repository.CommunityPostRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CommunityRewriteServiceTest {
    @Mock CommunityPostRepository posts;
    @Mock CommunityPostPendingRevisionRepository pending;
    @Mock CommunityRewriteClient client;
    CommunityRewriteService service;
    LearningUserPrincipal author = new LearningUserPrincipal("student@edu.vn", 20L, "STUDENT");

    @BeforeEach void setUp() {
        service = new CommunityRewriteService(posts, pending, client);
    }

    @Test void authorCanRewriteNeedsEditCurrentRevisionWithoutMutation() {
        CommunityPost post = post(1L, 20L, CommunityModerationStatus.NEEDS_EDIT, PostType.STUDENT_FIND_TUTOR);
        when(posts.findById(1L)).thenReturn(Optional.of(post));
        when(pending.findById(1L)).thenReturn(Optional.empty());
        when(client.rewrite(any())).thenReturn(new CommunityRewriteClient.Result(
                true, "Tiêu đề an toàn", "Nội dung an toàn", "Đã sửa ngôn từ"));

        var result = service.rewrite(1L, new AiRewritePostRequest(1L), author);

        assertThat(result.getSuggestedTitle()).isEqualTo("Tiêu đề an toàn");
        assertThat(result.getSourceRevision()).isEqualTo(1L);
        assertThat(result.getPendingEdit()).isFalse();
        verify(posts, never()).save(any());
        verify(pending, never()).save(any());
    }

    @Test void pendingRejectedRevisionIsAuthoritativeAndPublishedContentIsUntouched() {
        CommunityPost post = post(2L, 20L, CommunityModerationStatus.ALLOWED, PostType.TUTOR_POLL);
        post.setTitle("Bản công khai");
        CommunityPostPendingRevision revision = new CommunityPostPendingRevision();
        revision.setPostId(2L);
        revision.setContentRevision(4L);
        revision.setModerationStatus(CommunityModerationStatus.REJECTED);
        revision.setModerationCategories("SCAM_FRAUD");
        revision.setModerationReason("Nội dung không phù hợp");
        revision.setRequestJson("{\"postType\":\"TUTOR_POLL\",\"title\":\"Bản chờ\",\"content\":\"Nội dung chờ\","
                + "\"poll\":{\"question\":\"Lịch nào?\",\"options\":[]}}");
        when(posts.findById(2L)).thenReturn(Optional.of(post));
        when(pending.findById(2L)).thenReturn(Optional.of(revision));
        when(client.rewrite(any())).thenReturn(new CommunityRewriteClient.Result(
                true, "Bản chờ an toàn", "Nội dung chờ an toàn", "Đã sửa"));

        var result = service.rewrite(2L, new AiRewritePostRequest(4L), author);

        assertThat(result.getPendingEdit()).isTrue();
        assertThat(post.getTitle()).isEqualTo("Bản công khai");
        var request = org.mockito.ArgumentCaptor.forClass(CommunityRewriteClient.Request.class);
        verify(client).rewrite(request.capture());
        assertThat(request.getValue().title()).isEqualTo("Bản chờ");
        assertThat(request.getValue().content()).isEqualTo("Nội dung chờ");
    }

    @Test void rejectsWrongOwnerAndIneligibleStatuses() {
        CommunityPost post = post(3L, 20L, CommunityModerationStatus.REJECTED, PostType.STUDENT_FIND_TUTOR);
        when(posts.findById(3L)).thenReturn(Optional.of(post));
        assertThrows(ForbiddenException.class, () -> service.rewrite(3L, new AiRewritePostRequest(1L),
                new LearningUserPrincipal("other@edu.vn", 99L, "STUDENT")));

        for (CommunityModerationStatus status : List.of(CommunityModerationStatus.ALLOWED,
                CommunityModerationStatus.MODERATING, CommunityModerationStatus.FAILED,
                CommunityModerationStatus.NOT_CHECKED)) {
            post.setModerationStatus(status);
            when(pending.findById(3L)).thenReturn(Optional.empty());
            assertThrows(ConflictException.class,
                    () -> service.rewrite(3L, new AiRewritePostRequest(1L), author));
        }
        verifyNoInteractions(client);
    }

    @Test void rejectsStaleRequestAndResult() {
        CommunityPost post = post(4L, 20L, CommunityModerationStatus.REJECTED, PostType.STUDENT_FIND_TUTOR);
        when(posts.findById(4L)).thenReturn(Optional.of(post));
        when(pending.findById(4L)).thenReturn(Optional.empty());
        assertThrows(ConflictException.class, () -> service.rewrite(4L, new AiRewritePostRequest(0L), author));

        when(client.rewrite(any())).thenAnswer(invocation -> {
            post.setContentRevision(2L);
            return new CommunityRewriteClient.Result(true, "x", "y", "z");
        });
        assertThrows(ConflictException.class, () -> service.rewrite(4L, new AiRewritePostRequest(1L), author));
    }

    private CommunityPost post(Long id, Long authorId, CommunityModerationStatus status, PostType type) {
        CommunityPost post = new CommunityPost();
        post.setId(id);
        post.setAuthorId(authorId);
        post.setPostType(type);
        post.setTitle("Tiêu đề gốc");
        post.setContent("Nội dung gốc");
        post.setStatus(PostStatus.OPEN);
        post.setContentRevision(1L);
        post.setModerationStatus(status);
        post.setModerationCategories("PROFANITY");
        post.setModerationReason("Vui lòng chỉnh sửa nội dung");
        return post;
    }
}
