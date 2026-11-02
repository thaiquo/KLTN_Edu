package iuh.fit.learning_service.repository;

import iuh.fit.learning_service.entity.CommunityPostPendingRevision;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Optional;
import java.util.Collection;
import java.util.List;

public interface CommunityPostPendingRevisionRepository extends JpaRepository<CommunityPostPendingRevision, Long> {
    List<CommunityPostPendingRevision> findAllByPostIdIn(Collection<Long> postIds);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from CommunityPostPendingRevision r where r.postId = :postId")
    Optional<CommunityPostPendingRevision> findByPostIdForUpdate(@Param("postId") Long postId);
}
