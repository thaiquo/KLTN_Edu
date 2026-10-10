package iuh.fit.learning_service.service;

import iuh.fit.learning_service.dto.ClassRoomDtos;
import iuh.fit.learning_service.entity.*;
import iuh.fit.learning_service.enums.ClassRoomStatus;
import iuh.fit.learning_service.enums.DurationUnit;
import iuh.fit.learning_service.messaging.LearningEventPublisher;
import iuh.fit.learning_service.enums.JoinMode;
import iuh.fit.learning_service.enums.LearningMode;
import iuh.fit.learning_service.enums.SyllabusMode;
import iuh.fit.learning_service.enums.TeachingMode;
import iuh.fit.learning_service.enums.TutorSubjectRegistrationStatus;
import iuh.fit.learning_service.exception.BadRequestException;
import iuh.fit.learning_service.exception.ConflictException;
import iuh.fit.learning_service.exception.ForbiddenException;
import iuh.fit.learning_service.exception.ResourceNotFoundException;
import iuh.fit.learning_service.enums.EnrollmentRequestStatus;
import iuh.fit.learning_service.repository.CatalogLevelRepository;
import iuh.fit.learning_service.repository.ClassRoomRepository;
import iuh.fit.learning_service.repository.EnrollmentRequestRepository;
import iuh.fit.learning_service.repository.TutorAvailabilityRepository;
import iuh.fit.learning_service.repository.TutorAuthorizationStateRepository;
import iuh.fit.learning_service.repository.TutorReviewRepository;
import iuh.fit.learning_service.repository.TutorSubjectRegistrationRepository;
import iuh.fit.learning_service.realtime.RealtimeEventHub;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
public class ClassRoomService {
    private static final Logger log = LoggerFactory.getLogger(ClassRoomService.class);

    private final ClassRoomRepository classRoomRepository;
    private final TutorSubjectRegistrationRepository registrationRepository;
    private final CatalogLevelRepository levelRepository;
    private final TutorAvailabilityRepository availabilityRepository;
    private final EnrollmentRequestRepository enrollmentRequestRepository;
    private final TutorAuthorizationStateRepository tutorAuthorizationStateRepository;
    private final TutorReviewRepository tutorReviewRepository;
    private final TutorIdentityLookup tutorIdentityLookup;
    private final LearningEventPublisher eventPublisher;
    private final RealtimeEventHub realtimeEventHub;
    private final LearningStorageCleanupService learningStorageCleanupService;

    public ClassRoomService(
            ClassRoomRepository classRoomRepository,
            TutorSubjectRegistrationRepository registrationRepository,
            CatalogLevelRepository levelRepository,
            TutorAvailabilityRepository availabilityRepository,
            EnrollmentRequestRepository enrollmentRequestRepository,
            TutorAuthorizationStateRepository tutorAuthorizationStateRepository,
            TutorReviewRepository tutorReviewRepository,
            TutorIdentityLookup tutorIdentityLookup,
            LearningEventPublisher eventPublisher,
            RealtimeEventHub realtimeEventHub,
            LearningStorageCleanupService learningStorageCleanupService
    ) {
        this.classRoomRepository = classRoomRepository;
        this.registrationRepository = registrationRepository;
        this.levelRepository = levelRepository;
        this.availabilityRepository = availabilityRepository;
        this.enrollmentRequestRepository = enrollmentRequestRepository;
        this.tutorAuthorizationStateRepository = tutorAuthorizationStateRepository;
        this.tutorReviewRepository = tutorReviewRepository;
        this.tutorIdentityLookup = tutorIdentityLookup;
        this.eventPublisher = eventPublisher;
        this.realtimeEventHub = realtimeEventHub;
        this.learningStorageCleanupService = learningStorageCleanupService;
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
        long privateCount = classRoomRepository.countByTutorEmailIgnoreCaseAndStatus(tutorEmail, ClassRoomStatus.PRIVATE);
        long publishedCount = classRoomRepository.countByTutorEmailIgnoreCaseAndStatus(tutorEmail, ClassRoomStatus.PUBLISHED);
        long lockedCount = classRoomRepository.countByTutorEmailIgnoreCaseAndStatus(tutorEmail, ClassRoomStatus.LOCKED);
        long closedCount = classRoomRepository.countByTutorEmailIgnoreCaseAndStatus(tutorEmail, ClassRoomStatus.CLOSED);
        long rejected = classRoomRepository.countByTutorEmailIgnoreCaseAndStatus(tutorEmail, ClassRoomStatus.REJECTED);
        long draft = classRoomRepository.countByTutorEmailIgnoreCaseAndStatus(tutorEmail, ClassRoomStatus.DRAFT);
        return new ClassRoomDtos.ClassRoomStatsResponse(total, active, pending, privateCount, publishedCount, lockedCount, closedCount, rejected, draft);
    }

    @Transactional(readOnly = true)
    public List<ClassRoomDtos.ClassRoomResponse> getMyEnrolledClasses(String studentEmail) {
        List<EnrollmentRequest> requests = enrollmentRequestRepository.findByStudentEmailWithDetails(studentEmail);
        List<Long> classIds = requests.stream()
                .filter(r -> r.getStatus() == EnrollmentRequestStatus.ENROLLED
                        || r.getStatus() == EnrollmentRequestStatus.ACCEPTED
                        || r.getStatus() == EnrollmentRequestStatus.CANCELLED)
                .map(r -> r.getClassRoom().getId())
                .distinct()
                .toList();

        if (classIds.isEmpty()) {
            return List.of();
        }

        return classRoomRepository.findAllById(classIds).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public ClassRoomDtos.ClassRoomResponse updateClassDetails(String tutorEmail, Long id, ClassRoomDtos.UpdateClassDetailsRequest request) {
        ClassRoom classRoom = classRoomRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Classroom not found: " + id));
        if (!classRoom.getTutorEmail().equalsIgnoreCase(tutorEmail)) {
            throw new ForbiddenException("You do not have access to this classroom");
        }

        if (classRoom.getStatus() == ClassRoomStatus.CANCELLED || classRoom.getStatus() == ClassRoomStatus.CLOSED) {
            throw new BadRequestException("Lớp đã kết thúc; không thể sửa nội dung và phòng học");
        }
        validateSyllabus(request.syllabusMode(), request.syllabusFileUrl(), request.chapters());

        classRoom.setDescription(request.description().trim());
        classRoom.setMeetingLink(request.meetingLink() != null ? request.meetingLink().trim() : null);
        classRoom.setAddress(request.address() != null ? request.address().trim() : null);
        classRoom.setSyllabusMode(request.syllabusMode());
        classRoom.setSyllabusFileUrl(request.syllabusFileUrl() != null ? request.syllabusFileUrl().trim() : null);

        classRoom.getChapters().clear();
        if (request.chapters() != null && !request.chapters().isEmpty()) {
            int idx = 1;
            for (ClassRoomDtos.ChapterRequest chReq : request.chapters()) {
                ClassChapter ch = new ClassChapter();
                ch.setClassRoom(classRoom);
                ch.setTitle(chReq.title().trim());
                ch.setDescription(chReq.description() != null ? chReq.description().trim() : "");
                ch.setExpectedSessions(chReq.expectedSessions());
                ch.setOrderIndex(chReq.orderIndex() != null ? chReq.orderIndex() : idx++);
                classRoom.getChapters().add(ch);
            }
        }

        ClassRoom saved = classRoomRepository.save(classRoom);
        publishClassMutationRealtime(saved, "DETAILS_UPDATED");
        return toResponse(saved);
    }

    @Transactional
    public ClassRoomDtos.ClassRoomResponse updateVisibility(String tutorEmail, Long id, ClassRoomDtos.UpdateVisibilityRequest request) {
        ClassRoom classRoom = classRoomRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Classroom not found: " + id));
        if (classRoom.getTerminationCutoffSession() != null || classRoom.getStatus() == ClassRoomStatus.CANCELLED
                || classRoom.getStatus() == ClassRoomStatus.CLOSED) throw new BadRequestException("Classroom is terminating or closed");
        if (!classRoom.getTutorEmail().equalsIgnoreCase(tutorEmail)) {
            throw new ForbiddenException("You do not have access to this classroom");
        }

        if (request.status() != ClassRoomStatus.PRIVATE && request.status() != ClassRoomStatus.PUBLISHED) {
            throw new BadRequestException("Gia sư chỉ có thể chuyển đổi giữa PRIVATE (Tạm ngưng) và PUBLISHED (Mở bán). Trạng thái CLOSED và LOCKED do hệ thống tự động quản lý.");
        }

        classRoom.setStatus(request.status());
        classRoom.setJoinMode(request.joinMode());

        if (request.joinMode() == JoinMode.INVITE_KEY) {
            String key = request.joinKey() != null ? request.joinKey().trim().toUpperCase() : "";
            if (key.isEmpty()) {
                key = "KEY" + UUID.randomUUID().toString().substring(0, 6).toUpperCase();
            }
            classRoom.setJoinKey(key);
        } else {
            classRoom.setJoinKey(null);
        }

        if (request.bufferPoolRatioPercent() != null) {
            if (request.bufferPoolRatioPercent() < 100 || request.bufferPoolRatioPercent() > 300) {
                throw new BadRequestException("Tỷ lệ danh sách chờ phải từ 100% đến 300%");
            }
            int calcPending = (int) Math.ceil(classRoom.getMaxStudents() * (request.bufferPoolRatioPercent() / 100.0));
            classRoom.setMaxPendingRequests(calcPending);
        } else if (request.maxPendingRequests() != null) {
            if (request.maxPendingRequests() < classRoom.getMaxStudents() || request.maxPendingRequests() > classRoom.getMaxStudents() * 3) {
                throw new BadRequestException("Mức trần chờ phải từ " + classRoom.getMaxStudents() + " đến " + (classRoom.getMaxStudents() * 3) + " hồ sơ");
            }
            classRoom.setMaxPendingRequests(request.maxPendingRequests());
        }

        ClassRoom saved = classRoomRepository.save(classRoom);
        publishClassMutationRealtime(saved, "VISIBILITY_UPDATED");
        return toResponse(saved);
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

        if (registration.getSubject() == null || !registration.getSubject().isActive()
                || !registration.getCategory().isActive()) {
            throw new BadRequestException("This teaching subject is no longer active in the catalog");
        }

        CatalogLevel level = levelRepository.findById(request.levelId())
                .orElseThrow(() -> new ResourceNotFoundException("Level not found: " + request.levelId()));

        if (!level.isActive()) {
            throw new BadRequestException("This teaching level is no longer active in the catalog");
        }

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
                throw new BadRequestException("Link phòng học trực tuyến là bắt buộc đối với lớp học Online");
            }
            meetingLink = request.meetingLink().trim();
        } else if (request.learningMode() == LearningMode.OFFLINE) {
            if (request.address() == null || request.address().trim().isEmpty()) {
                throw new BadRequestException("Địa chỉ học trực tiếp là bắt buộc đối với lớp học Offline");
            }
            address = request.address().trim();
        }
        Long tutorProfileId = resolveTutorProfileId(registration, tutorEmail);
        TutorAuthorizationState tutorAuthorization = validateTutorTeachingMode(tutorProfileId, request.learningMode());

        // Calculate end date, total sessions, and total price
        LocalDate endDate = calculateEndDate(request.startDate(), request.durationValue(), request.durationUnit());
        int totalSessions = calculateTotalSessions(request.durationValue(), request.durationUnit(), request.sessionsPerWeek());
        BigDecimal totalPrice = request.pricePerSession().multiply(BigDecimal.valueOf(totalSessions));

        // Validate schedules
        if (request.schedules().size() != request.sessionsPerWeek()) {
            throw new BadRequestException(String.format(
                    "You must select exactly %d schedule slot(s) for %d session(s) per week",
                    request.sessionsPerWeek(), request.sessionsPerWeek()));
        }
        validateScheduleSlots(tutorEmail, request.schedules(), request.durationPerSessionMinutes(), request.startDate(), endDate);

        // Validate syllabus
        validateSyllabus(request.syllabusMode(), request.syllabusFileUrl(), request.chapters());

        ClassRoom classRoom = new ClassRoom();
        classRoom.setTutorSubjectRegistration(registration);
        classRoom.setLevel(level);
        classRoom.setTutorEmail(tutorEmail);
        classRoom.setTutorProfileId(tutorAuthorization.getTutorProfileId());
        classRoom.setTutorFullName(normalizeOptional(request.tutorFullName()));
        classRoom.setName(request.name().trim());
        classRoom.setDescription(request.description().trim());
        classRoom.setLearningMode(request.learningMode());
        classRoom.setMeetingLink(meetingLink);
        classRoom.setAddress(address);
        classRoom.setMaxStudents(request.maxStudents());

        // Validate & set maxPendingRequests / bufferPoolRatioPercent
        if (request.bufferPoolRatioPercent() != null) {
            if (request.bufferPoolRatioPercent() < 100 || request.bufferPoolRatioPercent() > 300) {
                throw new BadRequestException("Tỷ lệ danh sách chờ phải từ 100% đến 300%");
            }
            int calcPending = (int) Math.ceil(request.maxStudents() * (request.bufferPoolRatioPercent() / 100.0));
            classRoom.setMaxPendingRequests(calcPending);
        } else if (request.maxPendingRequests() != null) {
            if (request.maxPendingRequests() < request.maxStudents()) {
                throw new BadRequestException(String.format("Mức trần hồ sơ chờ (%d) phải lớn hơn hoặc bằng sức chứa chính thức (%d)", request.maxPendingRequests(), request.maxStudents()));
            }
            if (request.maxPendingRequests() > request.maxStudents() * 3) {
                throw new BadRequestException(String.format("Mức trần hồ sơ chờ (%d) không được vượt quá 3 lần sức chứa chính thức (%d)", request.maxPendingRequests(), request.maxStudents() * 3));
            }
            classRoom.setMaxPendingRequests(request.maxPendingRequests());
        } else {
            classRoom.setMaxPendingRequests((int) Math.ceil(request.maxStudents() * 1.5));
        }
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
        realtimeEventHub.publishToReviewers("CLASS_SUBMITTED", saved.getId(), Map.of(
                "tutorEmail", saved.getTutorEmail(),
                "className", saved.getName(),
                "status", saved.getStatus().name()
        ));
        eventPublisher.publishClassSubmitted(saved.getId(), saved.getTutorEmail(), saved.getName());
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
        Set<String> storageKeys = learningStorageCleanupService.collectClassroomObjectKeys(classRoom);
        classRoomRepository.delete(classRoom);
        classRoomRepository.flush();
        learningStorageCleanupService.deleteObjectsAfterCommit(storageKeys);
    }

    // ==========================================
    // ADMIN / STAFF METHODS
    // ==========================================

    @Transactional(readOnly = true)
    public List<ClassRoomDtos.ClassRoomResponse> getAllClassesForAdmin(
            ClassRoomStatus status,
            String tutorEmail,
            Long subjectId,
            String keyword,
            String reviewedByEmail
    ) {
        List<ClassRoom> list = classRoomRepository.findAllWithDetails();
        return list.stream()
                .filter(c -> status == null || c.getStatus() == status)
                .filter(c -> reviewedByEmail == null || reviewedByEmail.isBlank()
                        || (c.getReviewedByEmail() != null && c.getReviewedByEmail().equalsIgnoreCase(reviewedByEmail.trim())))
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
                    boolean matchTutorName = c.getTutorFullName() != null && c.getTutorFullName().toLowerCase().contains(k);
                    boolean matchEmail = c.getTutorEmail().toLowerCase().contains(k);
                    boolean matchSubject = c.getTutorSubjectRegistration() != null &&
                            c.getTutorSubjectRegistration().getSubject() != null &&
                            c.getTutorSubjectRegistration().getSubject().getName().toLowerCase().contains(k);
                    return matchName || matchTutorName || matchEmail || matchSubject;
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
        classRoom.setStatus(ClassRoomStatus.PRIVATE);
        classRoom.setRejectReason(null);
        classRoom.setReviewedByEmail(reviewerEmail);
        classRoom.setReviewedAt(LocalDateTime.now());
        ClassRoom saved = classRoomRepository.save(classRoom);
        publishClassReviewRealtime(saved, "APPROVED");
        publishClassReviewNotification(saved, "APPROVED");
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
        classRoom.setReviewedByEmail(reviewerEmail);
        classRoom.setReviewedAt(LocalDateTime.now());
        ClassRoom saved = classRoomRepository.save(classRoom);
        publishClassReviewRealtime(saved, "REJECTED");
        publishClassReviewNotification(saved, "REJECTED");
        return toResponse(saved);
    }

    private void publishClassReviewNotification(ClassRoom classRoom, String action) {
        Long recipientUserId = resolveTutorUserId(classRoom);
        if (recipientUserId == null) {
            log.warn(
                    "Skipping class review notification: tutor user id not found classId={} tutorProfileId={}",
                    classRoom.getId(),
                    classRoom.getTutorProfileId());
            return;
        }

        eventPublisher.publishClassReviewed(
                classRoom.getId(),
                recipientUserId,
                classRoom.getTutorEmail(),
                classRoom.getName(),
                action,
                classRoom.getRejectReason(),
                classRoom.getReviewedByEmail());
    }

    private Long resolveTutorUserId(ClassRoom classRoom) {
        if (classRoom == null || classRoom.getTutorProfileId() == null || tutorAuthorizationStateRepository == null) {
            return null;
        }

        return tutorAuthorizationStateRepository.findByTutorProfileId(classRoom.getTutorProfileId())
                .filter(state -> "APPROVED".equalsIgnoreCase(state.getStatus()))
                .map(TutorAuthorizationState::getUserId)
                .orElse(null);
    }

    private void publishClassReviewRealtime(ClassRoom classRoom, String action) {
        Map<String, Object> payload = new java.util.LinkedHashMap<>();
        payload.put("tutorEmail", classRoom.getTutorEmail());
        payload.put("className", classRoom.getName());
        payload.put("status", classRoom.getStatus().name());
        payload.put("action", action);
        payload.put("reason", classRoom.getRejectReason());
        realtimeEventHub.publishToAll("CLASS_REVIEWED", classRoom.getId(), payload);
    }

    private void publishClassMutationRealtime(ClassRoom classRoom, String action) {
        Map<String, Object> payload = new java.util.LinkedHashMap<>();
        payload.put("tutorEmail", classRoom.getTutorEmail());
        payload.put("className", classRoom.getName());
        payload.put("status", classRoom.getStatus().name());
        payload.put("action", action);
        realtimeEventHub.publishToAll("CLASS_MUTATED", classRoom.getId(), payload);
    }

    @Transactional(readOnly = true)
    public ClassRoomDtos.ClassRoomStatsResponse getAdminClassStats() {
        long total = classRoomRepository.count();
        long active = classRoomRepository.countByStatus(ClassRoomStatus.ACTIVE);
        long pending = classRoomRepository.countByStatus(ClassRoomStatus.PENDING_APPROVAL);
        long privateCount = classRoomRepository.countByStatus(ClassRoomStatus.PRIVATE);
        long publishedCount = classRoomRepository.countByStatus(ClassRoomStatus.PUBLISHED);
        long lockedCount = classRoomRepository.countByStatus(ClassRoomStatus.LOCKED);
        long closedCount = classRoomRepository.countByStatus(ClassRoomStatus.CLOSED);
        long rejected = classRoomRepository.countByStatus(ClassRoomStatus.REJECTED);
        long draft = classRoomRepository.countByStatus(ClassRoomStatus.DRAFT);
        return new ClassRoomDtos.ClassRoomStatsResponse(total, active, pending, privateCount, publishedCount, lockedCount, closedCount, rejected, draft);
    }

    @Transactional(readOnly = true)
    public List<ClassRoomDtos.ClassRoomResponse> getPublicClasses(Long subjectId, String keyword) {
        return getPublicClasses(null, null, null, subjectId, null, keyword, null, null, null, null, null);
    }

    @Transactional(readOnly = true)
    public List<ClassRoomDtos.ClassRoomResponse> getPublicClasses(Long subjectId, String keyword, String mode, String tutorEmail) {
        return getPublicClasses(null, null, null, subjectId, null, keyword, mode, tutorEmail, null, null, null);
    }

    @Transactional(readOnly = true)
    public List<ClassRoomDtos.ClassRoomResponse> getPublicClasses(
            Long programTypeId,
            Long educationLevelId,
            Long categoryId,
            Long subjectId,
            Long levelId,
            String keyword,
            String mode,
            String tutorEmail,
            Long tutorProfileId,
            BigDecimal minPrice,
            BigDecimal maxPrice
    ) {
        return filterPublicClasses(
                programTypeId,
                educationLevelId,
                categoryId,
                subjectId,
                levelId,
                null,
                keyword,
                mode,
                tutorEmail,
                tutorProfileId,
                minPrice,
                maxPrice,
                null,
                null,
                null,
                null,
                false
        ).stream().map(c -> toResponse(c, false)).toList();
    }

    @Transactional(readOnly = true)
    public ClassRoomDtos.PublicClassSearchResponse searchPublicClasses(
            Long programTypeId,
            Long educationLevelId,
            Long categoryId,
            Long subjectId,
            Long levelId,
            List<Long> levelIds,
            String keyword,
            String mode,
            String tutorEmail,
            Long tutorProfileId,
            BigDecimal minPrice,
            BigDecimal maxPrice,
            Integer weekday,
            List<Integer> weekdays,
            String startTime,
            String endTime,
            Boolean availableOnly,
            int page,
            int size,
            String sort
    ) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(Math.max(size, 1), 50);
        String safeSort = normalizeSort(sort);

        List<ClassRoom> filtered = filterPublicClasses(
                programTypeId,
                educationLevelId,
                categoryId,
                subjectId,
                levelId,
                levelIds,
                keyword,
                mode,
                tutorEmail,
                tutorProfileId,
                minPrice,
                maxPrice,
                weekday,
                weekdays,
                startTime,
                endTime,
                Boolean.TRUE.equals(availableOnly)
        ).stream().sorted(publicClassComparator(safeSort)).toList();

        long total = filtered.size();
        int fromIndex = safePage * safeSize;
        List<ClassRoomDtos.PublicClassCardResponse> content = fromIndex >= filtered.size()
                ? List.of()
                : filtered.subList(fromIndex, Math.min(filtered.size(), fromIndex + safeSize))
                        .stream()
                        .map(this::toPublicCardResponse)
                        .toList();
        int totalPages = total == 0 ? 0 : (int) Math.ceil(total / (double) safeSize);
        return new ClassRoomDtos.PublicClassSearchResponse(content, safePage, safeSize, total, totalPages, safeSort);
    }

    @Transactional(readOnly = true)
    public ClassRoomDtos.PublicClassSemanticSourceResponse getPublicClassSemanticSources(
            List<Long> ids,
            Long subjectId,
            Long levelId,
            String mode,
            Boolean availableOnly,
            Integer max
    ) {
        List<ClassRoom> filtered = filterPublicClasses(
                null,
                null,
                null,
                subjectId,
                levelId,
                null,
                null,
                mode,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                Boolean.TRUE.equals(availableOnly)
        );
        Set<Long> requestedIds = ids == null ? Set.of() : ids.stream()
                .filter(id -> id != null && id > 0)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        int limit = max == null || max <= 0 ? Integer.MAX_VALUE : Math.min(max, 500);
        List<ClassRoomDtos.PublicClassSemanticSourceItem> content = filtered.stream()
                .filter(c -> requestedIds.isEmpty() || requestedIds.contains(c.getId()))
                .sorted(Comparator.comparing(ClassRoom::getId))
                .limit(limit)
                .map(this::toPublicSemanticSourceItem)
                .toList();
        return new ClassRoomDtos.PublicClassSemanticSourceResponse(content);
    }

    private List<ClassRoom> filterPublicClasses(
            Long programTypeId,
            Long educationLevelId,
            Long categoryId,
            Long subjectId,
            Long levelId,
            List<Long> levelIds,
            String keyword,
            String mode,
            String tutorEmail,
            Long tutorProfileId,
            BigDecimal minPrice,
            BigDecimal maxPrice,
            Integer weekday,
            List<Integer> weekdays,
            String startTime,
            String endTime,
            boolean availableOnly
    ) {
        LearningMode requestedMode = parseLearningMode(mode);
        boolean invalidMode = mode != null && !mode.isBlank() && requestedMode == null && !"ALL".equalsIgnoreCase(mode.trim());
        if (invalidMode) {
            return List.of();
        }
        LocalTime requestedStart = parseOptionalTime(startTime);
        LocalTime requestedEnd = parseOptionalTime(endTime);
        boolean invalidTimeRange = requestedStart != null && requestedEnd != null && !requestedStart.isBefore(requestedEnd);
        if (invalidTimeRange) {
            return List.of();
        }
        Set<Long> requestedLevelIds = normalizeLevelIds(levelId, levelIds);
        Set<Integer> requestedWeekdays = normalizeWeekdays(weekday, weekdays);

        List<ClassRoom> list = classRoomRepository.findAllWithDetails();
        return list.stream()
                .filter(c -> c.getStatus() == ClassRoomStatus.PUBLISHED || c.getStatus() == ClassRoomStatus.ACTIVE)
                .filter(c -> matchesTutorFilter(c, tutorEmail, tutorProfileId))
                .filter(c -> matchesRegistrationBranch(c, programTypeId, educationLevelId, categoryId, subjectId))
                .filter(c -> requestedLevelIds.isEmpty() || (c.getLevel() != null && requestedLevelIds.contains(c.getLevel().getId())))
                .filter(c -> requestedMode == null || c.getLearningMode() == requestedMode)
                .filter(c -> minPrice == null || c.getPricePerSession().compareTo(minPrice) >= 0)
                .filter(c -> maxPrice == null || c.getPricePerSession().compareTo(maxPrice) <= 0)
                .filter(c -> keyword == null || keyword.isBlank() || matchesPublicClassKeyword(c, keyword))
                .filter(c -> matchesScheduleFilter(c, requestedWeekdays, requestedStart, requestedEnd))
                .filter(c -> !availableOnly || hasAvailableSlot(c))
                .toList();
    }

    private Set<Long> normalizeLevelIds(Long levelId, List<Long> levelIds) {
        LinkedHashSet<Long> result = new LinkedHashSet<>();
        if (levelId != null) {
            result.add(levelId);
        }
        if (levelIds != null) {
            levelIds.stream()
                    .filter(value -> value != null && value > 0)
                    .forEach(result::add);
        }
        return result;
    }

    private Set<Integer> normalizeWeekdays(Integer weekday, List<Integer> weekdays) {
        LinkedHashSet<Integer> result = new LinkedHashSet<>();
        if (weekday != null) {
            addValidPublicWeekday(result, weekday);
        }
        if (weekdays != null) {
            weekdays.forEach(value -> addValidPublicWeekday(result, value));
        }
        return result;
    }

    private void addValidPublicWeekday(Set<Integer> result, Integer value) {
        if (value == null) return;
        int normalized = value == 1 ? 8 : value;
        if (normalized >= 2 && normalized <= 8) {
            result.add(normalized);
        }
    }

    private boolean matchesRegistrationBranch(
            ClassRoom c,
            Long programTypeId,
            Long educationLevelId,
            Long categoryId,
            Long subjectId
    ) {
        TutorSubjectRegistration reg = c.getTutorSubjectRegistration();
        if (reg == null) return false;
        if (programTypeId != null && (reg.getProgramType() == null || !reg.getProgramType().getId().equals(programTypeId))) {
            return false;
        }
        if (educationLevelId != null && (reg.getEducationLevel() == null || !reg.getEducationLevel().getId().equals(educationLevelId))) {
            return false;
        }
        if (categoryId != null && (reg.getCategory() == null || !reg.getCategory().getId().equals(categoryId))) {
            return false;
        }
        return subjectId == null || (reg.getSubject() != null && reg.getSubject().getId().equals(subjectId));
    }

    private boolean matchesTutorFilter(ClassRoom c, String tutorEmail, Long tutorProfileId) {
        boolean hasEmailFilter = tutorEmail != null && !tutorEmail.isBlank();
        boolean hasProfileFilter = tutorProfileId != null;
        if (!hasEmailFilter && !hasProfileFilter) return true;

        boolean matchesEmail = hasEmailFilter && c.getTutorEmail().equalsIgnoreCase(tutorEmail.trim());
        boolean matchesProfile = hasProfileFilter && c.getTutorProfileId() != null && c.getTutorProfileId().equals(tutorProfileId);
        return matchesEmail || matchesProfile;
    }

    private boolean matchesPublicClassKeyword(ClassRoom c, String keyword) {
        String k = keyword.trim().toLowerCase(Locale.ROOT);
        TutorSubjectRegistration reg = c.getTutorSubjectRegistration();
        return contains(c.getName(), k)
                || contains(c.getDescription(), k)
                || contains(c.getTutorFullName(), k)
                || (reg != null && (
                        contains(reg.getTutorEmail(), k)
                                || (reg.getSubject() != null && contains(reg.getSubject().getName(), k))
                                || (reg.getCategory() != null && contains(reg.getCategory().getName(), k))
                                || reg.getLevels().stream().anyMatch(level -> contains(level.getName(), k))
                ));
    }

    private boolean contains(String value, String keyword) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(keyword);
    }

    private boolean matchesScheduleFilter(ClassRoom c, Set<Integer> availableWeekdays, LocalTime startTime, LocalTime endTime) {
        if (availableWeekdays.isEmpty() && startTime == null && endTime == null) {
            return true;
        }
        if (c.getSchedules() == null || c.getSchedules().isEmpty()) {
            return false;
        }
        return c.getSchedules().stream().allMatch(schedule -> {
            if (!availableWeekdays.isEmpty() && !availableWeekdays.contains(normalizePublicWeekday(schedule.getDayOfWeek()))) {
                return false;
            }
            LocalTime scheduleStart = parseOptionalTime(schedule.getStartTime());
            LocalTime scheduleEnd = parseOptionalTime(schedule.getEndTime());
            if (scheduleStart == null || scheduleEnd == null) {
                return false;
            }
            if (startTime != null && scheduleStart.isBefore(startTime)) {
                return false;
            }
            return endTime == null || !scheduleEnd.isAfter(endTime);
        });
    }

    private Integer normalizePublicWeekday(Integer day) {
        if (day == null) return null;
        return day == 1 ? 8 : day;
    }

    private boolean hasAvailableSlot(ClassRoom c) {
        if (c.getId() == null || c.getMaxStudents() == null) return false;
        long acceptedCount = enrollmentRequestRepository.countByClassRoomIdAndStatusIn(
                c.getId(),
                List.of(EnrollmentRequestStatus.ACCEPTED, EnrollmentRequestStatus.ENROLLED)
        );
        long pendingCount = enrollmentRequestRepository.countByClassRoomIdAndStatus(c.getId(), EnrollmentRequestStatus.PENDING);
        int maxPending = c.getMaxPendingRequests() != null ? c.getMaxPendingRequests() : (int) Math.ceil(c.getMaxStudents() * 1.5);
        return acceptedCount < c.getMaxStudents() && (pendingCount + acceptedCount) < maxPending;
    }

    private Comparator<ClassRoom> publicClassComparator(String sort) {
        Comparator<ClassRoom> byIdDesc = Comparator.comparing(
                (ClassRoom c) -> c.getId() == null ? 0L : c.getId(),
                Comparator.reverseOrder()
        );
        return switch (sort) {
            case "price_asc" -> Comparator
                    .comparing((ClassRoom c) -> c.getPricePerSession() == null ? BigDecimal.ZERO : c.getPricePerSession())
                    .thenComparing(byIdDesc);
            case "price_desc" -> Comparator
                    .comparing((ClassRoom c) -> c.getPricePerSession() == null ? BigDecimal.ZERO : c.getPricePerSession(), Comparator.reverseOrder())
                    .thenComparing(byIdDesc);
            case "soonest" -> Comparator
                    .comparing((ClassRoom c) -> c.getStartDate() == null ? LocalDate.MAX : c.getStartDate())
                    .thenComparing(byIdDesc);
            case "rating_desc" -> Comparator
                    .comparing(this::publicClassAverageRating, Comparator.reverseOrder())
                    .thenComparing(byIdDesc);
            default -> Comparator
                    .comparing((ClassRoom c) -> c.getCreatedAt() == null ? LocalDateTime.MIN : c.getCreatedAt(), Comparator.reverseOrder())
                    .thenComparing(byIdDesc);
        };
    }

    private String normalizeSort(String sort) {
        if (sort == null || sort.isBlank()) return "newest";
        return switch (sort.trim()) {
            case "newest", "price_asc", "price_desc", "soonest", "rating_desc" -> sort.trim();
            default -> "newest";
        };
    }

    private LearningMode parseLearningMode(String mode) {
        if (mode == null || mode.isBlank() || "ALL".equalsIgnoreCase(mode.trim())) {
            return null;
        }
        try {
            return LearningMode.valueOf(mode.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private LocalTime parseOptionalTime(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return LocalTime.parse(value.trim());
        } catch (RuntimeException ex) {
            return null;
        }
    }

    private Double publicClassAverageRating(ClassRoom c) {
        Long tutorUserId = resolveTutorUserIdForRating(c);
        return tutorUserId == null ? 0.0 : safeAverage(tutorReviewRepository.averageRatingByTutorId(tutorUserId));
    }

    private String normalizeOptional(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    @Transactional(readOnly = true)
    public ClassRoomDtos.ClassRoomResponse getPublicClassById(Long id) {
        ClassRoom classRoom = classRoomRepository.findByIdWithDetails(id)
                .orElseThrow(() -> new ResourceNotFoundException("Classroom not found: " + id));
        if (classRoom.getStatus() != ClassRoomStatus.PUBLISHED && classRoom.getStatus() != ClassRoomStatus.ACTIVE && classRoom.getStatus() != ClassRoomStatus.LOCKED) {
            throw new ResourceNotFoundException("Classroom is not available for public view");
        }
        return toResponse(classRoom, false);
    }

    @Transactional(readOnly = true)
    public ClassRoomDtos.ClassRoomResponse getShareablePublicClassById(Long id) {
        ClassRoom classRoom = classRoomRepository.findByIdWithDetails(id)
                .orElseThrow(() -> new ResourceNotFoundException("Classroom not found: " + id));
        if (!isAcceptingPublicShareLink(classRoom)) {
            throw new ResourceNotFoundException("Classroom share link is no longer available");
        }
        return toResponse(classRoom, false);
    }

    private boolean isAcceptingPublicShareLink(ClassRoom classRoom) {
        if (classRoom == null || classRoom.getId() == null) return false;
        if (classRoom.getStatus() != ClassRoomStatus.PUBLISHED) return false;
        if (classRoom.getTerminationCutoffSession() != null) return false;
        if (classRoom.getStartDate() == null || classRoom.getStartDate().isBefore(LocalDate.now())) return false;
        if (classRoom.getMaxStudents() == null || classRoom.getMaxStudents() <= 0) return false;
        long acceptedCount = enrollmentRequestRepository != null
                ? enrollmentRequestRepository.countByClassRoomIdAndStatusIn(
                        classRoom.getId(),
                        List.of(EnrollmentRequestStatus.ACCEPTED, EnrollmentRequestStatus.ENROLLED))
                : 0;
        return acceptedCount < classRoom.getMaxStudents();
    }

    @Transactional(readOnly = true)
    public ClassRoomDtos.VerifyJoinKeyResponse verifyJoinKey(Long id, String joinKey) {
        ClassRoom classRoom = classRoomRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Classroom not found: " + id));

        if (classRoom.getJoinMode() == JoinMode.OPEN_REQUEST) {
            return new ClassRoomDtos.VerifyJoinKeyResponse(true, "Lớp ở chế độ mở, không cần mã mời");
        }

        if (joinKey == null || joinKey.trim().isEmpty()) {
            return new ClassRoomDtos.VerifyJoinKeyResponse(false, "Vui lòng nhập mã mời (Invite Key)");
        }

        boolean match = joinKey.trim().equalsIgnoreCase(classRoom.getJoinKey());
        if (match) {
            return new ClassRoomDtos.VerifyJoinKeyResponse(true, "Mã mời chính xác!");
        } else {
            return new ClassRoomDtos.VerifyJoinKeyResponse(false, "Mã mời (Invite Key) không chính xác!");
        }
    }

    private void validateScheduleSlots(
            String tutorEmail,
            List<ClassRoomDtos.ScheduleRequest> schedules,
            Integer durationPerSessionMinutes,
            LocalDate newStartDate,
            LocalDate newEndDate
    ) {
        List<TutorAvailability> availability = availabilityRepository
                .findByTutorEmailIgnoreCaseOrderByDayOfWeekAscStartTimeAsc(tutorEmail);
        if (availability.isEmpty()) {
            throw new BadRequestException("Bạn phải thiết lập lịch rảnh trước khi tạo lớp học.");
        }

        for (int i = 0; i < schedules.size(); i++) {
            ClassRoomDtos.ScheduleRequest a = schedules.get(i);
            LocalTime startTime = LocalTime.parse(a.startTime());
            LocalTime endTime = LocalTime.parse(a.endTime());
            if (!startTime.isBefore(endTime)) {
                throw new BadRequestException("Giờ bắt đầu phải trước giờ kết thúc.");
            }
            long actualDuration = Duration.between(startTime, endTime).toMinutes();
            if (actualDuration != durationPerSessionMinutes) {
                throw new BadRequestException(String.format(
                        "Buổi học %s - %s phải kéo dài đúng %d phút.",
                        a.startTime(), a.endTime(), durationPerSessionMinutes
                ));
            }

            boolean containedInAvailability = availability.stream().anyMatch(slot -> {
                if (!a.dayOfWeek().equals(slot.getDayOfWeek())) return false;
                LocalTime availableStart = LocalTime.parse(slot.getStartTime());
                LocalTime availableEnd = LocalTime.parse(slot.getEndTime());
                return !startTime.isBefore(availableStart) && !endTime.isAfter(availableEnd);
            });
            if (!containedInAvailability) {
                String dayLabel = a.dayOfWeek() == 8 ? "Chủ nhật" : "Thứ " + a.dayOfWeek();
                throw new BadRequestException(String.format(
                        "Khung giờ %s - %s (%s) phải nằm trọn trong lịch rảnh đã đăng ký.",
                        a.startTime(), a.endTime(), dayLabel
                ));
            }
            for (int j = i + 1; j < schedules.size(); j++) {
                ClassRoomDtos.ScheduleRequest b = schedules.get(j);
                if (a.dayOfWeek().equals(b.dayOfWeek())) {
                    // Check overlap within request
                    if (!(a.endTime().compareTo(b.startTime()) <= 0 || a.startTime().compareTo(b.endTime()) >= 0)) {
                        throw new BadRequestException("Overlapping schedules detected on day " + a.dayOfWeek());
                    }
                }
            }
        }

        // Check overlap with existing active/pending/private/published classes of tutor
        List<ClassRoom> existingClasses = classRoomRepository.findByTutorEmailWithDetails(tutorEmail);
        for (ClassRoom existing : existingClasses) {
            if (existing.getTerminationCutoffSession() != null) continue;
            if (existing.getStatus() == ClassRoomStatus.ACTIVE ||
                existing.getStatus() == ClassRoomStatus.PENDING_APPROVAL ||
                existing.getStatus() == ClassRoomStatus.PRIVATE ||
                existing.getStatus() == ClassRoomStatus.PUBLISHED ||
                existing.getStatus() == ClassRoomStatus.LOCKED) {
                if (!dateRangesOverlap(newStartDate, newEndDate, existing.getStartDate(), existing.getEndDate())) {
                    continue;
                }
                for (ClassSchedule existingSchedule : existing.getSchedules()) {
                    for (ClassRoomDtos.ScheduleRequest newSched : schedules) {
                        if (newSched.dayOfWeek().equals(existingSchedule.getDayOfWeek())) {
                            boolean overlaps = !(newSched.endTime().compareTo(existingSchedule.getStartTime()) <= 0
                                    || newSched.startTime().compareTo(existingSchedule.getEndTime()) >= 0);
                            if (overlaps) {
                                String dayLabel = existingSchedule.getDayOfWeek() == 8 ? "Chủ nhật" : "Thứ " + existingSchedule.getDayOfWeek();
                                throw new BadRequestException(String.format(
                                    "Khung giờ %s - %s (%s) bị trùng với lớp '%s' (%s - %s) đã tạo.",
                                    newSched.startTime(), newSched.endTime(), dayLabel,
                                    existing.getName(), existingSchedule.getStartTime(), existingSchedule.getEndTime()
                                ));
                            }
                        }
                    }
                }
            }
        }
    }

    private Long resolveTutorProfileId(TutorSubjectRegistration registration, String tutorEmail) {
        Long tutorProfileId = registration.getTutorProfileId();
        if (tutorProfileId == null) {
            java.util.Optional<Long> resolvedProfileId = tutorIdentityLookup.tutorProfileId(tutorEmail);
            if (resolvedProfileId != null && resolvedProfileId.isPresent()) {
                tutorProfileId = resolvedProfileId.get();
                registration.setTutorProfileId(tutorProfileId);
            }
        }
        if (tutorProfileId == null) {
            throw new BadRequestException("Không thể xác định hồ sơ gia sư đã được duyệt.");
        }
        return tutorProfileId;
    }

    private TutorAuthorizationState validateTutorTeachingMode(Long tutorProfileId, LearningMode requestedMode) {
        TutorAuthorizationState state = tutorAuthorizationStateRepository.findByTutorProfileId(tutorProfileId)
                .orElseThrow(() -> new BadRequestException("Hồ sơ gia sư chưa sẵn sàng để tạo lớp."));
        if (!"APPROVED".equalsIgnoreCase(state.getStatus())) {
            throw new BadRequestException("Hồ sơ gia sư chưa được phê duyệt.");
        }

        List<TeachingMode> allowedModes = state.getTeachingModes() == null || state.getTeachingModes().isEmpty()
                ? List.of(TeachingMode.ONLINE, TeachingMode.OFFLINE)
                : new ArrayList<>(state.getTeachingModes());
        TeachingMode requestedTeachingMode = TeachingMode.valueOf(requestedMode.name());
        if (!allowedModes.contains(requestedTeachingMode)) {
            String label = requestedMode == LearningMode.OFFLINE ? "trực tiếp" : "trực tuyến";
            throw new BadRequestException("Bạn chưa đăng ký hình thức dạy " + label + ".");
        }
        return state;
    }

    private boolean dateRangesOverlap(LocalDate firstStart, LocalDate firstEnd, LocalDate secondStart, LocalDate secondEnd) {
        if (firstStart == null || firstEnd == null || secondStart == null || secondEnd == null) {
            return true;
        }
        return !firstStart.isAfter(secondEnd) && !secondStart.isAfter(firstEnd);
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
        return toResponse(c, true);
    }

    private ClassRoomDtos.PublicClassCardResponse toPublicCardResponse(ClassRoom c) {
        ClassRoomDtos.ClassRoomResponse response = toResponse(c, false);
        List<String> topicChips = c.getChapters().stream()
                .sorted(Comparator
                        .comparing((ClassChapter ch) -> ch.getOrderIndex() == null ? 0 : ch.getOrderIndex())
                        .thenComparing(ch -> ch.getId() == null ? 0L : ch.getId()))
                .map(ClassChapter::getTitle)
                .filter(title -> title != null && !title.isBlank())
                .limit(3)
                .toList();
        return new ClassRoomDtos.PublicClassCardResponse(
                response.id(),
                response.tutorSubjectRegistrationId(),
                response.registration(),
                response.level(),
                response.tutorProfileId(),
                response.tutorFullName(),
                response.name(),
                response.description(),
                response.learningMode(),
                response.learningMode() == LearningMode.OFFLINE ? response.address() : null,
                response.maxStudents(),
                response.acceptedCount(),
                response.availableSlots(),
                response.isBufferPoolFull(),
                response.pricePerSession(),
                response.totalPrice(),
                response.sessionsPerWeek(),
                response.durationPerSessionMinutes(),
                response.startDate(),
                response.endDate(),
                response.totalSessions(),
                response.joinMode(),
                response.status(),
                response.averageRating(),
                response.reviewCount(),
                response.schedules(),
                topicChips,
                response.createdAt()
        );
    }

    private ClassRoomDtos.PublicClassSemanticSourceItem toPublicSemanticSourceItem(ClassRoom c) {
        ClassRoomDtos.ClassRoomResponse response = toResponse(c, false);
        List<String> topicChips = c.getChapters().stream()
                .sorted(Comparator
                        .comparing((ClassChapter ch) -> ch.getOrderIndex() == null ? 0 : ch.getOrderIndex())
                        .thenComparing(ch -> ch.getId() == null ? 0L : ch.getId()))
                .map(ClassChapter::getTitle)
                .filter(title -> title != null && !title.isBlank())
                .limit(3)
                .toList();
        return new ClassRoomDtos.PublicClassSemanticSourceItem(
                response.id(),
                response.tutorSubjectRegistrationId(),
                response.registration(),
                response.level(),
                response.tutorProfileId(),
                response.tutorFullName(),
                response.name(),
                response.description(),
                response.learningMode(),
                response.learningMode() == LearningMode.OFFLINE ? response.address() : null,
                response.maxStudents(),
                response.acceptedCount(),
                response.availableSlots(),
                response.isBufferPoolFull(),
                response.pricePerSession(),
                response.totalPrice(),
                response.sessionsPerWeek(),
                response.durationPerSessionMinutes(),
                response.startDate(),
                response.endDate(),
                response.totalSessions(),
                response.joinMode(),
                response.status(),
                response.averageRating(),
                response.reviewCount(),
                response.schedules(),
                response.chapters(),
                topicChips,
                response.createdAt(),
                response.updatedAt()
        );
    }

    /** Public class discovery must not expose the reusable classroom meeting URL. */
    private ClassRoomDtos.ClassRoomResponse toResponse(ClassRoom c, boolean includeMeetingLink) {
        ClassRoomDtos.RegistrationBrief regBrief = null;
        if (c.getTutorSubjectRegistration() != null) {
            TutorSubjectRegistration r = c.getTutorSubjectRegistration();
            String subjectName = r.getSubject() != null ? r.getSubject().getName() : r.getProposedSubjectName();
            String subjectCode = r.getSubject() != null ? r.getSubject().getCode() : "custom";
            regBrief = new ClassRoomDtos.RegistrationBrief(
                    r.getId(),
                    r.getProgramType() != null ? r.getProgramType().getId() : null,
                    r.getProgramType() != null ? r.getProgramType().getName() : null,
                    r.getEducationLevel() != null ? r.getEducationLevel().getId() : null,
                    r.getEducationLevel() != null ? r.getEducationLevel().getName() : null,
                    r.getCategory() != null ? r.getCategory().getId() : null,
                    r.getCategory() != null ? r.getCategory().getName() : null,
                    r.getSubject() != null ? r.getSubject().getId() : null,
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

        long pendingCount = enrollmentRequestRepository != null ? enrollmentRequestRepository.countByClassRoomIdAndStatus(c.getId(), EnrollmentRequestStatus.PENDING) : 0;
        long acceptedCount = enrollmentRequestRepository != null ? enrollmentRequestRepository.countByClassRoomIdAndStatusIn(c.getId(), List.of(EnrollmentRequestStatus.ACCEPTED, EnrollmentRequestStatus.ENROLLED)) : 0;
        int maxPending = c.getMaxPendingRequests() != null ? c.getMaxPendingRequests() : (int) Math.ceil(c.getMaxStudents() * 1.5);
        int ratioPercent = (int) Math.round((maxPending * 100.0) / c.getMaxStudents());
        long availableSlots = Math.max(0, c.getMaxStudents() - acceptedCount);
        boolean isBufferPoolFull = (pendingCount + acceptedCount) >= maxPending;

        String visibleMeetingLink = includeMeetingLink ? c.getMeetingLink() : null;
        if (includeMeetingLink && c.getLearningMode() == LearningMode.ONLINE
                && (visibleMeetingLink == null || visibleMeetingLink.isBlank())) {
            visibleMeetingLink = "https://meet.google.com/edu-class-" + (c.getId() != null ? c.getId() : "online");
        }
        String visibleJoinKey = includeMeetingLink ? c.getJoinKey() : null;
        Long tutorUserId = resolveTutorUserIdForRating(c);
        double averageRating = tutorUserId == null ? 0.0 : safeAverage(tutorReviewRepository.averageRatingByTutorId(tutorUserId));
        long reviewCount = tutorUserId == null ? 0 : tutorReviewRepository.countByTutorId(tutorUserId);

        return new ClassRoomDtos.ClassRoomResponse(
                c.getId(),
                c.getTutorSubjectRegistration() != null ? c.getTutorSubjectRegistration().getId() : null,
                regBrief,
                levelBrief,
                c.getTutorEmail(),
                c.getTutorProfileId(),
                c.getTutorFullName(),
                c.getName(),
                c.getDescription(),
                c.getLearningMode(),
                visibleMeetingLink,
                c.getAddress(),
                c.getMaxStudents(),
                maxPending,
                ratioPercent,
                pendingCount,
                acceptedCount,
                availableSlots,
                isBufferPoolFull,
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
                c.getJoinMode(),
                visibleJoinKey,
                c.getStatus(),
                c.getRejectReason(),
                c.getReviewedByEmail(),
                c.getReviewedAt(),
                averageRating,
                reviewCount,
                schedules,
                chapters,
                c.getCreatedAt(),
                c.getUpdatedAt(),
                c.getTerminationCutoffSession()
        );
    }

    private Long resolveTutorUserIdForRating(ClassRoom classRoom) {
        if (classRoom.getTutorProfileId() == null) {
            return null;
        }
        return tutorAuthorizationStateRepository.findByTutorProfileId(classRoom.getTutorProfileId())
                .map(TutorAuthorizationState::getUserId)
                .orElse(null);
    }

    private double safeAverage(Double value) {
        return value == null ? 0.0 : value;
    }
}
