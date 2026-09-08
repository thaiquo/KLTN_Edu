package iuh.fit.contract_service.service;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ContractTermsSnapshotServiceTest {
    private final ContractTermsSnapshotService service = new ContractTermsSnapshotService();

    @Test
    void canonicalTermsHashChangesWhenASignedClassroomTermChanges() {
        String first = service.serialize(snapshot("https://meet.google.com/first"));
        String second = service.serialize(snapshot("https://meet.google.com/second"));

        assertThat(first).isNotEqualTo(second);
        assertThat(service.hash(first)).isNotEqualTo(service.hash(second));
        assertThat(service.matchesHash(first, service.hash(first))).isTrue();
    }

    private ContractTermsSnapshot snapshot(String meetingLink) {
        return new ContractTermsSnapshot(
                ContractTermsSnapshotService.SCHEMA_VERSION,
                new ContractTermsSnapshot.ClassroomTerms("Math", "Algebra", "ONLINE", "Google Meet", meetingLink, null,
                        "2026-09-10", "2026-10-10", 90,
                        List.of(new ContractTermsSnapshot.ScheduleTerms(2, "18:00", "19:30")), List.of()),
                new ContractTermsSnapshot.PartiesTerms(
                        new ContractTermsSnapshot.PartyTerms("Tutor", "tutor@example.com", "0901", "0x0000000000000000000000000000000000000001"),
                        new ContractTermsSnapshot.PartyTerms("Student", "student@example.com", "0902", "0x0000000000000000000000000000000000000002")),
                new ContractTermsSnapshot.FinancialTerms(new BigDecimal("250000"), new BigDecimal("1000000"), new BigDecimal("25000"),
                        "USDC", (short) 6, "10000000", "40000000", 4),
                new ContractTermsSnapshot.PlatformTerms(11155111L, "0x0000000000000000000000000000000000000003",
                        "0x0000000000000000000000000000000000000004", "0x0000000000000000000000000000000000000005"),
                new ContractTermsSnapshot.EscrowPolicyTerms(24, 8500, 1500, "SETTLE_PER_CONFIRMED_SESSION"));
    }
}
