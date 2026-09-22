package iuh.fit.learning_service.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class StaffNotificationRecipientLookup {
    private final JdbcTemplate jdbc;

    public StaffNotificationRecipientLookup(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<Long> activeStaffUserIds() {
        if (!tableExists("users") || !tableExists("user_roles")) {
            return List.of();
        }

        return jdbc.query("""
                SELECT DISTINCT account_user.id
                  FROM users account_user
                  JOIN user_roles role ON role.user_id = account_user.id
                 WHERE role.role = 'STAFF'
                   AND account_user.account_status = 'ACTIVE'
                 ORDER BY account_user.id
                """, (rs, rowNum) -> rs.getLong(1));
    }

    public List<Long> activeStaffUserIdsExcludingUserId(Long excludedUserId) {
        return activeStaffUserIds().stream()
                .filter(userId -> userId != null && !userId.equals(excludedUserId))
                .toList();
    }

    public List<Long> activeStaffUserIdsExcludingEmail(String excludedEmail) {
        if (!tableExists("users") || !tableExists("user_roles")) {
            return List.of();
        }

        if (excludedEmail == null || excludedEmail.isBlank()) {
            return activeStaffUserIds();
        }

        return jdbc.query("""
                SELECT DISTINCT account_user.id
                  FROM users account_user
                  JOIN user_roles role ON role.user_id = account_user.id
                 WHERE role.role = 'STAFF'
                   AND account_user.account_status = 'ACTIVE'
                   AND lower(account_user.email) <> lower(?)
                 ORDER BY account_user.id
                """, (rs, rowNum) -> rs.getLong(1), excludedEmail.trim());
    }

    private boolean tableExists(String tableName) {
        Boolean exists = jdbc.queryForObject("SELECT to_regclass(?) IS NOT NULL", Boolean.class, "public." + tableName);
        return Boolean.TRUE.equals(exists);
    }
}
