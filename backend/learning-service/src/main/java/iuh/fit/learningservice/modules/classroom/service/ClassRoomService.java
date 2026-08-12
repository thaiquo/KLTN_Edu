package iuh.fit.learningservice.modules.classroom.service;

import iuh.fit.learningservice.modules.availability.entity.AvailabilityResourceType;
import iuh.fit.learningservice.modules.availability.entity.AvailabilityStatus;
import iuh.fit.learningservice.modules.availability.entity.TutorAvailability;
import iuh.fit.learningservice.modules.availability.entity.TutorAvailabilityUsage;
import iuh.fit.learningservice.modules.availability.repository.TutorAvailabilityRepository;
import iuh.fit.learningservice.modules.availability.repository.TutorAvailabilityUsageRepository;
import iuh.fit.learningservice.modules.classroom.dto.*;
import iuh.fit.learningservice.modules.classroom.entity.*;
import iuh.fit.learningservice.modules.classroom.repository.*;
import iuh.fit.learningservice.modules.session.entity.Session;
import iuh.fit.learningservice.modules.session.repository.SessionRepository;
import iuh.fit.learningservice.shared.exception.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class ClassRoomService {

    private static final Logger log = LoggerFactory.getLogger(ClassRoomService.class);

    private final AccountTutorProfileRepository tutorProfileRepository;
    private final AccountTeachingSubjectRepository teachingSubjectRepository;
    private final ClassRoomRepository classRoomRepository;
    private final ClassScheduleRepository scheduleRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final SessionRepository sessionRepository;
    private final TutorAvailabilityRepository availabilityRepository;
    private final TutorAvailabilityUsageRepository availabilityUsageRepository;

    public ClassRoomService(AccountTutorProfileRepository tutorProfileRepository,
                           AccountTeachingSubjectRepository teachingSubjectRepository,
                           ClassRoomRepository classRoomRepository,
                           ClassScheduleRepository scheduleRepository,
                           EnrollmentRepository enrollmentRepository,
                           SessionRepository sessionRepository,
                           TutorAvailabilityRepository availabilityRepository,
                           TutorAvailabilityUsageRepository availabilityUsageRepository) {
        this.tutorProfileRepository = tutorProfileRepository;
        this.teachingSubjectRepository = teachingSubjectRepository;
        this.classRoomRepository = classRoomRepository;
        this.scheduleRepository = scheduleRepository;
        this.enrollmentRepository = enrollmentRepository;
        this.sessionRepository = sessionRepository;
        this.availabilityRepository = availabilityRepository;
        this.availabilityUsageRepository = availabilityUsageRepository;
    }

    @Transactional(readOnly = true)
    public List<ApprovedSubjectResponse> getApprovedTeachingSubjects(UUID tutorId) {
        validateTutorApproved(tutorId);
        return teachingSubjectRepository.findAllApprovedByTutorId(tutorId).stream()
            .map(subject -> new ApprovedSubjectResponse(
                subject.getId(),
                subject.getLevelGroup(),
                subject.getSubjectName(),
                subject.getTeachingLevel()
            ))
            .toList();
    }

    public ClassRoomResponse createClassRoom(UUID tutorId, CreateClassRoomRequest request) {
        validateTutorApproved(tutorId);

        AccountTeachingSubject subject = teachingSubjectRepository.findById(request.teachingRegistrationId())
            .orElseThrow(() -> new BusinessException("NOT_FOUND", "Không tìm thấy phạm vi giảng dạy đã đăng ký", HttpStatus.NOT_FOUND));

        if (!subject.getTutorApplication().getUserId().equals(tutorId)) {
            throw new BusinessException("FORBIDDEN", "Phạm vi giảng dạy không thuộc về bạn", HttpStatus.FORBIDDEN);
        }

        if (!"APPROVED".equalsIgnoreCase(subject.getTutorApplication().getStatus())) {
            throw new BusinessException("FORBIDDEN", "Phạm vi giảng dạy này chưa được Admin duyệt", HttpStatus.FORBIDDEN);
        }

        if (request.schedules().size() != request.sessionsPerWeek()) {
            throw new BusinessException("INVALID_SCHEDULE", "Số lượng lịch học (" + request.schedules().size()
                + ") phải bằng đúng số buổi / tuần (" + request.sessionsPerWeek() + ")");
        }

        if (request.sessionDurationMinutes() != 60 && request.sessionDurationMinutes() != 90 && request.sessionDurationMinutes() != 120) {
            throw new BusinessException("INVALID_DURATION", "Thời lượng mỗi buổi học phải là 60, 90 hoặc 120 phút");
        }

        if (request.totalPrice().compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException("INVALID_PRICE", "Giá toàn bộ khóa học phải lớn hơn 0");
        }

        List<TutorAvailability> availabilities = availabilityRepository.findByTutorIdOrderByDayOfWeekAscStartTimeAsc(tutorId);

        for (ScheduleItemRequest item : request.schedules()) {
            LocalTime startTime = item.startTime();
            LocalTime endTime = startTime.plusMinutes(request.sessionDurationMinutes());

            boolean fitsInAvailability = availabilities.stream().anyMatch(av ->
                av.getStatus() == AvailabilityStatus.AVAILABLE
                && av.getDayOfWeek() == item.dayOfWeek()
                && !startTime.isBefore(av.getStartTime())
                && !endTime.isAfter(av.getEndTime())
            );

            if (!fitsInAvailability) {
                throw new BusinessException("AVAILABILITY_EXCEEDED",
                    "Thời gian buổi học (" + item.dayOfWeek() + " " + startTime + " - " + endTime
                        + ") vượt quá lịch trống đã đăng ký. Vui lòng chọn thời gian bắt đầu khác.");
            }
        }

        List<GeneratedSessionInfo> generatedSessions = generateSessions(
            request.startDate(), request.durationValue(), request.durationUnit(),
            request.schedules(), request.sessionDurationMinutes()
        );

        if (generatedSessions.isEmpty()) {
            throw new BusinessException("INVALID_DATE_RANGE", "Không thể sinh ra buổi học nào trong khoảng thời gian đã chọn");
        }

        LocalDate endDate = generatedSessions.get(generatedSessions.size() - 1).date();
        int totalSessions = generatedSessions.size();
        BigDecimal pricePerSession = request.totalPrice().divide(BigDecimal.valueOf(totalSessions), 2, RoundingMode.HALF_UP);

        validateNoScheduleCollision(tutorId, request.startDate(), endDate, request.schedules(), request.sessionDurationMinutes());

        List<String> allowedLevels = List.of(subject.getTeachingLevel().split(","));
        if (!allowedLevels.contains(request.teachingLevel())) {
            throw new BusinessException("INVALID_TEACHING_LEVEL", "Lớp / cấp độ chọn không hợp lệ cho môn học này");
        }

        ClassRoom classRoom = new ClassRoom(
            tutorId,
            subject.getId(),
            subject.getSubjectName(),
            request.teachingLevel(),
            request.name().trim(),
            request.description().trim(),
            request.maxStudents(),
            request.sessionsPerWeek(),
            request.sessionDurationMinutes(),
            request.durationValue(),
            request.durationUnit().toUpperCase(),
            request.startDate(),
            endDate,
            request.totalPrice(),
            pricePerSession,
            totalSessions
        );

        for (ScheduleItemRequest item : request.schedules()) {
            LocalTime endTime = item.startTime().plusMinutes(request.sessionDurationMinutes());
            ClassSchedule schedule = new ClassSchedule(classRoom, item.dayOfWeek(), item.startTime(), endTime);
            classRoom.addSchedule(schedule);
        }

        ClassRoom saved = classRoomRepository.save(classRoom);

        for (ClassSchedule sch : saved.getSchedules()) {
            availabilities.stream()
                .filter(av -> av.getStatus() == AvailabilityStatus.AVAILABLE
                    && av.getDayOfWeek() == sch.getDayOfWeek()
                    && !sch.getStartTime().isBefore(av.getStartTime())
                    && !sch.getEndTime().isAfter(av.getEndTime()))
                .findFirst()
                .ifPresent(av -> {
                    TutorAvailabilityUsage usage = new TutorAvailabilityUsage(av, AvailabilityResourceType.CLASSROOM, saved.getId());
                    availabilityUsageRepository.save(usage);
                });
        }

        log.info("Gửi thông báo cho Admin: Lớp học '{}' (ID: {}) được tạo và chờ phê duyệt.", saved.getName(), saved.getId());

        return toResponse(saved, List.of());
    }

    @Transactional(readOnly = true)
    public List<ClassRoomResponse> getMyClassRooms(UUID tutorId) {
        List<ClassRoom> rooms = classRoomRepository.findByTutorIdOrderByCreatedAtDesc(tutorId);
        rooms.forEach(this::checkAndAutoLock);
        return rooms.stream().map(room -> {
            List<Session> sessions = sessionRepository.findByClassRoomIdOrderByDateAscStartTimeAsc(room.getId());
            return toResponse(room, sessions);
        }).toList();
    }

    @Transactional(readOnly = true)
    public ClassRoomResponse getClassRoomById(UUID classId) {
        ClassRoom room = classRoomRepository.findById(classId)
            .orElseThrow(() -> new BusinessException("NOT_FOUND", "Không tìm thấy lớp học", HttpStatus.NOT_FOUND));
        checkAndAutoLock(room);
        List<Session> sessions = sessionRepository.findByClassRoomIdOrderByDateAscStartTimeAsc(room.getId());
        return toResponse(room, sessions);
    }

    @Transactional(readOnly = true)
    public List<ClassRoomResponse> getAllClassRoomsForAdmin() {
        List<ClassRoom> rooms = classRoomRepository.findAllByOrderByCreatedAtDesc();
        rooms.forEach(this::checkAndAutoLock);
        return rooms.stream().map(room -> {
            List<Session> sessions = sessionRepository.findByClassRoomIdOrderByDateAscStartTimeAsc(room.getId());
            return toResponse(room, sessions);
        }).toList();
    }

    public ClassRoomResponse approveClassRoom(UUID classId) {
        ClassRoom room = classRoomRepository.findById(classId)
            .orElseThrow(() -> new BusinessException("NOT_FOUND", "Không tìm thấy lớp học", HttpStatus.NOT_FOUND));

        if (room.getStatus() != ClassRoomStatus.PENDING_APPROVAL) {
            throw new BusinessException("INVALID_STATUS", "Lớp học không ở trạng thái chờ duyệt");
        }

        room.setStatus(ClassRoomStatus.ACTIVE);
        ClassRoom saved = classRoomRepository.save(room);

        List<ScheduleItemRequest> scheduleRequests = saved.getSchedules().stream()
            .map(sch -> new ScheduleItemRequest(sch.getDayOfWeek(), sch.getStartTime()))
            .toList();

        List<GeneratedSessionInfo> generatedSessions = generateSessions(
            saved.getStartDate(), saved.getDurationValue(), saved.getDurationUnit(),
            scheduleRequests, saved.getSessionDurationMinutes()
        );

        List<Session> sessionsToSave = generatedSessions.stream()
            .map(gen -> new Session(saved, gen.startTime(), gen.endTime(), gen.date(), null))
            .toList();

        List<Session> savedSessions = sessionRepository.saveAll(sessionsToSave);

        log.info("Lớp học ID: {} đã được Admin phê duyệt và sinh ra {} buổi học.", saved.getId(), savedSessions.size());

        return toResponse(saved, savedSessions);
    }

    public ClassRoomResponse rejectClassRoom(UUID classId) {
        ClassRoom room = classRoomRepository.findById(classId)
            .orElseThrow(() -> new BusinessException("NOT_FOUND", "Không tìm thấy lớp học", HttpStatus.NOT_FOUND));

        if (room.getStatus() != ClassRoomStatus.PENDING_APPROVAL) {
            throw new BusinessException("INVALID_STATUS", "Lớp học không ở trạng thái chờ duyệt");
        }

        room.setStatus(ClassRoomStatus.REJECTED);
        ClassRoom saved = classRoomRepository.save(room);

        return toResponse(saved, List.of());
    }

    public ClassRoomResponse cancelClassRoom(UUID tutorId, UUID classId) {
        ClassRoom room = classRoomRepository.findById(classId)
            .orElseThrow(() -> new BusinessException("NOT_FOUND", "Không tìm thấy lớp học", HttpStatus.NOT_FOUND));

        if (!room.getTutorId().equals(tutorId)) {
            throw new BusinessException("FORBIDDEN", "Bạn không có quyền hủy lớp học này", HttpStatus.FORBIDDEN);
        }

        long studentCount = enrollmentRepository.countByClassRoomId(classId);
        if (studentCount > 0) {
            throw new BusinessException("HAS_STUDENTS", "Không thể hủy/khóa lớp học đã có học viên tham gia");
        }

        room.setStatus(ClassRoomStatus.CANCELLED);
        ClassRoom saved = classRoomRepository.save(room);

        return toResponse(saved, List.of());
    }

    private void checkAndAutoLock(ClassRoom classroom) {
        if ((classroom.getStatus() == ClassRoomStatus.ACTIVE || classroom.getStatus() == ClassRoomStatus.PENDING_APPROVAL)
            && LocalDate.now().isAfter(classroom.getStartDate())) {
            long studentCount = enrollmentRepository.countByClassRoomId(classroom.getId());
            if (studentCount == 0) {
                classroom.setStatus(ClassRoomStatus.CANCELLED);
                classRoomRepository.save(classroom);
                log.info("Lớp học ID: {} tự động khóa/hủy do đến ngày bắt đầu mà chưa có học viên.", classroom.getId());
            }
        }
    }

    private void validateTutorApproved(UUID tutorId) {
        AccountTutorProfile profile = tutorProfileRepository.findByUserId(tutorId)
            .orElseThrow(() -> new BusinessException("FORBIDDEN", "Không tìm thấy hồ sơ Gia sư của tài khoản này", HttpStatus.FORBIDDEN));

        if (!"APPROVED".equalsIgnoreCase(profile.getVerificationStatus())) {
            throw new BusinessException("FORBIDDEN", "Tài khoản gia sư chưa được phê duyệt", HttpStatus.FORBIDDEN);
        }
    }

    private void validateNoScheduleCollision(UUID tutorId, LocalDate startDate, LocalDate endDate,
                                              List<ScheduleItemRequest> schedules, int sessionDurationMinutes) {
        List<ClassRoom> existingRooms = classRoomRepository.findByTutorIdAndStatusIn(
            tutorId, List.of(ClassRoomStatus.PENDING_APPROVAL, ClassRoomStatus.ACTIVE)
        );

        for (ClassRoom existing : existingRooms) {
            if (!(endDate.isBefore(existing.getStartDate()) || startDate.isAfter(existing.getEndDate()))) {
                for (ScheduleItemRequest newSch : schedules) {
                    LocalTime newStart = newSch.startTime();
                    LocalTime newEnd = newStart.plusMinutes(sessionDurationMinutes);

                    for (ClassSchedule oldSch : existing.getSchedules()) {
                        if (oldSch.getDayOfWeek() == newSch.dayOfWeek()) {
                            if (newStart.isBefore(oldSch.getEndTime()) && newEnd.isAfter(oldSch.getStartTime())) {
                                throw new BusinessException("SCHEDULE_COLLISION",
                                    "Lịch học (" + newSch.dayOfWeek() + " " + newStart + " - " + newEnd
                                        + ") bị trùng với lớp '" + existing.getName() + "' (" + oldSch.getStartTime() + " - " + oldSch.getEndTime() + ")");
                            }
                        }
                    }
                }
            }
        }
    }

    private List<GeneratedSessionInfo> generateSessions(LocalDate startDate, int durationValue, String durationUnit,
                                                         List<ScheduleItemRequest> schedules, int durationMinutes) {
        LocalDate cutoffDate;
        if ("WEEK".equalsIgnoreCase(durationUnit)) {
            cutoffDate = startDate.plusWeeks(durationValue);
        } else if ("MONTH".equalsIgnoreCase(durationUnit)) {
            cutoffDate = startDate.plusMonths(durationValue);
        } else {
            throw new BusinessException("INVALID_DURATION_UNIT", "Đơn vị thời gian không hợp lệ (chỉ chấp nhận WEEK hoặc MONTH)");
        }

        List<GeneratedSessionInfo> sessions = new ArrayList<>();
        LocalDate current = startDate;

        while (current.isBefore(cutoffDate)) {
            DayOfWeek day = current.getDayOfWeek();
            for (ScheduleItemRequest sch : schedules) {
                if (sch.dayOfWeek() == day) {
                    LocalTime end = sch.startTime().plusMinutes(durationMinutes);
                    sessions.add(new GeneratedSessionInfo(current, sch.startTime(), end));
                }
            }
            current = current.plusDays(1);
        }

        sessions.sort(Comparator.comparing(GeneratedSessionInfo::date).thenComparing(GeneratedSessionInfo::startTime));
        return sessions;
    }

    private ClassRoomResponse toResponse(ClassRoom room, List<Session> sessions) {
        long currentStudents = enrollmentRepository.countByClassRoomId(room.getId());

        List<ClassScheduleResponse> scheduleResponses = room.getSchedules().stream()
            .map(sch -> new ClassScheduleResponse(sch.getId(), sch.getDayOfWeek(), sch.getStartTime(), sch.getEndTime()))
            .sorted(Comparator.comparing(ClassScheduleResponse::dayOfWeek).thenComparing(ClassScheduleResponse::startTime))
            .toList();

        List<SessionResponse> sessionResponses = sessions.stream()
            .map(s -> new SessionResponse(s.getId(), s.getDate(), s.getStartTime(), s.getEndTime(), s.getLink(), s.getStatus()))
            .toList();

        BigDecimal hoursPerSession = BigDecimal.valueOf(room.getSessionDurationMinutes()).divide(BigDecimal.valueOf(60), 2, RoundingMode.HALF_UP);
        BigDecimal totalHours = hoursPerSession.multiply(BigDecimal.valueOf(room.getTotalSessions()));
        BigDecimal averageHourlyRate = totalHours.compareTo(BigDecimal.ZERO) > 0
            ? room.getTotalPrice().divide(totalHours, 2, RoundingMode.HALF_UP)
            : BigDecimal.ZERO;

        return new ClassRoomResponse(
            room.getId(),
            room.getTutorId(),
            room.getTeachingRegistrationId(),
            room.getSubjectName(),
            room.getTeachingLevel(),
            room.getName(),
            room.getDescription(),
            room.getMaxStudents(),
            (int) currentStudents,
            room.getSessionsPerWeek(),
            room.getSessionDurationMinutes(),
            room.getDurationValue(),
            room.getDurationUnit(),
            room.getStartDate(),
            room.getEndDate(),
            room.getTotalPrice(),
            room.getPricePerSession(),
            averageHourlyRate,
            room.getTotalSessions(),
            room.getStatus(),
            scheduleResponses,
            sessionResponses,
            room.getCreatedAt(),
            room.getUpdatedAt()
        );
    }

    private record GeneratedSessionInfo(LocalDate date, LocalTime startTime, LocalTime endTime) {}
}
