package iuh.fit.contract_service.dto;

import java.math.BigDecimal;
import java.util.List;

public record AdminFinancialTrendResponse(
        String generatedAt,
        int rangeDays,
        String bucket,
        List<CurrencySeries> series
) {
    public record CurrencySeries(
            String currency,
            int currencyDecimals,
            Totals totals,
            List<TrendPoint> points
    ) { }

    public record Totals(
            BigDecimal releasedAmount,
            BigDecimal pendingAmount,
            BigDecimal refundAmount,
            BigDecimal contractValue,
            long settlementCount,
            long contractCount
    ) { }

    public record TrendPoint(
            String period,
            BigDecimal releasedAmount,
            BigDecimal pendingAmount,
            BigDecimal refundAmount,
            BigDecimal contractValue,
            long settlementCount,
            long contractCount
    ) { }
}
