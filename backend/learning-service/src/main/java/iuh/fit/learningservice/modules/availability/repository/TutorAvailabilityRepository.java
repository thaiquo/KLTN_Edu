package iuh.fit.learningservice.modules.availability.repository;

import iuh.fit.learningservice.modules.availability.entity.TutorAvailability;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface TutorAvailabilityRepository extends JpaRepository<TutorAvailability, UUID> {

    List<TutorAvailability> findByTutorIdOrderByDayOfWeekAscStartTimeAsc(UUID tutorId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select availability from TutorAvailability availability " +
        "where availability.tutorId = :tutorId order by availability.dayOfWeek, availability.startTime")
    List<TutorAvailability> findByTutorIdForUpdate(@Param("tutorId") UUID tutorId);
}
