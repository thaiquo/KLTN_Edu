package iuh.fit.learning_service.repository;

import iuh.fit.learning_service.entity.PostPollOption;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PostPollOptionRepository extends JpaRepository<PostPollOption, Long> {
    List<PostPollOption> findByPollIdOrderByDayOfWeekAscStartTimeAsc(Long pollId);
}
