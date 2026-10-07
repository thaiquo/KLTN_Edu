package iuh.fit.contract_service.repository;

import iuh.fit.contract_service.entity.EscrowPayment;
import iuh.fit.contract_service.enums.EscrowPaymentStatus;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface EscrowPaymentRepository extends JpaRepository<EscrowPayment, UUID> {
    Optional<EscrowPayment> findByAgreementId(UUID agreementId);

    List<EscrowPayment> findByStatusAndFundTxHashIsNotNull(EscrowPaymentStatus status, Pageable pageable);
}
