package iuh.fit.learning_service.service;

import iuh.fit.learning_service.enums.ClassRoomStatus;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ClassRoomScheduleOccupancyPolicyTest {

    @Test
    void blockingStatusesBlockTutorSchedule() {
        assertThat(ClassRoomScheduleOccupancyPolicy.blocksTutorSchedule(ClassRoomStatus.PENDING_APPROVAL)).isTrue();
        assertThat(ClassRoomScheduleOccupancyPolicy.blocksTutorSchedule(ClassRoomStatus.ACTIVE)).isTrue();
        assertThat(ClassRoomScheduleOccupancyPolicy.blocksTutorSchedule(ClassRoomStatus.PRIVATE)).isTrue();
        assertThat(ClassRoomScheduleOccupancyPolicy.blocksTutorSchedule(ClassRoomStatus.PUBLISHED)).isTrue();
        assertThat(ClassRoomScheduleOccupancyPolicy.blocksTutorSchedule(ClassRoomStatus.LOCKED)).isTrue();
    }

    @Test
    void nonBlockingStatusesReleaseTutorSchedule() {
        assertThat(ClassRoomScheduleOccupancyPolicy.blocksTutorSchedule(ClassRoomStatus.CLOSED)).isFalse();
        assertThat(ClassRoomScheduleOccupancyPolicy.blocksTutorSchedule(ClassRoomStatus.CANCELLED)).isFalse();
        assertThat(ClassRoomScheduleOccupancyPolicy.blocksTutorSchedule(ClassRoomStatus.REJECTED)).isFalse();
        assertThat(ClassRoomScheduleOccupancyPolicy.blocksTutorSchedule(ClassRoomStatus.DRAFT)).isFalse();
    }
}
