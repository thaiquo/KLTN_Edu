package iuh.fit.account_service.modules.role.repository;

import iuh.fit.account_service.modules.role.entity.UserRole;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRoleRepository extends JpaRepository<UserRole, Long> {
}
