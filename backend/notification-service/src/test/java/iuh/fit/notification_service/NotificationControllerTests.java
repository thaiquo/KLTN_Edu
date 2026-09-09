package iuh.fit.notification_service;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import iuh.fit.notification_service.entity.Notification;
import iuh.fit.notification_service.repository.NotificationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockCookie;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.List;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
class NotificationControllerTests {
    private MockMvc mockMvc;

    @Autowired
    private NotificationRepository notificationRepository;

    @Value("${jwt.secret}")
    private String jwtSecret;

    @Autowired
    void setupMockMvc(WebApplicationContext context, FilterChainProxy springSecurityFilterChain) {
        this.mockMvc = MockMvcBuilders.webAppContextSetup(context)
                .addFilter(springSecurityFilterChain)
                .build();
    }

    @BeforeEach
    void cleanDatabase() {
        notificationRepository.deleteAll();
    }

    @Test
    void unauthenticatedRequestsAreDenied() throws Exception {
        mockMvc.perform(get("/api/notifications"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void listReturnsOnlyCurrentUsersNotificationsWithPagination() throws Exception {
        save("ctrl-1", 101L, "First");
        save("ctrl-2", 101L, "Second");
        save("ctrl-3", 202L, "Other");

        mockMvc.perform(get("/api/notifications?page=0&size=10").cookie(jwtCookie(101L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(2)))
                .andExpect(jsonPath("$.totalElements").value(2));
    }

    @Test
    void unreadCountAndMarkReadWorkForOwnerOnly() throws Exception {
        Notification own = save("ctrl-4", 303L, "Own");
        Notification other = save("ctrl-5", 404L, "Other");

        mockMvc.perform(get("/api/notifications/unread-count").cookie(jwtCookie(303L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(1));

        mockMvc.perform(patch("/api/notifications/{id}/read", own.getId())
                        .cookie(jwtCookie(303L))
                        .with(SecurityMockMvcRequestPostProcessors.csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.read").value(true));

        mockMvc.perform(patch("/api/notifications/{id}/read", other.getId())
                        .cookie(jwtCookie(303L))
                        .with(SecurityMockMvcRequestPostProcessors.csrf()))
                .andExpect(status().isForbidden());
    }

    @Test
    void unreadCountCanFilterByTargetRole() throws Exception {
        save("ctrl-9", 707L, "Tutor");
        save("ctrl-10", 707L, "Student", "STUDENT");

        mockMvc.perform(get("/api/notifications/unread-count?targetRole=TUTOR").cookie(jwtCookie(707L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(1));
    }

    @Test
    void markAllReadReturnsAffectedCount() throws Exception {
        save("ctrl-6", 505L, "One");
        save("ctrl-7", 505L, "Two");
        save("ctrl-8", 606L, "Other");

        mockMvc.perform(patch("/api/notifications/read-all")
                        .cookie(jwtCookie(505L))
                        .with(SecurityMockMvcRequestPostProcessors.csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(2));
    }

    @Test
    void markAllReadCanFilterByTargetRole() throws Exception {
        save("ctrl-11", 808L, "Tutor");
        save("ctrl-12", 808L, "Student", "STUDENT");

        mockMvc.perform(patch("/api/notifications/read-all?targetRole=STUDENT")
                        .cookie(jwtCookie(808L))
                        .with(SecurityMockMvcRequestPostProcessors.csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(1));

        mockMvc.perform(get("/api/notifications/unread-count").cookie(jwtCookie(808L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(1));
    }

    private Notification save(String eventId, Long recipientUserId, String title) {
        return save(eventId, recipientUserId, title, "TUTOR");
    }

    private Notification save(String eventId, Long recipientUserId, String title, String targetRole) {
        Notification notification = new Notification();
        notification.setEventId(eventId);
        notification.setRecipientUserId(recipientUserId);
        notification.setType("TUTOR_APPLICATION_REVIEWED");
        notification.setTitle(title);
        notification.setMessage("Message");
        notification.setTargetRole(targetRole);
        notification.setReferenceType("TUTOR_APPLICATION");
        notification.setReferenceId("1");
        return notificationRepository.saveAndFlush(notification);
    }

    private MockCookie jwtCookie(Long userId) {
        SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
        String token = Jwts.builder()
                .subject("user" + userId + "@example.com")
                .claim("userId", userId)
                .claim("activeRole", "STUDENT")
                .claim("roles", List.of("STUDENT"))
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + 600_000))
                .signWith(key)
                .compact();
        return new MockCookie("access_token", token);
    }
}
