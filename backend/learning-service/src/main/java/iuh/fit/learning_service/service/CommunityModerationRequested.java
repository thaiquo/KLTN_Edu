package iuh.fit.learning_service.service;

public record CommunityModerationRequested(
        Long postId,
        long contentRevision,
        String authorEmail,
        boolean pendingEdit,
        CommunityModerationClient.Request snapshot
) {}
