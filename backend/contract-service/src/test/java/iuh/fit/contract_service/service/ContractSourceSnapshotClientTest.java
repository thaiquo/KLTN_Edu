package iuh.fit.contract_service.service;

import iuh.fit.contract_service.api.ContractManagementController.InitiateAgreementRequest;
import iuh.fit.contract_service.config.security.ContractUserPrincipal;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ContractSourceSnapshotClientTest {
    private final ContractSourceSnapshotClient client = new ContractSourceSnapshotClient("http://localhost:1",
            "http://localhost:2", "a-secret-that-is-at-least-32-bytes-long");
    private final ContractUserPrincipal actor = new ContractUserPrincipal(7L, "tutor@example.com", "TUTOR", List.of("TUTOR"));

    @Test
    void ignoresSpoofedWalletAndPriceFromClient() {
        var sanitized = client.authoritative(intent(), actor, tutor(), student(), classroom());
        assertThat(sanitized.tutorWallet()).isEqualTo("0x1111111111111111111111111111111111111111");
        assertThat(sanitized.studentWallet()).isEqualTo("0x2222222222222222222222222222222222222222");
        assertThat(sanitized.pricePerSessionVnd()).isEqualByComparingTo("120000");
        assertThat(sanitized.studentEmail()).isEqualTo("student@example.com");
    }

    @Test
    void rejectsPartyNotBelongingToClass() {
        var wrong = new ContractSourceSnapshotClient.Classroom(42L, "Math", "Course", 99L,
                "tutor@example.com", 8L, "student@example.com", BigDecimal.valueOf(120000), 4,
                "staff@example.com", "ONLINE", "", "", LocalDate.now(), LocalDate.now().plusMonths(1),
                90, List.of(), List.of());
        assertThatThrownBy(() -> client.authoritative(intent(), actor, tutor(), student(), wrong))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void rejectsIncompleteClassroomTermsInsteadOfUsingClientValues() {
        var incomplete = new ContractSourceSnapshotClient.Classroom(42L, "Math", "Course", 7L,
                "tutor@example.com", 8L, "student@example.com", null, 4,
                "staff@example.com", "ONLINE", "", "", null, null,
                90, List.of(), List.of());
        assertThatThrownBy(() -> client.authoritative(intent(), actor, tutor(), student(), incomplete))
                .isInstanceOf(ResponseStatusException.class);
    }

    private InitiateAgreementRequest intent() {
        return new InitiateAgreementRequest(42L, "Fake", 8L, "Fake", "fake@example.com", "", "2000-01-01", "Fake",
                7L, "Fake", "tutor@example.com", "", "Fake", "0x3333333333333333333333333333333333333333",
                "0x4444444444444444444444444444444444444444", BigDecimal.ONE, 99,
                "fake@example.com", "Fake", "ONLINE", "EduConnect", "", "", "2026-01-01", "2026-02-01", 1,
                List.of(), List.of());
    }

    private ContractSourceSnapshotClient.Party tutor() {
        return new ContractSourceSnapshotClient.Party(7L, "tutor@example.com", "Tutor", "", null, "HCM",
                "0x1111111111111111111111111111111111111111", List.of("TUTOR"));
    }

    private ContractSourceSnapshotClient.Party student() {
        return new ContractSourceSnapshotClient.Party(8L, "student@example.com", "Student", "", LocalDate.of(2000, 1, 1), "HCM",
                "0x2222222222222222222222222222222222222222", List.of("STUDENT"));
    }

    private ContractSourceSnapshotClient.Classroom classroom() {
        return new ContractSourceSnapshotClient.Classroom(42L, "Math", "Course", 7L,
                "tutor@example.com", 8L, "student@example.com", BigDecimal.valueOf(120000), 4,
                "staff@example.com", "ONLINE", "", "", LocalDate.now(), LocalDate.now().plusMonths(1),
                90, List.of(), List.of());
    }
}
