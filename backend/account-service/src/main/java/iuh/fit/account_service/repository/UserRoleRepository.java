package iuh.fit.account_service.repository;

import iuh.fit.account_service.entity.UserRole;
import iuh.fit.account_service.enums.Role;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface UserRoleRepository extends JpaRepository<UserRole, Long> {

    List<UserRole> findByUserId(Long userId);

    boolean existsByUserIdAndRole(Long userId, Role role);
}
