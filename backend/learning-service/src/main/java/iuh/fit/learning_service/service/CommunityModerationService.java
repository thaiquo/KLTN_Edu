package iuh.fit.learning_service.service;

import iuh.fit.learning_service.repository.CommunityPostRepository;
import org.springframework.stereotype.Service;
import java.util.Objects;

@Service
public class CommunityModerationService {
    private final CommunityPostRepository repository;
    private final CommunityModerationClient client;
    private final CommunityModerationResultWriter writer;
    public CommunityModerationService(CommunityPostRepository repository, CommunityModerationClient client,
                                      CommunityModerationResultWriter writer) {
        this.repository = repository;
        this.client = client;
        this.writer = writer;
    }

    public boolean moderate(Long postId, long revision) {
        var post = repository.findById(postId).orElse(null);
        if (post == null || !Objects.equals(post.getContentRevision(), revision)) return false;
        var snapshot = new CommunityModerationClient.Request(post.getPostType().name(), post.getTitle(), post.getContent());
        return writer.apply(postId, revision, snapshot, client.moderate(snapshot));
    }
}
