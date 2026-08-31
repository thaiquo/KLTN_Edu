package iuh.fit.notification_service.config;

import iuh.fit.notification_service.realtime.ChatWebSocketHandler;
import iuh.fit.notification_service.realtime.NotificationEventHub;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final NotificationEventHub notificationEventHub;
    private final ChatWebSocketHandler chatWebSocketHandler;

    public WebSocketConfig(NotificationEventHub notificationEventHub, ChatWebSocketHandler chatWebSocketHandler) {
        this.notificationEventHub = notificationEventHub;
        this.chatWebSocketHandler = chatWebSocketHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(notificationEventHub, "/ws/notifications")
                .setAllowedOrigins("*");
        registry.addHandler(chatWebSocketHandler, "/ws/chat")
                .setAllowedOrigins("*");
    }
}
