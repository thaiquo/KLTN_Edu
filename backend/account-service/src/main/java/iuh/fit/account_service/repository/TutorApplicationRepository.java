package iuh.fit.account_service.repository;

import iuh.fit.account_service.entity.TutorApplication;
import iuh.fit.account_service.enums.TutorApplicationStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface TutorApplicationRepository extends JpaRepository<TutorApplication, Long>, JpaSpecificationExecutor<TutorApplication> {

    Optional<TutorApplication> findByUserId(Long userId);

    boolean existsByUserId(Long userId);

    List<TutorApplication> findByStatus(TutorApplicationStatus status);

    List<TutorApplication> findByUserIdIn(List<Long> userIds);

    @EntityGraph(attributePaths = {"user", "reviewedBy"})
    Page<TutorApplication> findByStatus(TutorApplicationStatus status, Pageable pageable);

    @EntityGraph(attributePaths = {"user", "reviewedBy"})
    Page<TutorApplication> findByStatusIn(Collection<TutorApplicationStatus> statuses, Pageable pageable);

    @EntityGraph(attributePaths = {"user", "reviewedBy"})
    Page<TutorApplication> findByReviewedByIdAndStatusIn(Long reviewedById,
                                                         Collection<TutorApplicationStatus> statuses,
                                                         Pageable pageable);

    @Override
    @EntityGraph(attributePaths = {"user", "reviewedBy"})
    Page<TutorApplication> findAll(Specification<TutorApplication> specification, Pageable pageable);

    List<TutorApplication> findByStatusInOrderByReviewedAtDesc(Collection<TutorApplicationStatus> statuses);

    List<TutorApplication> findByReviewedByIdAndStatusInOrderByReviewedAtDesc(Long reviewedById, Collection<TutorApplicationStatus> statuses);
}
