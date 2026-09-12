package iuh.fit.contract_service.service;

import iuh.fit.contract_service.entity.ContractAgreement;
import iuh.fit.contract_service.entity.SessionSettlement;
import iuh.fit.contract_service.enums.SettlementOutcome;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import java.math.BigInteger;
import static org.junit.jupiter.api.Assertions.*;

class SettlementRoundingTest {
    @Test
    void acceptsSolidityRoundingDustRefundAndRejectsGivingItToPlatform() {
        var settlement = SessionSettlement.create(new ContractAgreement(), 1L, "id",
                SettlementOutcome.BOTH_PRESENT, BigInteger.valueOf(101), "evidence");
        assertDoesNotThrow(() -> validate(settlement, 85, 15, 1));
        assertThrows(IllegalStateException.class, () -> validate(settlement, 85, 16, 0));
        settlement.markDisputed();
        assertDoesNotThrow(() -> validate(settlement, 85, 15, 1));
    }

    private void validate(SessionSettlement settlement, int tutor, int platform, int refund) {
        ReflectionTestUtils.invokeMethod(SessionSettlementWorkflowService.class, "validateSettlementDistribution",
                settlement, false, BigInteger.valueOf(tutor), BigInteger.valueOf(platform), BigInteger.valueOf(refund));
    }
}
