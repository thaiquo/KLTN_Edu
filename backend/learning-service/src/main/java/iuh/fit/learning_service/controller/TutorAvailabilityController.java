package iuh.fit.learning_service.controller;

import iuh.fit.learning_service.entity.ClassRoom;
import iuh.fit.learning_service.entity.ClassSchedule;
import iuh.fit.learning_service.entity.TutorAvailability;
import iuh.fit.learning_service.enums.ClassRoomStatus;
import iuh.fit.learning_service.exception.BadRequestException;
import iuh.fit.learning_service.repository.ClassRoomRepository;
import iuh.fit.learning_service.repository.TutorAvailabilityRepository;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/tutor/availability")
@PreAuthorize("hasRole('TUTOR')")
public class TutorAvailabilityController {

    private final TutorAvailabilityRepository repository;
    private final ClassRoomRepository classRoomRepository;

    public TutorAvailabilityController(
            TutorAvailabilityRepository repository,
            ClassRoomRepository classRoomRepository
    ) {
        this.repository = repository;
        this.classRoomRepository = classRoomRepository;
    }

    public record AvailabilitySlotDto(
            Long id,
            Integer dayOfWeek,
            String startTime,
            String endTime
    ) {}

    public record SaveAvailabilityRequest(
            List<AvailabilitySlotDto> slots
    ) {}

    @GetMapping
    public List<AvailabilitySlotDto> getMyAvailability(Authentication authentication) {
        String tutorEmail = authentication.getName();
        return repository.findByTutorEmailIgnoreCaseOrderByDayOfWeekAscStartTimeAsc(tutorEmail)
                .stream()
                .map(a -> new AvailabilitySlotDto(a.getId(), a.getDayOfWeek(), a.getStartTime(), a.getEndTime()))
                .toList();
    }

    @PostMapping
    @Transactional
    public List<AvailabilitySlotDto> saveMyAvailability(
            Authentication authentication,
            @RequestBody SaveAvailabilityRequest request
    ) {
        String tutorEmail = authentication.getName();
        List<ValidatedSlot> slots = validate(request == null ? null : request.slots());
        validateExistingClassesRemainCovered(tutorEmail, slots);

        repository.deleteByTutorEmailIgnoreCase(tutorEmail);

        List<TutorAvailability> entities = slots.stream()
                .map(slot -> new TutorAvailability(
                        tutorEmail,
                        slot.dayOfWeek(),
                        slot.startTime().toString(),
                        slot.endTime().toString()
                ))
                .toList();

        List<TutorAvailability> saved = repository.saveAllAndFlush(entities);
        return saved.stream()
                .map(a -> new AvailabilitySlotDto(a.getId(), a.getDayOfWeek(), a.getStartTime(), a.getEndTime()))
                .toList();
    }

    private List<ValidatedSlot> validate(List<AvailabilitySlotDto> requestedSlots) {
        if (requestedSlots == null || requestedSlots.size() < 3) {
            throw new BadRequestException("Availability must contain at least 3 sessions per week.");
        }

        List<ValidatedSlot> slots = requestedSlots.stream().map(this::validateSlot).toList();
        Set<Integer> distinctDays = slots.stream().map(ValidatedSlot::dayOfWeek).collect(Collectors.toSet());
        if (distinctDays.size() < 3) {
            throw new BadRequestException("Availability must cover at least 3 different days.");
        }

        Map<Integer, List<ValidatedSlot>> slotsByDay = slots.stream()
                .collect(Collectors.groupingBy(ValidatedSlot::dayOfWeek));
        for (List<ValidatedSlot> daySlots : slotsByDay.values()) {
            List<ValidatedSlot> sorted = daySlots.stream()
                    .sorted(Comparator.comparing(ValidatedSlot::startTime))
                    .toList();
            for (int index = 0; index < sorted.size() - 1; index++) {
                if (sorted.get(index).endTime().isAfter(sorted.get(index + 1).startTime())) {
                    throw new BadRequestException("Availability sessions on the same day must not overlap.");
                }
            }
        }
        return slots;
    }

    private ValidatedSlot validateSlot(AvailabilitySlotDto slot) {
        if (slot == null || slot.dayOfWeek() == null || slot.startTime() == null || slot.endTime() == null) {
            throw new BadRequestException("Every availability session requires a day, start time and end time.");
        }
        if (slot.dayOfWeek() < 2 || slot.dayOfWeek() > 8) {
            throw new BadRequestException("Availability day must be between 2 and 8.");
        }

        try {
            LocalTime startTime = LocalTime.parse(slot.startTime().trim());
            LocalTime endTime = LocalTime.parse(slot.endTime().trim());
            if (Duration.between(startTime, endTime).toMinutes() < 90) {
                throw new BadRequestException("Every availability session must last at least 90 minutes.");
            }
            return new ValidatedSlot(slot.dayOfWeek(), startTime, endTime);
        } catch (DateTimeParseException exception) {
            throw new BadRequestException("Availability time must use HH:mm format.");
        }
    }

    private void validateExistingClassesRemainCovered(String tutorEmail, List<ValidatedSlot> availability) {
        for (ClassRoom classRoom : classRoomRepository.findByTutorEmailWithDetails(tutorEmail)) {
            if (!blocksTutorSchedule(classRoom.getStatus())) continue;
            for (ClassSchedule schedule : classRoom.getSchedules()) {
                LocalTime classStart = LocalTime.parse(schedule.getStartTime());
                LocalTime classEnd = LocalTime.parse(schedule.getEndTime());
                boolean covered = availability.stream().anyMatch(slot ->
                        slot.dayOfWeek().equals(schedule.getDayOfWeek())
                                && !classStart.isBefore(slot.startTime())
                                && !classEnd.isAfter(slot.endTime())
                );
                if (!covered) {
                    String dayLabel = schedule.getDayOfWeek() == 8 ? "Chủ nhật" : "Thứ " + schedule.getDayOfWeek();
                    throw new BadRequestException(String.format(
                            "Không thể lưu lịch rảnh: lớp '%s' đang chiếm %s %s - %s.",
                            classRoom.getName(), dayLabel, schedule.getStartTime(), schedule.getEndTime()
                    ));
                }
            }
        }
    }

    private boolean blocksTutorSchedule(ClassRoomStatus status) {
        return status == ClassRoomStatus.PENDING_APPROVAL
                || status == ClassRoomStatus.ACTIVE
                || status == ClassRoomStatus.PRIVATE
                || status == ClassRoomStatus.PUBLISHED
                || status == ClassRoomStatus.LOCKED;
    }

    private record ValidatedSlot(Integer dayOfWeek, LocalTime startTime, LocalTime endTime) {}
}
