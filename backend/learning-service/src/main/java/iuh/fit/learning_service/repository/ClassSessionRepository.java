package iuh.fit.learning_service.repository;

import iuh.fit.learning_service.entity.ClassSession;
import iuh.fit.learning_service.enums.ClassSessionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface ClassSessionRepository extends JpaRepository<ClassSession, Long> {

    List<ClassSession> findByClassRoomIdOrderBySequenceNumberAsc(Long classRoomId);

    Optional<ClassSession> findByClassRoomIdAndSequenceNumber(Long classRoomId, Integer sequenceNumber);

    long countByClassRoomId(Long classRoomId);

    List<ClassSession> findByClassRoomIdAndStatus(Long classRoomId, ClassSessionStatus status);

    @Query("SELECT s FROM ClassSession s WHERE s.classRoom.id = :classRoomId AND s.sessionDate = :date")
    List<ClassSession> findByClassRoomIdAndDate(@Param("classRoomId") Long classRoomId, @Param("date") LocalDate date);

    @Query("SELECT MAX(s.sequenceNumber) FROM ClassSession s WHERE s.classRoom.id = :classRoomId")
    Integer findMaxSequenceNumberByClassRoomId(@Param("classRoomId") Long classRoomId);
}
