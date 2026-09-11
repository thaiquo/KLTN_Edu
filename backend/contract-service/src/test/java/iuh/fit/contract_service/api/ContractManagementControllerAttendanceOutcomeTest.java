package iuh.fit.contract_service.api;

import iuh.fit.contract_service.enums.SettlementOutcome;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ContractManagementControllerAttendanceOutcomeTest {

    @Test
    void noCheckInRecordUsesExistingTutorAbsentRule() {
        SettlementOutcome outcome = ContractManagementController.resolveAttendanceOutcome(Map.of(), 7L);

        assertEquals(SettlementOutcome.TUTOR_ABSENT, outcome);
    }

    @Test
    void finalizedAttendanceOutcomeRemainsAuthoritative() {
        SettlementOutcome outcome = ContractManagementController.resolveAttendanceOutcome(
                Map.of(7L, SettlementOutcome.STUDENT_ABSENT_TUTOR_PRESENT.name()), 7L);

        assertEquals(SettlementOutcome.STUDENT_ABSENT_TUTOR_PRESENT, outcome);
    }

    @Test
    void malformedAttendanceOutcomeFailsSafeToTutorAbsent() {
        SettlementOutcome outcome = ContractManagementController.resolveAttendanceOutcome(
                Map.of(7L, "UNTRUSTED_VALUE"), 7L);

        assertEquals(SettlementOutcome.TUTOR_ABSENT, outcome);
    }
}
