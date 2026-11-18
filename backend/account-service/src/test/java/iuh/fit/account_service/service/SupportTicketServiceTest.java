package iuh.fit.account_service.service;

import iuh.fit.account_service.config.security.ActiveRoleAuthenticationDetails;
import iuh.fit.account_service.dto.support.SupportTicketDtos.CreateRequest;
import iuh.fit.account_service.dto.support.SupportTicketDtos.ReassignRequest;
import iuh.fit.account_service.entity.SupportTicket;
import iuh.fit.account_service.entity.SupportTicketHistory;
import iuh.fit.account_service.entity.User;
import iuh.fit.account_service.enums.SupportTicketCategory;
import iuh.fit.account_service.enums.SupportTicketStatus;
import iuh.fit.account_service.enums.Role;
import iuh.fit.account_service.exception.ConflictException;
import iuh.fit.account_service.exception.ForbiddenException;
import iuh.fit.account_service.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.Authentication;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SupportTicketServiceTest {
    @Mock SupportTicketRepository tickets; @Mock SupportTicketMessageRepository messages;
    @Mock SupportTicketHistoryRepository history; @Mock UserRepository users; @Mock UserRoleRepository userRoles;
    SupportTicketService service;

    @BeforeEach void setUp() {
        service = new SupportTicketService(tickets, messages, history, users, userRoles);
        lenient().when(messages.findByTicketIdOrderByCreatedAtAscIdAsc(nullable(Long.class))).thenReturn(List.of());
        lenient().when(history.findByTicketIdOrderByCreatedAtAscIdAsc(nullable(Long.class))).thenReturn(List.of());
    }

    @Test void studentCreatesOwnOpenTicketWithAudit() {
        User student = user(20L, "student@test.vn", "Student");
        Authentication auth = auth(student, "STUDENT");
        var result = service.create(new CreateRequest(SupportTicketCategory.TECHNICAL, "Không tải được tài liệu", "Mô tả lỗi"), auth);
        assertThat(result.summary().status()).isEqualTo(SupportTicketStatus.OPEN);
        assertThat(result.summary().creatorId()).isEqualTo(20L);
        verify(history).save(any());
    }

    @Test void studentCannotReadAnotherUsersTicket() {
        User owner = user(20L, "owner@test.vn", "Owner");
        User other = user(21L, "other@test.vn", "Other");
        SupportTicket ticket = ticket(owner);
        when(tickets.findByPublicId(ticket.getPublicId())).thenReturn(Optional.of(ticket));
        assertThatThrownBy(() -> service.get(ticket.getPublicId(), auth(other, "STUDENT")))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test void staffCannotClaimTicketAssignedToAnotherStaff() {
        User owner = user(20L, "owner@test.vn", "Owner");
        User assigned = user(30L, "assigned@test.vn", "Assigned");
        User other = user(31L, "otherstaff@test.vn", "Other Staff");
        SupportTicket ticket = ticket(owner); ticket.setAssignee(assigned); ticket.setStatus(SupportTicketStatus.ASSIGNED);
        when(tickets.findByPublicIdForUpdate(ticket.getPublicId())).thenReturn(Optional.of(ticket));
        assertThatThrownBy(() -> service.claim(ticket.getPublicId(), auth(other, "STAFF")))
                .isInstanceOf(ConflictException.class);
    }

    @Test void adminReassignsOpenTicketToActiveStaffWithBeforeAfterAudit() {
        User owner = user(20L, "owner@test.vn", "Owner");
        User admin = user(1L, "admin@test.vn", "Admin");
        User previous = user(30L, "previous@test.vn", "Previous");
        User next = user(31L, "next@test.vn", "Next");
        SupportTicket ticket = ticket(owner); ticket.setAssignee(previous); ticket.setStatus(SupportTicketStatus.ASSIGNED);
        when(tickets.findByPublicIdForUpdate(ticket.getPublicId())).thenReturn(Optional.of(ticket));
        when(users.findById(next.getId())).thenReturn(Optional.of(next));
        when(userRoles.existsByUserIdAndRole(next.getId(), Role.STAFF)).thenReturn(true);

        var result = service.reassign(ticket.getPublicId(), new ReassignRequest(next.getId(), "Cân bằng tải"), auth(admin, "ADMIN"));

        assertThat(result.summary().assigneeId()).isEqualTo(next.getId());
        var audit = org.mockito.ArgumentCaptor.forClass(SupportTicketHistory.class);
        verify(history).save(audit.capture());
        assertThat(audit.getValue().getAction()).isEqualTo("REASSIGNED");
        assertThat(audit.getValue().getPreviousAssignee().getId()).isEqualTo(previous.getId());
        assertThat(audit.getValue().getNewAssignee().getId()).isEqualTo(next.getId());
        assertThat(audit.getValue().getReason()).isEqualTo("Cân bằng tải");
    }

    @Test void staffCannotReassignTicket() {
        User owner = user(20L, "owner@test.vn", "Owner");
        User staff = user(30L, "staff@test.vn", "Staff");
        SupportTicket ticket = ticket(owner);
        assertThatThrownBy(() -> service.reassign(ticket.getPublicId(),
                new ReassignRequest(31L, "Không có quyền"), auth(staff, "STAFF")))
                .isInstanceOf(ForbiddenException.class);
    }

    private SupportTicket ticket(User owner) {
        SupportTicket ticket = new SupportTicket(); ticket.setPublicId(UUID.randomUUID()); ticket.setCreator(owner);
        ticket.setCreatorRole("STUDENT"); ticket.setCategory(SupportTicketCategory.OTHER); ticket.setSubject("S");
        ticket.setDescription("D"); ticket.setStatus(SupportTicketStatus.OPEN); return ticket;
    }
    private User user(Long id, String email, String name) { return User.builder().id(id).email(email).fullName(name).password("x").build(); }
    private Authentication auth(User user, String role) {
        Authentication auth = mock(Authentication.class);
        when(auth.isAuthenticated()).thenReturn(true); when(auth.getName()).thenReturn(user.getEmail());
        when(auth.getDetails()).thenReturn(new ActiveRoleAuthenticationDetails(role, null));
        when(users.findByEmailIgnoreCase(user.getEmail())).thenReturn(Optional.of(user)); return auth;
    }
}
