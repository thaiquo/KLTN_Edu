package iuh.fit.learning_service.repository;

import iuh.fit.learning_service.entity.TutorFollow;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TutorFollowRepository extends JpaRepository<TutorFollow, Long> {

    boolean existsByStudentUserIdAndTutorUserId(Long studentUserId, Long tutorUserId);

    Optional<TutorFollow> findByStudentUserIdAndTutorUserId(Long studentUserId, Long tutorUserId);

    long countByTutorUserId(Long tutorUserId);

    long countByStudentUserId(Long studentUserId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM TutorFollow f WHERE f.studentUserId = :studentUserId AND f.tutorUserId = :tutorUserId")
    int deleteByStudentUserIdAndTutorUserId(@Param("studentUserId") Long studentUserId, @Param("tutorUserId") Long tutorUserId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            INSERT INTO tutor_follows (student_user_id, tutor_user_id)
            VALUES (:studentUserId, :tutorUserId)
            ON CONFLICT (student_user_id, tutor_user_id) DO NOTHING
            """, nativeQuery = true)
    int insertIfAbsent(@Param("studentUserId") Long studentUserId, @Param("tutorUserId") Long tutorUserId);

    @Query("SELECT f.tutorUserId FROM TutorFollow f WHERE f.studentUserId = :studentUserId")
    List<Long> findFollowedTutorUserIdsByStudentUserId(@Param("studentUserId") Long studentUserId);

    List<TutorFollow> findByStudentUserIdOrderByCreatedAtDesc(Long studentUserId);

    Page<TutorFollow> findByTutorUserIdOrderByCreatedAtDesc(Long tutorUserId, Pageable pageable);
}
