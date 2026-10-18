package iuh.fit.learning_service.service;

import iuh.fit.learning_service.exception.BadRequestException;
import iuh.fit.learning_service.exception.ConflictException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class CommunityCreateRequestStore {
    private static final String TOKEN_PATTERN = "[A-Za-z0-9._:-]{8,64}";

    private final JdbcTemplate jdbcTemplate;

    public CommunityCreateRequestStore(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public Claim claim(Long authorId, String authorRole, String requestToken) {
        if (requestToken == null || requestToken.isBlank()) {
            return Claim.disabled();
        }
        String token = requestToken.trim();
        if (!token.matches(TOKEN_PATTERN)) {
            throw new BadRequestException("Idempotency-Key is invalid");
        }

        int inserted = jdbcTemplate.update("""
                INSERT INTO community_post_create_requests(author_id, author_role, request_token)
                VALUES (?, ?, ?)
                ON CONFLICT (author_id, author_role, request_token) DO NOTHING
                """, authorId, authorRole, token);
        if (inserted == 1) {
            return new Claim(true, token, null);
        }

        List<Long> postIds = jdbcTemplate.query("""
                SELECT post_id
                FROM community_post_create_requests
                WHERE author_id = ? AND author_role = ? AND request_token = ?
                """, (rs, rowNum) -> rs.getObject("post_id", Long.class), authorId, authorRole, token);
        if (postIds.isEmpty() || postIds.getFirst() == null) {
            throw new ConflictException("The create request is still being processed");
        }
        return new Claim(false, token, postIds.getFirst());
    }

    public void complete(Long authorId, String authorRole, Claim claim, Long postId) {
        if (!claim.enabled() || !claim.owner()) return;
        int updated = jdbcTemplate.update("""
                UPDATE community_post_create_requests
                SET post_id = ?
                WHERE author_id = ? AND author_role = ? AND request_token = ? AND post_id IS NULL
                """, postId, authorId, authorRole, claim.token());
        if (updated != 1) {
            throw new IllegalStateException("Could not complete community create idempotency record");
        }
    }

    public record Claim(boolean owner, String token, Long existingPostId) {
        static Claim disabled() {
            return new Claim(false, null, null);
        }

        boolean enabled() {
            return token != null;
        }

        boolean replayed() {
            return existingPostId != null;
        }
    }
}
