package iuh.fit.learning_service.service;

import iuh.fit.learning_service.enums.ClassSessionStatus;
import iuh.fit.learning_service.repository.ClassSessionRepository;
import iuh.fit.learning_service.repository.SessionAttendanceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class SessionSettlementDeliveryService {
    private final ClassSessionRepository sessions;
    private final SessionAttendanceRepository attendances;
    private final ContractServiceDispatcher dispatcher;

    @Scheduled(initialDelay = 5000, fixedDelay = 30000)
    @Transactional
    public void deliverPending() {
        for (var session : sessions.findTop50ByStatusAndSettlementDispatchedFalseOrderByIdAsc(ClassSessionStatus.COMPLETED)) {
            var records = attendances.findBySessionId(session.getId());
            if (records.isEmpty()) {
                // Ask Contract Service whether this classroom has no payable agreements.
                // Never acknowledge an empty attendance ledger locally: an ACTIVE agreement
                // without an attendance row must remain retryable instead of being silently lost.
                if (dispatcher.dispatchAutoPropose(
                        session.getClassRoom().getId(),
                        session.getSequenceNumber().longValue(),
                        java.util.List.of())) {
                    session.setSettlementDispatched(true);
                    sessions.save(session);
                }
                continue;
            }
            if (records.stream().anyMatch(record -> record.getFinalOutcome() == null)) continue;
            var outcomes = records.stream().map(record -> new ContractServiceDispatcher.StudentAttendanceOutcomeItem(
                    record.getStudentId(), record.getFinalOutcome().name())).toList();
            if (dispatcher.dispatchAutoPropose(session.getClassRoom().getId(), session.getSequenceNumber().longValue(), outcomes)) {
                session.setSettlementDispatched(true);
                sessions.save(session);
            }
        }
    }
}
