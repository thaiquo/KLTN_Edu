package iuh.fit.contract_service.service;

import iuh.fit.contract_service.dto.TutorIncomeStatisticsSourceResponse;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;

@Service
public class TutorIncomeStatisticsService {
    private static final List<Integer> ALLOWED_RANGES = List.of(7, 30, 90);
    private static final String PENDING_STATUSES = "'PREPARING','PROPOSE_PENDING','PROPOSED','FINALIZE_PENDING','FAILED_RETRYABLE','DISPUTE_OPENING','DISPUTED'";
    private final NamedParameterJdbcTemplate jdbc;

    public TutorIncomeStatisticsService(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public TutorIncomeStatisticsSourceResponse getStatistics(Long tutorId, String tutorEmail, int requestedRangeDays) {
        int rangeDays = ALLOWED_RANGES.contains(requestedRangeDays) ? requestedRangeDays : 30;
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("tutorId", tutorId)
                .addValue("email", tutorEmail)
                .addValue("rangeDays", rangeDays);

        Map<String, Object> currencyRow = jdbc.query("""
                SELECT token_symbol, token_decimals, count(*) AS usage_count
                FROM contract_agreement
                WHERE legacy_excluded = false
                  AND (tutor_id = :tutorId OR lower(tutor_email) = lower(:email))
                GROUP BY token_symbol, token_decimals
                ORDER BY usage_count DESC, token_symbol ASC LIMIT 1
                """, params, rs -> rs.next() ? Map.of(
                "symbol", rs.getString("token_symbol"),
                "decimals", rs.getInt("token_decimals")
        ) : Map.of("symbol", "USDC", "decimals", 6));
        String currency = String.valueOf(currencyRow.get("symbol"));
        int decimals = ((Number) currencyRow.get("decimals")).intValue();

        String summarySql = """
                SELECT coalesce(sum(CASE WHEN s.status = 'SETTLED' THEN coalesce(s.tutor_amount, 0) ELSE 0 END), 0) AS released_units,
                       coalesce(sum(CASE WHEN s.status IN (%s) THEN
                           coalesce(s.tutor_amount,
                               CASE s.outcome
                                   WHEN 'BOTH_PRESENT' THEN floor(s.amount * 85 / 100)
                                   WHEN 'STUDENT_ABSENT_TUTOR_PRESENT' THEN floor(s.amount * 45 / 100)
                                   ELSE 0
                               END)
                           ELSE 0 END), 0) AS pending_units,
                       count(*) FILTER (WHERE s.status = 'SETTLED') AS settled_count,
                       count(*) FILTER (WHERE s.status IN (%s)) AS pending_count
                FROM session_settlement s JOIN contract_agreement a ON a.id = s.agreement_id
                WHERE a.legacy_excluded = false
                  AND a.token_symbol = :currency AND a.token_decimals = :decimals
                  AND (a.tutor_id = :tutorId OR lower(a.tutor_email) = lower(:email))
                """.formatted(PENDING_STATUSES, PENDING_STATUSES);
        Map<String, Object> summary = jdbc.queryForMap(
                summarySql, params.addValue("currency", currency).addValue("decimals", decimals));
        BigDecimal released = units(summary.get("released_units"), decimals);
        BigDecimal pending = units(summary.get("pending_units"), decimals);

        List<TutorIncomeStatisticsSourceResponse.IncomeTrendPoint> trend = jdbc.query("""
                SELECT to_char(date_trunc('month', s.updated_at), 'YYYY-MM') AS period,
                       coalesce(sum(coalesce(s.tutor_amount, 0)), 0) AS released_units,
                       count(*) AS payout_count
                FROM session_settlement s JOIN contract_agreement a ON a.id = s.agreement_id
                WHERE a.legacy_excluded = false AND s.status = 'SETTLED'
                  AND a.token_symbol = :currency AND a.token_decimals = :decimals
                  AND s.updated_at >= current_timestamp - make_interval(days => :rangeDays)
                  AND (a.tutor_id = :tutorId OR lower(a.tutor_email) = lower(:email))
                GROUP BY date_trunc('month', s.updated_at)
                ORDER BY date_trunc('month', s.updated_at) ASC
                """, params, (rs, rowNum) -> new TutorIncomeStatisticsSourceResponse.IncomeTrendPoint(
                rs.getString("period"), units(rs.getObject("released_units"), decimals), rs.getLong("payout_count")
        ));

        String classBreakdownSql = """
                SELECT a.classroom_id, max(a.class_name) AS class_name,
                       coalesce(sum(CASE WHEN s.status = 'SETTLED' THEN coalesce(s.tutor_amount, 0) ELSE 0 END), 0) AS released_units,
                       coalesce(sum(CASE WHEN s.status IN (%s) THEN
                           coalesce(s.tutor_amount,
                               CASE s.outcome WHEN 'BOTH_PRESENT' THEN floor(s.amount * 85 / 100)
                                   WHEN 'STUDENT_ABSENT_TUTOR_PRESENT' THEN floor(s.amount * 45 / 100) ELSE 0 END)
                           ELSE 0 END), 0) AS pending_units,
                       count(*) FILTER (WHERE s.status = 'SETTLED') AS settled_count,
                       max(s.updated_at) AS last_activity
                FROM session_settlement s JOIN contract_agreement a ON a.id = s.agreement_id
                WHERE a.legacy_excluded = false
                  AND a.token_symbol = :currency AND a.token_decimals = :decimals
                  AND (a.tutor_id = :tutorId OR lower(a.tutor_email) = lower(:email))
                GROUP BY a.classroom_id
                ORDER BY last_activity DESC NULLS LAST, a.classroom_id DESC LIMIT 10
                """.formatted(PENDING_STATUSES);
        List<TutorIncomeStatisticsSourceResponse.ClassIncome> classes = jdbc.query(classBreakdownSql, params, (rs, rowNum) -> new TutorIncomeStatisticsSourceResponse.ClassIncome(
                rs.getLong("classroom_id"), rs.getString("class_name"),
                units(rs.getObject("released_units"), decimals), units(rs.getObject("pending_units"), decimals),
                rs.getLong("settled_count")
        ));

        List<TutorIncomeStatisticsSourceResponse.RecentSettlement> recent = jdbc.query("""
                SELECT s.id, a.classroom_id, a.class_name, s.session_id, s.status, s.outcome,
                       coalesce(s.tutor_amount,
                           CASE s.outcome WHEN 'BOTH_PRESENT' THEN floor(s.amount * 85 / 100)
                               WHEN 'STUDENT_ABSENT_TUTOR_PRESENT' THEN floor(s.amount * 45 / 100) ELSE 0 END) AS tutor_units,
                       s.updated_at
                FROM session_settlement s JOIN contract_agreement a ON a.id = s.agreement_id
                WHERE a.legacy_excluded = false
                  AND a.token_symbol = :currency AND a.token_decimals = :decimals
                  AND (a.tutor_id = :tutorId OR lower(a.tutor_email) = lower(:email))
                ORDER BY s.updated_at DESC, s.id DESC LIMIT 10
                """, params, (rs, rowNum) -> new TutorIncomeStatisticsSourceResponse.RecentSettlement(
                rs.getString("id"), rs.getLong("classroom_id"), rs.getString("class_name"),
                rs.getLong("session_id"), rs.getString("status"), rs.getString("outcome"),
                units(rs.getObject("tutor_units"), decimals), ((Timestamp) rs.getObject("updated_at")).toInstant().atOffset(java.time.ZoneOffset.UTC)
        ));

        return new TutorIncomeStatisticsSourceResponse(
                Instant.now().toString(), rangeDays, currency, decimals,
                released, released, pending,
                number(summary, "settled_count"), number(summary, "pending_count"), trend, classes, recent
        );
    }

    private BigDecimal units(Object value, int decimals) {
        BigDecimal raw = value == null ? BigDecimal.ZERO : new BigDecimal(value.toString());
        return raw.movePointLeft(decimals).setScale(Math.min(decimals, 6), RoundingMode.DOWN).stripTrailingZeros();
    }

    private long number(Map<String, Object> row, String key) {
        Object value = row.get(key);
        return value instanceof Number number ? number.longValue() : 0L;
    }
}
