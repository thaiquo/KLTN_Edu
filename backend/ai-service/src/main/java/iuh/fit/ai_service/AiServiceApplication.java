package iuh.fit.ai_service;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@SpringBootApplication
@RestController
public class AiServiceApplication {

    @Value("${server.port}")
    private int serverPort;

    public static void main(String[] args) {
        SpringApplication.run(AiServiceApplication.class, args);
    }

    @GetMapping("/api/ai/health")
    public Map<String, Object> healthCheck() {
        return Map.of(
            "status", "UP",
            "service", "ai-service",
            "port", serverPort,
            "message", "AI Service skeleton ready"
        );
    }
}
