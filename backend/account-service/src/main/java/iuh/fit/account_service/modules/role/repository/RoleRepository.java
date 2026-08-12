package iuh.fit.account_service.modules.role.repository;

import iuh.fit.account_service.modules.role.entity.RoleEntity;
import iuh.fit.account_service.shared.enums.Role;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface RoleRepository extends JpaRepository<RoleEntity, Long> {
    Optional<RoleEntity> findByName(Role name);
}
