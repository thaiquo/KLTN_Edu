package iuh.fit.account_service;

import iuh.fit.account_service.controller.InternalNotificationRecipientsController;
import iuh.fit.account_service.repository.UserRoleRepository;
import iuh.fit.account_service.repository.SupportTicketRepository;
import iuh.fit.account_service.entity.*;
import iuh.fit.account_service.enums.*;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class InternalNotificationRecipientsTest {
    final String secret = "test-notification-recipient-secret-at-least-256-bits";
    final UserRoleRepository roles = mock(UserRoleRepository.class);
    final SupportTicketRepository tickets = mock(SupportTicketRepository.class);
    final InternalNotificationRecipientsController controller = new InternalNotificationRecipientsController(roles, tickets, secret);
    String token(String scope, Instant expiry) { return token("contract-service", scope, expiry); }
    String token(String subject, String scope, Instant expiry) {
        return Jwts.builder().subject(subject).claim("serviceScope", scope).expiration(Date.from(expiry))
                .signWith(Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8))).compact();
    }
    UserRole role(long id, String email, Role role) {
        return UserRole.builder().user(User.builder().id(id).email(email).accountStatus(AccountStatus.ACTIVE).build()).role(role).build();
    }
    @Test void onlyAssignedStaffAndAdminsReceiveReviewNoticesWithoutDuplicates() {
        when(roles.findByRoleIn(anyList())).thenReturn(List.of(role(1,"a@test",Role.ADMIN),
                role(2,"staff@test",Role.STAFF),role(3,"other@test",Role.STAFF),role(1,"a@test",Role.STAFF)));
        var recipients = controller.reviewers(token("notification-recipients", Instant.now().plusSeconds(60)), "STAFF@test", null);
        assertThat(recipients).extracting(InternalNotificationRecipientsController.Recipient::recipientId).containsExactly(1L,2L);
    }
    @Test void gatewayCanResolveOperationalSlaRecipients() {
        when(roles.findByRoleIn(anyList())).thenReturn(List.of(role(1,"admin@test",Role.ADMIN)));
        var recipients = controller.reviewers(
                token("api-gateway", "notification-recipients", Instant.now().plusSeconds(60)), "", null);
        assertThat(recipients).extracting(InternalNotificationRecipientsController.Recipient::recipientId)
                .containsExactly(1L);
    }
    @Test void gatewayResolvesAssignedSupportTicketWithoutExposingStaffEmail() {
        UUID ticketId = UUID.randomUUID();
        User assigned = User.builder().id(2L).email("staff@test").accountStatus(AccountStatus.ACTIVE).build();
        SupportTicket ticket = new SupportTicket();
        ticket.setAssignee(assigned);
        when(tickets.findByPublicId(ticketId)).thenReturn(Optional.of(ticket));
        when(roles.findByRoleIn(anyList())).thenReturn(List.of(role(1,"admin@test",Role.ADMIN),
                role(2,"staff@test",Role.STAFF), role(3,"other@test",Role.STAFF)));

        var recipients = controller.reviewers(
                token("api-gateway", "notification-recipients", Instant.now().plusSeconds(60)), "", ticketId);

        assertThat(recipients).extracting(InternalNotificationRecipientsController.Recipient::recipientId)
                .containsExactly(1L, 2L);
    }
    @Test void missingWrongScopeAndExpiredServiceTokensAreRejectedBeforeLookup() {
        for (String token : Arrays.asList(null, "bad", token("learning-termination", Instant.now().plusSeconds(60)),
                token("notification-recipients", Instant.now().minusSeconds(60)))) {
            assertThatThrownBy(() -> controller.reviewers(token,"staff@test", null))
                    .isInstanceOf(iuh.fit.account_service.exception.UnauthorizedException.class);
        }
        verifyNoInteractions(roles);
    }
    @Test void httpAuthenticationErrorsRemain401WithGlobalExceptionHandler() throws Exception {
        var mvc = org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new iuh.fit.account_service.exception.GlobalExceptionHandler()).build();
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                .get("/api/internal/notification-reviewers"))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isUnauthorized());
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                .get("/api/internal/notification-reviewers").header("X-Service-Token", "bad"))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isUnauthorized());
        verifyNoInteractions(roles);
    }
}
