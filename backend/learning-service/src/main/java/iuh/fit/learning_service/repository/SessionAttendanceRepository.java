package iuh.fit.learning_service.repository;

import iuh.fit.learning_service.entity.SessionAttendance;
import iuh.fit.learning_service.enums.AttendanceOutcome;
import iuh.fit.learning_service.enums.ClassSessionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SessionAttendanceRepository extends JpaRepository<SessionAttendance, Long> {

    List<SessionAttendance> findBySessionId(Long sessionId);

    Optional<SessionAttendance> findBySessionIdAndStudentId(Long sessionId, Long studentId);

    void deleteBySession_Id(Long sessionId);

    void deleteBySession_IdAndStudentId(Long sessionId, Long studentId);

    @Query("select count(a) from SessionAttendance a " +
            "where a.studentId = :studentId " +
            "and a.session.classRoom.id = :classRoomId " +
            "and a.session.status = :sessionStatus " +
            "and a.finalOutcome = :outcome")
    long countCompletedOutcomeForStudent(
            @Param("classRoomId") Long classRoomId,
            @Param("studentId") Long studentId,
            @Param("sessionStatus") ClassSessionStatus sessionStatus,
            @Param("outcome") AttendanceOutcome outcome);
}
