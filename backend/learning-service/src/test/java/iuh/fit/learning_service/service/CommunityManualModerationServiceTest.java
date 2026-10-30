package iuh.fit.learning_service.service;

import iuh.fit.learning_service.config.security.LearningUserPrincipal;
import iuh.fit.learning_service.dto.CommunityModerationDtos.Action;
import iuh.fit.learning_service.dto.CommunityModerationDtos.ActionRequest;
import iuh.fit.learning_service.entity.CommunityPost;
import iuh.fit.learning_service.entity.CommunityPostPendingRevision;
import iuh.fit.learning_service.enums.CommunityModerationStatus;
import iuh.fit.learning_service.enums.PostStatus;
import iuh.fit.learning_service.exception.ForbiddenException;
import iuh.fit.learning_service.repository.*;
import iuh.fit.learning_service.messaging.LearningEventPublisher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static iuh.fit.learning_service.dto.CommunityModerationDtos.ModerationSource.*;

@ExtendWith(MockitoExtension.class)
class CommunityManualModerationServiceTest {
    @Mock CommunityPostRepository posts; @Mock CommunityPostReportRepository reports;
    @Mock CommunityModerationHistoryRepository history; @Mock CommunityPostPendingRevisionRepository pending;
    @Mock LearningEventPublisher eventPublisher;
    @Mock CommunityPostService communityPostService;
    CommunityManualModerationService service; CommunityPost post;

    @BeforeEach void setUp() {
        service = new CommunityManualModerationService(posts, reports, history, pending, eventPublisher,
                communityPostService);
        post = new CommunityPost(); post.setId(9L); post.setTitle("Post"); post.setContent("Content");
        post.setAuthorId(2L); post.setAuthorName("Student"); post.setAuthorRole("STUDENT");
        post.setStatus(PostStatus.OPEN); post.setModerationStatus(CommunityModerationStatus.FAILED); post.setContentRevision(3L);
        lenient().when(posts.findByIdForUpdate(9L)).thenReturn(Optional.of(post));
        lenient().when(posts.findById(9L)).thenReturn(Optional.of(post));
        lenient().when(pending.findByPostIdForUpdate(9L)).thenReturn(Optional.empty());
        lenient().when(pending.findAllByPostIdIn(anyCollection())).thenReturn(List.of());
        lenient().when(pending.findById(9L)).thenReturn(Optional.empty());
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

    @Test void studentCannotMakeManualModerationDecision() {
        var student = new LearningUserPrincipal("student@test.vn", 2L, "STUDENT");
        assertThatThrownBy(() -> service.decide(9L,
                new ActionRequest(Action.APPROVE, "Không có quyền", 3L), student))
                .isInstanceOf(ForbiddenException.class);
        verify(history, never()).save(any());
        verifyNoInteractions(eventPublisher);
    }

    @Test void needsReviewWithoutUserReportAppearsInFilteredQueueWithPagination() {
        post.setModerationStatus(CommunityModerationStatus.NEEDS_REVIEW);
        var pageable = PageRequest.of(1, 10);
        when(posts.findAll(any(org.springframework.data.jpa.domain.Specification.class), eq(pageable)))
                .thenReturn(new PageImpl<>(List.of(post), pageable, 21));
        when(reports.countOpenByPostIds(List.of(9L))).thenReturn(List.of());

        var result = service.queue(CommunityModerationStatus.NEEDS_REVIEW, false, null, pageable);

        assertThat(result.getContent()).singleElement().satisfies(item -> {
            assertThat(item.postId()).isEqualTo(9L);
            assertThat(item.moderationStatus()).isEqualTo(CommunityModerationStatus.NEEDS_REVIEW);
            assertThat(item.openReportCount()).isZero();
            assertThat(item.source()).isEqualTo(AI_POST_REVIEW);
        });
        assertThat(result.getTotalElements()).isEqualTo(21);
        assertThat(result.getTotalPages()).isEqualTo(3);
    }

    @Test void defaultQueueMapsMixedAiReviewAndUserReportedPosts() {
        CommunityPost reportedPost = new CommunityPost();
        reportedPost.setId(10L); reportedPost.setTitle("Reported"); reportedPost.setContent("Content");
        reportedPost.setAuthorId(3L); reportedPost.setAuthorName("Tutor"); reportedPost.setAuthorRole("TUTOR");
        reportedPost.setStatus(PostStatus.OPEN); reportedPost.setModerationStatus(CommunityModerationStatus.ALLOWED);
        reportedPost.setContentRevision(1L);
        post.setModerationStatus(CommunityModerationStatus.NEEDS_REVIEW);
        var pageable = PageRequest.of(0, 10);
        when(posts.findAll(any(org.springframework.data.jpa.domain.Specification.class), eq(pageable)))
                .thenReturn(new PageImpl<>(List.of(post, reportedPost), pageable, 2));
        when(reports.countOpenByPostIds(List.of(9L, 10L))).thenReturn(List.<Object[]>of(new Object[] { 10L, 1L }));

        var result = service.queue(null, false, null, pageable);

        assertThat(result.getContent()).extracting(item -> item.postId()).containsExactly(9L, 10L);
        assertThat(result.getContent()).extracting(item -> item.openReportCount()).containsExactly(0L, 1L);
    }

    @Test void reportedOnlyQueuePreservesUserReportCount() {
        post.setModerationStatus(CommunityModerationStatus.ALLOWED);
        var pageable = PageRequest.of(0, 10);
        when(posts.findAll(any(org.springframework.data.jpa.domain.Specification.class), eq(pageable)))
                .thenReturn(new PageImpl<>(List.of(post), pageable, 1));
        when(reports.countOpenByPostIds(List.of(9L))).thenReturn(List.<Object[]>of(new Object[] { 9L, 1L }));

        var result = service.queue(null, true, null, pageable);

        assertThat(result.getContent()).singleElement().satisfies(item -> {
            assertThat(item.moderationStatus()).isEqualTo(CommunityModerationStatus.ALLOWED);
            assertThat(item.openReportCount()).isEqualTo(1L);
            assertThat(item.source()).isEqualTo(USER_REPORT);
        });
    }

    @Test void pendingNeedsReviewAppearsWithoutReportAndExposesCurrentAndProposedContent() {
        post.setModerationStatus(CommunityModerationStatus.ALLOWED);
        CommunityPostPendingRevision revision = pendingRevision(4L, "Edited title", "Edited content");
        var pageable = PageRequest.of(0, 10);
        when(posts.findAll(any(org.springframework.data.jpa.domain.Specification.class),
                eq(PageRequest.of(0, 10)))).thenReturn(new PageImpl<>(List.of(post), pageable, 1));
        when(reports.countOpenByPostIds(List.of(9L))).thenReturn(List.of());
        when(pending.findAllByPostIdIn(List.of(9L))).thenReturn(List.of(revision));

        var result = service.queue(CommunityModerationStatus.NEEDS_REVIEW, false, null, pageable);

        assertThat(result.getContent()).singleElement().satisfies(item -> {
            assertThat(item.source()).isEqualTo(AI_REVISION_REVIEW);
            assertThat(item.revisionId()).isEqualTo(4L);
            assertThat(item.currentTitle()).isEqualTo("Post");
            assertThat(item.currentContent()).isEqualTo("Content");
            assertThat(item.proposedTitle()).isEqualTo("Edited title");
            assertThat(item.proposedContent()).isEqualTo("Edited content");
            assertThat(item.openReportCount()).isZero();
        });
        verify(pending).findAllByPostIdIn(List.of(9L));
    }

    @Test void needsReviewFilterContainsPostAndRevisionReviewsButNotReportedAllowedPosts() {
        post.setModerationStatus(CommunityModerationStatus.ALLOWED);
        CommunityPostPendingRevision revision = pendingRevision(4L, "Edited title", "Edited content");
        CommunityPost postReview = queuePost(10L, CommunityModerationStatus.NEEDS_REVIEW);
        var pageable = PageRequest.of(0, 10);
        when(posts.findAll(any(org.springframework.data.jpa.domain.Specification.class), eq(pageable)))
                .thenReturn(new PageImpl<>(List.of(post, postReview), pageable, 2));
        when(reports.countOpenByPostIds(List.of(9L, 10L))).thenReturn(List.of());
        when(pending.findAllByPostIdIn(List.of(9L, 10L))).thenReturn(List.of(revision));

        var result = service.queue(CommunityModerationStatus.NEEDS_REVIEW, false, null, pageable);

        assertThat(result.getContent()).extracting(item -> item.source())
                .containsExactly(AI_REVISION_REVIEW, AI_POST_REVIEW);
        assertThat(result.getContent()).noneMatch(item -> item.source() == USER_REPORT);
        assertThat(result.getTotalElements()).isEqualTo(2);
        verify(pending).findAllByPostIdIn(List.of(9L, 10L));
    }

    @Test void adminApprovesPendingRevisionAndResolvesItWithoutCreatingAnotherPost() {
        post.setModerationStatus(CommunityModerationStatus.ALLOWED);
        CommunityPostPendingRevision revision = pendingRevision(4L, "Edited title", "Edited content");
        when(pending.findByPostIdForUpdate(9L)).thenReturn(Optional.of(revision));
        var actor = new LearningUserPrincipal("admin@test.vn", 1L, "ADMIN");

        service.decide(9L, new ActionRequest(Action.APPROVE, "Revision approved", 4L,
                AI_REVISION_REVIEW), actor);

        verify(communityPostService).approvePendingRevisionManually(post, revision, "Revision approved");
        verify(pending).delete(revision);
        verify(history).save(argThat(row -> "APPROVE_REVISION".equals(row.getAction())
                && "NEEDS_REVIEW".equals(row.getPreviousModerationStatus())
                && "ALLOWED".equals(row.getNewModerationStatus())));
        verify(eventPublisher).publishCommunityPostRevisionModerated(
                eq(9L), eq(4L), eq(2L), eq("STUDENT"), eq("Post"), eq("APPROVED"),
                eq("Revision approved"), eq(1L));
        verify(posts, never()).save(argThat(saved -> saved != post));
    }

    @Test void staffRejectsPendingRevisionAndPreservesPublishedPost() {
        post.setModerationStatus(CommunityModerationStatus.ALLOWED);
        post.setContent("Published content");
        CommunityPostPendingRevision revision = pendingRevision(4L, "Edited title", "Rejected content");
        when(pending.findByPostIdForUpdate(9L)).thenReturn(Optional.of(revision));
        var actor = new LearningUserPrincipal("staff@test.vn", 5L, "STAFF");

        service.decide(9L, new ActionRequest(Action.REJECT, "Revision rejected", 4L,
                AI_REVISION_REVIEW), actor);

        assertThat(post.getContent()).isEqualTo("Published content");
        assertThat(post.getStatus()).isEqualTo(PostStatus.OPEN);
        assertThat(post.getModerationStatus()).isEqualTo(CommunityModerationStatus.ALLOWED);
        assertThat(post.getContentRevision()).isEqualTo(3L);
        verifyNoInteractions(communityPostService);
        verify(pending).delete(revision);
        verify(history).save(argThat(row -> "REJECT_REVISION".equals(row.getAction())
                && "REJECTED".equals(row.getNewModerationStatus())));
        verify(eventPublisher).publishCommunityPostRevisionModerated(
                eq(9L), eq(4L), eq(2L), eq("STUDENT"), eq("Post"), eq("REJECTED"),
                eq("Revision rejected"), eq(5L));
    }

    @Test void adminApprovesNeedsReviewAndPublishesAuthorNotification() {
        post.setModerationStatus(CommunityModerationStatus.NEEDS_REVIEW);
        var actor = new LearningUserPrincipal("admin@test.vn", 1L, "ADMIN");

        var result = service.decide(9L, new ActionRequest(Action.APPROVE, "Nội dung giáo dục hợp lệ", 3L), actor);

        assertThat(result.post().moderationStatus()).isEqualTo(CommunityModerationStatus.ALLOWED);
        assertThat(result.post().postStatus()).isEqualTo(PostStatus.OPEN);
        verify(history).save(argThat(row -> "NEEDS_REVIEW".equals(row.getPreviousModerationStatus())
                && "ALLOWED".equals(row.getNewModerationStatus())));
        verify(eventPublisher).publishCommunityPostModerated(
                eq(9L), eq(4L), eq(2L), eq("STUDENT"), eq("Post"), eq("APPROVED"), anyString(), eq(1L));
    }

    @Test void staffRejectsNeedsReviewAndPublishesAuthorNotification() {
        post.setModerationStatus(CommunityModerationStatus.NEEDS_REVIEW);
        var actor = new LearningUserPrincipal("staff@test.vn", 5L, "STAFF");

        var result = service.decide(9L, new ActionRequest(Action.REJECT, "Không đủ ngữ cảnh giáo dục", 3L), actor);

        assertThat(result.post().moderationStatus()).isEqualTo(CommunityModerationStatus.REJECTED);
        assertThat(result.post().postStatus()).isEqualTo(PostStatus.HIDDEN);
        verify(history).save(argThat(row -> "NEEDS_REVIEW".equals(row.getPreviousModerationStatus())
                && "REJECTED".equals(row.getNewModerationStatus())));
        verify(eventPublisher).publishCommunityPostModerated(
                eq(9L), eq(4L), eq(2L), eq("STUDENT"), eq("Post"), eq("REJECTED"), anyString(), eq(5L));
    }

    private CommunityPostPendingRevision pendingRevision(long revisionId, String title, String content) {
        CommunityPostPendingRevision revision = new CommunityPostPendingRevision();
        revision.setPostId(9L);
        revision.setContentRevision(revisionId);
        revision.setRequestJson("{\"title\":\"" + title + "\",\"content\":\"" + content + "\"}");
        revision.setModerationStatus(CommunityModerationStatus.NEEDS_REVIEW);
        revision.setModerationReason("Needs human review");
        revision.setCreatedAt(java.time.LocalDateTime.now());
        return revision;
    }

    private CommunityPost queuePost(long id, CommunityModerationStatus moderationStatus) {
        CommunityPost row = new CommunityPost();
        row.setId(id); row.setTitle("Post " + id); row.setContent("Content " + id);
        row.setAuthorId(id + 100); row.setAuthorName("Author " + id); row.setAuthorRole("STUDENT");
        row.setStatus(PostStatus.OPEN); row.setModerationStatus(moderationStatus); row.setContentRevision(1L);
        return row;
    }
}
