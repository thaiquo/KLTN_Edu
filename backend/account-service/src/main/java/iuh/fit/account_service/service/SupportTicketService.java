package iuh.fit.account_service.service;

import iuh.fit.account_service.config.security.ActiveRoleAuthenticationDetails;
import iuh.fit.account_service.dto.support.SupportTicketDtos.*;
import iuh.fit.account_service.entity.*;
import iuh.fit.account_service.enums.SupportTicketStatus;
import iuh.fit.account_service.exception.BadRequestException;
import iuh.fit.account_service.exception.ConflictException;
import iuh.fit.account_service.exception.ForbiddenException;
import iuh.fit.account_service.exception.ResourceNotFoundException;
import iuh.fit.account_service.exception.UnauthorizedException;
import iuh.fit.account_service.repository.*;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Locale;
import java.util.UUID;

@Service
public class SupportTicketService {
    private final SupportTicketRepository tickets;
    private final SupportTicketMessageRepository messages;
    private final SupportTicketHistoryRepository history;
    private final UserRepository users;

    public SupportTicketService(SupportTicketRepository tickets, SupportTicketMessageRepository messages,
                                SupportTicketHistoryRepository history, UserRepository users) {
        this.tickets = tickets; this.messages = messages; this.history = history; this.users = users;
    }

    @Transactional
    public Detail create(CreateRequest request, Authentication authentication) {
        Actor actor = actor(authentication);
        if (!actor.role.equals("STUDENT") && !actor.role.equals("TUTOR")) forbidden();
        SupportTicket ticket = new SupportTicket();
        ticket.setCreator(actor.user); ticket.setCreatorRole(actor.role); ticket.setCategory(request.category());
        ticket.setSubject(request.subject().trim()); ticket.setDescription(request.description().trim());
        ticket.setStatus(SupportTicketStatus.OPEN);
        tickets.save(ticket);
        audit(ticket, actor, "CREATED", null, SupportTicketStatus.OPEN, ticket.getDescription());
        return detail(ticket);
    }

    @Transactional(readOnly = true)
    public Page<Summary> list(SupportTicketStatus status, String keyword, Pageable pageable, Authentication authentication) {
        Actor actor = actor(authentication);
        Specification<SupportTicket> spec = (root, query, cb) -> {
            var conditions = new ArrayList<Predicate>();
            query.distinct(true);
            if (actor.role.equals("ADMIN")) {
                // Global scope.
            } else if (actor.role.equals("STAFF")) {
                conditions.add(cb.or(cb.isNull(root.get("assignee")),
                        cb.equal(root.get("assignee").get("id"), actor.user.getId())));
            } else {
                conditions.add(cb.equal(root.get("creator").get("id"), actor.user.getId()));
            }
            if (status != null) conditions.add(cb.equal(root.get("status"), status));
            if (keyword != null && !keyword.isBlank()) {
                String like = "%" + keyword.trim().toLowerCase(Locale.ROOT) + "%";
                conditions.add(cb.or(cb.like(cb.lower(root.get("subject")), like),
                        cb.like(cb.lower(root.get("description")), like)));
            }
            return cb.and(conditions.toArray(Predicate[]::new));
        };
        return tickets.findAll(spec, pageable).map(this::summary);
    }

    @Transactional(readOnly = true)
    public Detail get(UUID id, Authentication authentication) {
        Actor actor = actor(authentication);
        SupportTicket ticket = tickets.findByPublicId(id).orElseThrow(this::notFound);
        requireView(ticket, actor);
        return detail(ticket);
    }

    @Transactional
    public Detail claim(UUID id, Authentication authentication) {
        Actor actor = actor(authentication);
        if (!actor.role.equals("STAFF") && !actor.role.equals("ADMIN")) forbidden();
        SupportTicket ticket = lock(id);
        if (ticket.getAssignee() != null && !ticket.getAssignee().getId().equals(actor.user.getId())) {
            throw conflict("Ticket is already assigned");
        }
        if (ticket.getStatus() == SupportTicketStatus.CLOSED || ticket.getStatus() == SupportTicketStatus.RESOLVED) {
            throw conflict("Closed ticket cannot be claimed");
        }
        SupportTicketStatus from = ticket.getStatus();
        ticket.setAssignee(actor.user); ticket.setStatus(SupportTicketStatus.ASSIGNED);
        tickets.save(ticket); audit(ticket, actor, "CLAIMED", from, ticket.getStatus(), null);
        return detail(ticket);
    }

    @Transactional
    public Detail addMessage(UUID id, MessageRequest request, Authentication authentication) {
        Actor actor = actor(authentication);
        SupportTicket ticket = lock(id);
        requireParticipate(ticket, actor);
        if (ticket.getStatus() == SupportTicketStatus.CLOSED) throw conflict("Closed ticket cannot receive messages");
        SupportTicketMessage message = new SupportTicketMessage();
        message.setTicket(ticket); message.setActor(actor.user); message.setActorRole(actor.role);
        message.setMessage(request.message().trim()); messages.save(message);
        SupportTicketStatus from = ticket.getStatus();
        if (actor.role.equals("STUDENT") || actor.role.equals("TUTOR")) ticket.setStatus(SupportTicketStatus.WAITING_STAFF);
        else ticket.setStatus(SupportTicketStatus.WAITING_USER);
        tickets.save(ticket); audit(ticket, actor, "REPLIED", from, ticket.getStatus(), null);
        return detail(ticket);
    }

    @Transactional
    public Detail updateStatus(UUID id, StatusRequest request, Authentication authentication) {
        Actor actor = actor(authentication);
        if (!actor.role.equals("STAFF") && !actor.role.equals("ADMIN")) forbidden();
        SupportTicket ticket = lock(id);
        requireManage(ticket, actor);
        SupportTicketStatus from = ticket.getStatus();
        validateTransition(from, request.status(), actor.role);
        ticket.setStatus(request.status());
        if (request.status() == SupportTicketStatus.ESCALATED) ticket.setEscalatedAt(LocalDateTime.now());
        tickets.save(ticket); audit(ticket, actor, "STATUS_CHANGED", from, request.status(), request.reason());
        return detail(ticket);
    }

    @Transactional
    public Detail escalate(UUID id, EscalateRequest request, Authentication authentication) {
        Actor actor = actor(authentication);
        if (!actor.role.equals("STAFF")) forbidden();
        SupportTicket ticket = lock(id); requireManage(ticket, actor);
        if (ticket.getStatus() == SupportTicketStatus.ESCALATED) throw conflict("Ticket is already escalated");
        if (request.reason() == null || request.reason().isBlank()) {
            throw new BadRequestException("Escalation reason is required");
        }
        SupportTicketStatus from = ticket.getStatus();
        ticket.setStatus(SupportTicketStatus.ESCALATED); ticket.setEscalatedAt(LocalDateTime.now());
        tickets.save(ticket); audit(ticket, actor, "ESCALATED", from, ticket.getStatus(), request.reason().trim());
        return detail(ticket);
    }

    private void validateTransition(SupportTicketStatus from, SupportTicketStatus to, String role) {
        if (from == to) return;
        if (from == SupportTicketStatus.CLOSED) throw conflict("Closed ticket is immutable");
        if (to == SupportTicketStatus.ESCALATED && !role.equals("ADMIN")) {
            throw conflict("Use the escalation action");
        }
        if (from == SupportTicketStatus.ESCALATED && !role.equals("ADMIN")) {
            throw new ForbiddenException("Escalated ticket is controlled by Admin");
        }
    }

    private void requireView(SupportTicket ticket, Actor actor) {
        if (actor.role.equals("ADMIN")) return;
        if (actor.role.equals("STAFF") && (ticket.getAssignee() == null || ticket.getAssignee().getId().equals(actor.user.getId()))) return;
        if (ticket.getCreator().getId().equals(actor.user.getId())) return;
        forbidden();
    }
    private void requireParticipate(SupportTicket ticket, Actor actor) {
        if (ticket.getCreator().getId().equals(actor.user.getId())) return;
        requireManage(ticket, actor);
    }
    private void requireManage(SupportTicket ticket, Actor actor) {
        if (actor.role.equals("ADMIN")) return;
        if (actor.role.equals("STAFF") && ticket.getAssignee() != null
                && ticket.getAssignee().getId().equals(actor.user.getId())
                && ticket.getStatus() != SupportTicketStatus.ESCALATED) return;
        forbidden();
    }

    private void audit(SupportTicket ticket, Actor actor, String action, SupportTicketStatus from,
                       SupportTicketStatus to, String reason) {
        SupportTicketHistory row = new SupportTicketHistory();
        row.setTicket(ticket); row.setActor(actor.user); row.setActorRole(actor.role); row.setAction(action);
        row.setFromStatus(from == null ? null : from.name()); row.setToStatus(to == null ? null : to.name());
        row.setReason(reason); history.save(row);
    }
    private Detail detail(SupportTicket ticket) {
        var messageRows = messages.findByTicketIdOrderByCreatedAtAscIdAsc(ticket.getId()).stream()
                .map(row -> new Message(row.getId(), row.getActor().getId(), row.getActor().getFullName(), row.getActorRole(), row.getMessage(), row.getCreatedAt())).toList();
        var historyRows = history.findByTicketIdOrderByCreatedAtAscIdAsc(ticket.getId()).stream()
                .map(row -> new History(row.getId(), row.getActor().getId(), row.getActor().getFullName(), row.getActorRole(), row.getAction(), row.getFromStatus(), row.getToStatus(), row.getReason(), row.getCreatedAt())).toList();
        return new Detail(summary(ticket), ticket.getDescription(), messageRows, historyRows);
    }
    private Summary summary(SupportTicket t) {
        return new Summary(t.getPublicId(), t.getCategory(), t.getSubject(), t.getStatus(), t.getCreator().getId(),
                t.getCreator().getFullName(), t.getCreatorRole(), t.getAssignee() == null ? null : t.getAssignee().getId(),
                t.getAssignee() == null ? null : t.getAssignee().getFullName(), t.getEscalatedAt(),
                t.getCreatedAt(), t.getUpdatedAt(), t.getVersion());
    }
    private SupportTicket lock(UUID id) { return tickets.findByPublicIdForUpdate(id).orElseThrow(this::notFound); }
    private Actor actor(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) throw new UnauthorizedException("Authentication is required");
        User user = users.findByEmailIgnoreCase(authentication.getName())
                .orElseThrow(() -> new UnauthorizedException("Authentication is required"));
        String role = null;
        if (authentication.getDetails() instanceof ActiveRoleAuthenticationDetails details) role = details.activeRole();
        if (role == null || role.isBlank()) role = authentication.getAuthorities().stream().findFirst()
                .map(a -> a.getAuthority().replace("ROLE_", "")).orElse("");
        return new Actor(user, role.toUpperCase(Locale.ROOT));
    }
    private record Actor(User user, String role) {}
    private ResourceNotFoundException notFound() { return new ResourceNotFoundException("Support ticket not found"); }
    private ConflictException conflict(String message) { return new ConflictException(message); }
    private void forbidden() { throw new ForbiddenException("Forbidden"); }
}
