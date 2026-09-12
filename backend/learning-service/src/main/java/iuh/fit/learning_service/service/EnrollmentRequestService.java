package iuh.fit.learning_service.service;

import iuh.fit.learning_service.dto.EnrollmentRequestDtos.*;
import iuh.fit.learning_service.entity.ClassRoom;
import iuh.fit.learning_service.entity.ClassSchedule;
import iuh.fit.learning_service.entity.ClassSession;
import iuh.fit.learning_service.entity.EnrollmentRequest;
import iuh.fit.learning_service.enums.ClassRoomStatus;
import iuh.fit.learning_service.enums.EnrollmentRequestStatus;
import iuh.fit.learning_service.enums.JoinMode;
import iuh.fit.learning_service.exception.BadRequestException;
import iuh.fit.learning_service.exception.ForbiddenException;
import iuh.fit.learning_service.exception.ResourceNotFoundException;
import iuh.fit.learning_service.messaging.LearningEventPublisher;
import iuh.fit.learning_service.repository.ClassRoomRepository;
import iuh.fit.learning_service.repository.ClassSessionRepository;
import iuh.fit.learning_service.repository.EnrollmentRequestRepository;
import iuh.fit.learning_service.repository.TutorAuthorizationStateRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
@Transactional
public class EnrollmentRequestService {

    private final ClassRoomRepository classRoomRepository;
    private final EnrollmentRequestRepository enrollmentRequestRepository;
    private final ClassSessionRepository classSessionRepository;
    private final TutorAuthorizationStateRepository tutorAuthorizationStateRepository;
    private final LearningEventPublisher eventPublisher;

    public EnrollmentRequestService(
            ClassRoomRepository classRoomRepository,
            EnrollmentRequestRepository enrollmentRequestRepository,
            ClassSessionRepository classSessionRepository,
            TutorAuthorizationStateRepository tutorAuthorizationStateRepository,
            LearningEventPublisher eventPublisher
    ) {
        this.classRoomRepository = classRoomRepository;
        this.enrollmentRequestRepository = enrollmentRequestRepository;
        this.classSessionRepository = classSessionRepository;
        this.tutorAuthorizationStateRepository = tutorAuthorizationStateRepository;
        this.eventPublisher = eventPublisher;
    }

    /**
     * Student submits enrollment request for a classroom
     */
    @Transactional
    public EnrollmentRequestResponse enrollClass(
        Long classRoomId,
        Long authenticatedStudentId,
        String studentEmail,
        EnrollClassRequest request
        ) {
        if (request == null || authenticatedStudentId == null || authenticatedStudentId <= 0) {
            throw new BadRequestException("Không xác định được tài khoản học viên. Vui lòng đăng nhập lại.");
        }
        if (request.studentName() == null || request.studentName().isBlank()
                || request.studentName().contains("@") || request.studentName().startsWith("Học viên")) {
            throw new BadRequestException("Học viên cần cập nhật họ tên thật trước khi gửi yêu cầu.");
        }
        if (request.studentPhone() == null || request.studentPhone().isBlank()) {
            throw new BadRequestException("Học viên cần cập nhật số điện thoại trước khi gửi yêu cầu.");
        }
        if (request.studentWallet() == null || !request.studentWallet().matches("^0x[a-fA-F0-9]{40}$")
                || "0x0000000000000000000000000000000000000000".equalsIgnoreCase(request.studentWallet())) {
            throw new BadRequestException("A connected MetaMask wallet is required before submitting an enrollment request.");
        }

        // Pessimistic Lock on classroom to avoid race conditions
        ClassRoom classRoom = classRoomRepository.findByIdForUpdate(classRoomId)
                .orElseThrow(() -> new ResourceNotFoundException("Classroom not found: " + classRoomId));

        // Auto-lock check: if current date >= start date and has accepted students, or already full
        long currentAccepted = enrollmentRequestRepository.countByClassRoomIdAndStatus(classRoomId, EnrollmentRequestStatus.ACCEPTED);
        if (classRoom.getStatus() == ClassRoomStatus.PUBLISHED) {
            LocalDate today = LocalDate.now();
            if ((!today.isBefore(classRoom.getStartDate()) && currentAccepted > 0) || currentAccepted >= classRoom.getMaxStudents()) {
                classRoom.setStatus(ClassRoomStatus.LOCKED);
                classRoomRepository.save(classRoom);
            }
        }

        if (classRoom.getStatus() != ClassRoomStatus.PUBLISHED) {
            throw new BadRequestException("Lớp học hiện tại không mở đăng ký tuyển sinh (Trạng thái: " + classRoom.getStatus() + ")");
        }

        // Validate invite key if joinMode == INVITE_KEY
        if (classRoom.getJoinMode() == JoinMode.INVITE_KEY) {
            String key = request != null && request.joinKey() != null ? request.joinKey().trim() : "";
            if (key.isEmpty() || !key.equalsIgnoreCase(classRoom.getJoinKey())) {
                throw new BadRequestException("Mã mời (Invite Key) không đúng");
            }
        }

        // Check duplicate request
        boolean alreadySubmitted = enrollmentRequestRepository.existsByClassRoomIdAndStudentEmailIgnoreCaseAndStatusIn(
                classRoomId,
                studentEmail,
                List.of(EnrollmentRequestStatus.PENDING, EnrollmentRequestStatus.ACCEPTED)
        );
        if (alreadySubmitted) {
            throw new BadRequestException("Bạn đã gửi yêu cầu hoặc đang tham gia lớp học này.");
        }

        // Validate schedule conflict with student's active enrolled classes
        validateNoScheduleConflict(classRoom, studentEmail);

        // Buffer pool ceiling check: Total_In_Pool = PENDING + ACCEPTED
        long pendingCount = enrollmentRequestRepository.countByClassRoomIdAndStatus(classRoomId, EnrollmentRequestStatus.PENDING);
        long totalInPool = pendingCount + currentAccepted;
        int maxPending = classRoom.getMaxPendingRequests() != null ? classRoom.getMaxPendingRequests() : (int) Math.ceil(classRoom.getMaxStudents() * 1.5);

        if (totalInPool >= maxPending) {
            throw new BadRequestException("Lớp học đang tạm đủ số lượng yêu cầu. Vui lòng quay lại sau nếu gia sư mở thêm lượt đăng ký.");
        }

        // Create enrollment request
        EnrollmentRequest req = new EnrollmentRequest();
        req.setClassRoom(classRoom);
        req.setStudentId(authenticatedStudentId);
        req.setStudentEmail(studentEmail);
        req.setStudentName(request.studentName().trim());
        req.setStudentPhone(request.studentPhone().trim());
        req.setStudentWallet(request.studentWallet().trim().toLowerCase());
        req.setJoinKey(request.joinKey());
        req.setNote(request.note() != null ? request.note().trim() : null);
        req.setStatus(EnrollmentRequestStatus.PENDING);

        EnrollmentRequest saved = enrollmentRequestRepository.save(req);
        eventPublisher.publishEnrollmentRequested(
                saved.getId(),
                classRoom.getId(),
                tutorUserId(classRoom),
                authenticatedStudentId,
                classRoom.getName(),
                saved.getStudentName());
        return toResponse(saved);
    }

    /**
     * Tutor accepts enrollment request
     */
    @Transactional
    public EnrollmentRequestResponse acceptRequest(
            Long requestId,
            String tutorEmail) {
        return acceptRequest(requestId, tutorEmail, null, null);
    }

    public EnrollmentRequestResponse acceptRequest(
            Long requestId,
            String tutorEmail,
            Long tutorUserId) {
        return acceptRequest(requestId, tutorEmail, tutorUserId, null);
    }

    public EnrollmentRequestResponse acceptRequest(
            Long requestId,
            String tutorEmail,
            String agreementId) {
        return acceptRequest(requestId, tutorEmail, null, agreementId);
    }
    public EnrollmentRequestResponse acceptRequest(
            Long requestId,
            String tutorEmail,
            Long tutorUserId,
            String agreementId) {
        EnrollmentRequest req = enrollmentRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("Enrollment request not found: " + requestId));

        ClassRoom classRoom = req.getClassRoom();
        if (!classRoom.getTutorEmail().equalsIgnoreCase(tutorEmail)) {
            throw new ForbiddenException("Bạn không có quyền quản lý yêu cầu của lớp học này");
        }

        if (req.getStatus() != EnrollmentRequestStatus.PENDING) {
            throw new BadRequestException("Yêu cầu này không ở trạng thái chờ duyệt (Trạng thái hiện tại: " + req.getStatus() + ")");
        }

        final Long targetClassId = req.getClassRoom().getId();
        classRoom = classRoomRepository.findByIdForUpdate(targetClassId)
                .orElseThrow(() -> new ResourceNotFoundException("Classroom not found: " + targetClassId));

        long occupiedCount = enrollmentRequestRepository.countByClassRoomIdAndStatusIn(
                classRoom.getId(), List.of(EnrollmentRequestStatus.ACCEPTED, EnrollmentRequestStatus.ENROLLED));
        long availableSlots = classRoom.getMaxStudents() - occupiedCount;

        if (availableSlots <= 0) {
            throw new BadRequestException("Lớp đã hết chỗ trống để duyệt thêm.");
        }

        req.setStatus(EnrollmentRequestStatus.ACCEPTED);
        if (agreementId != null && !agreementId.isBlank()) {
            req.setAgreementId(agreementId.trim());
        }
        EnrollmentRequest saved = enrollmentRequestRepository.save(req);
        eventPublisher.publishEnrollmentAccepted(
                saved.getId(),
                classRoom.getId(),
                saved.getStudentId(),
                tutorUserId,
                classRoom.getName(),
                saved.getStudentName()
        );

        occupiedCount++;
        // Auto-lock & cleanup if full capacity reached
        if (occupiedCount >= classRoom.getMaxStudents()) {
            classRoom.setStatus(ClassRoomStatus.LOCKED);
            classRoomRepository.save(classRoom);

            // Reject all remaining PENDING requests for this class
            List<EnrollmentRequest> remainingPending = enrollmentRequestRepository.findByClassRoomIdAndStatus(classRoom.getId(), EnrollmentRequestStatus.PENDING);
            for (EnrollmentRequest pReq : remainingPending) {
                pReq.setStatus(EnrollmentRequestStatus.REJECTED);
                pReq.setRejectReason("Lớp học đã đủ số lượng học viên (Đã khóa tuyển sinh)");
            }
            enrollmentRequestRepository.saveAll(remainingPending);
            for (EnrollmentRequest pReq : remainingPending) {
                eventPublisher.publishEnrollmentRejected(
                        pReq.getId(),
                        classRoom.getId(),
                        pReq.getStudentId(),
                        tutorUserId,
                        classRoom.getName(),
                        pReq.getRejectReason(),
                        pReq.getStudentName()
                );
            }
        }

        return toResponse(saved);
    }

    /**
     * Tutor rejects enrollment request
     */
    @Transactional
    public EnrollmentRequestResponse rejectRequest(Long requestId, String tutorEmail, Long tutorUserId, String reason) {
        EnrollmentRequest req = enrollmentRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("Enrollment request not found: " + requestId));

        ClassRoom classRoom = req.getClassRoom();
        if (!classRoom.getTutorEmail().equalsIgnoreCase(tutorEmail)) {
            throw new ForbiddenException("Bạn không có quyền quản lý yêu cầu của lớp học này");
        }

        if (req.getStatus() != EnrollmentRequestStatus.PENDING) {
            throw new BadRequestException("Yêu cầu này không ở trạng thái chờ duyệt (Trạng thái hiện tại: " + req.getStatus() + ")");
        }

        req.setStatus(EnrollmentRequestStatus.REJECTED);
        req.setRejectReason(reason != null && !reason.trim().isEmpty() ? reason.trim() : "Gia sư từ chối yêu cầu tham gia.");
        EnrollmentRequest saved = enrollmentRequestRepository.save(req);
        eventPublisher.publishEnrollmentRejected(
                saved.getId(),
                classRoom.getId(),
                saved.getStudentId(),
                tutorUserId,
                classRoom.getName(),
                saved.getRejectReason(),
                saved.getStudentName()
        );
        return toResponse(saved);
    }

    /**
     * Student cancels their pending enrollment request
     */
    @Transactional
    public EnrollmentRequestResponse cancelRequest(Long requestId, String studentEmail, Long studentUserId) {
        EnrollmentRequest req = enrollmentRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("Enrollment request not found: " + requestId));

        if (!req.getStudentEmail().equalsIgnoreCase(studentEmail)) {
            throw new ForbiddenException("Bạn không phải người tạo yêu cầu này");
        }

        if (req.getStatus() != EnrollmentRequestStatus.PENDING) {
            throw new BadRequestException("Chỉ có thể hủy yêu cầu đang ở trạng thái chờ duyệt");
        }

        req.setStatus(EnrollmentRequestStatus.CANCELLED);
        EnrollmentRequest saved = enrollmentRequestRepository.save(req);
        ClassRoom classRoom = saved.getClassRoom();
        eventPublisher.publishEnrollmentCancelled(
                saved.getId(),
                classRoom.getId(),
                tutorUserId(classRoom),
                studentUserId,
                classRoom.getName(),
                saved.getStudentName()
        );
        return toResponse(saved);
    }

    /**
     * Tutor views all requests for a classroom
     */
    @Transactional(readOnly = true)
    public List<EnrollmentRequestResponse> getRequestsForClass(Long classRoomId, String tutorEmail) {
        ClassRoom classRoom = classRoomRepository.findById(classRoomId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lớp học: " + classRoomId));

        if (!classRoom.getTutorEmail().equalsIgnoreCase(tutorEmail)) {
            throw new ForbiddenException("Bạn không có quyền xem yêu cầu của lớp học này");
        }

        List<EnrollmentRequest> list = enrollmentRequestRepository.findByClassRoomIdWithDetails(classRoomId);
        return list.stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<EnrollmentRequestResponse> getAllRequestsForTutor(String tutorEmail) {
        List<EnrollmentRequest> list = enrollmentRequestRepository.findByTutorEmailWithDetails(tutorEmail);
        return list.stream().map(this::toResponse).toList();
    }

    /**
     * Student views their submitted enrollment requests
     */
    @Transactional(readOnly = true)
    public List<EnrollmentRequestResponse> getMyRequests(String studentEmail) {
        List<EnrollmentRequest> list = enrollmentRequestRepository.findByStudentEmailWithDetails(studentEmail);
        return list.stream().map(this::toResponse).toList();
    }

    /**
     * Get buffer pool status for a classroom
     */
    @Transactional(readOnly = true)
    public BufferPoolStatusResponse getBufferPoolStatus(Long classRoomId, String tutorEmail) {
        ClassRoom classRoom = classRoomRepository.findById(classRoomId)
                .orElseThrow(() -> new ResourceNotFoundException("Classroom not found: " + classRoomId));
        if (!classRoom.getTutorEmail().equalsIgnoreCase(tutorEmail)) {
            throw new ForbiddenException("Bạn không có quyền xem danh sách chờ của lớp học này");
        }

        long pendingCount = enrollmentRequestRepository.countByClassRoomIdAndStatus(classRoomId, EnrollmentRequestStatus.PENDING);
        long acceptedCount = enrollmentRequestRepository.countByClassRoomIdAndStatusIn(classRoomId, List.of(EnrollmentRequestStatus.ACCEPTED, EnrollmentRequestStatus.ENROLLED));
        long totalInPool = pendingCount + acceptedCount;
        int maxPending = classRoom.getMaxPendingRequests() != null ? classRoom.getMaxPendingRequests() : (int) Math.ceil(classRoom.getMaxStudents() * 1.5);
        long availableSlots = Math.max(0, classRoom.getMaxStudents() - acceptedCount);

        return new BufferPoolStatusResponse(
                classRoomId,
                classRoom.getMaxStudents(),
                maxPending,
                pendingCount,
                acceptedCount,
                totalInPool,
                availableSlots,
                acceptedCount >= classRoom.getMaxStudents(),
                totalInPool >= maxPending
        );
    }

    @Transactional
    public EnrollmentRequestResponse activateEnrollment(Long classRoomId, Long studentId, String agreementId) {
        EnrollmentRequest req = null;
        if (agreementId != null && !agreementId.isBlank()) {
            req = enrollmentRequestRepository.findByAgreementId(agreementId.trim()).orElse(null);
        }
        if (req == null && classRoomId != null && studentId != null) {
            req = enrollmentRequestRepository.findFirstByClassRoomIdAndStudentIdAndStatusInOrderByCreatedAtDesc(
                    classRoomId, studentId, List.of(EnrollmentRequestStatus.ACCEPTED, EnrollmentRequestStatus.PENDING)
            ).orElse(null);
        }
        if (req == null) {
            throw new ResourceNotFoundException("No pending/accepted enrollment request found for activation (classRoomId: " + classRoomId + ", studentId: " + studentId + ", agreementId: " + agreementId + ")");
        }

        req.setStatus(EnrollmentRequestStatus.ENROLLED);
        if (agreementId != null && !agreementId.isBlank()) {
            req.setAgreementId(agreementId.trim());
        }
        EnrollmentRequest saved = enrollmentRequestRepository.save(req);
        return toResponse(saved);
    }

    @Transactional
    public EnrollmentRequestResponse expireEnrollment(Long classRoomId, Long studentId, String agreementId) {
        EnrollmentRequest req = null;
        if (agreementId != null && !agreementId.isBlank()) {
            req = enrollmentRequestRepository.findByAgreementId(agreementId.trim()).orElse(null);
        }
        if (req == null && classRoomId != null && studentId != null) {
            req = enrollmentRequestRepository.findFirstByClassRoomIdAndStudentIdAndStatusInOrderByCreatedAtDesc(
                    classRoomId, studentId, List.of(EnrollmentRequestStatus.ACCEPTED, EnrollmentRequestStatus.PENDING)
            ).orElse(null);
        }
        if (req == null) {
            return null;
        }

        req.setStatus(EnrollmentRequestStatus.EXPIRED);
        EnrollmentRequest saved = enrollmentRequestRepository.save(req);

        // Unlock classroom if it was previously LOCKED due to full capacity
        ClassRoom classRoom = req.getClassRoom();
        if (classRoom.getStatus() == ClassRoomStatus.LOCKED) {
            long occupiedCount = enrollmentRequestRepository.countByClassRoomIdAndStatusIn(
                    classRoom.getId(), List.of(EnrollmentRequestStatus.ACCEPTED, EnrollmentRequestStatus.ENROLLED));
            if (occupiedCount < classRoom.getMaxStudents()) {
                classRoom.setStatus(ClassRoomStatus.PUBLISHED);
                classRoomRepository.save(classRoom);
            }
        }

        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public StudentScheduleResponse getStudentSchedule(String studentEmail) {
        List<EnrollmentRequest> activeRequests = enrollmentRequestRepository.findByStudentEmailWithDetails(studentEmail);
        List<ClassRoom> activeClasses = activeRequests.stream()
                .filter(r -> r.getStatus() == EnrollmentRequestStatus.ACCEPTED || r.getStatus() == EnrollmentRequestStatus.ENROLLED)
                .map(EnrollmentRequest::getClassRoom)
                .filter(c -> c != null && c.getStatus() != ClassRoomStatus.CLOSED && c.getStatus() != ClassRoomStatus.CANCELLED)
                .distinct()
                .toList();

        List<ScheduleItemDto> recurringSchedules = new ArrayList<>();
        for (ClassRoom classRoom : activeClasses) {
            if (classRoom.getSchedules() != null) {
                for (ClassSchedule schedule : classRoom.getSchedules()) {
                    recurringSchedules.add(new ScheduleItemDto(
                            classRoom.getId(),
                            classRoom.getName(),
                            classRoom.getTutorEmail(),
                            classRoom.getTutorFullName(),
                            classRoom.getMeetingLink(),
                            classRoom.getAddress(),
                            classRoom.getLearningMode() != null ? classRoom.getLearningMode().name() : "ONLINE",
                            schedule.getDayOfWeek(),
                            schedule.getStartTime(),
                            schedule.getEndTime(),
                            classRoom.getStartDate(),
                            classRoom.getEndDate()
                    ));
                }
            }
        }

        List<Long> classIds = activeClasses.stream().map(ClassRoom::getId).toList();
        List<UpcomingSessionItemDto> sessions = new ArrayList<>();
        if (!classIds.isEmpty()) {
            List<ClassSession> classSessions = classSessionRepository.findByClassRoomIdInOrderBySessionDateAscStartTimeAsc(classIds);
            for (ClassSession session : classSessions) {
                int dayOfWeek = session.getSessionDate() != null
                        ? (session.getSessionDate().getDayOfWeek().getValue() == 7 ? 8 : session.getSessionDate().getDayOfWeek().getValue() + 1)
                        : 2;
                sessions.add(new UpcomingSessionItemDto(
                        session.getId(),
                        session.getClassRoom().getId(),
                        session.getClassRoom().getName(),
                        session.getClassRoom().getTutorFullName(),
                        session.getSequenceNumber(),
                        session.getTopic(),
                        session.getSessionDate(),
                        dayOfWeek,
                        session.getStartTime(),
                        session.getEndTime(),
                        session.getStatus() != null ? session.getStatus().name() : "SCHEDULED",
                        session.getClassRoom().getMeetingLink(),
                        session.getAssignmentTitle() != null && !session.getAssignmentTitle().isBlank()
                ));
            }
        }

        recurringSchedules.sort(Comparator.comparing(ScheduleItemDto::dayOfWeek, Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(ScheduleItemDto::startTime, Comparator.nullsLast(Comparator.naturalOrder())));

        return new StudentScheduleResponse(recurringSchedules, sessions);
    }

    private void validateNoScheduleConflict(ClassRoom targetClass, String studentEmail) {
        if (targetClass.getSchedules() == null || targetClass.getSchedules().isEmpty()) {
            return;
        }

        List<EnrollmentRequest> activeRequests = enrollmentRequestRepository.findByStudentEmailWithDetails(studentEmail);
        List<ClassRoom> activeClasses = activeRequests.stream()
                .filter(r -> r.getStatus() == EnrollmentRequestStatus.ACCEPTED || r.getStatus() == EnrollmentRequestStatus.ENROLLED)
                .map(EnrollmentRequest::getClassRoom)
                .filter(c -> c != null && c.getStatus() != ClassRoomStatus.CLOSED && c.getStatus() != ClassRoomStatus.CANCELLED)
                .distinct()
                .toList();

        for (ClassRoom activeClass : activeClasses) {
            if (activeClass.getId().equals(targetClass.getId())) {
                continue;
            }
            if (targetClass.getStartDate() != null && targetClass.getEndDate() != null
                    && activeClass.getStartDate() != null && activeClass.getEndDate() != null) {
                boolean dateOverlaps = !(targetClass.getEndDate().isBefore(activeClass.getStartDate())
                        || activeClass.getEndDate().isBefore(targetClass.getStartDate()));
                if (!dateOverlaps) {
                    continue;
                }
            }

            if (activeClass.getSchedules() == null || activeClass.getSchedules().isEmpty()) {
                continue;
            }

            for (ClassSchedule targetSlot : targetClass.getSchedules()) {
                if (targetSlot.getDayOfWeek() == null || targetSlot.getStartTime() == null || targetSlot.getEndTime() == null) {
                    continue;
                }
                LocalTime targetStart;
                LocalTime targetEnd;
                try {
                    targetStart = LocalTime.parse(targetSlot.getStartTime().trim());
                    targetEnd = LocalTime.parse(targetSlot.getEndTime().trim());
                } catch (Exception e) {
                    continue;
                }

                for (ClassSchedule activeSlot : activeClass.getSchedules()) {
                    if (activeSlot.getDayOfWeek() == null || activeSlot.getStartTime() == null || activeSlot.getEndTime() == null) {
                        continue;
                    }
                    if (!targetSlot.getDayOfWeek().equals(activeSlot.getDayOfWeek())) {
                        continue;
                    }

                    LocalTime activeStart;
                    LocalTime activeEnd;
                    try {
                        activeStart = LocalTime.parse(activeSlot.getStartTime().trim());
                        activeEnd = LocalTime.parse(activeSlot.getEndTime().trim());
                    } catch (Exception e) {
                        continue;
                    }

                    // Overlap condition: start1 < end2 && start2 < end1
                    boolean timeOverlaps = targetStart.isBefore(activeEnd) && activeStart.isBefore(targetEnd);
                    if (timeOverlaps) {
                        String dayLabel = formatDayOfWeek(targetSlot.getDayOfWeek());
                        throw new BadRequestException(String.format(
                                "Trùng lịch học: Lớp học này có lịch vào %s (%s - %s) bị trùng với lớp '%s' (%s - %s) mà bạn đang theo học.",
                                dayLabel, targetSlot.getStartTime(), targetSlot.getEndTime(),
                                activeClass.getName(), activeSlot.getStartTime(), activeSlot.getEndTime()
                        ));
                    }
                }
            }
        }
    }

    private String formatDayOfWeek(Integer dayOfWeek) {
        if (dayOfWeek == null) return "";
        return dayOfWeek == 8 ? "Chủ nhật" : "Thứ " + dayOfWeek;
    }

    private EnrollmentRequestResponse toResponse(EnrollmentRequest r) {
        ClassRoom c = r.getClassRoom();
        return new EnrollmentRequestResponse(
                r.getId(),
                c.getId(),
                c.getName(),
                c.getTutorEmail(),
                c.getTutorFullName(),
                r.getStudentId(),
                r.getStudentEmail(),
                r.getStudentName(),
                r.getStudentPhone(),
                r.getStudentWallet(),
                r.getAgreementId(),
                r.getStatus(),
                r.getJoinKey(),
                r.getNote(),
                r.getRejectReason(),
                r.getCreatedAt(),
                r.getUpdatedAt()
        );
    }

    private Long tutorUserId(ClassRoom classRoom) {
        if (classRoom == null || classRoom.getTutorProfileId() == null) {
            return null;
        }
        return tutorAuthorizationStateRepository.findByTutorProfileId(classRoom.getTutorProfileId())
                .map(state -> state.getUserId())
                .orElse(null);
    }
}
