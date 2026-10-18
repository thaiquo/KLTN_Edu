package iuh.fit.learning_service.service;

import iuh.fit.learning_service.enums.CommunityModerationStatus;
import iuh.fit.learning_service.repository.CommunityPostRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
public class CommunityModerationResultWriter {
    private final CommunityPostRepository repository;
    private final CommunityModerationPolicy policy;
    public CommunityModerationResultWriter(CommunityPostRepository repository, CommunityModerationPolicy policy) {
        this.repository = repository;
        this.policy = policy;
    }

    @Transactional
    public long advanceRevision(Long postId) {
        var post = repository.findByIdForUpdate(postId)
                .orElseThrow(() -> new IllegalArgumentException("Community post not found"));
        post.setContentRevision(Math.addExact(post.getContentRevision(), 1L));
        post.setModerationStatus(CommunityModerationStatus.NOT_CHECKED);
        post.setModerationCategories(null);
        post.setModerationReason(null);
        post.setModerationPromptVersion(null);
        post.setModeratedAt(null);
        repository.save(post);
        return post.getContentRevision();
    }

    @Transactional
    public boolean apply(Long postId, long revision, CommunityModerationClient.Request snapshot,
                         CommunityModerationPolicy.Result result) {
        var post = repository.findByIdForUpdate(postId).orElse(null);
        if (post == null || !Objects.equals(post.getContentRevision(), revision)
                || !Objects.equals(post.getPostType().name(), snapshot.postType())
                || !Objects.equals(post.getTitle(), snapshot.title())
                || !Objects.equals(post.getContent(), snapshot.content())) return false;
        CommunityModerationStatus status = policy.map(result);
        post.setModerationStatus(status);
        post.setModerationCategories(status == CommunityModerationStatus.FAILED ? null : result.categories().stream()
                .map(Enum::name).collect(Collectors.joining(",")));
        post.setModerationReason(status == CommunityModerationStatus.FAILED ? null : result.reason());
        post.setModerationPromptVersion(status == CommunityModerationStatus.FAILED ? null : result.promptVersion());
        post.setModeratedAt(LocalDateTime.now());
        repository.save(post);
        return true;
    }
}
