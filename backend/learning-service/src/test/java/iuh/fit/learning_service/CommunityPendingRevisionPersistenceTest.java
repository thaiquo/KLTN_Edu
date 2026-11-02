package iuh.fit.learning_service;

import iuh.fit.learning_service.config.security.LearningUserPrincipal;
import iuh.fit.learning_service.dto.CommunityModerationDtos.Action;
import iuh.fit.learning_service.dto.CommunityModerationDtos.ActionRequest;
import iuh.fit.learning_service.dto.CommunityModerationDtos.ModerationSource;
import iuh.fit.learning_service.entity.CommunityPost;
import iuh.fit.learning_service.entity.CommunityPostPendingRevision;
import iuh.fit.learning_service.enums.CommunityModerationStatus;
import iuh.fit.learning_service.enums.PostStatus;
import iuh.fit.learning_service.enums.PostType;
import iuh.fit.learning_service.messaging.LearningEventPublisher;
import iuh.fit.learning_service.repository.CommunityModerationHistoryRepository;
import iuh.fit.learning_service.repository.CommunityPostPendingRevisionRepository;
import iuh.fit.learning_service.repository.CommunityPostReportRepository;
import iuh.fit.learning_service.repository.CommunityPostRepository;
import iuh.fit.learning_service.service.CommunityManualModerationService;
import iuh.fit.learning_service.service.CommunityPostService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

@SpringBootTest(classes = CommunityPendingRevisionPersistenceTest.TestConfig.class, properties = {
        "spring.flyway.enabled=false",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.datasource.url=jdbc:h2:mem:pending_revision_persistence;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.rabbitmq.listener.simple.auto-startup=false",
        "spring.rabbitmq.listener.direct.auto-startup=false"
})
@Transactional
class CommunityPendingRevisionPersistenceTest {
    @Autowired CommunityPostRepository posts;
    @Autowired CommunityPostPendingRevisionRepository pending;
    @Autowired CommunityPostReportRepository reports;
    @Autowired CommunityModerationHistoryRepository history;
    @PersistenceContext EntityManager entityManager;

    private LearningEventPublisher events;
    private CommunityPostService postService;
    private CommunityManualModerationService moderationService;

    @BeforeEach
    void setUp() {
        events = mock(LearningEventPublisher.class);
        postService = mock(CommunityPostService.class);
        moderationService = new CommunityManualModerationService(
                posts, reports, history, pending, events, postService);
    }

    @Test
    void queueAndDetailLoadNeedsReviewRevisionThroughRepository() {
        CommunityPost post = savePost("Published title", "Published content");
        saveRevision(post.getId(), 2L, "Edited title", "Edited content");
        entityManager.flush();
        entityManager.clear();

        var queue = moderationService.queue(CommunityModerationStatus.NEEDS_REVIEW, false, null,
                PageRequest.of(0, 10));
        var detail = moderationService.detail(post.getId(), ModerationSource.AI_REVISION_REVIEW);

        assertThat(queue.getTotalElements()).isEqualTo(1);
        assertThat(queue.getContent()).singleElement().satisfies(item -> {
            assertThat(item.source()).isEqualTo(ModerationSource.AI_REVISION_REVIEW);
            assertThat(item.currentContent()).isEqualTo("Published content");
            assertThat(item.proposedContent()).isEqualTo("Edited content");
        });
        assertThat(detail.post().revisionId()).isEqualTo(2L);
        assertThat(detail.post().proposedTitle()).isEqualTo("Edited title");
    }

    @Test
    void approveLoadsManagedRevisionResolvesItAndFlushesWithoutTransientReference() {
        CommunityPost post = savePost("Published title", "Published content");
        CommunityPostPendingRevision revision = saveRevision(
                post.getId(), 2L, "Edited title", "Edited content");
        entityManager.flush();
        entityManager.clear();
        moderationService.decide(post.getId(),
                new ActionRequest(Action.APPROVE, "Approved", revision.getContentRevision(),
                        ModerationSource.AI_REVISION_REVIEW),
                new LearningUserPrincipal("admin@test.vn", 1L, "ADMIN"));
        entityManager.flush();

        assertThat(pending.findById(post.getId())).isEmpty();
        assertThat(history.findByPostIdOrderByCreatedAtAscIdAsc(post.getId()))
                .singleElement().satisfies(row -> assertThat(row.getAction()).isEqualTo("APPROVE_REVISION"));
        verify(events).publishCommunityPostRevisionModerated(
                eq(post.getId()), eq(2L), eq(11L), eq("STUDENT"), eq("Published title"),
                eq("APPROVED"), eq("Approved"), eq(1L));
    }

    @Test
    void rejectLoadsManagedRevisionPreservesPublishedPostAndFlushesWithoutTransientReference() {
        CommunityPost post = savePost("Published title", "Published content");
        CommunityPostPendingRevision revision = saveRevision(
                post.getId(), 2L, "Rejected title", "Rejected content");
        entityManager.flush();
        entityManager.clear();

        moderationService.decide(post.getId(),
                new ActionRequest(Action.REJECT, "Rejected", revision.getContentRevision(),
                        ModerationSource.AI_REVISION_REVIEW),
                new LearningUserPrincipal("staff@test.vn", 2L, "STAFF"));
        entityManager.flush();
        entityManager.clear();

        CommunityPost preserved = posts.findById(post.getId()).orElseThrow();
        assertThat(preserved.getTitle()).isEqualTo("Published title");
        assertThat(preserved.getContent()).isEqualTo("Published content");
        assertThat(preserved.getStatus()).isEqualTo(PostStatus.OPEN);
        assertThat(preserved.getModerationStatus()).isEqualTo(CommunityModerationStatus.ALLOWED);
        assertThat(preserved.getContentRevision()).isEqualTo(1L);
        assertThat(pending.findById(post.getId())).isEmpty();
        assertThat(history.findByPostIdOrderByCreatedAtAscIdAsc(post.getId()))
                .singleElement().satisfies(row -> assertThat(row.getAction()).isEqualTo("REJECT_REVISION"));
        verifyNoInteractions(postService);
        verify(events).publishCommunityPostRevisionModerated(
                eq(post.getId()), eq(2L), eq(11L), eq("STUDENT"), eq("Published title"),
                eq("REJECTED"), eq("Rejected"), eq(2L));
    }

    private CommunityPost savePost(String title, String content) {
        CommunityPost post = new CommunityPost();
        post.setAuthorId(11L);
        post.setAuthorRole("STUDENT");
        post.setAuthorName("Student");
        post.setPostType(PostType.STUDENT_FIND_TUTOR);
        post.setTitle(title);
        post.setContent(content);
        post.setStatus(PostStatus.OPEN);
        post.setModerationStatus(CommunityModerationStatus.ALLOWED);
        return posts.save(post);
    }

    private CommunityPostPendingRevision saveRevision(long postId, long revisionId,
                                                       String title, String content) {
        CommunityPostPendingRevision revision = new CommunityPostPendingRevision();
        revision.setPostId(postId);
        revision.setContentRevision(revisionId);
        revision.setRequestJson("{\"title\":\"" + title + "\",\"content\":\"" + content + "\"}");
        revision.setModerationStatus(CommunityModerationStatus.NEEDS_REVIEW);
        revision.setModerationReason("Needs human review");
        return pending.save(revision);
    }

    @SpringBootConfiguration
    @EnableAutoConfiguration
    static class TestConfig {}
}
