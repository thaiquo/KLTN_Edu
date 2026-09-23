package iuh.fit.learning_service.service;

import iuh.fit.learning_service.dto.StudentMatchingDtos.PreferredScheduleRequest;
import iuh.fit.learning_service.dto.StudentMatchingDtos.StudentMatchingInputRequest;
import iuh.fit.learning_service.dto.StudentMatchingDtos.StudentMatchingInputResponse;
import iuh.fit.learning_service.entity.CatalogLevel;
import iuh.fit.learning_service.entity.CatalogSubject;
import iuh.fit.learning_service.enums.TeachingMode;
import iuh.fit.learning_service.exception.BadRequestException;
import iuh.fit.learning_service.repository.CatalogLevelRepository;
import iuh.fit.learning_service.repository.CatalogSubjectRepository;
import org.springframework.stereotype.Service;

import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
public class StudentMatchingInputService {
    private final CatalogSubjectRepository subjects;
    private final CatalogLevelRepository levels;

    public StudentMatchingInputService(CatalogSubjectRepository subjects, CatalogLevelRepository levels) {
        this.subjects = subjects;
        this.levels = levels;
    }

    public StudentMatchingInputResponse validate(StudentMatchingInputRequest request) {
        CatalogSubject subject = subjects.findByIdAndActiveTrue(request.subjectId())
                .orElseThrow(() -> new BadRequestException("Môn học không tồn tại hoặc đã ngừng hoạt động."));
        CatalogLevel level = levels.findByIdAndActiveTrue(request.levelId())
                .orElseThrow(() -> new BadRequestException("Cấp độ học không tồn tại hoặc đã ngừng hoạt động."));
        if (level.getSubject() == null || !subject.getId().equals(level.getSubject().getId())) {
            throw new BadRequestException("Cấp độ học không thuộc môn học đã chọn.");
        }

        List<PreferredScheduleRequest> schedules = normalizeSchedules(request.preferredSchedules());
        String provinceCode = trimToNull(request.provinceCode());
        String communeCode = trimToNull(request.communeCode());
        TeachingMode teachingMode = request.teachingMode();

        return new StudentMatchingInputResponse(
                subject.getId(),
                level.getId(),
                teachingMode,
                request.budgetMin(),
                request.budgetMax(),
                provinceCode,
                communeCode,
                schedules,
                trimToNull(request.learningGoal()),
                "VALIDATED",
                notices(teachingMode, provinceCode, schedules)
        );
    }

    private List<PreferredScheduleRequest> normalizeSchedules(List<PreferredScheduleRequest> requested) {
        if (requested == null || requested.isEmpty()) {
            return List.of();
        }

        List<ValidatedSchedule> schedules = requested.stream()
                .map(this::validatedSchedule)
                .sorted(Comparator
                        .comparing(ValidatedSchedule::dayOfWeek)
                        .thenComparing(ValidatedSchedule::startTime)
                        .thenComparing(ValidatedSchedule::endTime))
                .toList();

        Set<String> exactKeys = new HashSet<>();
        for (ValidatedSchedule schedule : schedules) {
            String key = schedule.dayOfWeek() + "|" + schedule.startTime() + "|" + schedule.endTime();
            if (!exactKeys.add(key)) {
                throw new BadRequestException("Các khung giờ ưu tiên không được trùng nhau.");
            }
        }

        for (int index = 0; index < schedules.size() - 1; index++) {
            ValidatedSchedule current = schedules.get(index);
            ValidatedSchedule next = schedules.get(index + 1);
            if (current.dayOfWeek().equals(next.dayOfWeek()) && current.endTime().isAfter(next.startTime())) {
                throw new BadRequestException("Các khung giờ ưu tiên trong cùng một ngày không được chồng lấn.");
            }
        }

        return schedules.stream()
                .map(schedule -> new PreferredScheduleRequest(
                        schedule.dayOfWeek(),
                        schedule.startTime().toString(),
                        schedule.endTime().toString()))
                .toList();
    }

    private ValidatedSchedule validatedSchedule(PreferredScheduleRequest schedule) {
        if (schedule == null) {
            throw new BadRequestException("Khung giờ ưu tiên không hợp lệ.");
        }
        if (schedule.dayOfWeek() == null || schedule.dayOfWeek() < 2 || schedule.dayOfWeek() > 8) {
            throw new BadRequestException("Ngày học ưu tiên phải nằm trong khoảng Thứ 2 đến Chủ nhật.");
        }
        LocalTime start = parseTime(schedule.startTime(), "Giờ bắt đầu phải có định dạng HH:mm.");
        LocalTime end = parseTime(schedule.endTime(), "Giờ kết thúc phải có định dạng HH:mm.");
        if (!start.isBefore(end)) {
            throw new BadRequestException("Giờ bắt đầu phải nhỏ hơn giờ kết thúc.");
        }
        return new ValidatedSchedule(schedule.dayOfWeek(), start, end);
    }

    private LocalTime parseTime(String value, String message) {
        try {
            return LocalTime.parse(value == null ? "" : value.trim());
        } catch (RuntimeException exception) {
            throw new BadRequestException(message);
        }
    }

    private List<String> notices(TeachingMode teachingMode, String provinceCode, List<PreferredScheduleRequest> schedules) {
        List<String> notices = new ArrayList<>();
        if (teachingMode == TeachingMode.ONLINE) {
            notices.add("ONLINE không yêu cầu khu vực học trực tiếp.");
        } else if (teachingMode == TeachingMode.OFFLINE && provinceCode == null) {
            notices.add("OFFLINE nên có khu vực học mong muốn để Phase 4 lọc chính xác hơn.");
        }
        if (schedules.isEmpty()) {
            notices.add("Chưa có khung giờ ưu tiên; Phase 4 có thể dùng tiêu chí lịch ở mức mềm.");
        }
        return notices;
    }

    private String trimToNull(String value) {
        if (value == null || value.trim().isEmpty()) {
            return null;
        }
        return value.trim();
    }

    private record ValidatedSchedule(Integer dayOfWeek, LocalTime startTime, LocalTime endTime) {}
}
