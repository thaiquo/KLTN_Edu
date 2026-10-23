package iuh.fit.learning_service.config;

import iuh.fit.learning_service.realtime.RealtimeEventHub;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {
    private final RealtimeEventHub realtimeEventHub;
    private final CorsOriginProperties corsOriginProperties;

    public WebSocketConfig(
            RealtimeEventHub realtimeEventHub,
            CorsOriginProperties corsOriginProperties
    ) {
        this.realtimeEventHub = realtimeEventHub;
        this.corsOriginProperties = corsOriginProperties;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(realtimeEventHub, "/ws/learning")
                .setAllowedOriginPatterns(corsOriginProperties.allowedOriginPatternsArray());
        registry.addHandler(realtimeEventHub, "/ws/learning/mobile")
                .setAllowedOriginPatterns(corsOriginProperties.allowedOriginPatternsArray());
    }
}
