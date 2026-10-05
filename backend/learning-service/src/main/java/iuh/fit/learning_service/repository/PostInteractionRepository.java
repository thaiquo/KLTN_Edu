package iuh.fit.learning_service.repository;

import iuh.fit.learning_service.entity.CommunityPost;
import iuh.fit.learning_service.entity.PostInteraction;
import iuh.fit.learning_service.enums.InteractionType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PostInteractionRepository extends JpaRepository<PostInteraction, Long> {
    Optional<PostInteraction> findByPostIdAndUserIdAndInteractionType(Long postId, Long userId, InteractionType type);
    Page<PostInteraction> findByPostIdAndInteractionTypeOrderByCreatedAtAsc(Long postId, InteractionType type, Pageable pageable);
    boolean existsByPostIdAndUserIdAndInteractionType(Long postId, Long userId, InteractionType type);
    void deleteByPostIdAndUserIdAndInteractionType(Long postId, Long userId, InteractionType type);

    @org.springframework.data.jpa.repository.Query("""
            SELECT interaction.post
            FROM PostInteraction interaction
            WHERE interaction.userId = :userId
              AND interaction.interactionType = iuh.fit.learning_service.enums.InteractionType.BOOKMARK
              AND interaction.post.status <> iuh.fit.learning_service.enums.PostStatus.HIDDEN
            """)
    Page<CommunityPost> findBookmarkedPosts(
            @org.springframework.data.repository.query.Param("userId") Long userId,
            Pageable pageable);
}
