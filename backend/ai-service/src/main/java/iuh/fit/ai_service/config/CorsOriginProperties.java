package iuh.fit.ai_service.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@ConfigurationProperties(prefix = "app.cors")
public class CorsOriginProperties {

    private List<String> allowedOriginPatterns = List.of(
            "http://localhost:*",
            "http://127.0.0.1:*"
    );

    public List<String> getAllowedOriginPatterns() {
        return List.copyOf(allowedOriginPatterns);
    }

    public void setAllowedOriginPatterns(List<String> allowedOriginPatterns) {
        this.allowedOriginPatterns = List.copyOf(allowedOriginPatterns);
    }
}
