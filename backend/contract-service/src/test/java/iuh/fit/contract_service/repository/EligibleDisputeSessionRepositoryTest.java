package iuh.fit.contract_service.repository;

import iuh.fit.contract_service.entity.ContractAgreement;
import iuh.fit.contract_service.entity.SessionSettlement;
import iuh.fit.contract_service.enums.ContractAgreementStatus;
import iuh.fit.contract_service.enums.SettlementOutcome;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = {
        "spring.flyway.enabled=false",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@Transactional
class EligibleDisputeSessionRepositoryTest {
    @Autowired private ContractAgreementRepository agreements;
    @Autowired private SessionSettlementRepository settlements;

    @Test
    void eligibleSessionBeyondFirstFiftyRemainsReachableAndOwnershipIsEnforced() {
        var agreement = agreements.save(agreement(42L, "student@example.com"));
        var other = agreements.save(agreement(99L, "other@example.com"));
        var deadline = OffsetDateTime.now().plusHours(12);
        var rows = new ArrayList<SessionSettlement>();
        for (long session = 1; session <= 61; session++) {
            var settlement = SessionSettlement.create(
                    agreement, session, "0x" + String.format("%064x", session),
                    SettlementOutcome.BOTH_PRESENT, BigInteger.valueOf(600_000), "0x" + "1".repeat(64));
            settlement.markProposed(deadline.plusMinutes(session), "0x" + "2".repeat(64));
            rows.add(settlement);
        }
        var excluded = SessionSettlement.create(
                other, 999L, "0x" + "3".repeat(64), SettlementOutcome.BOTH_PRESENT,
                BigInteger.valueOf(600_000), "0x" + "4".repeat(64));
        excluded.markProposed(deadline, "0x" + "5".repeat(64));
        rows.add(excluded);
        settlements.saveAllAndFlush(rows);

        var page = settlements.findEligibleStudentDisputes(
                42L, "student@example.com", OffsetDateTime.now(), null, null,
                PageRequest.of(5, 10, Sort.by("disputeDeadline", "id")));

        assertThat(page.getTotalElements()).isEqualTo(61);
        assertThat(page.getContent()).hasSize(10);
        assertThat(page.getContent()).allMatch(row -> row.getSessionId() > 50 && row.getSessionId() <= 60);
        assertThat(page.getContent()).allMatch(row -> row.getAgreement().getStudentId().equals(42L));
    }

    private ContractAgreement agreement(Long studentId, String email) {
        var now = OffsetDateTime.now();
        return ContractAgreement.builder()
                .id(UUID.randomUUID()).classroomId(1L).studentId(studentId).tutorId(7L)
                .studentEmail(email).tutorEmail("tutor@example.com").className("Lớp kiểm thử")
                .studentWallet("0x" + "1".repeat(40)).tutorWallet("0x" + "2".repeat(40))
                .platformWallet("0x" + "3".repeat(40)).tokenSymbol("USDC").tokenDecimals((short) 6)
                .termsJson("{}").termsHash("0x" + "4".repeat(64)).contractVersion(1)
                .totalPriceVnd(BigDecimal.valueOf(1_000_000)).vndPerUsdc(BigDecimal.valueOf(25_000))
                .totalAmountUsdcUnits(BigInteger.valueOf(40_000_000))
                .pricePerSessionUsdcUnits(BigInteger.valueOf(600_000)).totalSessions(100)
                .status(ContractAgreementStatus.ACTIVE).createdAt(now).updatedAt(now)
                .build();
    }
}
