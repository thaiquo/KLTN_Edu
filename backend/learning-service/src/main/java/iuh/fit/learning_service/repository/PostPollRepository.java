package iuh.fit.learning_service.repository;

import iuh.fit.learning_service.entity.PostPoll;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import jakarta.persistence.LockModeType;

import java.util.Optional;

@Repository
public interface PostPollRepository extends JpaRepository<PostPoll, Long> {
    Optional<PostPoll> findByPostId(Long postId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM PostPoll p JOIN FETCH p.post WHERE p.id = :id")
    Optional<PostPoll> findByIdForUpdate(@Param("id") Long id);
}
