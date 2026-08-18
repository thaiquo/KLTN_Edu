package iuh.fit.learning_service.repository;

import iuh.fit.learning_service.entity.TutorAvailability;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TutorAvailabilityRepository extends JpaRepository<TutorAvailability, Long> {
    List<TutorAvailability> findByTutorEmailIgnoreCaseOrderByDayOfWeekAscStartTimeAsc(String tutorEmail);

    void deleteByTutorEmailIgnoreCase(String tutorEmail);
}
