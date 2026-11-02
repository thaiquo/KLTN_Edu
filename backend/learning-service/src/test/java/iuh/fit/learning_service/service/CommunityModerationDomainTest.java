package iuh.fit.learning_service.service;

import iuh.fit.learning_service.entity.CommunityPost;
import iuh.fit.learning_service.enums.CommunityModerationStatus;
import iuh.fit.learning_service.enums.PostStatus;
import iuh.fit.learning_service.enums.PostType;
import iuh.fit.learning_service.repository.CommunityPostRepository;
import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class CommunityModerationDomainTest {
    private final CommunityModerationPolicy policy = new CommunityModerationPolicy();
    private final CommunityPostRepository repo = mock(CommunityPostRepository.class);
    private final CommunityModerationResultWriter writer = new CommunityModerationResultWriter(repo, policy);
    private final CommunityModerationClient.Request snapshot = new CommunityModerationClient.Request("TUTOR_POLL", "title", "content");

    private CommunityModerationPolicy.Result result(CommunityModerationPolicy.Recommendation recommendation,
            CommunityModerationPolicy.Risk risk, List<CommunityModerationPolicy.Category> categories) {
        return new CommunityModerationPolicy.Result(recommendation, risk, categories, "reason", "model", "v1", "now");
    }
    private CommunityPost post(PostStatus lifecycle) {
        CommunityPost post = new CommunityPost();
        post.setPostType(PostType.TUTOR_POLL);
        post.setTitle("title");
        post.setContent("content");
        post.setStatus(lifecycle);
        when(repo.findByIdForUpdate(1L)).thenReturn(Optional.of(post));
        return post;
    }

    @Test void policyFailsClosedAndMapsCategories() {
        assertEquals(CommunityModerationStatus.FAILED, policy.map(null));
        assertEquals(CommunityModerationStatus.ALLOWED, policy.map(result(CommunityModerationPolicy.Recommendation.ALLOW, CommunityModerationPolicy.Risk.LOW, List.of())));
        assertEquals(CommunityModerationStatus.NEEDS_REVIEW, policy.map(result(CommunityModerationPolicy.Recommendation.ALLOW, CommunityModerationPolicy.Risk.MEDIUM, List.of(CommunityModerationPolicy.Category.SPAM))));
        assertEquals(CommunityModerationStatus.NEEDS_EDIT, policy.map(result(CommunityModerationPolicy.Recommendation.NEEDS_EDIT, CommunityModerationPolicy.Risk.MEDIUM, List.of(CommunityModerationPolicy.Category.SPAM))));
        assertEquals(CommunityModerationStatus.NEEDS_REVIEW, policy.map(result(CommunityModerationPolicy.Recommendation.NEEDS_REVIEW, CommunityModerationPolicy.Risk.MEDIUM, List.of(CommunityModerationPolicy.Category.OTHER_UNSAFE))));
        assertEquals(CommunityModerationStatus.REJECTED, policy.map(result(CommunityModerationPolicy.Recommendation.REJECT, CommunityModerationPolicy.Risk.HIGH, List.of(CommunityModerationPolicy.Category.SPAM))));
    }
    @Test void matchingRevisionPersistsWithoutChangingLifecycle() {
        for (PostStatus lifecycle : PostStatus.values()) {
            var post = post(lifecycle);
            assertTrue(writer.apply(1L, 1, snapshot, result(CommunityModerationPolicy.Recommendation.REJECT, CommunityModerationPolicy.Risk.HIGH, List.of(CommunityModerationPolicy.Category.SPAM))));
            assertEquals(lifecycle, post.getStatus());
            assertEquals("SPAM", post.getModerationCategories());
            assertEquals(CommunityModerationStatus.REJECTED, post.getModerationStatus());
            assertTrue(writer.apply(1L, 1, snapshot, null));
            assertEquals(CommunityModerationStatus.FAILED, post.getModerationStatus());
        }
    }
    @Test void staleRevisionOrChangedContentIsIgnored() {
        var post = post(PostStatus.OPEN);
        post.setContentRevision(2L);
        assertFalse(writer.apply(1L, 1, snapshot, null));
        post.setContentRevision(1L);
        post.setContent("edited");
        assertFalse(writer.apply(1L, 1, snapshot, null));
        verify(repo, never()).save(any());
    }
    @Test void advancingRevisionResetsModerationAndRejectsOldResults() {
        var post = post(PostStatus.OPEN);
        post.setModerationStatus(CommunityModerationStatus.ALLOWED);
        assertEquals(2L, writer.advanceRevision(1L));
        assertEquals(CommunityModerationStatus.NOT_CHECKED, post.getModerationStatus());
        assertFalse(writer.apply(1L, 1, snapshot, null));
        assertEquals(PostStatus.OPEN, post.getStatus());
    }
}
