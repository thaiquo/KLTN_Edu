package iuh.fit.ai_service;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@SpringBootApplication
@RestController
public class AiServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(AiServiceApplication.class, args);
    }

    @GetMapping("/api/ai/health")
    public Map<String, Object> healthCheck() {
        return Map.of(
            "status", "UP",
            "service", "ai-service",
            "port", 8084,
            "message", "AI Service skeleton ready"
        );
    }
}
