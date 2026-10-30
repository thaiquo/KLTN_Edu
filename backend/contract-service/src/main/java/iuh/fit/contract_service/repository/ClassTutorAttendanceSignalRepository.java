package iuh.fit.contract_service.repository;

import iuh.fit.contract_service.entity.ClassTutorAttendanceSignal;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ClassTutorAttendanceSignalRepository extends JpaRepository<ClassTutorAttendanceSignal, UUID> {
    Optional<ClassTutorAttendanceSignal> findBySourceEventId(String sourceEventId);

    Optional<ClassTutorAttendanceSignal> findByClassroomIdAndSessionSequence(Long classroomId, Integer sessionSequence);

    Optional<ClassTutorAttendanceSignal> findByClassroomIdAndLearningSessionId(Long classroomId, Long learningSessionId);

    List<ClassTutorAttendanceSignal> findByClassroomIdOrderBySessionSequenceAsc(Long classroomId);

    List<ClassTutorAttendanceSignal> findByClassroomIdOrderBySessionSequenceDesc(Long classroomId);
}
