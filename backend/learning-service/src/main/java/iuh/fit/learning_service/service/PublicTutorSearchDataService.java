package iuh.fit.learning_service.service;

import iuh.fit.learning_service.dto.TutorSearchDataDtos;
import iuh.fit.learning_service.enums.TeachingMode;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
public class PublicTutorSearchDataService {
    private final JdbcTemplate jdbcTemplate;

    public PublicTutorSearchDataService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional(readOnly = true)
    public List<TutorSearchDataDtos.TutorSearchDataResponse> search(
            List<Long> tutorProfileIds,
            Long programTypeId,
            Long educationLevelId,
            Long categoryId,
            Long subjectId,
            Long levelId,
            TeachingMode teachingMode,
            BigDecimal minPrice,
            BigDecimal maxPrice,
            Double minRating,
            Integer minExperience,
            Integer dayOfWeek,
            String startTime,
            String endTime
    ) {
        Set<Long> requestedProfileIds = normalizeProfileIds(tutorProfileIds);
        Map<Long, TutorAccumulator> tutors = loadApprovedCapabilities(requestedProfileIds);
        if (tutors.isEmpty()) {
            return List.of();
        }

        loadTeachingModes(tutors);
        loadAvailability(tutors);
        loadRatings(tutors);
        loadPublishedClassCounts(tutors);

        LocalTime requestedStart = parseOptionalTime(startTime);
        LocalTime requestedEnd = parseOptionalTime(endTime);

        return tutors.values().stream()
                .filter(tutor -> matchesTeachingMode(tutor, teachingMode))
                .filter(tutor -> matchesRating(tutor, minRating))
                .filter(tutor -> matchesAvailability(tutor, dayOfWeek, requestedStart, requestedEnd))
                .map(tutor -> tutor.toResponse(programTypeId, educationLevelId, categoryId, subjectId, levelId, minPrice, maxPrice, minExperience))
                .filter(response -> !response.subjects().isEmpty())
                .sorted(Comparator.comparing(TutorSearchDataDtos.TutorSearchDataResponse::tutorProfileId))
                .toList();
    }

    private Map<Long, TutorAccumulator> loadApprovedCapabilities(Set<Long> requestedProfileIds) {
        StringBuilder sql = new StringBuilder("""
                SELECT reg.id AS registration_id,
                       reg.tutor_profile_id,
                       reg.tutor_email,
                       auth.user_id,
                       auth.updated_at AS authorization_updated_at,
                       reg.program_type_id,
                       reg.education_level_id,
                       subject.id AS subject_id,
                       COALESCE(subject.name, reg.proposed_subject_name) AS subject_name,
                       category.id AS category_id,
                       category.name AS category_name,
                       level.id AS level_id,
                       level.name AS level_name,
                       reg.experience_years,
                       reg.tuition_min,
                       reg.tuition_max,
                       reg.description
                FROM tutor_subject_registrations reg
                LEFT JOIN catalog_subjects subject ON subject.id = reg.subject_id
                JOIN catalog_categories category ON category.id = reg.category_id
                LEFT JOIN tutor_subject_registration_levels reg_level ON reg_level.registration_id = reg.id
                LEFT JOIN catalog_levels level ON level.id = reg_level.level_id
                LEFT JOIN tutor_authorization_states auth ON auth.tutor_profile_id = reg.tutor_profile_id
                WHERE reg.status = 'APPROVED'
                  AND reg.tutor_profile_id IS NOT NULL
                """);
        List<Object> args = new ArrayList<>();
        appendInClause(sql, args, "reg.tutor_profile_id", requestedProfileIds);
        sql.append(" ORDER BY reg.tutor_profile_id ASC, reg.created_at ASC, reg.id ASC, level.order_index ASC, level.name ASC");

        Map<Long, TutorAccumulator> tutors = new LinkedHashMap<>();
        jdbcTemplate.query(sql.toString(), rs -> {
            Long tutorProfileId = rs.getLong("tutor_profile_id");
            Long userId = getNullableLong(rs, "user_id");
            String tutorEmail = rs.getString("tutor_email");
            java.time.LocalDateTime authorizationUpdatedAt = getTimestamp(rs, "authorization_updated_at");
            TutorAccumulator tutor = tutors.computeIfAbsent(tutorProfileId, id -> new TutorAccumulator(
                    id,
                    userId,
                    tutorEmail,
                    authorizationUpdatedAt
            ));
            tutor.addCapabilityRow(rs);
        }, args.toArray());
        return tutors;
    }

    private void loadTeachingModes(Map<Long, TutorAccumulator> tutors) {
        Set<Long> userIds = new LinkedHashSet<>();
        tutors.values().forEach(tutor -> {
            if (tutor.userId != null) {
                userIds.add(tutor.userId);
            }
        });
        if (userIds.isEmpty()) {
            return;
        }

        StringBuilder sql = new StringBuilder("""
                SELECT user_id, teaching_mode
                FROM tutor_authorization_teaching_modes
                WHERE 1 = 1
                """);
        List<Object> args = new ArrayList<>();
        appendInClause(sql, args, "user_id", userIds);

        Map<Long, TutorAccumulator> byUserId = new LinkedHashMap<>();
        tutors.values().forEach(tutor -> {
            if (tutor.userId != null) {
                byUserId.put(tutor.userId, tutor);
            }
        });
        jdbcTemplate.query(sql.toString(), rs -> {
            TutorAccumulator tutor = byUserId.get(rs.getLong("user_id"));
            if (tutor != null) {
                tutor.teachingModes.add(TeachingMode.valueOf(rs.getString("teaching_mode")));
            }
        }, args.toArray());
    }

    private void loadAvailability(Map<Long, TutorAccumulator> tutors) {
        Set<String> emails = new LinkedHashSet<>();
        tutors.values().forEach(tutor -> {
            if (StringUtils.hasText(tutor.tutorEmail)) {
                emails.add(tutor.tutorEmail.toLowerCase(Locale.ROOT));
            }
        });
        if (emails.isEmpty()) {
            return;
        }

        StringBuilder sql = new StringBuilder("""
                SELECT id, tutor_email, day_of_week, start_time, end_time
                FROM tutor_availabilities
                WHERE 1 = 1
                """);
        List<Object> args = new ArrayList<>();
        appendInClause(sql, args, "lower(tutor_email)", emails);
        sql.append(" ORDER BY day_of_week ASC, start_time ASC");

        Map<String, TutorAccumulator> byEmail = new LinkedHashMap<>();
        tutors.values().forEach(tutor -> {
            if (StringUtils.hasText(tutor.tutorEmail)) {
                byEmail.put(tutor.tutorEmail.toLowerCase(Locale.ROOT), tutor);
            }
        });
        jdbcTemplate.query(sql.toString(), rs -> {
            TutorAccumulator tutor = byEmail.get(rs.getString("tutor_email").toLowerCase(Locale.ROOT));
            if (tutor != null) {
                tutor.availability.add(new TutorSearchDataDtos.AvailabilitySlotResponse(
                        rs.getLong("id"),
                        rs.getInt("day_of_week"),
                        rs.getString("start_time"),
                        rs.getString("end_time")
                ));
            }
        }, args.toArray());
    }

    private void loadRatings(Map<Long, TutorAccumulator> tutors) {
        Set<Long> userIds = new LinkedHashSet<>();
        tutors.values().forEach(tutor -> {
            if (tutor.userId != null) {
                userIds.add(tutor.userId);
            }
        });
        if (userIds.isEmpty()) {
            return;
        }

        StringBuilder sql = new StringBuilder("""
                SELECT tutor_id, AVG(rating) AS average_rating, COUNT(*) AS review_count
                FROM tutor_reviews
                WHERE 1 = 1
                """);
        List<Object> args = new ArrayList<>();
        appendInClause(sql, args, "tutor_id", userIds);
        sql.append(" GROUP BY tutor_id");

        Map<Long, TutorAccumulator> byUserId = new LinkedHashMap<>();
        tutors.values().forEach(tutor -> {
            if (tutor.userId != null) {
                byUserId.put(tutor.userId, tutor);
            }
        });
        jdbcTemplate.query(sql.toString(), rs -> {
            TutorAccumulator tutor = byUserId.get(rs.getLong("tutor_id"));
            if (tutor != null) {
                tutor.averageRating = rs.getDouble("average_rating");
                tutor.reviewCount = rs.getLong("review_count");
            }
        }, args.toArray());
    }

    private void loadPublishedClassCounts(Map<Long, TutorAccumulator> tutors) {
        Set<Long> tutorProfileIds = tutors.keySet();
        if (tutorProfileIds.isEmpty()) {
            return;
        }

        StringBuilder sql = new StringBuilder("""
                SELECT tutor_profile_id, COUNT(*) AS class_count
                FROM class_rooms
                WHERE tutor_profile_id IS NOT NULL
                  AND status IN ('PUBLISHED', 'ACTIVE')
                """);
        List<Object> args = new ArrayList<>();
        appendInClause(sql, args, "tutor_profile_id", tutorProfileIds);
        sql.append(" GROUP BY tutor_profile_id");

        jdbcTemplate.query(sql.toString(), rs -> {
            TutorAccumulator tutor = tutors.get(rs.getLong("tutor_profile_id"));
            if (tutor != null) {
                tutor.publishedClassCount = rs.getLong("class_count");
            }
        }, args.toArray());
    }

    private boolean matchesTeachingMode(TutorAccumulator tutor, TeachingMode requestedMode) {
        return requestedMode == null || tutor.teachingModes.contains(requestedMode);
    }

    private boolean matchesRating(TutorAccumulator tutor, Double minRating) {
        return minRating == null || tutor.averageRating >= minRating;
    }

    private boolean matchesAvailability(TutorAccumulator tutor, Integer dayOfWeek, LocalTime requestedStart, LocalTime requestedEnd) {
        if (dayOfWeek == null && requestedStart == null && requestedEnd == null) {
            return true;
        }
        return tutor.availability.stream().anyMatch(slot -> {
            if (dayOfWeek != null && !dayOfWeek.equals(slot.dayOfWeek())) {
                return false;
            }
            LocalTime availableStart = parseOptionalTime(slot.startTime());
            LocalTime availableEnd = parseOptionalTime(slot.endTime());
            if (availableStart == null || availableEnd == null) {
                return false;
            }
            if (requestedStart != null && availableStart.isAfter(requestedStart)) {
                return false;
            }
            return requestedEnd == null || !availableEnd.isBefore(requestedEnd);
        });
    }

    private static Set<Long> normalizeProfileIds(List<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return Set.of();
        }
        Set<Long> result = new LinkedHashSet<>();
        ids.stream().filter(id -> id != null && id > 0).forEach(result::add);
        return result;
    }

    private static LocalTime parseOptionalTime(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return LocalTime.parse(value.trim());
    }

    private static void appendInClause(StringBuilder sql, List<Object> args, String column, Set<?> values) {
        if (values == null || values.isEmpty()) {
            return;
        }
        sql.append(" AND ").append(column).append(" IN (");
        String separator = "";
        for (Object value : values) {
            sql.append(separator).append("?");
            args.add(value);
            separator = ",";
        }
        sql.append(")");
    }

    private static Long getNullableLong(ResultSet rs, String column) throws SQLException {
        long value = rs.getLong(column);
        return rs.wasNull() ? null : value;
    }

    private static java.time.LocalDateTime getTimestamp(ResultSet rs, String column) throws SQLException {
        java.sql.Timestamp timestamp = rs.getTimestamp(column);
        return timestamp == null ? null : timestamp.toLocalDateTime();
    }

    private static boolean rangesOverlap(BigDecimal capabilityMin, BigDecimal capabilityMax, BigDecimal requestedMin, BigDecimal requestedMax) {
        if (capabilityMin == null || capabilityMax == null) {
            return false;
        }
        if (requestedMin != null && capabilityMax.compareTo(requestedMin) < 0) {
            return false;
        }
        return requestedMax == null || capabilityMin.compareTo(requestedMax) <= 0;
    }

    private static final class TutorAccumulator {
        private final Long tutorProfileId;
        private final Long userId;
        private final String tutorEmail;
        private final java.time.LocalDateTime authorizationUpdatedAt;
        private final Map<Long, CapabilityAccumulator> capabilities = new LinkedHashMap<>();
        private final Set<TeachingMode> teachingModes = new LinkedHashSet<>();
        private final List<TutorSearchDataDtos.AvailabilitySlotResponse> availability = new ArrayList<>();
        private double averageRating = 0.0;
        private long reviewCount = 0;
        private long publishedClassCount = 0;

        private TutorAccumulator(Long tutorProfileId, Long userId, String tutorEmail, java.time.LocalDateTime authorizationUpdatedAt) {
            this.tutorProfileId = tutorProfileId;
            this.userId = userId;
            this.tutorEmail = tutorEmail;
            this.authorizationUpdatedAt = authorizationUpdatedAt;
        }

        private void addCapabilityRow(ResultSet rs) throws SQLException {
            Long registrationId = rs.getLong("registration_id");
            Long subjectId = getNullableLong(rs, "subject_id");
            String subjectName = rs.getString("subject_name");
            Long programTypeId = getNullableLong(rs, "program_type_id");
            Long educationLevelId = getNullableLong(rs, "education_level_id");
            Long categoryId = getNullableLong(rs, "category_id");
            String categoryName = rs.getString("category_name");
            Integer experienceYears = rs.getInt("experience_years");
            BigDecimal tuitionMin = rs.getBigDecimal("tuition_min");
            BigDecimal tuitionMax = rs.getBigDecimal("tuition_max");
            String description = rs.getString("description");
            CapabilityAccumulator capability = capabilities.computeIfAbsent(registrationId, ignored -> new CapabilityAccumulator(
                    registrationId,
                    programTypeId,
                    educationLevelId,
                    subjectId,
                    subjectName,
                    categoryId,
                    categoryName,
                    experienceYears,
                    tuitionMin,
                    tuitionMax,
                    description
            ));
            Long levelId = getNullableLong(rs, "level_id");
            if (levelId != null) {
                capability.levels.putIfAbsent(levelId, new TutorSearchDataDtos.LevelResponse(levelId, rs.getString("level_name")));
            }
        }

        private TutorSearchDataDtos.TutorSearchDataResponse toResponse(
                Long programTypeId,
                Long educationLevelId,
                Long categoryId,
                Long subjectId,
                Long levelId,
                BigDecimal minPrice,
                BigDecimal maxPrice,
                Integer minExperience
        ) {
            List<TutorSearchDataDtos.CapabilityResponse> publicCapabilities = capabilities.values().stream()
                    .filter(capability -> capability.matches(programTypeId, educationLevelId, categoryId, subjectId, levelId, minPrice, maxPrice, minExperience))
                    .map(CapabilityAccumulator::toResponse)
                    .toList();
            BigDecimal startingTuition = capabilities.values().stream()
                    .map(capability -> capability.tuitionMin)
                    .filter(value -> value != null && value.signum() > 0)
                    .min(BigDecimal::compareTo)
                    .orElse(null);
            return new TutorSearchDataDtos.TutorSearchDataResponse(
                    tutorProfileId,
                    userId,
                    Set.copyOf(teachingModes),
                    publicCapabilities,
                    startingTuition,
                    List.copyOf(availability),
                    averageRating,
                    reviewCount,
                    publishedClassCount,
                    authorizationUpdatedAt
            );
        }
    }

    private static final class CapabilityAccumulator {
        private final Long registrationId;
        private final Long programTypeId;
        private final Long educationLevelId;
        private final Long subjectId;
        private final String subjectName;
        private final Long categoryId;
        private final String categoryName;
        private final Map<Long, TutorSearchDataDtos.LevelResponse> levels = new LinkedHashMap<>();
        private final Integer experienceYears;
        private final BigDecimal tuitionMin;
        private final BigDecimal tuitionMax;
        private final String description;

        private CapabilityAccumulator(Long registrationId, Long programTypeId, Long educationLevelId,
                                      Long subjectId, String subjectName, Long categoryId, String categoryName,
                                      Integer experienceYears, BigDecimal tuitionMin, BigDecimal tuitionMax, String description) {
            this.registrationId = registrationId;
            this.programTypeId = programTypeId;
            this.educationLevelId = educationLevelId;
            this.subjectId = subjectId;
            this.subjectName = subjectName;
            this.categoryId = categoryId;
            this.categoryName = categoryName;
            this.experienceYears = experienceYears;
            this.tuitionMin = tuitionMin;
            this.tuitionMax = tuitionMax;
            this.description = description;
        }

        private boolean matches(Long requestedProgramTypeId, Long requestedEducationLevelId, Long requestedCategoryId,
                                Long requestedSubjectId, Long requestedLevelId, BigDecimal requestedMinPrice,
                                BigDecimal requestedMaxPrice, Integer requestedMinExperience) {
            if (requestedProgramTypeId != null && !requestedProgramTypeId.equals(programTypeId)) {
                return false;
            }
            if (requestedEducationLevelId != null && !requestedEducationLevelId.equals(educationLevelId)) {
                return false;
            }
            if (requestedCategoryId != null && !requestedCategoryId.equals(categoryId)) {
                return false;
            }
            if (requestedSubjectId != null && !requestedSubjectId.equals(subjectId)) {
                return false;
            }
            if (requestedLevelId != null && !levels.containsKey(requestedLevelId)) {
                return false;
            }
            if (!rangesOverlap(tuitionMin, tuitionMax, requestedMinPrice, requestedMaxPrice)) {
                return false;
            }
            return requestedMinExperience == null || (experienceYears != null && experienceYears >= requestedMinExperience);
        }

        private TutorSearchDataDtos.CapabilityResponse toResponse() {
            return new TutorSearchDataDtos.CapabilityResponse(
                    registrationId,
                    subjectId,
                    subjectName,
                    categoryId,
                    categoryName,
                    List.copyOf(levels.values()),
                    experienceYears,
                    tuitionMin,
                    tuitionMax,
                    description
            );
        }
    }
}
