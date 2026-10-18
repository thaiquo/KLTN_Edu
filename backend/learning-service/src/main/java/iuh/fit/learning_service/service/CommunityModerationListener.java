package iuh.fit.learning_service.service;

import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Component
public class CommunityModerationListener {
    private static final Logger log = LoggerFactory.getLogger(CommunityModerationListener.class);
    private final CommunityModerationClient client;
    private final CommunityPostService postService;

    public CommunityModerationListener(CommunityModerationClient client, CommunityPostService postService) {
        this.client = client;
        this.postService = postService;
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void moderate(CommunityModerationRequested event) {
        CommunityModerationPolicy.Result result;
        try {
            result = client.moderate(event.snapshot());
        } catch (RuntimeException ex) {
            log.warn("operation=community-moderation-provider-failure postId={} revision={} failureType={}",
                    event.postId(), event.contentRevision(), ex.getClass().getSimpleName());
            result = null;
        }
        boolean applied = postService.applyModerationResult(event, result);
        if (!applied) {
            log.info("operation=community-moderation-stale-noop postId={} revision={} pendingEdit={}",
                    event.postId(), event.contentRevision(), event.pendingEdit());
        }
    }
}
