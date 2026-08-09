package iuh.fit.authservice.modules.auth.repository;

import iuh.fit.authservice.modules.auth.entity.SecurityAudit;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface SecurityAuditRepository extends JpaRepository<SecurityAudit, UUID> {
}