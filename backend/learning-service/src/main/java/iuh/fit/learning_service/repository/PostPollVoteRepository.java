package iuh.fit.learning_service.repository;

import iuh.fit.learning_service.entity.PostPollVote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PostPollVoteRepository extends JpaRepository<PostPollVote, Long> {
    Optional<PostPollVote> findByPollIdAndUserId(Long pollId, Long userId);
    List<PostPollVote> findByPollId(Long pollId);
    List<PostPollVote> findByOptionId(Long optionId);
    boolean existsByPollIdAndUserId(Long pollId, Long userId);
}
