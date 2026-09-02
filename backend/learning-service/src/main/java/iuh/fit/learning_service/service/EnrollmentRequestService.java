package iuh.fit.learning_service.service;

import iuh.fit.learning_service.dto.EnrollmentRequestDtos.*;
import iuh.fit.learning_service.entity.ClassRoom;
import iuh.fit.learning_service.entity.EnrollmentRequest;
import iuh.fit.learning_service.enums.ClassRoomStatus;
import iuh.fit.learning_service.enums.EnrollmentRequestStatus;
import iuh.fit.learning_service.enums.JoinMode;
import iuh.fit.learning_service.exception.BadRequestException;
import iuh.fit.learning_service.exception.ForbiddenException;
import iuh.fit.learning_service.exception.ResourceNotFoundException;
import iuh.fit.learning_service.messaging.LearningEventPublisher;
import iuh.fit.learning_service.repository.ClassRoomRepository;
import iuh.fit.learning_service.repository.EnrollmentRequestRepository;
import iuh.fit.learning_service.repository.TutorAuthorizationStateRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
@Transactional
public class EnrollmentRequestService {

    private final ClassRoomRepository classRoomRepository;
    private final EnrollmentRequestRepository enrollmentRequestRepository;
    private final TutorAuthorizationStateRepository tutorAuthorizationStateRepository;
    private final LearningEventPublisher eventPublisher;

    public EnrollmentRequestService(
            ClassRoomRepository classRoomRepository,
            EnrollmentRequestRepository enrollmentRequestRepository,
            TutorAuthorizationStateRepository tutorAuthorizationStateRepository,
            LearningEventPublisher eventPublisher
    ) {
        this.classRoomRepository = classRoomRepository;
        this.enrollmentRequestRepository = enrollmentRequestRepository;
        this.tutorAuthorizationStateRepository = tutorAuthorizationStateRepository;
        this.eventPublisher = eventPublisher;
    }

    /**
     * Student submits enrollment request for a classroom
     */
    @Transactional
    public EnrollmentRequestResponse enrollClass(Long classRoomId, String studentEmail, Long studentUserId, EnrollClassRequest request) {
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
        req.setStudentEmail(studentEmail);
        req.setStudentUserId(studentUserId);
        req.setStudentName(request != null && request.studentName() != null ? request.studentName().trim() : null);
        req.setJoinKey(request != null ? request.joinKey() : null);
        req.setNote(request != null && request.note() != null ? request.note().trim() : null);
        req.setStatus(EnrollmentRequestStatus.PENDING);

        EnrollmentRequest saved = enrollmentRequestRepository.save(req);
        eventPublisher.publishEnrollmentRequested(
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
     * Tutor accepts enrollment request
     */
    @Transactional
    public EnrollmentRequestResponse acceptRequest(Long requestId, String tutorEmail, Long tutorUserId) {
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

        long acceptedCount = enrollmentRequestRepository.countByClassRoomIdAndStatus(classRoom.getId(), EnrollmentRequestStatus.ACCEPTED);
        long availableSlots = classRoom.getMaxStudents() - acceptedCount;

        if (availableSlots <= 0) {
            throw new BadRequestException("Lớp đã hết chỗ trống để duyệt thêm.");
        }

        req.setStatus(EnrollmentRequestStatus.ACCEPTED);
        EnrollmentRequest saved = enrollmentRequestRepository.save(req);
        eventPublisher.publishEnrollmentAccepted(
                saved.getId(),
                classRoom.getId(),
                saved.getStudentUserId(),
                tutorUserId,
                classRoom.getName(),
                saved.getStudentName()
        );

        acceptedCount++;
        // Auto-lock & cleanup if full capacity reached
        if (acceptedCount >= classRoom.getMaxStudents()) {
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
                        pReq.getStudentUserId(),
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
                saved.getStudentUserId(),
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
                .orElseThrow(() -> new ResourceNotFoundException("Classroom not found: " + classRoomId));

        if (!classRoom.getTutorEmail().equalsIgnoreCase(tutorEmail)) {
            throw new ForbiddenException("Bạn không có quyền xem yêu cầu của lớp học này");
        }

        List<EnrollmentRequest> list = enrollmentRequestRepository.findByClassRoomIdWithDetails(classRoomId);
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
        long acceptedCount = enrollmentRequestRepository.countByClassRoomIdAndStatus(classRoomId, EnrollmentRequestStatus.ACCEPTED);
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

    private EnrollmentRequestResponse toResponse(EnrollmentRequest r) {
        ClassRoom c = r.getClassRoom();
        return new EnrollmentRequestResponse(
                r.getId(),
                c.getId(),
                c.getName(),
                c.getTutorEmail(),
                r.getStudentEmail(),
                r.getStudentName(),
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
