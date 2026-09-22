package iuh.fit.account_service.service;

import iuh.fit.account_service.enums.AccountStatus;
import iuh.fit.account_service.enums.Role;
import iuh.fit.account_service.repository.UserRoleRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class StaffNotificationRecipientResolver {
    private final UserRoleRepository userRoleRepository;

    public StaffNotificationRecipientResolver(UserRoleRepository userRoleRepository) {
        this.userRoleRepository = userRoleRepository;
    }

    public List<Long> activeStaffUserIds() {
        return userRoleRepository.findUserIdsByRoleAndAccountStatus(Role.STAFF, AccountStatus.ACTIVE);
    }
}
