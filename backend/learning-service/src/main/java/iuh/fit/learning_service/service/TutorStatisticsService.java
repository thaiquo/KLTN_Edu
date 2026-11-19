package iuh.fit.learning_service.service;

import iuh.fit.learning_service.dto.TutorStatisticsSourceResponse;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Date;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class TutorStatisticsService {
    private static final List<Integer> ALLOWED_RANGES = List.of(7, 30, 90);
    private final NamedParameterJdbcTemplate jdbc;

    public TutorStatisticsService(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public TutorStatisticsSourceResponse getStatistics(String tutorEmail, Long tutorUserId, int requestedRangeDays) {
        int rangeDays = ALLOWED_RANGES.contains(requestedRangeDays) ? requestedRangeDays : 30;
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("email", tutorEmail)
                .addValue("tutorUserId", tutorUserId)
                .addValue("rangeDays", rangeDays);

        Map<String, Object> totals = jdbc.queryForMap("""
                WITH tutor_classes AS (
                    SELECT id, status, start_date
                    FROM class_rooms
                    WHERE lower(tutor_email) = lower(:email)
                ), enrollment AS (
                    SELECT count(DISTINCT coalesce('id:' || er.student_id::text, 'email:' || lower(er.student_email)))
                               FILTER (WHERE er.status = 'ENROLLED') AS active_students
                    FROM enrollment_requests er JOIN tutor_classes tc ON tc.id = er.class_room_id
                ), sessions AS (
                    SELECT count(*) AS total_sessions,
                           count(*) FILTER (WHERE cs.status = 'COMPLETED') AS completed_sessions,
                           count(*) FILTER (WHERE cs.status = 'SCHEDULED' AND cs.session_date >= current_date) AS upcoming_sessions,
                           count(*) FILTER (WHERE cs.status = 'CANCELLED') AS cancelled_sessions,
                           count(*) FILTER (WHERE cs.submission_required = true OR cs.assignment_title IS NOT NULL
                               OR cs.assignment_description IS NOT NULL OR cs.assignment_file_url IS NOT NULL
                               OR cs.assignment_external_url IS NOT NULL) AS assignments_created,
                           count(*) FILTER (WHERE cs.status = 'IN_PROGRESS'
                               OR (cs.status = 'SCHEDULED' AND cs.session_date < current_date)) AS session_actions_pending
                    FROM class_sessions cs JOIN tutor_classes tc ON tc.id = cs.class_room_id
                ), submissions AS (
                    SELECT count(*) FILTER (WHERE sa.submitted_at IS NOT NULL) AS submitted_assignments,
                           count(*) FILTER (WHERE sa.submitted_at IS NOT NULL AND sa.graded_at IS NULL) AS pending_submissions,
                           count(*) FILTER (WHERE sa.graded_at IS NOT NULL) AS graded_submissions
                    FROM session_attendances sa
                    JOIN class_sessions cs ON cs.id = sa.session_id
                    JOIN tutor_classes tc ON tc.id = cs.class_room_id
                )
                SELECT count(*) FILTER (WHERE tc.status IN ('ACTIVE', 'LOCKED')) AS active_classes,
                       count(*) FILTER (WHERE tc.status = 'PUBLISHED' AND tc.start_date >= current_date) AS upcoming_classes,
                       coalesce(max(enrollment.active_students), 0) AS active_students,
                       coalesce(max(sessions.total_sessions), 0) AS total_sessions,
                       coalesce(max(sessions.completed_sessions), 0) AS completed_sessions,
                       coalesce(max(sessions.upcoming_sessions), 0) AS upcoming_sessions,
                       coalesce(max(sessions.cancelled_sessions), 0) AS cancelled_sessions,
                       coalesce(max(sessions.assignments_created), 0) AS assignments_created,
                       coalesce(max(sessions.session_actions_pending), 0) AS session_actions_pending,
                       coalesce(max(submissions.submitted_assignments), 0) AS submitted_assignments,
                       coalesce(max(submissions.pending_submissions), 0) AS pending_submissions,
                       coalesce(max(submissions.graded_submissions), 0) AS graded_submissions
                FROM tutor_classes tc CROSS JOIN enrollment CROSS JOIN sessions CROSS JOIN submissions
                """, params);

        var teaching = new TutorStatisticsSourceResponse.TeachingOverview(
                number(totals, "active_classes"),
                null,
                number(totals, "upcoming_classes"),
                number(totals, "active_students"),
                number(totals, "total_sessions"),
                number(totals, "completed_sessions"),
                number(totals, "upcoming_sessions"),
                number(totals, "cancelled_sessions")
        );
        var operations = new TutorStatisticsSourceResponse.LearningOperations(
                number(totals, "assignments_created"),
                number(totals, "submitted_assignments"),
                number(totals, "pending_submissions"),
                number(totals, "graded_submissions"),
                number(totals, "session_actions_pending")
        );

        List<TutorStatisticsSourceResponse.ClassBreakdown> classes = jdbc.query("""
                SELECT c.id, c.name, c.status,
                       count(DISTINCT er.id) FILTER (WHERE er.status = 'ENROLLED') AS enrolled_students,
                       count(DISTINCT cs.id) AS total_sessions,
                       count(DISTINCT cs.id) FILTER (WHERE cs.status = 'COMPLETED') AS completed_sessions,
                       count(DISTINCT cs.id) FILTER (WHERE cs.status = 'SCHEDULED' AND cs.session_date >= current_date) AS upcoming_sessions
                FROM class_rooms c
                LEFT JOIN enrollment_requests er ON er.class_room_id = c.id
                LEFT JOIN class_sessions cs ON cs.class_room_id = c.id
                WHERE lower(c.tutor_email) = lower(:email)
                GROUP BY c.id, c.name, c.status, c.updated_at, c.created_at
                ORDER BY coalesce(c.updated_at, c.created_at) DESC, c.id DESC
                LIMIT 8
                """, params, (rs, rowNum) -> new TutorStatisticsSourceResponse.ClassBreakdown(
                rs.getLong("id"), rs.getString("name"), rs.getString("status"),
                rs.getLong("enrolled_students"), rs.getLong("total_sessions"),
                rs.getLong("completed_sessions"), rs.getLong("upcoming_sessions")
        ));

        List<TutorStatisticsSourceResponse.UpcomingSession> upcoming = jdbc.query("""
                SELECT cs.id, cs.class_room_id, c.name, cs.sequence_number, cs.topic,
                       cs.session_date, cs.start_time, cs.end_time
                FROM class_sessions cs JOIN class_rooms c ON c.id = cs.class_room_id
                WHERE lower(c.tutor_email) = lower(:email)
                  AND cs.status = 'SCHEDULED' AND cs.session_date >= current_date
                ORDER BY cs.session_date ASC, cs.start_time ASC, cs.id ASC
                LIMIT 8
                """, params, (rs, rowNum) -> new TutorStatisticsSourceResponse.UpcomingSession(
                rs.getLong("id"), rs.getLong("class_room_id"), rs.getString("name"),
                rs.getInt("sequence_number"), rs.getString("topic"),
                ((Date) rs.getObject("session_date")).toLocalDate(),
                rs.getString("start_time"), rs.getString("end_time")
        ));

        Map<String, Object> rating = jdbc.queryForMap("""
                SELECT coalesce(avg(rating), 0) AS average_rating, count(*) AS review_count
                FROM tutor_reviews WHERE tutor_id = :tutorUserId
                """, params);
        Map<Integer, Long> distribution = new LinkedHashMap<>();
        for (int star = 5; star >= 1; star--) distribution.put(star, 0L);
        jdbc.queryForList("""
                SELECT rating, count(*) AS total FROM tutor_reviews
                WHERE tutor_id = :tutorUserId GROUP BY rating ORDER BY rating DESC
                """, params).forEach(row -> distribution.put(
                ((Number) row.get("rating")).intValue(), ((Number) row.get("total")).longValue()));
        List<TutorStatisticsSourceResponse.RecentReview> recentReviews = jdbc.query("""
                SELECT id, classroom_id, rating, comment, created_at
                FROM tutor_reviews WHERE tutor_id = :tutorUserId
                ORDER BY created_at DESC, id DESC LIMIT 5
                """, params, (rs, rowNum) -> new TutorStatisticsSourceResponse.RecentReview(
                rs.getLong("id"), rs.getLong("classroom_id"), rs.getInt("rating"),
                rs.getString("comment"), ((Timestamp) rs.getObject("created_at")).toLocalDateTime()
        ));
        var reviews = new TutorStatisticsSourceResponse.ReviewStatistics(
                rating.get("average_rating") == null ? 0.0 : ((Number) rating.get("average_rating")).doubleValue(),
                number(rating, "review_count"), distribution, recentReviews
        );

        return new TutorStatisticsSourceResponse(
                Instant.now().toString(), rangeDays, teaching, operations, reviews, classes, upcoming,
                List.of("completedClasses: class_rooms không có trạng thái COMPLETED đáng tin cậy")
        );
    }

    private long number(Map<String, Object> row, String key) {
        Object value = row.get(key);
        return value instanceof Number number ? number.longValue() : 0L;
    }
}
