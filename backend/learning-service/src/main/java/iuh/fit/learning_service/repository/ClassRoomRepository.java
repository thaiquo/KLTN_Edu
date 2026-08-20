package iuh.fit.learning_service.repository;

import iuh.fit.learning_service.entity.ClassRoom;
import iuh.fit.learning_service.enums.ClassRoomStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ClassRoomRepository extends JpaRepository<ClassRoom, Long> {
    List<ClassRoom> findByTutorEmailIgnoreCaseOrderByCreatedAtDesc(String tutorEmail);

    List<ClassRoom> findByTutorEmailIgnoreCaseAndStatusOrderByCreatedAtDesc(String tutorEmail, ClassRoomStatus status);

    @Query("SELECT c FROM ClassRoom c " +
           "LEFT JOIN FETCH c.tutorSubjectRegistration r " +
           "LEFT JOIN FETCH r.subject " +
           "LEFT JOIN FETCH c.level " +
           "WHERE c.id = :id")
    Optional<ClassRoom> findByIdWithDetails(@Param("id") Long id);

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

    long countByStatus(ClassRoomStatus status);

    long countByTutorEmailIgnoreCase(String tutorEmail);

    long countByTutorEmailIgnoreCaseAndStatus(String tutorEmail, ClassRoomStatus status);
}
