package iuh.fit.account_service.repository;

import iuh.fit.account_service.entity.SupportTicketMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface SupportTicketMessageRepository extends JpaRepository<SupportTicketMessage, Long> {
    List<SupportTicketMessage> findByTicketIdOrderByCreatedAtAscIdAsc(Long ticketId);
}
