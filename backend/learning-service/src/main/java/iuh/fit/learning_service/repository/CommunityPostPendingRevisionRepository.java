package iuh.fit.learning_service.repository;

import iuh.fit.learning_service.entity.CommunityPostPendingRevision;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Optional;

public interface CommunityPostPendingRevisionRepository extends JpaRepository<CommunityPostPendingRevision, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from CommunityPostPendingRevision r where r.postId = :postId")
    Optional<CommunityPostPendingRevision> findByPostIdForUpdate(@Param("postId") Long postId);
}
