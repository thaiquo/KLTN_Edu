package iuh.fit.learning_service.service;

import iuh.fit.learning_service.entity.ClassRoom;
import iuh.fit.learning_service.entity.ClassSchedule;
import iuh.fit.learning_service.entity.ClassSession;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CanonicalSessionPlannerTest {
    private final CanonicalSessionPlanner planner = new CanonicalSessionPlanner();

    @Test
    void ordersMultipleSlotsByDateThenStartTimeAcrossWeekBoundary() {
        ClassRoom room = room(LocalDate.of(2026, 9, 6), 5); // Sunday
        room.setSchedules(List.of(
                slot(room, 2, "18:00", "19:00"),
                slot(room, 8, "15:00", "16:00"),
                slot(room, 2, "08:00", "09:00")));

        assertThat(planner.plan(room)).containsExactly(
                new CanonicalSessionPlanner.PlannedSession(1, LocalDate.of(2026, 9, 6), "15:00", "16:00"),
                new CanonicalSessionPlanner.PlannedSession(2, LocalDate.of(2026, 9, 7), "08:00", "09:00"),
                new CanonicalSessionPlanner.PlannedSession(3, LocalDate.of(2026, 9, 7), "18:00", "19:00"),
                new CanonicalSessionPlanner.PlannedSession(4, LocalDate.of(2026, 9, 13), "15:00", "16:00"),
                new CanonicalSessionPlanner.PlannedSession(5, LocalDate.of(2026, 9, 14), "08:00", "09:00"));
    }

    @Test
    void rejectsOverlappingSlotsAndInvalidTime() {
        ClassRoom overlap = room(LocalDate.of(2026, 9, 7), 2);
        overlap.setSchedules(List.of(
                slot(overlap, 2, "08:00", "10:00"),
                slot(overlap, 2, "09:59", "11:00")));

        assertThatThrownBy(() -> planner.plan(overlap))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Overlapping");

        ClassRoom invalid = room(LocalDate.of(2026, 9, 7), 1);
        invalid.setSchedules(List.of(slot(invalid, 2, "8:00", "09:00")));
        assertThatThrownBy(() -> planner.plan(invalid))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("HH:mm");
    }

    @Test
    void derivesImmutableTrialWindowAndCanonicalFingerprint() {
        ClassRoom room = room(LocalDate.of(2026, 9, 6), 5);
        room.setSchedules(List.of(
                slot(room, 8, "15:00", "16:00"),
                slot(room, 2, "18:00", "19:00"),
                slot(room, 2, "08:00", "09:00")));

        CanonicalSessionPlanner.TrialSchedule trial = planner.trialSchedule(room);

        assertThat(trial.trialSessionSequence()).isEqualTo(1);
        assertThat(trial.nextSessionSequence()).isEqualTo(2);
        assertThat(trial.trialSessionStartAt())
                .isEqualTo(OffsetDateTime.parse("2026-09-06T15:00:00+07:00"));
        assertThat(trial.nextSessionStartAt())
                .isEqualTo(OffsetDateTime.parse("2026-09-07T08:00:00+07:00"));
        assertThat(trial.initialTrialDeadline()).isEqualTo(trial.nextSessionStartAt());
        assertThat(trial.scheduleFingerprint())
                .isEqualTo("28c5e083c0914437b881120d14447e927fdd4ce049af6f458a6f650cc4de40aa");
    }

    @Test
    void trialPolicyRequiresAtLeastTwoSessions() {
        ClassRoom room = room(LocalDate.of(2026, 9, 7), 1);
        room.setSchedules(List.of(slot(room, 2, "08:00", "09:00")));

        assertThatThrownBy(() -> planner.trialSchedule(room))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("at least two");
    }

    @Test
    void validatesPersistedSessionsAsCanonicalPrefix() {
        ClassRoom room = room(LocalDate.of(2026, 9, 7), 3);
        room.setSchedules(List.of(
                slot(room, 2, "08:00", "09:00"),
                slot(room, 4, "18:00", "19:00")));
        ClassSession first = persisted(1, LocalDate.of(2026, 9, 7), "08:00", "09:00");
        ClassSession second = persisted(2, LocalDate.of(2026, 9, 9), "18:00", "19:00");

        assertThatCode(() -> planner.requirePersistedPrefix(room, List.of(first, second)))
                .doesNotThrowAnyException();

        second.setStartTime("18:01");
        assertThatThrownBy(() -> planner.requirePersistedPrefix(room, List.of(first, second)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("diverges");
    }

    private ClassRoom room(LocalDate startDate, int totalSessions) {
        ClassRoom room = new ClassRoom();
        room.setStartDate(startDate);
        room.setTotalSessions(totalSessions);
        return room;
    }

    private ClassSchedule slot(ClassRoom room, int day, String start, String end) {
        ClassSchedule schedule = new ClassSchedule();
        schedule.setClassRoom(room);
        schedule.setDayOfWeek(day);
        schedule.setStartTime(start);
        schedule.setEndTime(end);
        return schedule;
    }

    private ClassSession persisted(int sequence, LocalDate date, String start, String end) {
        ClassSession session = new ClassSession();
        session.setSequenceNumber(sequence);
        session.setSessionDate(date);
        session.setStartTime(start);
        session.setEndTime(end);
        return session;
    }
}
