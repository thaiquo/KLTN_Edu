package iuh.fit.learning_service.repository;

import iuh.fit.learning_service.entity.SessionAttendance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SessionAttendanceRepository extends JpaRepository<SessionAttendance, Long> {

    List<SessionAttendance> findBySessionId(Long sessionId);

    Optional<SessionAttendance> findBySessionIdAndStudentId(Long sessionId, Long studentId);

    List<SessionAttendance> findByStudentId(Long studentId);

    long countBySessionIdAndStudentCheckedTrue(Long sessionId);
}
