package iuh.fit.account_service.config;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

class DevelopmentStaffSeedMigrationTest {

    @Test
    void developmentStaffSeedForcesStaffOnlyRolesForKnownAccounts() throws Exception {
        String sql = Files.readString(Path.of("src/main/resources/db/migration/V10__seed_development_staff_accounts.sql"));

        assertThat(sql).contains(
                "tanthinh@gmail.com",
                "quocthai@gmail.com",
                "tanquoc@gmail.com",
                "role_row.role <> 'STAFF'",
                "INSERT INTO user_roles (user_id, role)",
                "'STAFF'"
        );
        assertThat(sql).doesNotContain("staff_users");
        assertThat(sql).doesNotContain("'12345678'");
        assertThat(sql).doesNotContain("role) VALUES ('STUDENT'");
    }
}
