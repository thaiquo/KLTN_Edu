package iuh.fit.learning_service.repository;

import iuh.fit.learning_service.entity.ClassSchedule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ClassScheduleRepository extends JpaRepository<ClassSchedule, Long> {
    List<ClassSchedule> findByClassRoomIdOrderByDayOfWeekAscStartTimeAsc(Long classRoomId);
    void deleteByClassRoomId(Long classRoomId);
}
