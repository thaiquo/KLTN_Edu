package iuh.fit.account_service.repository;

import iuh.fit.account_service.entity.UserRole;
import iuh.fit.account_service.enums.AccountStatus;
import iuh.fit.account_service.enums.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface UserRoleRepository extends JpaRepository<UserRole, Long> {

    List<UserRole> findByUserId(Long userId);

    boolean existsByUserIdAndRole(Long userId, Role role);

    @Query("""
            select distinct ur.user.id
              from UserRole ur
             where ur.role = :role
               and ur.user.accountStatus = :status
            """)
    List<Long> findUserIdsByRoleAndAccountStatus(
            @Param("role") Role role,
            @Param("status") AccountStatus status
    );
}
