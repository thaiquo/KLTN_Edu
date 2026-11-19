package iuh.fit.api_gateway.reporting;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class OperationalSourceHealthRegistryTest {
    @Test
    void preservesLastSuccessfulRefreshAcrossFailureAndExposesSafeDiagnostics() {
        var registry = new OperationalSourceHealthRegistry();
        var success = registry.success("SUPPORT_TICKET", 20, 7, 2_000);
        var failed = registry.unavailable("SUPPORT_TICKET", 5_000, "TIMEOUT",
                "Source did not respond within the configured timeout");

        assertThat(success.status()).isEqualTo(OperationalWorkItemService.SourceStatus.SUCCESS);
        assertThat(success.itemCount()).isEqualTo(7);
        assertThat(success.checkedAt()).isNotBlank();
        assertThat(failed.status()).isEqualTo(OperationalWorkItemService.SourceStatus.UNAVAILABLE);
        assertThat(failed.lastSuccessfulRefresh()).isEqualTo(success.lastSuccessfulRefresh());
        assertThat(failed.itemCount()).isNull();
        assertThat(failed.errorSummary()).doesNotContain("http", "token", "jdbc");
    }

    @Test
    void marksUsableSlowSourceAsDegraded() {
        var health = new OperationalSourceHealthRegistry().success("CLASS_APPROVAL", 2_500, 3, 2_000);
        assertThat(health.status()).isEqualTo(OperationalWorkItemService.SourceStatus.DEGRADED);
        assertThat(health.itemCount()).isEqualTo(3);
    }
}
