package iuh.fit.learningservice.modules.availability.service;

import iuh.fit.learningservice.modules.availability.dto.AvailabilitySlotRequest;
import iuh.fit.learningservice.modules.availability.dto.ReplaceAvailabilityRequest;
import iuh.fit.learningservice.modules.availability.dto.TutorAvailabilityResponse;
import iuh.fit.learningservice.modules.availability.entity.TutorAvailability;
import iuh.fit.learningservice.modules.availability.repository.TutorAvailabilityRepository;
import iuh.fit.learningservice.modules.availability.repository.TutorAvailabilityUsageRepository;
import iuh.fit.learningservice.shared.exception.AvailabilityInUseException;
import iuh.fit.learningservice.shared.exception.InvalidAvailabilityException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class TutorAvailabilityService {

    private static final int MIN_WEEKLY_SESSIONS = 3;
    private static final Duration MIN_SLOT_DURATION = Duration.ofMinutes(90);
    private static final Comparator<TutorAvailabilityResponse> RESPONSE_ORDER = Comparator
        .comparing(TutorAvailabilityResponse::dayOfWeek)
        .thenComparing(TutorAvailabilityResponse::startTime);

    private final TutorAvailabilityRepository availabilityRepository;
    private final TutorAvailabilityUsageRepository usageRepository;

    public TutorAvailabilityService(TutorAvailabilityRepository availabilityRepository,
                                    TutorAvailabilityUsageRepository usageRepository) {
        this.availabilityRepository = availabilityRepository;
        this.usageRepository = usageRepository;
    }

    @Transactional(readOnly = true)
    public List<TutorAvailabilityResponse> getByTutorId(UUID tutorId) {
        return availabilityRepository.findByTutorIdOrderByDayOfWeekAscStartTimeAsc(tutorId).stream()
            .map(TutorAvailabilityResponse::from)
            .toList();
    }

    @Transactional
    public List<TutorAvailabilityResponse> replace(UUID tutorId, ReplaceAvailabilityRequest request) {
        validateSlots(request.availabilities());

        List<TutorAvailability> existing = availabilityRepository.findByTutorIdForUpdate(tutorId);
        Map<UUID, TutorAvailability> existingById = existing.stream()
            .collect(Collectors.toMap(TutorAvailability::getId, Function.identity()));
        validateOwnership(request.availabilities(), existingById);

        Set<UUID> requestedIds = request.availabilities().stream()
            .map(AvailabilitySlotRequest::id)
            .filter(Objects::nonNull)
            .collect(Collectors.toSet());
        List<TutorAvailability> removed = existing.stream()
            .filter(availability -> !requestedIds.contains(availability.getId()))
            .toList();
        removed.forEach(this::assertNotInUse);

        availabilityRepository.deleteAll(removed);
        availabilityRepository.flush();

        List<TutorAvailability> result = new ArrayList<>();
        for (AvailabilitySlotRequest slot : request.availabilities()) {
            if (slot.id() == null) {
                result.add(new TutorAvailability(
                    tutorId, slot.dayOfWeek(), slot.startTime(), slot.endTime(), slot.status()
                ));
                continue;
            }

            TutorAvailability availability = existingById.get(slot.id());
            if (hasChanged(availability, slot)) {
                assertNotInUse(availability);
                availability.change(slot.dayOfWeek(), slot.startTime(), slot.endTime(), slot.status());
            }
            result.add(availability);
        }

        availabilityRepository.saveAll(result);
        availabilityRepository.flush();
        return result.stream()
            .map(TutorAvailabilityResponse::from)
            .sorted(RESPONSE_ORDER)
            .toList();
    }

    private void validateSlots(List<AvailabilitySlotRequest> slots) {
        long availableSlots = slots.stream()
            .filter(slot -> slot.status() == iuh.fit.learningservice.modules.availability.entity.AvailabilityStatus.AVAILABLE)
            .count();
        if (availableSlots < MIN_WEEKLY_SESSIONS) {
            throw new InvalidAvailabilityException("Cần tạo ít nhất 3 lịch trống trong tuần");
        }
        Set<UUID> ids = new HashSet<>();
        Map<java.time.DayOfWeek, List<AvailabilitySlotRequest>> slotsByDay = new HashMap<>();

        for (AvailabilitySlotRequest slot : slots) {
            if (slot.id() != null && !ids.add(slot.id())) {
                throw new InvalidAvailabilityException("An availability id cannot appear more than once");
            }
            if (!slot.startTime().isBefore(slot.endTime())) {
                throw new InvalidAvailabilityException("Availability start time must be earlier than end time");
            }
            Duration duration = Duration.between(slot.startTime(), slot.endTime());
            if (duration.compareTo(MIN_SLOT_DURATION) < 0) {
                throw new InvalidAvailabilityException("Mỗi lịch trống phải kéo dài ít nhất 90 phút");
            }
            slotsByDay.computeIfAbsent(slot.dayOfWeek(), ignored -> new ArrayList<>()).add(slot);
        }

        for (List<AvailabilitySlotRequest> dailySlots : slotsByDay.values()) {
            dailySlots.sort(Comparator.comparing(AvailabilitySlotRequest::startTime));
            for (int index = 1; index < dailySlots.size(); index++) {
                AvailabilitySlotRequest previous = dailySlots.get(index - 1);
                AvailabilitySlotRequest current = dailySlots.get(index);
                if (current.startTime().isBefore(previous.endTime())) {
                    throw new InvalidAvailabilityException("Availability slots cannot overlap on the same day");
                }
            }
        }
    }

    private void validateOwnership(List<AvailabilitySlotRequest> slots,
                                   Map<UUID, TutorAvailability> existingById) {
        slots.stream()
            .map(AvailabilitySlotRequest::id)
            .filter(Objects::nonNull)
            .filter(id -> !existingById.containsKey(id))
            .findFirst()
            .ifPresent(id -> {
                throw new InvalidAvailabilityException("Availability does not belong to the current tutor");
            });
    }

    private boolean hasChanged(TutorAvailability availability, AvailabilitySlotRequest slot) {
        return availability.getDayOfWeek() != slot.dayOfWeek()
            || !availability.getStartTime().equals(slot.startTime())
            || !availability.getEndTime().equals(slot.endTime())
            || availability.getStatus() != slot.status();
    }

    private void assertNotInUse(TutorAvailability availability) {
        if (usageRepository.existsByAvailabilityIdAndActiveTrue(availability.getId())) {
            throw new AvailabilityInUseException();
        }
    }
}
