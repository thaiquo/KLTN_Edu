package iuh.fit.contract_service.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

public record TutorIncomeStatisticsSourceResponse(
        String generatedAt,
        int rangeDays,
        String currency,
        int currencyDecimals,
        BigDecimal totalEarned,
        BigDecimal releasedAmount,
        BigDecimal pendingAmount,
        long settledPayouts,
        long pendingPayouts,
        List<IncomeTrendPoint> incomeTrend,
        List<ClassIncome> classBreakdown,
        List<RecentSettlement> recentSettlements
) {
    public record IncomeTrendPoint(String period, BigDecimal releasedAmount, long payoutCount) { }

    public record ClassIncome(
            long classRoomId,
            String className,
            BigDecimal releasedAmount,
            BigDecimal pendingAmount,
            long settledPayouts
    ) { }

    public record RecentSettlement(
            String settlementId,
            long classRoomId,
            String className,
            long sessionId,
            String status,
            String outcome,
            BigDecimal tutorAmount,
            OffsetDateTime updatedAt
    ) { }
}
