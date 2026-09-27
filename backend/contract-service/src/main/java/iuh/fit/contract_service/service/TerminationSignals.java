package iuh.fit.contract_service.service;

import iuh.fit.contract_service.entity.*;
import iuh.fit.contract_service.enums.*;
import iuh.fit.contract_service.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

@Service @RequiredArgsConstructor
public class TerminationSignals {
    private final ContractAgreementRepository agreements;
    private final SessionSettlementRepository settlements;
    private final DisputeRepository disputes;
    private final TerminationService terminations;

    @Transactional
    public void detect() {
        for (var a : agreements.findByStatus(ContractAgreementStatus.ACTIVE)) {
            if (a.isLegacyExcluded() || a.getTerminationCutoffSession() != null) continue;
            var rows = settlements.findByAgreementId(a.getId()).stream()
                    .filter(s -> s.getStatus() == SettlementStatus.SETTLED || s.getStatus() == SettlementStatus.REFUNDED)
                    .sorted(Comparator.comparing(SessionSettlement::getSessionId).reversed()).limit(3).toList();
            if (rows.size() != 3 || rows.getFirst().getSessionId() - rows.getLast().getSessionId() != 2) continue;
            boolean absent = rows.stream().allMatch(s -> s.getOutcome() == SettlementOutcome.TUTOR_ABSENT);
            boolean upheld = rows.stream().allMatch(s -> disputes.findBySettlementId(s.getId())
                    .map(d -> d.getStatus() == DisputeStatus.APPROVED).orElse(false));
            if (absent || upheld) {
                String kind = absent ? "TUTOR_ABSENT" : "UPHELD_COMPLAINT";
                String key = kind + ":" + a.getClassroomId() + ":" + rows.getFirst().getSessionId();
                terminations.requestSystemReview(a.getId(), key, absent
                        ? "He thong ghi nhan 3 buoi lien tiep co ket qua gia su vang. Staff can xac minh diem danh va su co truoc khi de xuat cham dut."
                        : "He thong ghi nhan khieu nai duoc chap thuan trong 3 buoi lien tiep. Staff can xem ho so va de xuat xu ly.");
            }
        }
    }
}
