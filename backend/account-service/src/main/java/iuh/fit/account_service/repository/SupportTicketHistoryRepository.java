package iuh.fit.account_service.repository;

import iuh.fit.account_service.entity.SupportTicketHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface SupportTicketHistoryRepository extends JpaRepository<SupportTicketHistory, Long> {
    List<SupportTicketHistory> findByTicketIdOrderByCreatedAtAscIdAsc(Long ticketId);
}
