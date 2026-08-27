package iuh.fit.contract_service.repository;

import iuh.fit.contract_service.entity.EscrowPayment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface EscrowPaymentRepository extends JpaRepository<EscrowPayment, UUID> {
    Optional<EscrowPayment> findByAgreementId(UUID agreementId);
}
