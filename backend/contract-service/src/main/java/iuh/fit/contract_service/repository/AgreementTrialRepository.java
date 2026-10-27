package iuh.fit.contract_service.repository;

import iuh.fit.contract_service.entity.AgreementTrial;
import iuh.fit.contract_service.enums.TrialStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AgreementTrialRepository extends JpaRepository<AgreementTrial, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from AgreementTrial t where t.agreementId = :agreementId")
    Optional<AgreementTrial> lockByAgreementId(@Param("agreementId") UUID agreementId);

    Optional<AgreementTrial> findByAgreementId(UUID agreementId);

    List<AgreementTrial> findTop50ByStatusAndTrialDeadlineLessThanEqualOrderByTrialDeadlineAsc(
            TrialStatus status,
            OffsetDateTime deadline);
}
