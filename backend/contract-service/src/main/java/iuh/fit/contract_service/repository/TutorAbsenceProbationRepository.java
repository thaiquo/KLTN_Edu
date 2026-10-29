package iuh.fit.contract_service.repository;

import iuh.fit.contract_service.entity.TutorAbsenceProbation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TutorAbsenceProbationRepository extends JpaRepository<TutorAbsenceProbation, UUID> {
    Optional<TutorAbsenceProbation> findBySourceCaseId(UUID sourceCaseId);

    List<TutorAbsenceProbation> findByClassroomIdAndStatus(Long classroomId, String status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM TutorAbsenceProbation p WHERE p.classroomId = :classroomId AND p.status = 'ACTIVE'")
    Optional<TutorAbsenceProbation> findActiveByClassroomIdForUpdate(@Param("classroomId") Long classroomId);

    Optional<TutorAbsenceProbation> findByClassroomIdAndSessionSequence(Long classroomId, Integer sessionSequence);

    List<TutorAbsenceProbation> findByStatus(String status);
}
