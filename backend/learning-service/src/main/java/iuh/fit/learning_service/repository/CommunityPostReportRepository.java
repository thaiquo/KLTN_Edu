package iuh.fit.learning_service.repository;

import iuh.fit.learning_service.entity.CommunityPostReport;
import iuh.fit.learning_service.enums.CommunityReportStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

public interface CommunityPostReportRepository extends JpaRepository<CommunityPostReport, Long> {
    boolean existsByPostIdAndReporterUserIdAndStatus(Long postId, Long reporterUserId, CommunityReportStatus status);
    List<CommunityPostReport> findByPostIdOrderByCreatedAtAscIdAsc(Long postId);
    @Query("SELECT r.post.id, COUNT(r) FROM CommunityPostReport r WHERE r.status = 'OPEN' AND r.post.id IN :postIds GROUP BY r.post.id")
    List<Object[]> countOpenByPostIds(@Param("postIds") Collection<Long> postIds);
    @Modifying
    @Query("UPDATE CommunityPostReport r SET r.status = :status, r.resolvedByUserId = :actorId, r.resolvedByRole = :role, r.resolvedAt = :at WHERE r.post.id = :postId AND r.status = 'OPEN'")
    int resolveOpen(@Param("postId") Long postId, @Param("status") CommunityReportStatus status,
                    @Param("actorId") Long actorId, @Param("role") String role, @Param("at") LocalDateTime at);
}
