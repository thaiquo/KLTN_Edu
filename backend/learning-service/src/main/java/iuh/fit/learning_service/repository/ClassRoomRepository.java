package iuh.fit.learning_service.repository;

import iuh.fit.learning_service.entity.ClassRoom;
import iuh.fit.learning_service.enums.ClassRoomStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ClassRoomRepository extends JpaRepository<ClassRoom, Long>, JpaSpecificationExecutor<ClassRoom> {
    List<ClassRoom> findByTutorEmailIgnoreCaseOrderByCreatedAtDesc(String tutorEmail);

    List<ClassRoom> findByTutorEmailIgnoreCaseAndStatusOrderByCreatedAtDesc(String tutorEmail, ClassRoomStatus status);

    @Query("SELECT c FROM ClassRoom c " +
           "LEFT JOIN FETCH c.tutorSubjectRegistration r " +
           "LEFT JOIN FETCH r.subject " +
           "LEFT JOIN FETCH c.level " +
           "WHERE c.id = :id")
    Optional<ClassRoom> findByIdWithDetails(@Param("id") Long id);

    @Query("SELECT c FROM ClassRoom c " +
           "LEFT JOIN FETCH c.tutorSubjectRegistration r " +
           "LEFT JOIN FETCH r.subject " +
           "LEFT JOIN FETCH c.level " +
           "WHERE c.publicShareId = :publicShareId")
    Optional<ClassRoom> findByPublicShareIdWithDetails(@Param("publicShareId") UUID publicShareId);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM ClassRoom c WHERE c.id = :id")
    Optional<ClassRoom> findByIdForUpdate(@Param("id") Long id);

    @Query("SELECT c FROM ClassRoom c " +
           "LEFT JOIN FETCH c.tutorSubjectRegistration r " +
           "LEFT JOIN FETCH r.subject " +
           "LEFT JOIN FETCH c.level " +
           "WHERE lower(c.tutorEmail) = lower(:tutorEmail) " +
           "ORDER BY c.createdAt DESC")
    List<ClassRoom> findByTutorEmailWithDetails(@Param("tutorEmail") String tutorEmail);

    @Query("SELECT c FROM ClassRoom c " +
           "LEFT JOIN FETCH c.tutorSubjectRegistration r " +
           "LEFT JOIN FETCH r.subject " +
           "LEFT JOIN FETCH c.level " +
           "ORDER BY c.createdAt DESC")
    List<ClassRoom> findAllWithDetails();

    @Override
    @EntityGraph(attributePaths = {"tutorSubjectRegistration", "tutorSubjectRegistration.subject", "level"})
    Page<ClassRoom> findAll(Specification<ClassRoom> specification, Pageable pageable);

    long countByStatus(ClassRoomStatus status);

    long countByTutorEmailIgnoreCase(String tutorEmail);

    long countByTutorEmailIgnoreCaseAndStatus(String tutorEmail, ClassRoomStatus status);
}
