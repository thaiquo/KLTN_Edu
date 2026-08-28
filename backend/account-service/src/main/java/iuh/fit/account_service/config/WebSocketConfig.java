package iuh.fit.account_service.config;

import iuh.fit.account_service.realtime.RealtimeEventHub;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {
    private final RealtimeEventHub realtimeEventHub;

    public WebSocketConfig(RealtimeEventHub realtimeEventHub) {
        this.realtimeEventHub = realtimeEventHub;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(realtimeEventHub, "/ws/account")
                .setAllowedOriginPatterns("http://localhost:*", "http://127.0.0.1:*");
    }
}
