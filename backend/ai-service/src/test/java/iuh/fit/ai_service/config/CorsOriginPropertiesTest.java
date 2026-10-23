package iuh.fit.ai_service.config;

import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.bind.Bindable;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.mock.env.MockEnvironment;

import static org.assertj.core.api.Assertions.assertThat;

class CorsOriginPropertiesTest {

    @Test
    void bindsExplicitProductionAndDevelopmentOrigins() {
        MockEnvironment environment = new MockEnvironment()
                .withProperty("app.cors.allowed-origin-patterns",
                        "https://educonnectiuh.duckdns.org,http://localhost:*");

        CorsOriginProperties properties = Binder.get(environment)
                .bind("app.cors", Bindable.of(CorsOriginProperties.class))
                .orElseThrow(() -> new AssertionError("CORS properties were not bound"));

        assertThat(properties.getAllowedOriginPatterns()).containsExactly(
                "https://educonnectiuh.duckdns.org",
                "http://localhost:*"
        );
    }
}
