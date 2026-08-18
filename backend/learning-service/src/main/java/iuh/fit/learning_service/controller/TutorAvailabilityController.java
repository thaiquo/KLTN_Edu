package iuh.fit.learning_service.controller;

import iuh.fit.learning_service.entity.TutorAvailability;
import iuh.fit.learning_service.exception.BadRequestException;
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

    public TutorAvailabilityController(TutorAvailabilityRepository repository) {
        this.repository = repository;
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

    private record ValidatedSlot(Integer dayOfWeek, LocalTime startTime, LocalTime endTime) {}
}
