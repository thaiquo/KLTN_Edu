package iuh.fit.learning_service.repository;

import iuh.fit.learning_service.entity.CommunityPost;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import jakarta.persistence.LockModeType;

@Repository
public interface CommunityPostRepository extends JpaRepository<CommunityPost, Long>, JpaSpecificationExecutor<CommunityPost> {

    List<CommunityPost> findByAuthorIdAndAuthorRoleOrderByCreatedAtDesc(Long authorId, String authorRole);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM CommunityPost p LEFT JOIN FETCH p.poll WHERE p.id = :id")
    Optional<CommunityPost> findByIdForUpdate(@Param("id") Long id);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE CommunityPost p SET p.viewCount = p.viewCount + 1 " +
            "WHERE p.id = :id AND p.status <> iuh.fit.learning_service.enums.PostStatus.HIDDEN")
    int incrementViewCount(@Param("id") Long id);
}
