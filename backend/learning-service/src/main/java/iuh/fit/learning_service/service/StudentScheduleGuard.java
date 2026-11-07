package iuh.fit.learning_service.service;

import iuh.fit.learning_service.exception.BadRequestException;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class StudentScheduleGuard {
    private final JdbcTemplate jdbcTemplate;

    public StudentScheduleGuard(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /** Serializes schedule reservations for one student across classrooms. */
    public void lock(Long studentId) {
        if (studentId == null || studentId <= 0) {
            throw new BadRequestException("Không xác định được học viên để kiểm tra lịch học.");
        }
        jdbcTemplate.execute((ConnectionCallback<Void>) connection -> {
            try (var statement = connection.prepareStatement(
                    "SELECT pg_advisory_xact_lock(hashtextextended('student-schedule:' || CAST(? AS text), 0))")) {
                statement.setLong(1, studentId);
                statement.execute();
            }
            return null;
        });
    }
}
