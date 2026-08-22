package iuh.fit.learning_service.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Locale;
import java.util.Optional;

@Service
public class TutorIdentityLookup {
    private final JdbcTemplate jdbc;

    public TutorIdentityLookup(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<String> fullName(String email, Long tutorProfileId) {
        if (!tableExists("users")) {
            return Optional.empty();
        }

        String normalizedEmail = email == null ? null : email.trim().toLowerCase(Locale.ROOT);

        Optional<String> byEmail = normalizedEmail == null || normalizedEmail.isBlank()
                ? Optional.empty()
                : queryFullName("""
                        SELECT full_name
                        FROM users
                        WHERE lower(email) = ?
                          AND NULLIF(trim(full_name), '') IS NOT NULL
                        LIMIT 1
                        """, normalizedEmail);
        if (byEmail.isPresent() || tutorProfileId == null) {
            return byEmail;
        }

        Optional<String> byTutors = tableExists("tutors")
                ? queryFullName("""
                        SELECT account_user.full_name
                        FROM tutors tutor
                        JOIN users account_user ON account_user.id = tutor.user_id
                        WHERE tutor.id = ?
                          AND NULLIF(trim(account_user.full_name), '') IS NOT NULL
                        LIMIT 1
                        """, tutorProfileId)
                : Optional.empty();
        if (byTutors.isPresent()) {
            return byTutors;
        }

        return tableExists("tutor_profiles")
                ? queryFullName("""
                        SELECT account_user.full_name
                        FROM tutor_profiles tutor_profile
                        JOIN users account_user ON account_user.id = tutor_profile.user_id
                        WHERE tutor_profile.id = ?
                          AND NULLIF(trim(account_user.full_name), '') IS NOT NULL
                        LIMIT 1
                        """, tutorProfileId)
                : Optional.empty();
    }

    private Optional<String> queryFullName(String sql, Object... args) {
        List<String> values = jdbc.query(sql, (rs, rowNum) -> rs.getString(1), args);
        return values.stream()
                .map(this::normalize)
                .filter(value -> value != null && !value.isBlank())
                .findFirst();
    }

    private boolean tableExists(String tableName) {
        Boolean exists = jdbc.queryForObject("SELECT to_regclass(?) IS NOT NULL", Boolean.class, "public." + tableName);
        return Boolean.TRUE.equals(exists);
    }

    private String normalize(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
