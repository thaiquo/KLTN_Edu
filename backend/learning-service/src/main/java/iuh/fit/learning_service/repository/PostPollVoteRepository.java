package iuh.fit.learning_service.repository;

import iuh.fit.learning_service.entity.PostPollVote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PostPollVoteRepository extends JpaRepository<PostPollVote, Long> {
    List<PostPollVote> findByPollIdAndUserId(Long pollId, Long userId);
    Optional<PostPollVote> findByPollIdAndOptionIdAndUserId(Long pollId, Long optionId, Long userId);
    @Query("select vote from PostPollVote vote join fetch vote.option where vote.poll.id = :pollId")
    List<PostPollVote> findByPollId(@Param("pollId") Long pollId);
    List<PostPollVote> findByOptionId(Long optionId);
    boolean existsByPollIdAndUserId(Long pollId, Long userId);
    boolean existsByPollIdAndOptionIdAndUserId(Long pollId, Long optionId, Long userId);
    long countByPollIdAndUserId(Long pollId, Long userId);
    @Query("select count(distinct vote.userId) from PostPollVote vote where vote.poll.id = :pollId")
    long countDistinctUsersByPollId(@Param("pollId") Long pollId);
}
