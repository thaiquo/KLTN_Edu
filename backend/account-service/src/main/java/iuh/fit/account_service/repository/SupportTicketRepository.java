package iuh.fit.account_service.repository;

import iuh.fit.account_service.entity.SupportTicket;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface SupportTicketRepository extends JpaRepository<SupportTicket, Long>, JpaSpecificationExecutor<SupportTicket> {
    @Override
    @EntityGraph(attributePaths = {"creator", "assignee"})
    Page<SupportTicket> findAll(Specification<SupportTicket> spec, Pageable pageable);
    Optional<SupportTicket> findByPublicId(UUID publicId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT t FROM SupportTicket t JOIN FETCH t.creator LEFT JOIN FETCH t.assignee WHERE t.publicId = :publicId")
    Optional<SupportTicket> findByPublicIdForUpdate(@Param("publicId") UUID publicId);
}
