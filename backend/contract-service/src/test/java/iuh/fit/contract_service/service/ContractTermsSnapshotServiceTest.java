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
                        new ContractTermsSnapshot.PartyTerms("Tutor", "tutor@example.com", "0901", "0x0000000000000000000000000000000000000001", null, "TP. Hồ Chí Minh"),
                        new ContractTermsSnapshot.PartyTerms("Student", "student@example.com", "0902", "0x0000000000000000000000000000000000000002", "2005-01-01", "TP. Hồ Chí Minh")),
                new ContractTermsSnapshot.FinancialTerms(new BigDecimal("250000"), new BigDecimal("1000000"), new BigDecimal("25000"),
                        "USDC", (short) 6, "10000000", "40000000", 4),
                new ContractTermsSnapshot.PlatformTerms(11155111L, "0x0000000000000000000000000000000000000003",
                        "0x0000000000000000000000000000000000000004", "0x0000000000000000000000000000000000000005"),
                new ContractTermsSnapshot.EscrowPolicyTerms(24, 8500, 1500,
                        "SETTLE_PER_CONFIRMED_SESSION",
                        "Student termination opens after the first session end"));
    }

    @Test
    void supportsV4TermsWithTrialPolicyAndPreservesBackwardCompatibility() {
        var base = snapshot("https://meet.google.com/test");
        var trial = new ContractTermsSnapshot.TrialPolicyTerms(
                true, 1, 1, 2,
                "2026-09-10T18:00:00+07:00",
                "2026-09-13T18:00:00+07:00",
                "2026-09-13T18:00:00+07:00",
                "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
                "serverReceivedAt < initialTrialDeadline",
                "immutable after agreement signing starts in policy v1",
                "confirmed before trialSessionStartAt",
                true, true,
                "unused escrow after required settlements are final"
        );
        var v4Snapshot = new ContractTermsSnapshot(
                ContractTermsSnapshotService.SCHEMA_VERSION_V4,
                base.classroom(), base.parties(), base.financial(), base.platform(), base.escrowPolicy(),
                trial
        );

        String v4Json = service.serialize(v4Snapshot);
        assertThat(v4Json).contains("contract-terms-v4");
        assertThat(v4Json).contains("trialPolicy");
        assertThat(v4Json).contains("initialTrialDeadline");

        var parsed = service.parse(v4Json);
        assertThat(parsed).isPresent();
        assertThat(parsed.get().schemaVersion()).isEqualTo("contract-terms-v4");
        assertThat(parsed.get().trialPolicy()).isNotNull();
        assertThat(parsed.get().trialPolicy().trialSessionSequence()).isEqualTo(1);
        assertThat(parsed.get().trialPolicy().nextSessionSequence()).isEqualTo(2);

        // Backward compatibility: parsing legacy v3 json without trialPolicy or the v5 rule.
        var v3Snapshot = new ContractTermsSnapshot(
                ContractTermsSnapshotService.SCHEMA_VERSION_V3,
                base.classroom(), base.parties(), base.financial(), base.platform(),
                new ContractTermsSnapshot.EscrowPolicyTerms(24, 8500, 1500,
                        "SETTLE_PER_CONFIRMED_SESSION"));
        String v3Json = service.serialize(v3Snapshot);
        assertThat(v3Json).doesNotContain("trialPolicy");
        assertThat(v3Json).doesNotContain("studentTerminationRule");
        var parsedV3 = service.parse(v3Json);
        assertThat(parsedV3).isPresent();
        assertThat(parsedV3.get().schemaVersion()).isEqualTo("contract-terms-v3");
        assertThat(parsedV3.get().trialPolicy()).isNull();

        // Hash changes when trial policy changes
        assertThat(service.hash(v4Json)).isNotEqualTo(service.hash(v3Json));
    }

    @Test
    void v5SnapshotSignsTheFirstSessionTerminationRule() {
        String json = service.serialize(snapshot("https://meet.google.com/v5"));

        assertThat(json).contains("contract-terms-v5");
        assertThat(json).contains("studentTerminationRule");
        assertThat(service.parse(json)).get()
                .extracting(value -> value.escrowPolicy().studentTerminationRule())
                .isEqualTo("Student termination opens after the first session end");
    }
}
