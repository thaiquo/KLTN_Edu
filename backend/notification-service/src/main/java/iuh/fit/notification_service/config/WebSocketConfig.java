package iuh.fit.notification_service.config;

import iuh.fit.notification_service.realtime.NotificationRealtimeHub;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {
    private final NotificationRealtimeHub notificationRealtimeHub;

    public WebSocketConfig(NotificationRealtimeHub notificationRealtimeHub) {
        this.notificationRealtimeHub = notificationRealtimeHub;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(notificationRealtimeHub, "/ws/notifications")
                .setAllowedOriginPatterns("http://localhost:*", "http://127.0.0.1:*");
    }
}
