package iuh.fit.learning_service.service;

import iuh.fit.learning_service.dto.ClassRoomDtos;
import iuh.fit.learning_service.entity.*;
import iuh.fit.learning_service.enums.ClassRoomStatus;
import iuh.fit.learning_service.enums.DurationUnit;
import iuh.fit.learning_service.enums.LearningMode;
import iuh.fit.learning_service.enums.SyllabusMode;
import iuh.fit.learning_service.enums.TutorSubjectRegistrationStatus;
import iuh.fit.learning_service.exception.BadRequestException;
import iuh.fit.learning_service.exception.ConflictException;
import iuh.fit.learning_service.exception.ForbiddenException;
import iuh.fit.learning_service.exception.ResourceNotFoundException;
import iuh.fit.learning_service.repository.CatalogLevelRepository;
import iuh.fit.learning_service.repository.ClassRoomRepository;
import iuh.fit.learning_service.repository.TutorSubjectRegistrationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Service
@Transactional
public class ClassRoomService {
    private final ClassRoomRepository classRoomRepository;
    private final TutorSubjectRegistrationRepository registrationRepository;
    private final CatalogLevelRepository levelRepository;

    public ClassRoomService(
            ClassRoomRepository classRoomRepository,
            TutorSubjectRegistrationRepository registrationRepository,
            CatalogLevelRepository levelRepository
    ) {
        this.classRoomRepository = classRoomRepository;
        this.registrationRepository = registrationRepository;
        this.levelRepository = levelRepository;
    }

    @Transactional(readOnly = true)
    public List<ClassRoomDtos.ClassRoomResponse> getMyClasses(String tutorEmail, ClassRoomStatus status) {
        List<ClassRoom> classes;
        if (status != null) {
            classes = classRoomRepository.findByTutorEmailIgnoreCaseAndStatusOrderByCreatedAtDesc(tutorEmail, status);
        } else {
            classes = classRoomRepository.findByTutorEmailWithDetails(tutorEmail);
        }
        return classes.stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public ClassRoomDtos.ClassRoomResponse getClassById(String tutorEmail, Long id) {
        ClassRoom classRoom = classRoomRepository.findByIdWithDetails(id)
                .orElseThrow(() -> new ResourceNotFoundException("Classroom not found: " + id));
        if (!classRoom.getTutorEmail().equalsIgnoreCase(tutorEmail)) {
            throw new ForbiddenException("You do not have access to this classroom");
        }
        return toResponse(classRoom);
    }

    @Transactional(readOnly = true)
    public ClassRoomDtos.ClassRoomStatsResponse getMyClassStats(String tutorEmail) {
        long total = classRoomRepository.countByTutorEmailIgnoreCase(tutorEmail);
        long active = classRoomRepository.countByTutorEmailIgnoreCaseAndStatus(tutorEmail, ClassRoomStatus.ACTIVE);
        long pending = classRoomRepository.countByTutorEmailIgnoreCaseAndStatus(tutorEmail, ClassRoomStatus.PENDING_APPROVAL);
        long rejected = classRoomRepository.countByTutorEmailIgnoreCaseAndStatus(tutorEmail, ClassRoomStatus.REJECTED);
        long draft = classRoomRepository.countByTutorEmailIgnoreCaseAndStatus(tutorEmail, ClassRoomStatus.DRAFT);
        return new ClassRoomDtos.ClassRoomStatsResponse(total, active, pending, rejected, draft);
    }

    public ClassRoomDtos.ClassRoomResponse createClass(String tutorEmail, ClassRoomDtos.CreateClassRoomRequest request) {
        TutorSubjectRegistration registration = registrationRepository.findById(request.tutorSubjectRegistrationId())
                .orElseThrow(() -> new ResourceNotFoundException("Teaching registration not found: " + request.tutorSubjectRegistrationId()));

        if (!registration.getTutorEmail().equalsIgnoreCase(tutorEmail)) {
            throw new ForbiddenException("This teaching registration does not belong to you");
        }

        if (registration.getStatus() != TutorSubjectRegistrationStatus.APPROVED) {
            throw new BadRequestException("You can only create classes from APPROVED teaching registrations");
        }

        CatalogLevel level = levelRepository.findById(request.levelId())
                .orElseThrow(() -> new ResourceNotFoundException("Level not found: " + request.levelId()));

        boolean levelBelongsToRegistration = registration.getLevels().stream()
                .anyMatch(l -> l.getId().equals(level.getId()));
        if (!levelBelongsToRegistration) {
            throw new BadRequestException("The selected level does not belong to the approved registration");
        }

        // Validate price per session within bounds
        if (request.pricePerSession().compareTo(registration.getTuitionMin()) < 0 ||
            request.pricePerSession().compareTo(registration.getTuitionMax()) > 0) {
            throw new BadRequestException(String.format(
                    "Price per session must be between %,.0f VNĐ and %,.0f VNĐ",
                    registration.getTuitionMin(), registration.getTuitionMax()));
        }

        // Validate learning mode
        String meetingLink = null;
        String address = null;
        if (request.learningMode() == LearningMode.ONLINE) {
            if (request.meetingLink() == null || request.meetingLink().trim().isEmpty()) {
                throw new BadRequestException("Meeting link is required for ONLINE classes");
            }
            meetingLink = request.meetingLink().trim();
        } else if (request.learningMode() == LearningMode.OFFLINE) {
            if (request.address() == null || request.address().trim().isEmpty()) {
                throw new BadRequestException("Address is required for OFFLINE classes");
            }
            address = request.address().trim();
        }

        // Validate schedules
        if (request.schedules().size() != request.sessionsPerWeek()) {
            throw new BadRequestException(String.format(
                    "You must select exactly %d schedule slot(s) for %d session(s) per week",
                    request.sessionsPerWeek(), request.sessionsPerWeek()));
        }
        validateScheduleSlots(request.schedules());

        // Validate syllabus
        validateSyllabus(request.syllabusMode(), request.syllabusFileUrl(), request.chapters());

        // Calculate end date, total sessions, and total price
        LocalDate endDate = calculateEndDate(request.startDate(), request.durationValue(), request.durationUnit());
        int totalSessions = calculateTotalSessions(request.durationValue(), request.durationUnit(), request.sessionsPerWeek());
        BigDecimal totalPrice = request.pricePerSession().multiply(BigDecimal.valueOf(totalSessions));

        ClassRoom classRoom = new ClassRoom();
        classRoom.setTutorSubjectRegistration(registration);
        classRoom.setLevel(level);
        classRoom.setTutorEmail(tutorEmail);
        classRoom.setTutorProfileId(registration.getTutorProfileId());
        classRoom.setName(request.name().trim());
        classRoom.setDescription(request.description().trim());
        classRoom.setLearningMode(request.learningMode());
        classRoom.setMeetingLink(meetingLink);
        classRoom.setAddress(address);
        classRoom.setMaxStudents(request.maxStudents());
        classRoom.setPricePerSession(request.pricePerSession());
        classRoom.setTotalPrice(totalPrice);
        classRoom.setSessionsPerWeek(request.sessionsPerWeek());
        classRoom.setDurationPerSessionMinutes(request.durationPerSessionMinutes());
        classRoom.setDurationValue(request.durationValue());
        classRoom.setDurationUnit(request.durationUnit());
        classRoom.setStartDate(request.startDate());
        classRoom.setEndDate(endDate);
        classRoom.setTotalSessions(totalSessions);
        classRoom.setSyllabusMode(request.syllabusMode());
        classRoom.setSyllabusFileUrl(request.syllabusFileUrl());
        classRoom.setStatus(ClassRoomStatus.PENDING_APPROVAL);

        // Add schedules
        List<ClassSchedule> schedules = new ArrayList<>();
        for (ClassRoomDtos.ScheduleRequest sReq : request.schedules()) {
            ClassSchedule schedule = new ClassSchedule();
            schedule.setClassRoom(classRoom);
            schedule.setDayOfWeek(sReq.dayOfWeek());
            schedule.setStartTime(sReq.startTime());
            schedule.setEndTime(sReq.endTime());
            schedules.add(schedule);
        }
        classRoom.setSchedules(schedules);

        // Add chapters if any
        List<ClassChapter> chapters = new ArrayList<>();
        if (request.chapters() != null && !request.chapters().isEmpty()) {
            int order = 1;
            for (ClassRoomDtos.ChapterRequest cReq : request.chapters()) {
                ClassChapter chapter = new ClassChapter();
                chapter.setClassRoom(classRoom);
                chapter.setTitle(cReq.title().trim());
                chapter.setDescription(cReq.description() != null ? cReq.description().trim() : null);
                chapter.setExpectedSessions(cReq.expectedSessions());
                chapter.setOrderIndex(cReq.orderIndex() != null ? cReq.orderIndex() : order++);
                chapters.add(chapter);
            }
        }
        classRoom.setChapters(chapters);

        ClassRoom saved = classRoomRepository.save(classRoom);
        return toResponse(saved);
    }

    public void deleteClass(String tutorEmail, Long id) {
        ClassRoom classRoom = classRoomRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Classroom not found: " + id));
        if (!classRoom.getTutorEmail().equalsIgnoreCase(tutorEmail)) {
            throw new ForbiddenException("You do not have access to this classroom");
        }
        if (classRoom.getStatus() != ClassRoomStatus.DRAFT
                && classRoom.getStatus() != ClassRoomStatus.REJECTED
                && classRoom.getStatus() != ClassRoomStatus.PENDING_APPROVAL) {
            throw new ConflictException("Only DRAFT, REJECTED or PENDING_APPROVAL classrooms can be deleted");
        }
        classRoomRepository.delete(classRoom);
    }

    // ==========================================
    // ADMIN / STAFF METHODS
    // ==========================================

    @Transactional(readOnly = true)
    public List<ClassRoomDtos.ClassRoomResponse> getAllClassesForAdmin(
            ClassRoomStatus status,
            String tutorEmail,
            Long subjectId,
            String keyword
    ) {
        List<ClassRoom> list = classRoomRepository.findAllWithDetails();
        return list.stream()
                .filter(c -> status == null || c.getStatus() == status)
                .filter(c -> tutorEmail == null || tutorEmail.isBlank() || c.getTutorEmail().equalsIgnoreCase(tutorEmail.trim()))
                .filter(c -> {
                    if (subjectId == null) return true;
                    TutorSubjectRegistration reg = c.getTutorSubjectRegistration();
                    return reg != null && reg.getSubject() != null && reg.getSubject().getId().equals(subjectId);
                })
                .filter(c -> {
                    if (keyword == null || keyword.isBlank()) return true;
                    String k = keyword.trim().toLowerCase();
                    boolean matchName = c.getName().toLowerCase().contains(k);
                    boolean matchEmail = c.getTutorEmail().toLowerCase().contains(k);
                    boolean matchSubject = c.getTutorSubjectRegistration() != null &&
                            c.getTutorSubjectRegistration().getSubject() != null &&
                            c.getTutorSubjectRegistration().getSubject().getName().toLowerCase().contains(k);
                    return matchName || matchEmail || matchSubject;
                })
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public ClassRoomDtos.ClassRoomResponse getClassByIdForAdmin(Long id) {
        ClassRoom classRoom = classRoomRepository.findByIdWithDetails(id)
                .orElseThrow(() -> new ResourceNotFoundException("Classroom not found: " + id));
        return toResponse(classRoom);
    }

    public ClassRoomDtos.ClassRoomResponse approveClass(Long id, String reviewerEmail) {
        ClassRoom classRoom = classRoomRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Classroom not found: " + id));
        if (classRoom.getStatus() != ClassRoomStatus.PENDING_APPROVAL) {
            throw new BadRequestException("Only PENDING_APPROVAL classrooms can be approved");
        }
        classRoom.setStatus(ClassRoomStatus.ACTIVE);
        classRoom.setRejectReason(null);
        ClassRoom saved = classRoomRepository.save(classRoom);
        return toResponse(saved);
    }

    public ClassRoomDtos.ClassRoomResponse rejectClass(Long id, String reviewerEmail, String reason) {
        ClassRoom classRoom = classRoomRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Classroom not found: " + id));
        if (classRoom.getStatus() != ClassRoomStatus.PENDING_APPROVAL) {
            throw new BadRequestException("Only PENDING_APPROVAL classrooms can be rejected");
        }
        if (reason == null || reason.trim().isEmpty()) {
            throw new BadRequestException("Rejection reason is required");
        }
        classRoom.setStatus(ClassRoomStatus.REJECTED);
        classRoom.setRejectReason(reason.trim());
        ClassRoom saved = classRoomRepository.save(classRoom);
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public ClassRoomDtos.ClassRoomStatsResponse getAdminClassStats() {
        long total = classRoomRepository.count();
        long active = classRoomRepository.countByStatus(ClassRoomStatus.ACTIVE);
        long pending = classRoomRepository.countByStatus(ClassRoomStatus.PENDING_APPROVAL);
        long rejected = classRoomRepository.countByStatus(ClassRoomStatus.REJECTED);
        long draft = classRoomRepository.countByStatus(ClassRoomStatus.DRAFT);
        return new ClassRoomDtos.ClassRoomStatsResponse(total, active, pending, rejected, draft);
    }

    private void validateScheduleSlots(List<ClassRoomDtos.ScheduleRequest> schedules) {
        for (int i = 0; i < schedules.size(); i++) {
            ClassRoomDtos.ScheduleRequest a = schedules.get(i);
            if (a.startTime().compareTo(a.endTime()) >= 0) {
                throw new BadRequestException("Schedule start time must be before end time");
            }
            for (int j = i + 1; j < schedules.size(); j++) {
                ClassRoomDtos.ScheduleRequest b = schedules.get(j);
                if (a.dayOfWeek().equals(b.dayOfWeek())) {
                    // Check overlap
                    if (!(a.endTime().compareTo(b.startTime()) <= 0 || a.startTime().compareTo(b.endTime()) >= 0)) {
                        throw new BadRequestException("Overlapping schedules detected on day " + a.dayOfWeek());
                    }
                }
            }
        }
    }

    private void validateSyllabus(SyllabusMode mode, String fileUrl, List<ClassRoomDtos.ChapterRequest> chapters) {
        if (mode == SyllabusMode.FORM || mode == SyllabusMode.BOTH) {
            if (chapters == null || chapters.isEmpty()) {
                throw new BadRequestException("At least 1 syllabus chapter is required for " + mode + " mode");
            }
        }
        if (mode == SyllabusMode.FILE || mode == SyllabusMode.BOTH) {
            if (fileUrl == null || fileUrl.trim().isEmpty()) {
                throw new BadRequestException("A syllabus file upload is required for " + mode + " mode");
            }
        }
    }

    private LocalDate calculateEndDate(LocalDate startDate, int durationValue, DurationUnit unit) {
        if (unit == DurationUnit.WEEK) {
            return startDate.plusWeeks(durationValue);
        } else {
            return startDate.plusMonths(durationValue);
        }
    }

    private int calculateTotalSessions(int durationValue, DurationUnit unit, int sessionsPerWeek) {
        if (unit == DurationUnit.WEEK) {
            return durationValue * sessionsPerWeek;
        } else {
            // 1 month ~ 4 weeks
            return durationValue * 4 * sessionsPerWeek;
        }
    }

    private ClassRoomDtos.ClassRoomResponse toResponse(ClassRoom c) {
        ClassRoomDtos.RegistrationBrief regBrief = null;
        if (c.getTutorSubjectRegistration() != null) {
            TutorSubjectRegistration r = c.getTutorSubjectRegistration();
            String subjectName = r.getSubject() != null ? r.getSubject().getName() : r.getProposedSubjectName();
            String subjectCode = r.getSubject() != null ? r.getSubject().getCode() : "custom";
            regBrief = new ClassRoomDtos.RegistrationBrief(
                    r.getId(),
                    subjectName,
                    subjectCode,
                    r.getTuitionMin(),
                    r.getTuitionMax()
            );
        }

        ClassRoomDtos.LevelBrief levelBrief = null;
        if (c.getLevel() != null) {
            levelBrief = new ClassRoomDtos.LevelBrief(
                    c.getLevel().getId(),
                    c.getLevel().getName(),
                    c.getLevel().getCode()
            );
        }

        List<ClassRoomDtos.ScheduleResponse> schedules = c.getSchedules().stream()
                .map(s -> new ClassRoomDtos.ScheduleResponse(s.getId(), s.getDayOfWeek(), s.getStartTime(), s.getEndTime()))
                .toList();

        List<ClassRoomDtos.ChapterResponse> chapters = c.getChapters().stream()
                .map(ch -> new ClassRoomDtos.ChapterResponse(ch.getId(), ch.getTitle(), ch.getDescription(), ch.getExpectedSessions(), ch.getOrderIndex()))
                .toList();

        return new ClassRoomDtos.ClassRoomResponse(
                c.getId(),
                c.getTutorSubjectRegistration() != null ? c.getTutorSubjectRegistration().getId() : null,
                regBrief,
                levelBrief,
                c.getTutorEmail(),
                c.getTutorProfileId(),
                c.getName(),
                c.getDescription(),
                c.getLearningMode(),
                c.getMeetingLink(),
                c.getAddress(),
                c.getMaxStudents(),
                c.getPricePerSession(),
                c.getTotalPrice(),
                c.getSessionsPerWeek(),
                c.getDurationPerSessionMinutes(),
                c.getDurationValue(),
                c.getDurationUnit(),
                c.getStartDate(),
                c.getEndDate(),
                c.getTotalSessions(),
                c.getSyllabusMode(),
                c.getSyllabusFileUrl(),
                c.getStatus(),
                c.getRejectReason(),
                schedules,
                chapters,
                c.getCreatedAt(),
                c.getUpdatedAt()
        );
    }
}
