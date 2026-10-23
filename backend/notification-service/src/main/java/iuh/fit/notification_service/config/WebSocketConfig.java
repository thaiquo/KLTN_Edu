package iuh.fit.notification_service.config;

import iuh.fit.notification_service.realtime.NotificationRealtimeHub;
import iuh.fit.notification_service.realtime.ChatWebSocketHandler;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final NotificationRealtimeHub notificationRealtimeHub;
    private final ChatWebSocketHandler chatWebSocketHandler;
    private final CorsOriginProperties corsOriginProperties;

    public WebSocketConfig(
            NotificationRealtimeHub notificationRealtimeHub,
            ChatWebSocketHandler chatWebSocketHandler,
            CorsOriginProperties corsOriginProperties
    ) {
        this.notificationRealtimeHub = notificationRealtimeHub;
        this.chatWebSocketHandler = chatWebSocketHandler;
        this.corsOriginProperties = corsOriginProperties;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(chatWebSocketHandler, "/ws/chat")
                .setAllowedOriginPatterns(corsOriginProperties.allowedOriginPatternsArray());
        registry.addHandler(notificationRealtimeHub, "/ws/notifications")
                .setAllowedOriginPatterns(corsOriginProperties.allowedOriginPatternsArray());
    }
}
