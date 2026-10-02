package iuh.fit.contract_service.service;

import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.core.io.ClassPathResource;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.*;
import static org.assertj.core.api.Assertions.*;

class TerminationNotificationOutboxTest {
    JdbcTemplate jdbc;
    TerminationNotificationOutbox outbox;
    TransactionTemplate transaction;
    HttpServer server;
    List<String> received = new ArrayList<>();
    int responseStatus = 503;
    @BeforeEach void setup() throws Exception {
        var ds = new DriverManagerDataSource("jdbc:h2:mem:" + UUID.randomUUID() + ";MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1", "sa", "");
        jdbc = new JdbcTemplate(ds);
        new ResourceDatabasePopulator(new ClassPathResource("db/migration/V18__termination_notification_outbox.sql")).execute(ds);
        jdbc.execute("CREATE TABLE contract_agreement(id UUID PRIMARY KEY,classroom_reviewer_email VARCHAR(255))");
        jdbc.execute("CREATE TABLE termination_case(id UUID PRIMARY KEY,anchor_agreement_id UUID,origin VARCHAR(40),status VARCHAR(40),tutor_responded_at TIMESTAMP WITH TIME ZONE,response_deadline TIMESTAMP WITH TIME ZONE)");
        var manager = new DataSourceTransactionManager(ds);
        transaction = new TransactionTemplate(manager);
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/api/notifications/internal/send", exchange -> {
            var serviceToken = exchange.getRequestHeaders().getFirst("X-Service-Token");
            var claims = io.jsonwebtoken.Jwts.parser()
                    .verifyWith(io.jsonwebtoken.security.Keys.hmacShaKeyFor(
                            "test-notification-secret-with-at-least-256-bits".getBytes(StandardCharsets.UTF_8)))
                    .build().parseSignedClaims(serviceToken).getPayload();
            if (!"contract-service".equals(claims.getSubject())
                    || !"notification-send".equals(claims.get("serviceScope", String.class))) {
                exchange.sendResponseHeaders(401, -1); exchange.close(); return;
            }
            received.add(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            exchange.sendResponseHeaders(responseStatus, -1); exchange.close();
        });
        server.createContext("/api/internal/notification-reviewers", exchange -> {
            byte[] body = "[{\"recipientId\":4,\"targetRole\":\"STAFF\"},{\"recipientId\":1,\"targetRole\":\"ADMIN\"}]".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, body.length); exchange.getResponseBody().write(body); exchange.close();
        });
        server.start();
        String url = "http://127.0.0.1:" + server.getAddress().getPort();
        outbox = new TerminationNotificationOutbox(jdbc, new ObjectMapper(), manager, url, url,
                "test-notification-secret-with-at-least-256-bits");
    }
    @AfterEach void cleanup() { server.stop(0); }
    TerminationNotificationOutbox.Intent intent() {
        return new TerminationNotificationOutbox.Intent(2L,null,"Hủy lớp","Đã có quyết định", "TERMINATION_UPDATED","AGREEMENT",UUID.randomUUID().toString());
    }
    @Test void rolledBackBusinessChangeDoesNotSendNotification() {
        transaction.executeWithoutResult(status -> { outbox.enqueue("rollback",intent()); status.setRollbackOnly(); });
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM termination_notification_outbox",Integer.class)).isZero();
        outbox.deliver(); assertThat(received).isEmpty();
    }
    @Test void unavailableReceiverRetriesWithSameEventAndDeliveredIntentIsNotSentAgain() {
        outbox.enqueue("stable-event",intent()); outbox.enqueue("stable-event",intent());
        outbox.deliver(); // snapshot recipients
        outbox.deliver(); // HTTP 503
        assertThat(jdbc.queryForObject("SELECT attempts FROM termination_notification_outbox",Integer.class)).isEqualTo(1);
        responseStatus = 200;
        jdbc.update("UPDATE termination_notification_outbox SET next_attempt_at=CURRENT_TIMESTAMP");
        outbox.deliver(); outbox.deliver();
        assertThat(received).hasSize(2);
        assertThat(received.get(0)).isEqualTo(received.get(1)).contains("stable-event");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM termination_notification_outbox WHERE delivered_at IS NOT NULL",Integer.class)).isEqualTo(1);
    }
    @Test void expiredDeadlineNotifiesAssignedStaffAndAdminOnceAcrossRepeatedScans() {
        UUID agreement = UUID.randomUUID(), caseId = UUID.randomUUID();
        jdbc.update("INSERT INTO contract_agreement VALUES (?,?)", agreement, "staff@test");
        jdbc.update("INSERT INTO termination_case VALUES (?,?, 'AUTO_TUTOR_ABSENCE','REQUESTED',NULL,?)",
                caseId, agreement, java.time.OffsetDateTime.now().minusHours(1));
        responseStatus = 200;
        outbox.deliver(); outbox.deliver(); outbox.deliver();
        assertThat(received).hasSize(2);
        assertThat(received.get(0)).contains("STAFF", "TERMINATION_DEADLINE_EXPIRED");
        assertThat(received.get(1)).contains("ADMIN", "TERMINATION_DEADLINE_EXPIRED");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM termination_notification_outbox",Integer.class)).isEqualTo(1);
    }
    @Test void legacyAbsenceMigrationPreservesClosedHistoryAndRestartsOpenWarningHold() {
        jdbc.execute("ALTER TABLE termination_case ADD COLUMN detection_key VARCHAR(255)");
        jdbc.execute("ALTER TABLE termination_case ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE");
        for (String state : List.of("REQUESTED", "COMPLETED", "REJECTED")) {
            jdbc.update("INSERT INTO termination_case(id,origin,status,detection_key) VALUES (?,'PARTY_REQUEST',?,?)",
                    UUID.randomUUID(),state,"TUTOR_ABSENT:1:"+state);
        }
        new ResourceDatabasePopulator(new ClassPathResource("db/migration/V19__classify_existing_system_terminations.sql"))
                .execute(Objects.requireNonNull(jdbc.getDataSource()));
        assertThat(jdbc.queryForList("SELECT status FROM termination_case",String.class))
                .containsExactlyInAnyOrder("HOLD_PENDING","COMPLETED","REJECTED");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM termination_case WHERE origin='AUTO_TUTOR_ABSENCE'",Integer.class)).isEqualTo(3);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM termination_case WHERE response_deadline IS NOT NULL",Integer.class)).isZero();
    }
}
