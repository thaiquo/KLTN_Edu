package iuh.fit.contract_service.service;

import iuh.fit.contract_service.enums.SettlementStatus;
import iuh.fit.contract_service.repository.SessionSettlementRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "blockchain.operator", name = "enabled", havingValue = "true")
public class SessionFinalizationScheduler {
    private final SessionSettlementRepository settlements;
    private final SessionSettlementWorkflowService workflow;

    @Scheduled(initialDelay = 30000, fixedDelay = 60000)
    public void finalizeEligibleSessions() {
        // Opening/open disputes are excluded. Only confirmed proposals can be finalized.
        for (var settlement : settlements.findTop50ByStatusAndDisputeDeadlineBeforeOrderByDisputeDeadlineAsc(
                SettlementStatus.PROPOSED, OffsetDateTime.now(ZoneOffset.UTC).minusSeconds(30))) {
            try {
                workflow.initiateSessionFinalization(settlement.getId());
            } catch (RuntimeException ex) {
                log.warn("Could not enqueue finalization for settlement {}: {}", settlement.getId(), ex.getMessage());
            }
        }
    }
}
