package iuh.fit.learning_service.repository;

import iuh.fit.learning_service.entity.TutorReview;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface TutorReviewRepository extends JpaRepository<TutorReview, Long> {
    Optional<TutorReview> findByStudentIdAndClassRoomId(Long studentId, Long classRoomId);

    boolean existsByStudentIdAndClassRoomId(Long studentId, Long classRoomId);

    Page<TutorReview> findByTutorIdOrderByCreatedAtDesc(Long tutorId, Pageable pageable);

    @Query("select avg(r.rating) from TutorReview r where r.tutorId = :tutorId")
    Double averageRatingByTutorId(@Param("tutorId") Long tutorId);

    long countByTutorId(Long tutorId);

    @Query("select r.tutorId as tutorId, avg(r.rating) as averageRating, count(r) as reviewCount " +
            "from TutorReview r where r.tutorId in :tutorIds group by r.tutorId")
    List<TutorRatingSummaryRow> summarizeByTutorIds(@Param("tutorIds") Collection<Long> tutorIds);

    interface TutorRatingSummaryRow {
        Long getTutorId();
        Double getAverageRating();
        Long getReviewCount();
    }
}
