package iuh.fit.learning_service.service;

import iuh.fit.learning_service.dto.EnrollmentRequestDtos.*;
import iuh.fit.learning_service.entity.ClassRoom;
import iuh.fit.learning_service.entity.ClassSchedule;
import iuh.fit.learning_service.entity.ClassSession;
import iuh.fit.learning_service.entity.EnrollmentRequest;
import iuh.fit.learning_service.enums.ClassRoomStatus;
import iuh.fit.learning_service.enums.ClassSessionStatus;
import iuh.fit.learning_service.enums.EnrollmentRequestStatus;
import iuh.fit.learning_service.enums.JoinMode;
import iuh.fit.learning_service.exception.BadRequestException;
import iuh.fit.learning_service.exception.ForbiddenException;
import iuh.fit.learning_service.exception.ResourceNotFoundException;
import iuh.fit.learning_service.exception.StudentScheduleConflictException;
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
    private final RollingSessionService rollingSessionService;
    private final iuh.fit.learning_service.repository.LearningTerminationStopRepository terminationStops;
    private final StudentScheduleGuard studentScheduleGuard;

    public EnrollmentRequestService(
            ClassRoomRepository classRoomRepository,
            EnrollmentRequestRepository enrollmentRequestRepository,
            ClassSessionRepository classSessionRepository,
            TutorAuthorizationStateRepository tutorAuthorizationStateRepository,
            LearningEventPublisher eventPublisher,
            RollingSessionService rollingSessionService,
            iuh.fit.learning_service.repository.LearningTerminationStopRepository terminationStops,
            StudentScheduleGuard studentScheduleGuard
    ) {
        this.classRoomRepository = classRoomRepository;
        this.enrollmentRequestRepository = enrollmentRequestRepository;
        this.classSessionRepository = classSessionRepository;
        this.tutorAuthorizationStateRepository = tutorAuthorizationStateRepository;
        this.eventPublisher = eventPublisher;
        this.rollingSessionService = rollingSessionService;
        this.terminationStops = terminationStops;
        this.studentScheduleGuard = studentScheduleGuard;
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
        if (request.studentDateOfBirth() == null
                || request.studentAddress() == null || request.studentAddress().isBlank()) {
            throw new BadRequestException("Học viên cần cập nhật ngày sinh và địa chỉ trước khi gửi yêu cầu.");
        }
        if (request.studentWallet() == null || !request.studentWallet().matches("^0x[a-fA-F0-9]{40}$")
                || "0x0000000000000000000000000000000000000000".equalsIgnoreCase(request.studentWallet())) {
            throw new BadRequestException("A connected MetaMask wallet is required before submitting an enrollment request.");
        }

        // Pessimistic Lock on classroom to avoid race conditions
        ClassRoom classRoom = classRoomRepository.findByIdForUpdate(classRoomId)
                .orElseThrow(() -> new ResourceNotFoundException("Classroom not found: " + classRoomId));
        if (classRoom.getTerminationCutoffSession() != null) throw new BadRequestException("Classroom is terminating");

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

        // Classroom locks protect capacity; this student-scoped lock protects
        // reservations made concurrently in two different classrooms.
        studentScheduleGuard.lock(authenticatedStudentId);

        // Validate invite key if joinMode == INVITE_KEY
        if (classRoom.getJoinMode() == JoinMode.INVITE_KEY) {
            String key = request != null && request.joinKey() != null ? request.joinKey().trim() : "";
            if (key.isEmpty() || !key.equalsIgnoreCase(classRoom.getJoinKey())) {
                throw new BadRequestException("Mã mời (Invite Key) không đúng");
            }
        }

        // Check duplicate request, including an already-funded enrollment in the
        // same classroom. Schedule-conflict validation intentionally skips the
        // target classroom, so this identity guard must cover ENROLLED as well.
        List<EnrollmentRequestStatus> activeSameClassStatuses = List.of(
                EnrollmentRequestStatus.PENDING,
                EnrollmentRequestStatus.ACCEPTED,
                EnrollmentRequestStatus.ENROLLED);
        boolean alreadySubmitted = enrollmentRequestRepository.existsByClassRoomIdAndStudentEmailIgnoreCaseAndStatusIn(
                classRoomId,
                studentEmail,
                activeSameClassStatuses
        ) || enrollmentRequestRepository.existsActiveByClassRoomAndStudentIdentity(
                classRoomId,
                authenticatedStudentId,
                studentEmail,
                activeSameClassStatuses
        );
        if (alreadySubmitted) {
            throw new BadRequestException("Bạn đã gửi yêu cầu hoặc đang tham gia lớp học này.");
        }

        // PENDING is already a reservation; the first committed request wins.
        validateNoScheduleConflict(classRoom, authenticatedStudentId, studentEmail, null,
                List.of(EnrollmentRequestStatus.PENDING, EnrollmentRequestStatus.ACCEPTED, EnrollmentRequestStatus.ENROLLED));

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
        req.setStudentDateOfBirth(request.studentDateOfBirth());
        req.setStudentAddress(request.studentAddress().trim());
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
        Long targetClassId = enrollmentRequestRepository.findClassRoomIdById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("Enrollment request not found: " + requestId));
        ClassRoom classRoom = classRoomRepository.findByIdForUpdate(targetClassId)
                .orElseThrow(() -> new ResourceNotFoundException("Classroom not found: " + targetClassId));
        if (!classRoom.getTutorEmail().equalsIgnoreCase(tutorEmail)) {
            throw new ForbiddenException("Bạn không có quyền quản lý yêu cầu của lớp học này");
        }
        if (classRoom.getTerminationCutoffSession() != null) throw new BadRequestException("Classroom is terminating");
        if (classRoom.getStatus() != ClassRoomStatus.PUBLISHED) {
            throw new BadRequestException("Lớp học đã đóng nhận yêu cầu tham gia");
        }

        // Load the request only after acquiring the classroom lock so the lifecycle
        // scheduler and tutor acceptance cannot both complete for the same request.
        EnrollmentRequest req = enrollmentRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("Enrollment request not found: " + requestId));
        if (!targetClassId.equals(req.getClassRoom().getId())) {
            throw new BadRequestException("Yêu cầu tham gia không còn thuộc lớp học này");
        }
        if (req.getStatus() != EnrollmentRequestStatus.PENDING) {
            throw new BadRequestException("Yêu cầu này không ở trạng thái chờ duyệt (Trạng thái hiện tại: " + req.getStatus() + ")");
        }

        studentScheduleGuard.lock(req.getStudentId());
        validateNoScheduleConflict(classRoom, req.getStudentId(), req.getStudentEmail(), req.getId(),
                List.of(EnrollmentRequestStatus.PENDING, EnrollmentRequestStatus.ACCEPTED, EnrollmentRequestStatus.ENROLLED));

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
            if (req == null) {
                throw new ResourceNotFoundException("No enrollment request is linked to agreement: " + agreementId);
            }
            requireActivationIdentity(req, classRoomId, studentId, agreementId);
        }
        if (req == null && classRoomId != null && studentId != null) {
            req = enrollmentRequestRepository.findFirstByClassRoomIdAndStudentIdAndStatusInOrderByCreatedAtDesc(
                    classRoomId, studentId, List.of(EnrollmentRequestStatus.ACCEPTED)
            ).orElse(null);
        }
        if (req == null) {
            throw new ResourceNotFoundException("No pending/accepted enrollment request found for activation (classRoomId: " + classRoomId + ", studentId: " + studentId + ", agreementId: " + agreementId + ")");
        }
        if (req.getStatus() != EnrollmentRequestStatus.ACCEPTED
                && req.getStatus() != EnrollmentRequestStatus.ENROLLED) {
            throw new BadRequestException("Enrollment request cannot be activated from status: " + req.getStatus());
        }

        final Long targetClassId = req.getClassRoom().getId();
        ClassRoom classRoom = classRoomRepository.findByIdForUpdate(targetClassId)
                .orElseThrow(() -> new ResourceNotFoundException("Classroom not found: " + targetClassId));
        if (classRoom.getStatus() == ClassRoomStatus.CANCELLED || classRoom.getStatus() == ClassRoomStatus.CLOSED) {
            throw new BadRequestException("Classroom is already cancelled or closed");
        }
        if (classRoom.getTerminationCutoffSession() != null) {
            throw new BadRequestException("Classroom is terminating");
        }

        studentScheduleGuard.lock(req.getStudentId());
        validateNoScheduleConflict(classRoom, req.getStudentId(), req.getStudentEmail(), req.getId(),
                List.of(EnrollmentRequestStatus.PENDING, EnrollmentRequestStatus.ACCEPTED, EnrollmentRequestStatus.ENROLLED));

        req.setStatus(EnrollmentRequestStatus.ENROLLED);
        if (agreementId != null && !agreementId.isBlank()) {
            req.setAgreementId(agreementId.trim());
        }
        EnrollmentRequest saved = enrollmentRequestRepository.save(req);
        rollingSessionService.createMissingAttendancesForEnrollment(saved);
        return toResponse(saved);
    }

    @Transactional
    public EnrollmentRequestResponse expireEnrollment(Long classRoomId, Long studentId, String agreementId) {
        EnrollmentRequest req = null;
        if (agreementId != null && !agreementId.isBlank()) {
            req = enrollmentRequestRepository.findByAgreementId(agreementId.trim()).orElse(null);
            if (req == null) {
                throw new ResourceNotFoundException("No enrollment request is linked to agreement: " + agreementId);
            }
            requireActivationIdentity(req, classRoomId, studentId, agreementId);
        }
        if (req == null && classRoomId != null && studentId != null) {
            req = enrollmentRequestRepository.findFirstByClassRoomIdAndStudentIdAndStatusInOrderByCreatedAtDesc(
                    classRoomId, studentId, List.of(EnrollmentRequestStatus.ACCEPTED)
            ).orElse(null);
        }
        if (req == null) {
            return null;
        }

        if (req.getStatus() == EnrollmentRequestStatus.CANCELLED) return toResponse(req);
        req.setStatus(EnrollmentRequestStatus.EXPIRED);
        EnrollmentRequest saved = enrollmentRequestRepository.save(req);

        // Unlock classroom if it was previously LOCKED due to full capacity
        ClassRoom classRoom = req.getClassRoom();
        if (classRoom.getStatus() == ClassRoomStatus.LOCKED && classRoom.getTerminationCutoffSession() == null) {
            long occupiedCount = enrollmentRequestRepository.countByClassRoomIdAndStatusIn(
                    classRoom.getId(), List.of(EnrollmentRequestStatus.ACCEPTED, EnrollmentRequestStatus.ENROLLED));
            if (occupiedCount < classRoom.getMaxStudents()) {
                classRoom.setStatus(ClassRoomStatus.PUBLISHED);
                classRoomRepository.save(classRoom);
            }
        }

        return toResponse(saved);
    }

    private void requireActivationIdentity(EnrollmentRequest request, Long classRoomId, Long studentId, String agreementId) {
        if (classRoomId == null || studentId == null
                || !classRoomId.equals(request.getClassRoom().getId())
                || !studentId.equals(request.getStudentId())
                || !agreementId.trim().equals(request.getAgreementId())) {
            throw new BadRequestException("Contract event identity does not match the linked enrollment request");
        }
    }

    @Transactional(readOnly = true)
    public StudentScheduleResponse getStudentSchedule(String studentEmail) {
        return buildStudentSchedule(enrollmentRequestRepository.findByStudentEmailWithDetails(studentEmail));
    }

    @Transactional(readOnly = true)
    public StudentScheduleResponse getStudentSchedule(Long studentId, String studentEmail) {
        return buildStudentSchedule(loadStudentRequests(studentId, studentEmail));
    }

    private StudentScheduleResponse buildStudentSchedule(List<EnrollmentRequest> activeRequests) {
        // A reservation is shown immediately in the timetable. Only a funded
        // ENROLLED class exposes concrete sessions and attendance access.
        List<EnrollmentRequest> enrolledOrAccepted = activeRequests.stream()
                .filter(r -> r.getStatus() == EnrollmentRequestStatus.PENDING
                        || r.getStatus() == EnrollmentRequestStatus.ACCEPTED
                        || r.getStatus() == EnrollmentRequestStatus.ENROLLED
                        || (r.getStatus() == EnrollmentRequestStatus.CANCELLED
                        && r.getAgreementId() != null && !r.getAgreementId().isBlank()))
                .toList();

        // Recurring schedules include pending/accepted reservations so a later
        // request can see the occupied slot immediately.
        List<EnrollmentRequest> activeRecurringReservations = enrolledOrAccepted.stream()
                .filter(r -> r.getStatus() == EnrollmentRequestStatus.PENDING
                        || r.getStatus() == EnrollmentRequestStatus.ACCEPTED
                        || r.getStatus() == EnrollmentRequestStatus.ENROLLED)
                .filter(r -> participationCutoff(r) == null)
                .filter(r -> r.getClassRoom() != null
                        && r.getClassRoom().getStatus() != ClassRoomStatus.CLOSED
                        && r.getClassRoom().getStatus() != ClassRoomStatus.CANCELLED
                        && r.getClassRoom().getTerminationCutoffSession() == null)
                .toList();

        List<ScheduleItemDto> recurringSchedules = new ArrayList<>();
        for (EnrollmentRequest reservation : activeRecurringReservations) {
            ClassRoom classRoom = reservation.getClassRoom();
            if (classRoom.getSchedules() != null) {
                for (ClassSchedule schedule : classRoom.getSchedules()) {
                    recurringSchedules.add(new ScheduleItemDto(
                            classRoom.getId(),
                            classRoom.getName(),
                            classRoom.getTutorEmail(),
                            classRoom.getTutorFullName(),
                            null,
                            classRoom.getAddress(),
                            classRoom.getLearningMode() != null ? classRoom.getLearningMode().name() : "ONLINE",
                            schedule.getDayOfWeek(),
                            schedule.getStartTime(),
                            schedule.getEndTime(),
                            classRoom.getStartDate(),
                            classRoom.getEndDate(),
                            reservation.getStatus()
                    ));
                }
            }
        }

        // Sessions: include all enrolled classes (including terminating ones), marking attendanceStopped when past cutoff
        java.util.Map<Long, Integer> studentCutoffByClassId = new java.util.HashMap<>();
        for (EnrollmentRequest req : enrolledOrAccepted.stream()
                .filter(r -> r.getStatus() == EnrollmentRequestStatus.ENROLLED
                        || r.getStatus() == EnrollmentRequestStatus.CANCELLED)
                .toList()) {
            if (req.getClassRoom() != null) {
                studentCutoffByClassId.put(req.getClassRoom().getId(), participationCutoff(req));
            }
        }

        List<Long> allClassIds = studentCutoffByClassId.keySet().stream().toList();
        List<UpcomingSessionItemDto> sessions = new ArrayList<>();
        if (!allClassIds.isEmpty()) {
            List<ClassSession> classSessions = classSessionRepository.findByClassRoomIdInOrderBySessionDateAscStartTimeAsc(allClassIds);
            for (ClassSession session : classSessions) {
                int dayOfWeek = session.getSessionDate() != null
                        ? (session.getSessionDate().getDayOfWeek().getValue() == 7 ? 8 : session.getSessionDate().getDayOfWeek().getValue() + 1)
                        : 2;

                Long classId = session.getClassRoom().getId();
                Integer cutoff = studentCutoffByClassId.get(classId);
                // A whole-class cancellation happens after previous sessions
                // have settled. Keep their true COMPLETED history visible; only
                // future/cancelled session rows are stopped.
                boolean isStopped = (cutoff != null && session.getSequenceNumber() > cutoff)
                        || session.getStatus() == ClassSessionStatus.CANCELLED;

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
                        isStopped ? "CANCELLED" : (session.getStatus() != null ? session.getStatus().name() : "SCHEDULED"),
                        null,
                        session.getAssignmentTitle() != null && !session.getAssignmentTitle().isBlank(),
                        isStopped
                ));
            }
        }

        recurringSchedules.sort(Comparator.comparing(ScheduleItemDto::dayOfWeek, Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(ScheduleItemDto::startTime, Comparator.nullsLast(Comparator.naturalOrder())));

        return new StudentScheduleResponse(recurringSchedules, sessions);
    }

    private void validateNoScheduleConflict(
            ClassRoom targetClass,
            Long studentId,
            String studentEmail,
            Long excludedRequestId,
            java.util.Collection<EnrollmentRequestStatus> conflictingStatuses) {
        requireValidSchedule(targetClass);

        List<EnrollmentRequest> activeRequests = loadStudentRequests(studentId, studentEmail);
        // A termination HOLD can be rejected; keep the student's reservation
        // until the enrollment or classroom reaches its final cancelled state.
        List<ClassRoom> activeClasses = activeRequests.stream()
                .filter(r -> excludedRequestId == null || !excludedRequestId.equals(r.getId()))
                .filter(r -> conflictingStatuses.contains(r.getStatus()))
                .map(EnrollmentRequest::getClassRoom)
                .filter(c -> c != null && c.getStatus() != ClassRoomStatus.CLOSED && c.getStatus() != ClassRoomStatus.CANCELLED)
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

            requireValidSchedule(activeClass);

            for (ClassSchedule targetSlot : targetClass.getSchedules()) {
                LocalTime targetStart = parseTime(targetClass, targetSlot.getStartTime(), "bắt đầu");
                LocalTime targetEnd = parseTime(targetClass, targetSlot.getEndTime(), "kết thúc");

                for (ClassSchedule activeSlot : activeClass.getSchedules()) {
                    if (!normalizeDayOfWeek(targetSlot.getDayOfWeek())
                            .equals(normalizeDayOfWeek(activeSlot.getDayOfWeek()))) {
                        continue;
                    }

                    LocalTime activeStart = parseTime(activeClass, activeSlot.getStartTime(), "bắt đầu");
                    LocalTime activeEnd = parseTime(activeClass, activeSlot.getEndTime(), "kết thúc");

                    // Overlap condition: start1 < end2 && start2 < end1
                    boolean timeOverlaps = targetStart.isBefore(activeEnd) && activeStart.isBefore(targetEnd);
                    if (timeOverlaps) {
                        String dayLabel = formatDayOfWeek(targetSlot.getDayOfWeek());
                        throw new StudentScheduleConflictException(String.format(
                                "Trùng lịch học: Lớp học này có lịch vào %s (%s - %s) bị trùng với lớp '%s' (%s - %s) mà bạn đang theo học.",
                                dayLabel, targetSlot.getStartTime(), targetSlot.getEndTime(),
                                activeClass.getName(), activeSlot.getStartTime(), activeSlot.getEndTime()
                        ), activeClass.getId(), activeClass.getName(), targetSlot.getDayOfWeek(),
                                activeSlot.getStartTime(), activeSlot.getEndTime());
                    }
                }
            }
        }
    }

    private String formatDayOfWeek(Integer dayOfWeek) {
        if (dayOfWeek == null) return "";
        return (dayOfWeek == 8 || dayOfWeek == 1) ? "Chủ nhật" : "Thứ " + dayOfWeek;
    }

    private List<EnrollmentRequest> loadStudentRequests(Long studentId, String studentEmail) {
        if (studentId != null && studentId > 0) {
            return enrollmentRequestRepository.findByStudentIdentityWithDetails(studentId, studentEmail);
        }
        return enrollmentRequestRepository.findByStudentEmailWithDetails(studentEmail);
    }

    private void requireValidSchedule(ClassRoom classRoom) {
        if (classRoom.getSchedules() == null || classRoom.getSchedules().isEmpty()) {
            throw invalidSchedule(classRoom, "không có khung giờ học");
        }
        for (ClassSchedule slot : classRoom.getSchedules()) {
            Integer day = normalizeDayOfWeek(slot.getDayOfWeek());
            if (day < 2 || day > 8) {
                throw invalidSchedule(classRoom, "thứ trong tuần không hợp lệ");
            }
            LocalTime start = parseTime(classRoom, slot.getStartTime(), "bắt đầu");
            LocalTime end = parseTime(classRoom, slot.getEndTime(), "kết thúc");
            if (!start.isBefore(end)) {
                throw invalidSchedule(classRoom, "giờ bắt đầu phải trước giờ kết thúc");
            }
        }
    }

    private Integer normalizeDayOfWeek(Integer dayOfWeek) {
        if (dayOfWeek == null) return -1;
        return dayOfWeek == 1 ? 8 : dayOfWeek;
    }

    private LocalTime parseTime(ClassRoom classRoom, String value, String field) {
        if (value == null || value.isBlank()) {
            throw invalidSchedule(classRoom, "thiếu giờ " + field);
        }
        try {
            return LocalTime.parse(value.trim());
        } catch (RuntimeException invalidTime) {
            throw invalidSchedule(classRoom, "giờ " + field + " không hợp lệ: " + value);
        }
    }

    private BadRequestException invalidSchedule(ClassRoom classRoom, String reason) {
        String name = classRoom.getName() == null ? "#" + classRoom.getId() : classRoom.getName();
        return new BadRequestException("Dữ liệu lịch của lớp '" + name + "' không hợp lệ (" + reason
                + "). Vui lòng liên hệ quản trị viên để chỉnh lịch trước khi tiếp tục.");
    }

    private Integer participationCutoff(EnrollmentRequest r) {
        Integer classCutoff = r.getClassRoom().getTerminationCutoffSession();
        Integer individualCutoff = terminationStops.findByClassroomIdAndStudentId(r.getClassRoom().getId(), r.getStudentId())
                .stream().map(iuh.fit.learning_service.entity.LearningTerminationStop::getCutoffSession)
                .min(Integer::compareTo).orElse(null);
        if (classCutoff == null) return individualCutoff;
        return individualCutoff == null ? classCutoff : Math.min(classCutoff, individualCutoff);
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
                r.getStudentDateOfBirth(),
                r.getStudentAddress(),
                r.getAgreementId(),
                r.getStatus(),
                c.getStatus().name(),
                participationCutoff(r),
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
