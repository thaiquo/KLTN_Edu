package iuh.fit.contract_service.service;

import iuh.fit.contract_service.config.TutorAbsenceGovernanceProperties;
import iuh.fit.contract_service.entity.*;
import iuh.fit.contract_service.enums.*;
import iuh.fit.contract_service.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.*;

@Service
public class TerminationSignals {
    private static final Logger log = LoggerFactory.getLogger(TerminationSignals.class);

    private final ContractAgreementRepository agreements;
    private final SessionSettlementRepository settlements;
    private final DisputeRepository disputes;
    private final TerminationService terminations;
    private final ClassTutorAttendanceSignalRepository attendanceSignals;
    private final TutorAbsenceProbationRepository probations;
    private final TutorAbsenceGovernanceProperties governanceProperties;

    @org.springframework.beans.factory.annotation.Autowired
    public TerminationSignals(
            ContractAgreementRepository agreements,
            SessionSettlementRepository settlements,
            DisputeRepository disputes,
            TerminationService terminations,
            ClassTutorAttendanceSignalRepository attendanceSignals,
            TutorAbsenceProbationRepository probations,
            TutorAbsenceGovernanceProperties governanceProperties) {
        this.agreements = agreements;
        this.settlements = settlements;
        this.disputes = disputes;
        this.terminations = terminations;
        this.attendanceSignals = attendanceSignals;
        this.probations = probations;
        this.governanceProperties = governanceProperties;
    }

    public TerminationSignals(
            ContractAgreementRepository agreements,
            SessionSettlementRepository settlements,
            DisputeRepository disputes,
            TerminationService terminations) {
        this(agreements, settlements, disputes, terminations, null, null, null);
    }

    @Transactional
    public void detectForClassroom(Long classroomId, Integer nextSessionSequence, OffsetDateTime nextSessionStartAt) {
        if (classroomId == null) return;
        TutorAbsenceGovernanceProperties.Mode mode = governanceProperties != null
                ? governanceProperties.getEffectiveMode(classroomId)
                : TutorAbsenceGovernanceProperties.Mode.OFF;

        if (mode == TutorAbsenceGovernanceProperties.Mode.OFF) {
            log.debug("Tutor absence governance is OFF for classroom {}", classroomId);
            return;
        }

        if (attendanceSignals == null) return;

        // 1. Check active probation first
        if (probations != null) {
            var activeProbationOpt = probations.findActiveByClassroomIdForUpdate(classroomId);
            if (activeProbationOpt.isPresent()) {
                var probation = activeProbationOpt.get();
                var probationSignalOpt = attendanceSignals.findByClassroomIdAndSessionSequence(classroomId, probation.getSessionSequence());
                if (probationSignalOpt.isPresent()) {
                    var probSignal = probationSignalOpt.get();
                    if ("TUTOR_ABSENT".equals(probSignal.getTutorAttendanceOutcome())) {
                        if (mode == TutorAbsenceGovernanceProperties.Mode.ENFORCE) {
                            log.warn("Tutor absence probation RELAPSE detected for classroom {} at sequence {}",
                                    classroomId, probation.getSessionSequence());
                            terminations.requestAbsenceGovernanceRelapse(classroomId, probation, probSignal);
                        } else {
                            log.info("[SHADOW] Tutor absence probation RELAPSE detected for classroom {} at sequence {}",
                                    classroomId, probation.getSessionSequence());
                        }
                        return;
                    } else if ("TUTOR_PRESENT".equals(probSignal.getTutorAttendanceOutcome())) {
                        if (mode == TutorAbsenceGovernanceProperties.Mode.ENFORCE) {
                            probation.setStatus("PASSED");
                            probation.setActiveClassroomGuard(null);
                            probation.setResolvedAt(OffsetDateTime.now(ZoneOffset.UTC));
                            probations.saveAndFlush(probation);
                            log.info("Tutor absence probation PASSED for classroom {} sequence {}",
                                    classroomId, probation.getSessionSequence());
                        } else {
                            log.info("[SHADOW] Tutor absence probation would PASS for classroom {} sequence {}",
                                    classroomId, probation.getSessionSequence());
                        }
                        return;
                    }
                }
            }
        }

        // 2. Check 3 consecutive absences at classroom level
        var signals = attendanceSignals.findByClassroomIdOrderBySessionSequenceAsc(classroomId);
        if (signals.size() < 3) return;

        int consecutiveAbsences = 0;
        Integer lastSequence = null;
        Integer triggerSequence = null;

        for (var s : signals) {
            int seq = s.getSessionSequence();
            String outcome = s.getTutorAttendanceOutcome();

            if (lastSequence != null && seq != lastSequence + 1) {
                consecutiveAbsences = 0;
            }
            lastSequence = seq;

            if ("TUTOR_ABSENT".equals(outcome)) {
                consecutiveAbsences++;
                if (consecutiveAbsences >= 3) {
                    triggerSequence = seq;
                }
            } else {
                consecutiveAbsences = 0;
            }
        }

        if (triggerSequence != null) {
            var triggerSignal = attendanceSignals
                    .findByClassroomIdAndSessionSequence(classroomId, triggerSequence)
                    .orElse(null);
            if (triggerSignal == null
                    || triggerSignal.getNextSessionSequence() == null
                    || triggerSignal.getNextSessionStartAt() == null) {
                log.info("Tutor absence candidate for classroom {} sequence {} has no real next-session snapshot; no governance case is opened",
                        classroomId, triggerSequence);
                return;
            }
            if (hasContradictingSettlement(classroomId, triggerSequence)) {
                log.warn("Tutor absence signal conflicts with settlement data for classroom {} sequence {}; keeping candidate in manual/shadow review",
                        classroomId, triggerSequence);
                return;
            }
            if (mode == TutorAbsenceGovernanceProperties.Mode.ENFORCE) {
                log.info("Triggering AUTO_TUTOR_ABSENCE governance for classroom {} at sequence {}",
                        classroomId, triggerSequence);
                terminations.requestAbsenceGovernanceCase(
                        classroomId,
                        triggerSequence,
                        triggerSignal.getNextSessionSequence(),
                        triggerSignal.getNextSessionStartAt());
            } else {
                log.info("[SHADOW] AUTO_TUTOR_ABSENCE candidate for classroom {} at sequence {}",
                        classroomId, triggerSequence);
            }
        }
    }

    private boolean hasContradictingSettlement(Long classroomId, int sequence) {
        return agreements.findByClassroomIdOrderByCreatedAtAsc(classroomId).stream()
                .filter(TerminationSignals::activeAgreement)
                .flatMap(agreement -> settlements.findByAgreementId(agreement.getId()).stream())
                .filter(settlement -> Objects.equals(settlement.getSessionId(), (long) sequence))
                .anyMatch(settlement -> settlement.getOutcome() != SettlementOutcome.TUTOR_ABSENT);
    }

    private static boolean activeAgreement(ContractAgreement agreement) {
        return agreement.getStatus() == ContractAgreementStatus.ACTIVE && !agreement.isLegacyExcluded();
    }

    @Transactional
    public void detect() {
        Set<Long> processedClassrooms = new HashSet<>();
        for (var a : agreements.findByStatus(ContractAgreementStatus.ACTIVE)) {
            if (a.isLegacyExcluded() || a.getTerminationCutoffSession() != null) continue;
            Long classroomId = a.getClassroomId();

            if (classroomId != null && processedClassrooms.add(classroomId)) {
                TutorAbsenceGovernanceProperties.Mode mode = governanceProperties != null
                        ? governanceProperties.getEffectiveMode(classroomId)
                        : TutorAbsenceGovernanceProperties.Mode.OFF;
                if (mode != TutorAbsenceGovernanceProperties.Mode.OFF) {
                    detectForClassroom(classroomId, null, null);
                }
            }

            var rows = settlements.findByAgreementId(a.getId()).stream()
                    .sorted(Comparator.comparing(SessionSettlement::getSessionId).reversed()).limit(3).toList();
            if (rows.size() != 3 || rows.getFirst().getSessionId() - rows.getLast().getSessionId() != 2) continue;
            boolean upheld = rows.stream().allMatch(s -> disputes.findBySettlementId(s.getId())
                    .map(d -> d.getStatus() == DisputeStatus.APPROVED).orElse(false));
            if (upheld) {
                String key = "UPHELD_COMPLAINT:" + a.getClassroomId() + ":" + rows.getFirst().getSessionId();
                terminations.requestSystemReview(a.getId(), key,
                        "He thong ghi nhan khieu nai duoc chap thuan trong 3 buoi lien tiep. Staff can xem ho so va de xuat xu ly.");
            } else if (governanceProperties == null || governanceProperties.getEffectiveMode(classroomId) == TutorAbsenceGovernanceProperties.Mode.OFF) {
                boolean absent = rows.stream().allMatch(s -> s.getOutcome() == SettlementOutcome.TUTOR_ABSENT);
                if (absent) {
                    String key = "TUTOR_ABSENT:" + a.getClassroomId() + ":" + rows.getFirst().getSessionId();
                    terminations.requestSystemReview(a.getId(), key,
                            "He thong ghi nhan 3 buoi lien tiep co ket qua gia su vang. Staff can xac minh diem danh va su co truoc khi de xuat cham dut.");
                }
            }
        }
    }
}
