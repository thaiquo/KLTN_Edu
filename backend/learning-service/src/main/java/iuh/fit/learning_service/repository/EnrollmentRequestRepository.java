package iuh.fit.learning_service.repository;

import iuh.fit.learning_service.entity.EnrollmentRequest;
import iuh.fit.learning_service.enums.EnrollmentRequestStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface EnrollmentRequestRepository extends JpaRepository<EnrollmentRequest, Long> {

    long countByClassRoomIdAndStatus(Long classRoomId, EnrollmentRequestStatus status);

    long countByClassRoomIdAndStatusIn(Long classRoomId, Collection<EnrollmentRequestStatus> statuses);

    boolean existsByClassRoomIdAndStudentEmailIgnoreCaseAndStatusIn(
            Long classRoomId,
            String studentEmail,
            Collection<EnrollmentRequestStatus> statuses
    );

    @Query("SELECT r FROM EnrollmentRequest r " +
           "JOIN FETCH r.classRoom c " +
           "WHERE c.id = :classRoomId " +
           "ORDER BY r.createdAt DESC")
    List<EnrollmentRequest> findByClassRoomIdWithDetails(@Param("classRoomId") Long classRoomId);

    @Query("SELECT r FROM EnrollmentRequest r " +
           "JOIN FETCH r.classRoom c " +
           "WHERE lower(r.studentEmail) = lower(:studentEmail) " +
           "ORDER BY r.createdAt DESC")
    List<EnrollmentRequest> findByStudentEmailWithDetails(@Param("studentEmail") String studentEmail);

    @Query("SELECT r FROM EnrollmentRequest r " +
           "JOIN FETCH r.classRoom c " +
           "WHERE lower(c.tutorEmail) = lower(:tutorEmail) " +
           "ORDER BY r.createdAt DESC")
    List<EnrollmentRequest> findByTutorEmailWithDetails(@Param("tutorEmail") String tutorEmail);

    List<EnrollmentRequest> findByClassRoomIdAndStatus(Long classRoomId, EnrollmentRequestStatus status);

    Optional<EnrollmentRequest> findByAgreementId(String agreementId);

    Optional<EnrollmentRequest> findFirstByClassRoomIdAndStudentIdAndStatusInOrderByCreatedAtDesc(
            Long classRoomId, Long studentId, Collection<EnrollmentRequestStatus> statuses);
}
