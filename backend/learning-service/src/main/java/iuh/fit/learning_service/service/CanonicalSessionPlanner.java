package iuh.fit.learning_service.service;

import iuh.fit.learning_service.entity.ClassRoom;
import iuh.fit.learning_service.entity.ClassSchedule;
import iuh.fit.learning_service.entity.ClassSession;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import java.time.format.DateTimeParseException;
import java.time.format.ResolverStyle;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.TreeMap;

/**
 * Single source of truth for turning a classroom's recurring schedule into
 * ordered session occurrences. Contract snapshots and persisted sessions must
 * use this planner so their sequence numbers and timestamps cannot diverge.
 */
@Component
public class CanonicalSessionPlanner {
    public static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final DateTimeFormatter TIME_FORMATTER = new DateTimeFormatterBuilder()
            .appendPattern("HH:mm")
            .toFormatter(Locale.ROOT)
            .withResolverStyle(ResolverStyle.STRICT);
    private static final int MAX_DAYS_TO_SCAN = 3660;

    public record PlannedSession(int sequenceNumber, LocalDate sessionDate, String startTime, String endTime) {}

    public record TrialSchedule(
            int trialSessionSequence,
            int nextSessionSequence,
            OffsetDateTime trialSessionStartAt,
            OffsetDateTime nextSessionStartAt,
            OffsetDateTime initialTrialDeadline,
            String scheduleFingerprint) {}

    public List<PlannedSession> plan(ClassRoom classRoom) {
        if (classRoom == null) {
            throw new IllegalArgumentException("ClassRoom is required");
        }
        if (classRoom.getStartDate() == null) {
            throw new IllegalArgumentException("ClassRoom startDate is required");
        }
        if (classRoom.getTotalSessions() == null || classRoom.getTotalSessions() <= 0) {
            throw new IllegalArgumentException("ClassRoom totalSessions must be positive");
        }

        Map<Integer, List<ScheduleSlot>> slotsByDay = normalize(classRoom.getSchedules());
        List<PlannedSession> result = new ArrayList<>(classRoom.getTotalSessions());
        LocalDate date = classRoom.getStartDate();
        int daysScanned = 0;

        while (result.size() < classRoom.getTotalSessions() && daysScanned < MAX_DAYS_TO_SCAN) {
            int projectDayOfWeek = date.getDayOfWeek().getValue() + 1;
            for (ScheduleSlot slot : slotsByDay.getOrDefault(projectDayOfWeek, List.of())) {
                if (result.size() >= classRoom.getTotalSessions()) {
                    break;
                }
                result.add(new PlannedSession(
                        result.size() + 1,
                        date,
                        slot.startText(),
                        slot.endText()));
            }
            date = date.plusDays(1);
            daysScanned++;
        }

        if (result.size() != classRoom.getTotalSessions()) {
            throw new IllegalStateException("Unable to generate all classroom sessions from the configured schedule");
        }
        return List.copyOf(result);
    }

    public TrialSchedule trialSchedule(ClassRoom classRoom) {
        List<PlannedSession> sessions = plan(classRoom);
        if (sessions.size() < 2) {
            throw new IllegalArgumentException("Trial policy requires at least two planned sessions");
        }

        PlannedSession trial = sessions.get(0);
        PlannedSession next = sessions.get(1);
        OffsetDateTime trialStart = atBusinessOffset(trial);
        OffsetDateTime nextStart = atBusinessOffset(next);
        return new TrialSchedule(
                trial.sequenceNumber(),
                next.sequenceNumber(),
                trialStart,
                nextStart,
                nextStart,
                scheduleFingerprint(classRoom));
    }

    public void requirePersistedPrefix(ClassRoom classRoom, List<ClassSession> persistedSessions) {
        if (persistedSessions == null || persistedSessions.isEmpty()) {
            return;
        }
        List<PlannedSession> planned = plan(classRoom);
        if (persistedSessions.size() > planned.size()) {
            throw new IllegalStateException("Persisted sessions exceed the canonical classroom schedule");
        }
        for (int index = 0; index < persistedSessions.size(); index++) {
            ClassSession persisted = persistedSessions.get(index);
            PlannedSession expected = planned.get(index);
            String persistedStart = normalizedTime(persisted.getStartTime(), "startTime");
            String persistedEnd = normalizedTime(persisted.getEndTime(), "endTime");
            if (!Objects.equals(persisted.getSequenceNumber(), expected.sequenceNumber())
                    || !Objects.equals(persisted.getSessionDate(), expected.sessionDate())
                    || !persistedStart.equals(expected.startTime())
                    || !persistedEnd.equals(expected.endTime())) {
                throw new IllegalStateException(
                        "Persisted session " + persisted.getSequenceNumber()
                                + " diverges from the canonical classroom schedule");
            }
        }
    }

    public String scheduleFingerprint(ClassRoom classRoom) {
        if (classRoom == null || classRoom.getStartDate() == null
                || classRoom.getTotalSessions() == null || classRoom.getTotalSessions() <= 0) {
            throw new IllegalArgumentException("ClassRoom startDate and positive totalSessions are required");
        }
        Map<Integer, List<ScheduleSlot>> slotsByDay = normalize(classRoom.getSchedules());
        StringBuilder canonical = new StringBuilder(256)
                .append("{\"timezone\":\"").append(BUSINESS_ZONE.getId())
                .append("\",\"startDate\":\"").append(classRoom.getStartDate())
                .append("\",\"totalSessions\":").append(classRoom.getTotalSessions())
                .append(",\"slots\":[");
        boolean first = true;
        for (Map.Entry<Integer, List<ScheduleSlot>> entry : slotsByDay.entrySet()) {
            for (ScheduleSlot slot : entry.getValue()) {
                if (!first) {
                    canonical.append(',');
                }
                first = false;
                canonical.append("{\"dayOfWeek\":").append(entry.getKey())
                        .append(",\"startTime\":\"").append(slot.startText())
                        .append("\",\"endTime\":\"").append(slot.endText())
                        .append("\"}");
            }
        }
        canonical.append("]}");
        return sha256(canonical.toString());
    }

    private Map<Integer, List<ScheduleSlot>> normalize(List<ClassSchedule> schedules) {
        if (schedules == null || schedules.isEmpty()) {
            throw new IllegalArgumentException("ClassRoom must have at least one schedule slot");
        }

        Map<Integer, List<ScheduleSlot>> slotsByDay = new TreeMap<>();
        for (ClassSchedule schedule : schedules) {
            if (schedule == null || schedule.getDayOfWeek() == null
                    || schedule.getDayOfWeek() < 2 || schedule.getDayOfWeek() > 8) {
                throw new IllegalArgumentException("Schedule dayOfWeek must be between 2 and 8");
            }
            LocalTime start = parseTime(schedule.getStartTime(), "startTime");
            LocalTime end = parseTime(schedule.getEndTime(), "endTime");
            if (!start.isBefore(end)) {
                throw new IllegalArgumentException("Schedule startTime must be before endTime");
            }
            slotsByDay.computeIfAbsent(schedule.getDayOfWeek(), ignored -> new ArrayList<>())
                    .add(new ScheduleSlot(
                            start,
                            end,
                            start.format(TIME_FORMATTER),
                            end.format(TIME_FORMATTER)));
        }

        for (List<ScheduleSlot> daySlots : slotsByDay.values()) {
            daySlots.sort(Comparator.comparing(ScheduleSlot::start).thenComparing(ScheduleSlot::end));
            for (int i = 1; i < daySlots.size(); i++) {
                if (daySlots.get(i).start().isBefore(daySlots.get(i - 1).end())) {
                    throw new IllegalArgumentException("Overlapping schedule slots are not allowed on the same day");
                }
            }
        }
        return slotsByDay;
    }

    private LocalTime parseTime(String value, String field) {
        if (value == null) {
            throw new IllegalArgumentException("Schedule " + field + " is required");
        }
        try {
            return LocalTime.parse(value, TIME_FORMATTER);
        } catch (DateTimeParseException ex) {
            throw new IllegalArgumentException("Schedule " + field + " must use HH:mm", ex);
        }
    }

    private OffsetDateTime atBusinessOffset(PlannedSession session) {
        LocalTime start = parseTime(session.startTime(), "startTime");
        return session.sessionDate().atTime(start).atZone(BUSINESS_ZONE).toOffsetDateTime();
    }

    private String normalizedTime(String value, String field) {
        return parseTime(value, field).format(TIME_FORMATTER);
    }

    private String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is not available", ex);
        }
    }

    private record ScheduleSlot(LocalTime start, LocalTime end, String startText, String endText) {}
}
