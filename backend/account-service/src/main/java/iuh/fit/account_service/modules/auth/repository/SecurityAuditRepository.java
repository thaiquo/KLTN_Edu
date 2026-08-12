package iuh.fit.account_service.modules.auth.repository;

import iuh.fit.account_service.modules.auth.entity.SecurityAudit;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface SecurityAuditRepository extends JpaRepository<SecurityAudit, UUID> {
}