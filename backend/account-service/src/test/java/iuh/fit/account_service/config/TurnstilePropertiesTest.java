package iuh.fit.account_service.config;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TurnstilePropertiesTest {

    @Test
    void developmentUsesOfficialPassingTestSecretWhenUnset() {
        var properties = new TurnstileProperties("dev");

        properties.validate();

        assertThat(properties.usesTestKey()).isTrue();
    }

    @Test
    void productionRejectsMissingOrTestSecretAndMissingHostname() {
        var missing = new TurnstileProperties("production");
        assertThatThrownBy(missing::validate).isInstanceOf(IllegalStateException.class);

        var testSecret = new TurnstileProperties("production");
        testSecret.setSecretKey(TurnstileProperties.PASSING_TEST_SECRET);
        testSecret.setAllowedHostnames(List.of("educonnect.example"));
        assertThatThrownBy(testSecret::validate).isInstanceOf(IllegalStateException.class);

        var missingHost = new TurnstileProperties("production");
        missingHost.setSecretKey("real-production-secret");
        assertThatThrownBy(missingHost::validate).isInstanceOf(IllegalStateException.class);
    }
}
