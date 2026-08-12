package iuh.fit.account_service.modules.role.repository;

import iuh.fit.account_service.modules.role.entity.LegacyUserRole;
import iuh.fit.account_service.modules.role.enums.LegacyRole;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.NoRepositoryBean;

import java.util.List;

@NoRepositoryBean
public interface LegacyUserRoleRepository extends JpaRepository<LegacyUserRole, Long> {

    List<LegacyUserRole> findByUserId(Long userId);

    boolean existsByUserIdAndRole(Long userId, LegacyRole role);
}
