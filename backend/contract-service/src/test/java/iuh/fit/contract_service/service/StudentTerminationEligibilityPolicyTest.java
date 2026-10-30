package iuh.fit.contract_service.service;

import iuh.fit.contract_service.entity.ContractAgreement;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;

class StudentTerminationEligibilityPolicyTest {
    @Test
    void remainsLockedUntilTheFirstSessionScheduledEnd() {
        ContractAgreement agreement = agreement("2026-11-02", 2, "08:00", "09:30");

        var during = StudentTerminationEligibilityPolicy.evaluate(
                agreement, OffsetDateTime.of(2026, 11, 2, 2, 0, 0, 0, ZoneOffset.UTC));
        var after = StudentTerminationEligibilityPolicy.evaluate(
                agreement, OffsetDateTime.of(2026, 11, 2, 2, 30, 0, 0, ZoneOffset.UTC));

        assertThat(during.eligible()).isFalse();
        assertThat(during.code()).isEqualTo(StudentTerminationEligibilityPolicy.NOT_STARTED_CODE);
        assertThat(during.firstSessionEnd()).isEqualTo(OffsetDateTime.parse("2026-11-02T09:30+07:00"));
        assertThat(after.eligible()).isTrue();
    }

    @Test
    void invalidLegacySnapshotFailsClosed() {
        ContractAgreement agreement = ContractAgreement.builder().termsJson("{}").build();

        var result = StudentTerminationEligibilityPolicy.evaluate(agreement, OffsetDateTime.now(ZoneOffset.UTC));

        assertThat(result.eligible()).isFalse();
        assertThat(result.code()).isEqualTo(StudentTerminationEligibilityPolicy.UNAVAILABLE_CODE);
    }

    private ContractAgreement agreement(String startDate, int dayOfWeek, String start, String end) {
        return ContractAgreement.builder()
                .termsJson("{\"schemaVersion\":\"contract-terms-v5\",\"classroom\":{"
                        + "\"startDate\":\"" + startDate + "\",\"schedules\":[{"
                        + "\"dayOfWeek\":" + dayOfWeek + ",\"startTime\":\"" + start
                        + "\",\"endTime\":\"" + end + "\"}]}}")
                .build();
    }
}
