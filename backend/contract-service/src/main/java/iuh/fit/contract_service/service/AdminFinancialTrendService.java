package iuh.fit.contract_service.service;

import iuh.fit.contract_service.dto.AdminFinancialTrendResponse;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class AdminFinancialTrendService {
    private static final List<Integer> ALLOWED_RANGES = List.of(30, 90);
    private static final String PENDING_STATUSES =
            "'PREPARING','PROPOSE_PENDING','PROPOSED','DISPUTE_OPENING','DISPUTED','FINALIZE_PENDING','FAILED_RETRYABLE'";
    private static final DateTimeFormatter PERIOD_FORMAT = DateTimeFormatter.ISO_LOCAL_DATE;

    private final NamedParameterJdbcTemplate jdbc;

    public AdminFinancialTrendService(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public AdminFinancialTrendResponse getTrend(int requestedRangeDays) {
        if (!ALLOWED_RANGES.contains(requestedRangeDays)) {
            throw new IllegalArgumentException("rangeDays must be 30 or 90");
        }
        String bucket = requestedRangeDays <= 30 ? "day" : "week";
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("rangeDays", requestedRangeDays)
                .addValue("bucket", bucket);
        Map<SeriesKey, MutableSeries> result = new LinkedHashMap<>();

        jdbc.query(settlementSql(), params, rs -> {
            MutablePoint point = point(result, key(rs.getString("currency"), rs.getInt("decimals")),
                    period(rs.getTimestamp("period")));
            point.released = units(rs.getObject("released_units"), rs.getInt("decimals"));
            point.pending = units(rs.getObject("pending_units"), rs.getInt("decimals"));
            point.refund = units(rs.getObject("refund_units"), rs.getInt("decimals"));
            point.settlementCount = rs.getLong("settlement_count");
        });
        jdbc.query(agreementSql(), params, rs -> {
            MutablePoint point = point(result, key(rs.getString("currency"), rs.getInt("decimals")),
                    period(rs.getTimestamp("period")));
            point.contractValue = units(rs.getObject("contract_units"), rs.getInt("decimals"));
            point.contractCount = rs.getLong("contract_count");
        });
        jdbc.query(terminationRefundSql(), params, rs -> {
            MutablePoint point = point(result, key(rs.getString("currency"), rs.getInt("decimals")),
                    period(rs.getTimestamp("period")));
            point.refund = point.refund.add(units(rs.getObject("refund_units"), rs.getInt("decimals")));
        });

        List<AdminFinancialTrendResponse.CurrencySeries> series = result.entrySet().stream()
                .sorted(Map.Entry.comparingByKey(Comparator.comparing(SeriesKey::currency)))
                .map(entry -> entry.getValue().toResponse(entry.getKey()))
                .toList();
        return new AdminFinancialTrendResponse(Instant.now().toString(), requestedRangeDays, bucket, series);
    }

    private String settlementSql() {
        return """
                SELECT date_trunc(:bucket, s.updated_at) AS period,
                       a.token_symbol AS currency, a.token_decimals AS decimals,
                       coalesce(sum(CASE WHEN s.status = 'SETTLED'
                           THEN coalesce(s.tutor_amount, 0) + coalesce(s.platform_amount, 0) ELSE 0 END), 0) AS released_units,
                       coalesce(sum(CASE WHEN s.status IN (%s) THEN s.amount ELSE 0 END), 0) AS pending_units,
                       coalesce(sum(CASE WHEN s.status IN ('SETTLED','REFUNDED')
                           THEN coalesce(s.student_refund_amount, 0) ELSE 0 END), 0) AS refund_units,
                       count(*) FILTER (WHERE s.status = 'SETTLED') AS settlement_count
                FROM session_settlement s
                JOIN contract_agreement a ON a.id = s.agreement_id
                WHERE a.legacy_excluded = false
                  AND s.status <> 'EXCLUDED_LEGACY'
                  AND s.updated_at >= current_timestamp - make_interval(days => :rangeDays)
                GROUP BY 1, 2, 3
                ORDER BY period ASC
                """.formatted(PENDING_STATUSES);
    }

    private String agreementSql() {
        return """
                SELECT date_trunc(:bucket, a.created_at) AS period,
                       a.token_symbol AS currency, a.token_decimals AS decimals,
                       coalesce(sum(a.total_amount_usdc_units), 0) AS contract_units,
                       count(*) AS contract_count
                FROM contract_agreement a
                WHERE a.legacy_excluded = false
                  AND a.created_at >= current_timestamp - make_interval(days => :rangeDays)
                GROUP BY 1, 2, 3
                ORDER BY period ASC
                """;
    }

    private String terminationRefundSql() {
        return """
                SELECT date_trunc(:bucket, t.updated_at) AS period,
                       a.token_symbol AS currency, a.token_decimals AS decimals,
                       coalesce(sum(t.refunded_units), 0) AS refund_units
                FROM termination_item t
                JOIN contract_agreement a ON a.id = t.agreement_id
                WHERE a.legacy_excluded = false
                  AND upper(t.status) = 'COMPLETED'
                  AND t.refunded_units IS NOT NULL
                  AND t.updated_at >= current_timestamp - make_interval(days => :rangeDays)
                GROUP BY 1, 2, 3
                ORDER BY period ASC
                """;
    }

    private MutablePoint point(Map<SeriesKey, MutableSeries> result, SeriesKey key, String period) {
        return result.computeIfAbsent(key, ignored -> new MutableSeries())
                .points.computeIfAbsent(period, ignored -> new MutablePoint());
    }

    private SeriesKey key(String currency, int decimals) {
        return new SeriesKey(currency == null || currency.isBlank() ? "UNKNOWN" : currency, decimals);
    }

    private String period(Timestamp value) {
        return value.toInstant().atOffset(ZoneOffset.UTC).toLocalDate().format(PERIOD_FORMAT);
    }

    private BigDecimal units(Object value, int decimals) {
        BigDecimal raw = value == null ? BigDecimal.ZERO : new BigDecimal(value.toString());
        return raw.movePointLeft(decimals).setScale(Math.min(decimals, 6), RoundingMode.DOWN).stripTrailingZeros();
    }

    private record SeriesKey(String currency, int decimals) { }

    private static final class MutableSeries {
        private final Map<String, MutablePoint> points = new LinkedHashMap<>();

        private AdminFinancialTrendResponse.CurrencySeries toResponse(SeriesKey key) {
            List<AdminFinancialTrendResponse.TrendPoint> rows = points.entrySet().stream()
                    .sorted(Map.Entry.comparingByKey())
                    .map(entry -> entry.getValue().toResponse(entry.getKey()))
                    .toList();
            BigDecimal released = sum(rows, AdminFinancialTrendResponse.TrendPoint::releasedAmount);
            BigDecimal pending = sum(rows, AdminFinancialTrendResponse.TrendPoint::pendingAmount);
            BigDecimal refund = sum(rows, AdminFinancialTrendResponse.TrendPoint::refundAmount);
            BigDecimal contractValue = sum(rows, AdminFinancialTrendResponse.TrendPoint::contractValue);
            long settlementCount = rows.stream().mapToLong(AdminFinancialTrendResponse.TrendPoint::settlementCount).sum();
            long contractCount = rows.stream().mapToLong(AdminFinancialTrendResponse.TrendPoint::contractCount).sum();
            return new AdminFinancialTrendResponse.CurrencySeries(key.currency(), key.decimals(),
                    new AdminFinancialTrendResponse.Totals(released, pending, refund, contractValue,
                            settlementCount, contractCount), rows);
        }

        private BigDecimal sum(List<AdminFinancialTrendResponse.TrendPoint> rows,
                               java.util.function.Function<AdminFinancialTrendResponse.TrendPoint, BigDecimal> getter) {
            return rows.stream().map(getter).reduce(BigDecimal.ZERO, BigDecimal::add);
        }
    }

    private static final class MutablePoint {
        private BigDecimal released = BigDecimal.ZERO;
        private BigDecimal pending = BigDecimal.ZERO;
        private BigDecimal refund = BigDecimal.ZERO;
        private BigDecimal contractValue = BigDecimal.ZERO;
        private long settlementCount;
        private long contractCount;

        private AdminFinancialTrendResponse.TrendPoint toResponse(String period) {
            return new AdminFinancialTrendResponse.TrendPoint(period, released, pending, refund, contractValue,
                    settlementCount, contractCount);
        }
    }
}
