package iuh.fit.contract_service.service;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AdminFinancialTrendServiceTest {
    @Test
    void aggregatesReleasedPendingSessionAndTerminationRefundsByBucket() throws Exception {
        NamedParameterJdbcTemplate jdbc = mock(NamedParameterJdbcTemplate.class);
        doAnswer(invocation -> {
            String sql = invocation.getArgument(0);
            RowCallbackHandler handler = invocation.getArgument(2);
            ResultSet row = baseRow("2026-11-10T00:00:00Z");
            if (sql.contains("FROM session_settlement")) {
                when(row.getObject("released_units")).thenReturn(new BigDecimal("10000000"));
                when(row.getObject("pending_units")).thenReturn(new BigDecimal("5000000"));
                when(row.getObject("refund_units")).thenReturn(new BigDecimal("2000000"));
                when(row.getLong("settlement_count")).thenReturn(2L);
            } else if (sql.contains("FROM contract_agreement")) {
                when(row.getObject("contract_units")).thenReturn(new BigDecimal("30000000"));
                when(row.getLong("contract_count")).thenReturn(3L);
            } else {
                when(row.getObject("refund_units")).thenReturn(new BigDecimal("1000000"));
            }
            handler.processRow(row);
            return null;
        }).when(jdbc).query(anyString(), any(MapSqlParameterSource.class), any(RowCallbackHandler.class));

        var response = new AdminFinancialTrendService(jdbc).getTrend(30);

        assertThat(response.rangeDays()).isEqualTo(30);
        assertThat(response.bucket()).isEqualTo("day");
        assertThat(response.series()).hasSize(1);
        var totals = response.series().getFirst().totals();
        assertThat(totals.releasedAmount()).isEqualByComparingTo("10");
        assertThat(totals.pendingAmount()).isEqualByComparingTo("5");
        assertThat(totals.refundAmount()).isEqualByComparingTo("3");
        assertThat(totals.contractValue()).isEqualByComparingTo("30");
        assertThat(totals.settlementCount()).isEqualTo(2);
        assertThat(totals.contractCount()).isEqualTo(3);
    }

    @Test
    void returnsEmptySeriesForEmptyPeriodAndRejectsUnsupportedRange() {
        NamedParameterJdbcTemplate jdbc = mock(NamedParameterJdbcTemplate.class);
        var service = new AdminFinancialTrendService(jdbc);

        assertThat(service.getTrend(90).series()).isEmpty();
        assertThat(service.getTrend(90).bucket()).isEqualTo("week");
        assertThatThrownBy(() -> service.getTrend(7)).isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("30 or 90");
    }

    private ResultSet baseRow(String at) throws Exception {
        ResultSet row = mock(ResultSet.class);
        when(row.getString("currency")).thenReturn("USDC");
        when(row.getInt("decimals")).thenReturn(6);
        when(row.getTimestamp("period")).thenReturn(Timestamp.from(Instant.parse(at)));
        return row;
    }
}
