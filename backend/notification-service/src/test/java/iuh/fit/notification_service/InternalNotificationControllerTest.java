package iuh.fit.notification_service;

import iuh.fit.notification_service.controller.InternalNotificationController;
import iuh.fit.notification_service.entity.Notification;
import iuh.fit.notification_service.service.NotificationService;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class InternalNotificationControllerTest {
    private static final String SECRET = "notification-internal-test-secret-at-least-256-bits";
    private static final String BODY = "{\"recipientId\":2,\"title\":\"Status\",\"type\":\"TERMINATION_UPDATED\"}";

    private String token(String subject, String scope) {
        return Jwts.builder().subject(subject).claim("serviceScope", scope)
                .expiration(Date.from(Instant.now().plusSeconds(60)))
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8))).compact();
    }

    @Test void rejectsAnonymousAndWrongScopeBeforeWriting() throws Exception {
        var service = mock(NotificationService.class);
        var mvc = MockMvcBuilders.standaloneSetup(new InternalNotificationController(service, SECRET)).build();
        mvc.perform(post("/api/notifications/internal/send").contentType("application/json").content(BODY))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/notifications/internal/send").contentType("application/json").content(BODY)
                .header("X-Service-Token", token("contract-service", "notification-recipients")))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/notifications/internal/send").contentType("application/json").content(BODY)
                .header("X-Service-Token", token("another-service", "notification-send")))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(service);
    }

    @Test void acceptsScopedServiceToken() throws Exception {
        var service = mock(NotificationService.class);
        var notification = mock(Notification.class);
        when(notification.getId()).thenReturn(9L);
        when(service.createIfAbsent(any())).thenReturn(notification);
        var mvc = MockMvcBuilders.standaloneSetup(new InternalNotificationController(service, SECRET)).build();
        mvc.perform(post("/api/notifications/internal/send").contentType("application/json").content(BODY)
                .header("X-Service-Token", token("contract-service", "notification-send")))
                .andExpect(status().isOk());
        verify(service).createIfAbsent(any());
    }
}
