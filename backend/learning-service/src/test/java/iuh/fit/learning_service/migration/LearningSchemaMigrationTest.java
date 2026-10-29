package iuh.fit.learning_service.migration;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;

import java.time.OffsetDateTime;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class LearningSchemaMigrationTest {
    private static JdbcTemplate jdbc;
    private static Connection keepAlive;

    @BeforeAll
    static void migrateFreshSchema() throws SQLException {
        String url = "jdbc:h2:mem:learning_schema_migration;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE";
        keepAlive = DriverManager.getConnection(url, "sa", "");
        var dataSource = new DriverManagerDataSource(url, "sa", "");
        jdbc = new JdbcTemplate(dataSource);
        jdbc.execute("""
                CREATE TABLE class_sessions (
                    id BIGINT PRIMARY KEY,
                    sequence_number INTEGER NOT NULL
                )
                """);
        new ResourceDatabasePopulator(
                new ClassPathResource("db/migration/V17__absence_governance_safety.sql"),
                new ClassPathResource("db/migration/V18__command_inbox_class_cancelled.sql"))
                .populate(keepAlive);
    }

    @AfterAll
    static void closeDatabase() throws SQLException {
        keepAlive.close();
    }

    @Test
    void v17AndV18CreatesGovernanceColumnsAndCommandInboxWithClassCancelled() {
        Integer columns = jdbc.queryForObject("""
                SELECT COUNT(*) FROM information_schema.columns
                 WHERE table_name = 'class_sessions'
                   AND column_name IN (
                       'attendance_finalized_at',
                       'governance_next_session_sequence',
                       'governance_next_session_start_at',
                       'governance_snapshot_captured_at'
                   )
                """, Integer.class);
        assertEquals(4, columns);

        Integer inbox = jdbc.queryForObject("""
                SELECT COUNT(*) FROM information_schema.tables
                 WHERE table_name = 'learning_termination_command_inbox'
                """, Integer.class);
        assertEquals(1, inbox);

        Integer classCancelledCol = jdbc.queryForObject("""
                SELECT COUNT(*) FROM information_schema.columns
                 WHERE table_name = 'learning_termination_command_inbox'
                   AND column_name = 'class_cancelled'
                """, Integer.class);
        assertEquals(1, classCancelledCol);
    }

    @Test
    void commandInboxEnforcesIdempotencyAndLifecycleShape() {
        UUID commandId = UUID.randomUUID();
        insertInbox(UUID.randomUUID(), commandId, "HOLD", 3, "a".repeat(64));

        assertThrows(DataIntegrityViolationException.class,
                () -> insertInbox(UUID.randomUUID(), commandId, "HOLD", 3, "b".repeat(64)));
        assertThrows(DataIntegrityViolationException.class,
                () -> insertInbox(UUID.randomUUID(), UUID.randomUUID(), "UNKNOWN", 3, "c".repeat(64)));
        assertThrows(DataIntegrityViolationException.class,
                () -> insertInbox(UUID.randomUUID(), UUID.randomUUID(), "HOLD", -1, "d".repeat(64)));
        assertThrows(DataIntegrityViolationException.class,
                () -> insertInbox(UUID.randomUUID(), UUID.randomUUID(), "HOLD", 3, "short"));
    }

    private static void insertInbox(UUID id, UUID commandId, String action, int cutoff, String hash) {
        jdbc.update("""
                INSERT INTO learning_termination_command_inbox (
                    id, command_id, action, classroom_id, agreement_id, cutoff_session,
                    payload_hash, status, required_session_sequences_csv, created_at, updated_at
                ) VALUES (?, ?, ?, 100, ?, ?, ?, 'COMPLETED', '1,2,3', ?, ?)
                """, id, commandId, action, UUID.randomUUID().toString(), cutoff, hash,
                OffsetDateTime.now(), OffsetDateTime.now());
    }
}
