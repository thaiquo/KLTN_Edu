package iuh.fit.account_service.modules.tutor.repository;

import iuh.fit.account_service.modules.tutor.entity.Certificate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;
import java.util.Optional;

public interface CertificateRepository extends JpaRepository<Certificate, UUID> {
    Optional<Certificate> findByIdAndTutorApplication_User_Id(UUID id, UUID userId);
    Optional<Certificate> findByIdAndTutorApplication_Id(UUID id, UUID applicationId);
}
