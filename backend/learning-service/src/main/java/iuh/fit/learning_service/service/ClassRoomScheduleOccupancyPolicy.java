package iuh.fit.learning_service.service;

import iuh.fit.learning_service.enums.ClassRoomStatus;

/**
 * Canonical policy defining which classroom statuses block a tutor's schedule.
 * CLOSED, CANCELLED, and REJECTED classrooms do not block the tutor's availability.
 */
public final class ClassRoomScheduleOccupancyPolicy {

    private ClassRoomScheduleOccupancyPolicy() {}

    public static boolean blocksTutorSchedule(ClassRoomStatus status) {
        return status == ClassRoomStatus.PENDING_APPROVAL
                || status == ClassRoomStatus.ACTIVE
                || status == ClassRoomStatus.PRIVATE
                || status == ClassRoomStatus.PUBLISHED
                || status == ClassRoomStatus.LOCKED;
    }
}
