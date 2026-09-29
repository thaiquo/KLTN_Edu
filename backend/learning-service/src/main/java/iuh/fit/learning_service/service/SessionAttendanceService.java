package iuh.fit.learning_service.service;

import iuh.fit.learning_service.dto.ClassSessionDtos;
import iuh.fit.learning_service.dto.ClassroomMaterialDtos.PresignedDownloadUrlResponse;
import iuh.fit.learning_service.entity.ClassRoom;
import iuh.fit.learning_service.entity.ClassSession;
import iuh.fit.learning_service.entity.SessionAttendance;
import iuh.fit.learning_service.entity.SessionFile;
import iuh.fit.learning_service.enums.AttendanceOutcome;
import iuh.fit.learning_service.enums.ClassSessionStatus;
import iuh.fit.learning_service.enums.EnrollmentRequestStatus;
import iuh.fit.learning_service.enums.SyllabusMode;
import iuh.fit.learning_service.exception.BadRequestException;
import iuh.fit.learning_service.exception.ForbiddenException;
import iuh.fit.learning_service.exception.ResourceNotFoundException;
import iuh.fit.learning_service.messaging.LearningEventPublisher;
import iuh.fit.learning_service.repository.ClassRoomRepository;
import iuh.fit.learning_service.repository.ClassSessionRepository;
import iuh.fit.learning_service.repository.EnrollmentRequestRepository;
import iuh.fit.learning_service.repository.SessionAttendanceRepository;
import iuh.fit.learning_service.repository.SessionFileRepository;
import iuh.fit.learning_service.service.storage.FileStorageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class SessionAttendanceService {

    private final ClassSessionRepository classSessionRepository;
    private final SessionAttendanceRepository sessionAttendanceRepository;
    private final EnrollmentRequestRepository enrollmentRequestRepository;
    private final ClassRoomRepository classRoomRepository;
    private final SessionFileRepository sessionFileRepository;
    private final FileStorageService fileStorageService;
    private final RollingSessionService rollingSessionService;
    private final SessionAccessControl sessionAccessControl;
    private final ContractServiceDispatcher contractServiceDispatcher;
    private final LearningTerminationService terminationService;
    private final LearningStorageCleanupService learningStorageCleanupService;
    private final LearningEventPublisher learningEventPublisher;

    /**
     * Lấy danh sách các buổi học của một lớp học. Tự động sinh tuần đầu tiên nếu lớp chưa có buổi học nào.
     */
    @Transactional
    public List<ClassSessionDtos.ClassSessionResponse> getSessionsByClassRoomId(Long classRoomId) {
        ClassRoom room = classRoomRepository.findById(classRoomId)
                .orElseThrow(() -> new ResourceNotFoundException("Classroom not found"));
        sessionAccessControl.requireCanView(room);
        List<ClassSession> sessions = classSessionRepository.findByClassRoomIdOrderBySequenceNumberAsc(classRoomId);
        Long studentId = sessionAccessControl.currentStudentId();
        if (studentId != null && sessionAccessControl.isHistoricalOnlyStudent(room, studentId)) {
            sessions = sessions.stream()
                    .filter(session -> sessionAttendanceRepository
                            .findBySessionIdAndStudentId(session.getId(), studentId).isPresent())
                    .toList();
        }
        return sessions.stream().map(this::toSessionResponse).toList();
    }

    /**
     * Chủ động sinh danh sách các buổi học của tuần đầu tiên cho lớp học.
     */
    @Transactional
    public List<ClassSessionDtos.ClassSessionResponse> generateInitialWeekSessions(Long classRoomId) {
        ClassRoom room = classRoomRepository.findById(classRoomId)
                .orElseThrow(() -> new ResourceNotFoundException("Classroom not found"));
        sessionAccessControl.requireTutor(room);
        rollingSessionService.generateInitialWeekSessions(classRoomId);
        List<ClassSession> sessions = classSessionRepository.findByClassRoomIdOrderBySequenceNumberAsc(classRoomId);
        return sessions.stream().map(this::toSessionResponse).toList();
    }

    /**
     * Lấy chi tiết một buổi học.
     */
    @Transactional(readOnly = true)
    public ClassSessionDtos.ClassSessionResponse getSessionById(Long sessionId) {
        ClassSession session = classSessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Buổi học không tồn tại: " + sessionId));
        sessionAccessControl.requireCanView(session.getClassRoom());
        Long studentId = sessionAccessControl.currentStudentId();
        if (studentId != null
                && sessionAccessControl.isHistoricalOnlyStudent(session.getClassRoom(), studentId)
                && sessionAttendanceRepository.findBySessionIdAndStudentId(sessionId, studentId).isEmpty()) {
            throw new ForbiddenException("This session is outside the student's learning history");
        }
        return toSessionResponse(session);
    }

    /**
     * Gia sư lấy danh sách điểm danh chi tiết của toàn bộ học viên trong buổi học.
     */
    @Transactional(readOnly = true)
    public List<ClassSessionDtos.SessionAttendanceResponse> getAttendancesBySessionId(Long sessionId, String userEmail) {
        ClassSession session = classSessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Buổi học không tồn tại: " + sessionId));

        sessionAccessControl.requireTutor(session.getClassRoom());
        List<SessionAttendance> attendances = sessionAttendanceRepository.findBySessionId(sessionId);
        Map<Long, EnrollmentRequestStatus> enrollmentStatuses = enrollmentRequestRepository
                .findByClassRoomIdWithDetails(session.getClassRoom().getId()).stream()
                .filter(enrollment -> enrollment.getStudentId() != null)
                .collect(Collectors.toMap(
                        enrollment -> enrollment.getStudentId(),
                        enrollment -> enrollment.getStatus(),
                        (latest, ignored) -> latest
                ));
        return attendances.stream()
                .map(attendance -> toAttendanceResponse(attendance, enrollmentStatuses.get(attendance.getStudentId())))
                .toList();
    }

    /**
     * Gia sư cập nhật chủ đề, bài tập hoặc file tài liệu cho buổi học.
     */
    @Transactional
    public ClassSessionDtos.ClassSessionResponse updateSessionDetails(
            Long sessionId,
            String tutorEmail,
            ClassSessionDtos.UpdateSessionDetailsRequest request
    ) {
        ClassSession session = classSessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Buổi học không tồn tại: " + sessionId));

        ClassRoom classRoom = session.getClassRoom();
        sessionAccessControl.requireTutor(classRoom);
        if (tutorEmail != null && !classRoom.getTutorEmail().equalsIgnoreCase(tutorEmail.trim())) {
            throw new ForbiddenException("Bạn không có quyền chỉnh sửa buổi học của lớp này");
        }

        if (request.topic() != null) {
            session.setTopic(request.topic().trim());
        }
        if (request.assignmentTitle() != null) {
            session.setAssignmentTitle(request.assignmentTitle().trim());
        }
        if (request.assignmentDescription() != null) {
            session.setAssignmentDescription(request.assignmentDescription().trim());
        }
        if (request.assignmentFileUrl() != null) {
            session.setAssignmentFileUrl(request.assignmentFileUrl().trim());
        }
        if (request.assignmentDueAt() != null) {
            session.setAssignmentDueAt(request.assignmentDueAt());
        }
        if (request.submissionRequired() != null) {
            session.setSubmissionRequired(Boolean.TRUE.equals(request.submissionRequired()));
            if (!session.isSubmissionRequired()) {
                session.setAssignmentDueAt(null);
            }
        }
        if (request.lateSubmissionAllowed() != null) {
            session.setLateSubmissionAllowed(Boolean.TRUE.equals(request.lateSubmissionAllowed()));
        }
        if (session.isSubmissionRequired() && session.getAssignmentDueAt() == null) {
            throw new BadRequestException("Can nop bai thi bat buoc phai co han nop.");
        }
        if (request.materialUrl() != null) {
            session.setMaterialUrl(request.materialUrl().trim());
        }
        if (request.materialDescription() != null) {
            session.setMaterialDescription(request.materialDescription().trim());
        }
        if (request.assignmentExternalUrl() != null) {
            session.setAssignmentExternalUrl(request.assignmentExternalUrl().trim());
        }
        if (request.materialExternalUrl() != null) {
            session.setMaterialExternalUrl(request.materialExternalUrl().trim());
        }

        ClassSession saved = classSessionRepository.save(session);
        return toSessionResponse(saved);
    }

    /**
     * Gia sư cập nhật Link phòng học cố định cho toàn bộ Lớp học.
     */
    @Transactional
    public void updateClassMeetingLink(Long classRoomId, String tutorEmail, String meetingLink) {
        ClassRoom classRoom = classRoomRepository.findById(classRoomId)
                .orElseThrow(() -> new ResourceNotFoundException("Lớp học không tồn tại: " + classRoomId));

        sessionAccessControl.requireTutor(classRoom);
        if (tutorEmail != null && !classRoom.getTutorEmail().equalsIgnoreCase(tutorEmail.trim())) {
            throw new ForbiddenException("Bạn không có quyền chỉnh sửa lớp học này");
        }

        classRoom.setMeetingLink(meetingLink != null ? meetingLink.trim() : null);
        classRoomRepository.save(classRoom);
    }

    /**
     * Học viên tự bấm check-in trong khung giờ học thực tế.
     */
    @Transactional
    public ClassSessionDtos.SessionAttendanceResponse studentCheckIn(Long sessionId, Long studentId) {
        ClassSession session = classSessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Buổi học không tồn tại: " + sessionId));

        sessionAccessControl.requireStudent(session.getClassRoom(), studentId);
        validateStrictSessionTimeWindow(session);
        terminationService.requireCanAttend(session, studentId);

        SessionAttendance attendance = sessionAttendanceRepository.findBySessionIdAndStudentId(sessionId, studentId)
                .orElseThrow(() -> new BadRequestException("Bạn không có tên trong danh sách lớp học của buổi này"));

        if (Boolean.TRUE.equals(attendance.getStudentChecked())) {
            return toAttendanceResponse(attendance);
        }

        attendance.setStudentChecked(true);
        attendance.setStudentCheckedAt(LocalDateTime.now());
        SessionAttendance saved = sessionAttendanceRepository.save(attendance);

        if (session.getStatus() == ClassSessionStatus.SCHEDULED) {
            session.setStatus(ClassSessionStatus.IN_PROGRESS);
            classSessionRepository.save(session);
        }

        log.info("Student #{} checked-in successfully for Session #{} ({})", studentId, sessionId, session.getTopic());
        return toAttendanceResponse(saved);
    }

    /**
     * Học viên lấy link phòng học sau khi đã điểm danh thành công.
     */
    @Transactional(readOnly = true)
    public String getMeetingLinkAfterStudentCheckIn(Long sessionId, Long studentId) {
        ClassSession session = classSessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Buổi học không tồn tại: " + sessionId));

        sessionAccessControl.requireStudent(session.getClassRoom(), studentId);
        terminationService.requireCanAttend(session, studentId);

        SessionAttendance attendance = sessionAttendanceRepository.findBySessionIdAndStudentId(sessionId, studentId)
                .orElseThrow(() -> new BadRequestException("Bạn không có tên trong danh sách lớp học của buổi này"));

        if (!Boolean.TRUE.equals(attendance.getStudentChecked())) {
            throw new ForbiddenException("Bạn phải điểm danh thành công trước khi truy cập link phòng học.");
        }

        String meetingLink = session.getClassRoom().getMeetingLink();
        if (meetingLink == null || meetingLink.isBlank()) {
            meetingLink = "https://meet.google.com/edu-class-" + (session.getClassRoom().getId() != null ? session.getClassRoom().getId() : sessionId);
        }
        return meetingLink;
    }

    /**
     * Gia sư bấm "Điểm danh vào dạy" bất kỳ lúc nào TRONG KHUNG GIỜ HỌC.
     */
    @Transactional
    public ClassSessionDtos.ClassSessionResponse tutorCheckIn(
            Long sessionId,
            String tutorEmail,
            ClassSessionDtos.TutorAttendanceRequest request
    ) {
        ClassSession session = classSessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Buổi học không tồn tại: " + sessionId));

        ClassRoom classRoom = session.getClassRoom();
        sessionAccessControl.requireTutor(classRoom);
        if (tutorEmail != null && !classRoom.getTutorEmail().equalsIgnoreCase(tutorEmail.trim())) {
            throw new ForbiddenException("Bạn không có quyền điểm danh lớp học này");
        }

        validateStrictSessionTimeWindow(session);

        List<SessionAttendance> attendances = sessionAttendanceRepository.findBySessionId(sessionId);
        terminationService.requireCanAttend(session, null);

        LocalDateTime now = LocalDateTime.now();

        for (SessionAttendance att : attendances) {
            att.setTutorChecked(true);
            if (att.getTutorCheckedAt() == null) {
                att.setTutorCheckedAt(now);
            }
            sessionAttendanceRepository.save(att);
        }

        if (session.getStatus() == ClassSessionStatus.SCHEDULED) {
            session.setStatus(ClassSessionStatus.IN_PROGRESS);
            classSessionRepository.save(session);
        }

        log.info("Tutor {} check-in Session #{} ({})", tutorEmail, sessionId, session.getTopic());
        return toSessionResponse(session);
    }

    /**
     * HỆ THỐNG TỰ ĐỘNG CHỐT BUỔI HỌC DỰA TRÊN THỜI GIAN KẾT THÚC THỰC TẾ (endTime).
     */
    @Transactional
    public void autoFinalizePastDueSessions() {
        LocalDate today = LocalDate.now();
        LocalTime now = LocalTime.now();

        List<ClassSession> activeSessions = classSessionRepository.findAll().stream()
                .filter(s -> s.getStatus() == ClassSessionStatus.SCHEDULED || s.getStatus() == ClassSessionStatus.IN_PROGRESS)
                .filter(s -> s.getSessionDate() != null && s.getEndTime() != null)
                .filter(s -> {
                    if (s.getSessionDate().isBefore(today)) return true;
                    if (s.getSessionDate().isEqual(today)) {
                        try {
                            LocalTime endTime = LocalTime.parse(s.getEndTime());
                            return !now.isBefore(endTime);
                        } catch (Exception e) {
                            return false;
                        }
                    }
                    return false;
                })
                .toList();

        if (activeSessions.isEmpty()) {
            return;
        }

        for (ClassSession session : activeSessions) {
            if (terminationService.isWholeClassSessionStopped(session)) {
                continue;
            }
            try {
                List<SessionAttendance> attendances = sessionAttendanceRepository.findBySessionId(session.getId());
                for (SessionAttendance att : attendances) {
                    boolean tutorChecked = Boolean.TRUE.equals(att.getTutorChecked());
                    boolean studentChecked = Boolean.TRUE.equals(att.getStudentChecked());

                    if (tutorChecked && studentChecked) {
                        att.setFinalOutcome(AttendanceOutcome.BOTH_PRESENT);
                    } else if (tutorChecked && !studentChecked) {
                        att.setFinalOutcome(AttendanceOutcome.STUDENT_ABSENT_TUTOR_PRESENT);
                    } else {
                        att.setFinalOutcome(AttendanceOutcome.TUTOR_ABSENT);
                    }
                    sessionAttendanceRepository.save(att);
                }

                session.setStatus(ClassSessionStatus.COMPLETED);
                classSessionRepository.save(session);

                log.info("Auto-finalized Session #{} for ClassRoom #{} after reaching endTime {}. Outcomes resolved.",
                        session.getId(), session.getClassRoom().getId(), session.getEndTime());

                try {
                    rollingSessionService.generateNextBatchIfNeeded(session.getClassRoom().getId());
                } catch (Exception e) {
                    log.warn("Auto rolling generation failed after auto-finalizing session #{}: {}", session.getId(), e.getMessage());
                }
            } catch (Exception e) {
                log.error("Failed to auto-finalize Session #{}: {}", session.getId(), e.getMessage(), e);
            }
        }
    }

    private void validateStrictSessionTimeWindow(ClassSession session) {
        if (session.getStatus() != ClassSessionStatus.SCHEDULED && session.getStatus() != ClassSessionStatus.IN_PROGRESS) {
            throw new BadRequestException("Session has already been finalized or cancelled");
        }

        LocalDate today = LocalDate.now();
        LocalTime now = LocalTime.now();

        if (!session.getSessionDate().isEqual(today)) {
            if (session.getSessionDate().isAfter(today)) {
                throw new BadRequestException(String.format(
                        "Chưa đến ngày học. Buổi học diễn ra vào ngày %s.", session.getSessionDate()));
            } else {
                throw new BadRequestException(String.format(
                        "Buổi học ngày %s đã kết thúc thời gian điểm danh.", session.getSessionDate()));
            }
        }

        LocalTime startTime = LocalTime.parse(session.getStartTime());
        LocalTime endTime = LocalTime.parse(session.getEndTime());

        if (now.isBefore(startTime)) {
            throw new BadRequestException(String.format(
                    "Chưa đến giờ học. Điểm danh chỉ mở trong khung giờ từ %s đến %s.",
                    session.getStartTime(), session.getEndTime()));
        }

        if (!now.isBefore(endTime)) {
            throw new BadRequestException(String.format(
                    "Buổi học đã kết thúc lúc %s. Quá thời gian điểm danh.", session.getEndTime()));
        }
    }

    // -------------------------------------------------------------
    // MULTI-FILE ATTACHMENTS (SESSION LEVEL: MAX 5 ASSIGNMENT FILES)
    // -------------------------------------------------------------

    @Transactional
    public List<ClassSessionDtos.SessionFileItem> uploadAssignmentFiles(Long sessionId, List<MultipartFile> files) {
        ClassSession session = classSessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Buổi học không tồn tại: " + sessionId));
        sessionAccessControl.requireTutor(session.getClassRoom());

        if (files == null || files.isEmpty()) {
            throw new BadRequestException("Danh sách file tải lên không được rỗng");
        }

        long existingCount = sessionFileRepository.countBySession_IdAndFileCategory(sessionId, "ASSIGNMENT");
        if (existingCount + files.size() > 5) {
            throw new BadRequestException(String.format(
                    "Mỗi buổi học chỉ được tải lên tối đa 5 file bài tập (Hiện có %d file, bạn muốn thêm %d file)",
                    existingCount, files.size()));
        }

        Long classId = session.getClassRoom().getId();
        int order = (int) existingCount + 1;

        for (MultipartFile file : files) {
            if (file == null || file.isEmpty()) continue;

            String originalFilename = StringUtils.cleanPath(Objects.requireNonNullElse(file.getOriginalFilename(), "baitap"));
            String cleanName = originalFilename.replaceAll("[^a-zA-Z0-9.-]", "_");
            String uuid = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
            String fileKey = String.format("classes/%d/sessions/%d/assignments/%s_%s", classId, sessionId, uuid, cleanName);

            try {
                fileStorageService.store(fileKey, file.getBytes(), file.getContentType());
            } catch (IOException e) {
                throw new BadRequestException("Không thể đọc file: " + originalFilename);
            }

            SessionFile sf = new SessionFile();
            sf.setSession(session);
            sf.setFileCategory("ASSIGNMENT");
            sf.setFileName(originalFilename);
            sf.setFileKey(fileKey);
            sf.setFileSize(file.getSize());
            sf.setContentType(file.getContentType());
            sf.setFileOrder(order++);
            sessionFileRepository.save(sf);
        }

        return sessionFileRepository.findBySession_IdAndFileCategoryOrderByFileOrderAscCreatedAtAsc(sessionId, "ASSIGNMENT")
                .stream().map(this::toSessionFileItem).toList();
    }

    @Transactional
    public List<ClassSessionDtos.SessionFileItem> uploadMaterialFiles(Long sessionId, List<MultipartFile> files) {
        ClassSession session = classSessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Buổi học không tồn tại: " + sessionId));
        sessionAccessControl.requireTutor(session.getClassRoom());

        if (files == null || files.isEmpty()) {
            throw new BadRequestException("Danh sách file tải lên không được rỗng");
        }

        Long classId = session.getClassRoom().getId();
        int order = (int) sessionFileRepository.countBySession_IdAndFileCategory(sessionId, "MATERIAL") + 1;

        for (MultipartFile file : files) {
            if (file == null || file.isEmpty()) continue;

            String originalFilename = StringUtils.cleanPath(Objects.requireNonNullElse(file.getOriginalFilename(), "slide"));
            String cleanName = originalFilename.replaceAll("[^a-zA-Z0-9.-]", "_");
            String uuid = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
            String fileKey = String.format("classes/%d/sessions/%d/materials/%s_%s", classId, sessionId, uuid, cleanName);

            try {
                fileStorageService.store(fileKey, file.getBytes(), file.getContentType());
            } catch (IOException e) {
                throw new BadRequestException("Không thể đọc file: " + originalFilename);
            }

            SessionFile sf = new SessionFile();
            sf.setSession(session);
            sf.setFileCategory("MATERIAL");
            sf.setFileName(originalFilename);
            sf.setFileKey(fileKey);
            sf.setFileSize(file.getSize());
            sf.setContentType(file.getContentType());
            sf.setFileOrder(order++);
            sessionFileRepository.save(sf);
        }

        return sessionFileRepository.findBySession_IdAndFileCategoryOrderByFileOrderAscCreatedAtAsc(sessionId, "MATERIAL")
                .stream().map(this::toSessionFileItem).toList();
    }

    @Transactional
    public void deleteSessionFile(Long sessionId, Long fileId) {
        ClassSession session = classSessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Buổi học không tồn tại: " + sessionId));
        sessionAccessControl.requireTutor(session.getClassRoom());

        SessionFile sf = sessionFileRepository.findById(fileId)
                .orElseThrow(() -> new ResourceNotFoundException("File không tồn tại: " + fileId));

        if (!Objects.equals(sf.getSession().getId(), sessionId)) {
            throw new BadRequestException("File không thuộc buổi học này");
        }

        sessionFileRepository.delete(sf);
        sessionFileRepository.flush();
        learningStorageCleanupService.deleteObjectAfterCommit(sf.getFileKey());
    }

    /**
     * BẢO MẬT & GATE: Tải file bài tập hoặc slide của buổi học.
     * Gia sư: được tải bất kỳ lúc nào.
     * Học viên: BẮT BUỘC ĐÃ ĐIỂM DANH (studentChecked == true).
     */
    @Transactional(readOnly = true)
    public PresignedDownloadUrlResponse getSessionFileDownloadUrl(Long sessionId, Long fileId) {
        ClassSession session = classSessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Buổi học không tồn tại: " + sessionId));
        ClassRoom room = session.getClassRoom();

        SessionFile sf = sessionFileRepository.findById(fileId)
                .orElseThrow(() -> new ResourceNotFoundException("File không tồn tại: " + fileId));

        if (!Objects.equals(sf.getSession().getId(), sessionId)) {
            throw new BadRequestException("File không thuộc buổi học này");
        }

        Long studentId = sessionAccessControl.currentStudentId();
        if (studentId != null) {
            // Must belong to class and MUST have checked in
            SessionAttendance att = sessionAttendanceRepository.findBySessionIdAndStudentId(sessionId, studentId)
                    .orElseThrow(() -> new ForbiddenException("Bạn không thuộc danh sách học viên của buổi học này"));

            if (!Boolean.TRUE.equals(att.getStudentChecked())) {
                throw new ForbiddenException("Bạn chưa điểm danh buổi học này. Hãy điểm danh khi buổi học diễn ra để mở khóa tài liệu và bài tập.");
            }
        } else {
            sessionAccessControl.requireCanView(room);
        }

        String downloadUrl = fileStorageService.createPresignedGetUrl(sf.getFileKey());
        return new PresignedDownloadUrlResponse(downloadUrl, sf.getFileName(), sf.getContentType());
    }

    // -------------------------------------------------------------
    // STUDENT HOMEWORK SUBMISSION (S3 FILE OR EXTERNAL HTTP(S) LINK)
    // -------------------------------------------------------------

    @Transactional
    public ClassSessionDtos.SessionAttendanceResponse submitHomeworkWithFile(
            Long sessionId,
            Long studentId,
            MultipartFile file,
            String submissionText
    ) {
        return submitHomeworkWithFile(sessionId, studentId, file, submissionText, null);
    }

    @Transactional
    public ClassSessionDtos.SessionAttendanceResponse submitHomeworkWithFile(
            Long sessionId,
            Long studentId,
            MultipartFile file,
            String submissionText,
            String submissionFileUrl
    ) {
        ClassSession session = classSessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Buổi học không tồn tại: " + sessionId));

        sessionAccessControl.requireStudent(session.getClassRoom(), studentId);

        SessionAttendance attendance = sessionAttendanceRepository.findBySessionIdAndStudentId(sessionId, studentId)
                .orElseThrow(() -> new BadRequestException("Bạn không có tên trong danh sách học viên của buổi này"));

        if (!Boolean.TRUE.equals(attendance.getStudentChecked())) {
            throw new ForbiddenException("Bạn phải điểm danh buổi học trước khi nộp bài tập.");
        }

        validateHomeworkCanBeMutated(attendance);
        validateHomeworkSubmissionPolicy(session);

        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Bạn bắt buộc phải tải lên file bài làm (PDF, Word, Ảnh, Zip...).");
        }

        if (StringUtils.hasText(submissionFileUrl) && !isHttpUrl(submissionFileUrl.trim())) {
            throw new BadRequestException("Submission link must start with http:// or https://.");
        }

        Long classId = session.getClassRoom().getId();
        String originalFilename = StringUtils.cleanPath(Objects.requireNonNullElse(file.getOriginalFilename(), "submission"));
        String cleanName = originalFilename.replaceAll("[^a-zA-Z0-9.-]", "_");
        String uuid = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        String fileKey = String.format("classes/%d/sessions/%d/submissions/%d/%s_%s", classId, sessionId, studentId, uuid, cleanName);
        String previousFileKey = attendance.getSubmissionFileKey();

        try {
            fileStorageService.store(fileKey, file.getBytes(), file.getContentType());
        } catch (IOException e) {
            throw new BadRequestException("Không thể đọc nội dung file nộp: " + e.getMessage());
        }

        attendance.setSubmissionFileKey(fileKey);
        attendance.setSubmissionFileName(originalFilename);
        attendance.setSubmissionFileSize(file.getSize());
        attendance.setSubmissionContentType(file.getContentType());
        attendance.setSubmissionText(StringUtils.hasText(submissionText) ? submissionText.trim() : null);
        attendance.setSubmissionFileUrl(StringUtils.hasText(submissionFileUrl) ? submissionFileUrl.trim() : null);
        attendance.setSubmittedAt(LocalDateTime.now());

        SessionAttendance saved = sessionAttendanceRepository.save(attendance);
        if (StringUtils.hasText(previousFileKey) && !previousFileKey.equals(fileKey)) {
            learningStorageCleanupService.deleteObjectAfterCommit(previousFileKey);
        }
        publishHomeworkSubmittedNotification(session, saved);
        log.info("Student #{} submitted homework file [{}] for Session #{}", studentId, originalFilename, sessionId);
        return toAttendanceResponse(saved);
    }

    /** Accepts a text or external http(s) link submission when no uploaded file is selected. */
    @Transactional
    public ClassSessionDtos.SessionAttendanceResponse submitHomework(
            Long sessionId,
            Long studentId,
            ClassSessionDtos.SubmitHomeworkRequest request
    ) {
        ClassSession session = classSessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Buổi học không tồn tại: " + sessionId));

        sessionAccessControl.requireStudent(session.getClassRoom(), studentId);

        SessionAttendance attendance = sessionAttendanceRepository.findBySessionIdAndStudentId(sessionId, studentId)
                .orElseThrow(() -> new BadRequestException("Bạn không có tên trong danh sách học viên của buổi này"));

        if (!Boolean.TRUE.equals(attendance.getStudentChecked())) {
            throw new ForbiddenException("Valid session check-in is required before homework submission");
        }

        validateHomeworkCanBeMutated(attendance);
        validateHomeworkSubmissionPolicy(session);

        String submissionText = request == null ? null : normalizeText(request.submissionText());
        String submissionFileUrl = request == null ? null : normalizeText(request.submissionFileUrl());
        if (!StringUtils.hasText(submissionText) && !StringUtils.hasText(submissionFileUrl)) {
            throw new BadRequestException("Hãy nhập nội dung bài làm, dán link ngoài hoặc tải file lên.");
        }
        if (StringUtils.hasText(submissionFileUrl) && !isHttpUrl(submissionFileUrl)) {
            throw new BadRequestException("Link bài nộp phải bắt đầu bằng http:// hoặc https://.");
        }

        String previousFileKey = attendance.getSubmissionFileKey();
        attendance.setSubmissionText(submissionText);
        attendance.setSubmissionFileUrl(submissionFileUrl);
        attendance.setSubmissionFileKey(null);
        attendance.setSubmissionFileName(null);
        attendance.setSubmissionFileSize(null);
        attendance.setSubmissionContentType(null);
        attendance.setSubmittedAt(LocalDateTime.now());
        SessionAttendance saved = sessionAttendanceRepository.save(attendance);
        learningStorageCleanupService.deleteObjectAfterCommit(previousFileKey);
        publishHomeworkSubmittedNotification(session, saved);

        log.info("Student #{} submitted homework link/text for Session #{}", studentId, sessionId);
        return toAttendanceResponse(saved);
    }

    /**
     * Student removes the current homework submission while the same submit/update window is still open.
     */
    @Transactional
    public ClassSessionDtos.SessionAttendanceResponse deleteHomeworkSubmission(Long sessionId, Long studentId) {
        ClassSession session = classSessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Buổi học không tồn tại: " + sessionId));

        sessionAccessControl.requireStudent(session.getClassRoom(), studentId);

        SessionAttendance attendance = sessionAttendanceRepository.findBySessionIdAndStudentId(sessionId, studentId)
                .orElseThrow(() -> new BadRequestException("Bạn không có tên trong danh sách học viên của buổi này"));

        if (!Boolean.TRUE.equals(attendance.getStudentChecked())) {
            throw new ForbiddenException("Bạn phải điểm danh buổi học trước khi gỡ bài nộp.");
        }
        if (attendance.getGradedAt() != null || StringUtils.hasText(attendance.getGradeScore())) {
            throw new BadRequestException("Bài đã được gia sư chấm điểm nên không thể gỡ hoặc cập nhật bài nộp.");
        }

        validateHomeworkSubmissionPolicy(session);

        String previousFileKey = attendance.getSubmissionFileKey();
        clearHomeworkSubmission(attendance);
        SessionAttendance saved = sessionAttendanceRepository.save(attendance);
        learningStorageCleanupService.deleteObjectAfterCommit(previousFileKey);

        log.info("Student #{} removed homework submission for Session #{}", studentId, sessionId);
        return toAttendanceResponse(saved);
    }

    /**
     * Tải bài làm của học viên (Gia sư chấm bài hoặc chính học viên sở hữu bài nộp).
     */
    @Transactional(readOnly = true)
    public PresignedDownloadUrlResponse getSubmissionDownloadUrl(Long sessionId, Long attendanceId) {
        SessionAttendance att = sessionAttendanceRepository.findById(attendanceId)
                .orElseThrow(() -> new ResourceNotFoundException("Bản ghi bài nộp không tồn tại: " + attendanceId));

        if (!Objects.equals(att.getSession().getId(), sessionId)) {
            throw new BadRequestException("Bản ghi không thuộc buổi học này");
        }

        ClassRoom room = att.getSession().getClassRoom();
        Long studentId = sessionAccessControl.currentStudentId();

        if (studentId != null) {
            // Student must be the owner
            if (!Objects.equals(att.getStudentId(), studentId)) {
                throw new ForbiddenException("Bạn không có quyền tải bài làm của học viên khác");
            }
        } else {
            // Tutor must be the tutor of the class
            sessionAccessControl.requireTutor(room);
        }

        if (!StringUtils.hasText(att.getSubmissionFileKey())) {
            throw new ResourceNotFoundException("Học viên này chưa nộp file bài làm trên hệ thống");
        }

        String downloadUrl = fileStorageService.createPresignedGetUrl(att.getSubmissionFileKey());
        return new PresignedDownloadUrlResponse(downloadUrl, att.getSubmissionFileName(), att.getSubmissionContentType());
    }

    /**
     * Gia sư chấm điểm và nhận xét bài tập của học viên trong buổi học.
     */
    @Transactional
    public ClassSessionDtos.SessionAttendanceResponse gradeHomework(
            Long sessionId,
            Long attendanceId,
            String tutorEmail,
            ClassSessionDtos.GradeHomeworkRequest request
    ) {
        ClassSession session = classSessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Buổi học không tồn tại: " + sessionId));

        ClassRoom classRoom = session.getClassRoom();
        sessionAccessControl.requireTutor(classRoom);
        if (tutorEmail != null && !classRoom.getTutorEmail().equalsIgnoreCase(tutorEmail.trim())) {
            throw new ForbiddenException("Bạn không có quyền chấm bài cho lớp học này");
        }

        SessionAttendance attendance = sessionAttendanceRepository.findById(attendanceId)
                .orElseThrow(() -> new ResourceNotFoundException("Bản ghi điểm danh không tồn tại: " + attendanceId));

        if (!attendance.getSession().getId().equals(sessionId)) {
            throw new BadRequestException("Bản ghi điểm danh không thuộc buổi học này");
        }

        if (request == null) {
            throw new BadRequestException("Du lieu cham bai khong hop le.");
        }
        if (attendance.getSubmittedAt() == null
                && !StringUtils.hasText(attendance.getSubmissionText())
                && !StringUtils.hasText(attendance.getSubmissionFileUrl())
                && !StringUtils.hasText(attendance.getSubmissionFileKey())) {
            throw new BadRequestException("Hoc vien chua nop bai nen chua the cham diem.");
        }

        String gradeScore = normalizeGradeScore(request.gradeScore());
        String tutorFeedback = normalizeTutorFeedback(request.tutorFeedback());
        attendance.setGradeScore(gradeScore);
        attendance.setTutorFeedback(tutorFeedback);
        attendance.setGradedAt(LocalDateTime.now());
        attendance.setGradedByTutorEmail(tutorEmail != null ? tutorEmail.trim() : null);

        SessionAttendance saved = sessionAttendanceRepository.save(attendance);
        publishHomeworkGradedNotification(session, saved);
        log.info("Tutor {} graded attendance #{} for session #{}: score={}", tutorEmail, attendanceId, sessionId, attendance.getGradeScore());
        return toAttendanceResponse(saved);
    }

    // -------------------------------------------------------------
    // SYLLABUS / LỘ TRÌNH MÔN HỌC (FILE UPLOAD TO S3)
    // -------------------------------------------------------------

    @Transactional
    public void uploadSyllabusFile(Long classId, MultipartFile file) {
        ClassRoom room = classRoomRepository.findById(classId)
                .orElseThrow(() -> new ResourceNotFoundException("Lớp học không tồn tại: " + classId));
        sessionAccessControl.requireTutor(room);

        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Bạn bắt buộc phải chọn file lộ trình môn học.");
        }

        String originalFilename = StringUtils.cleanPath(Objects.requireNonNullElse(file.getOriginalFilename(), "lotrinh"));
        String cleanName = originalFilename.replaceAll("[^a-zA-Z0-9.-]", "_");
        String uuid = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        String fileKey = String.format("classes/%d/syllabus/%s_%s", classId, uuid, cleanName);

        try {
            fileStorageService.store(fileKey, file.getBytes(), file.getContentType());
        } catch (IOException e) {
            throw new BadRequestException("Không thể đọc file lộ trình: " + e.getMessage());
        }

        String previousFileKey = room.getSyllabusFileKey();
        room.setSyllabusFileKey(fileKey);
        room.setSyllabusFileName(originalFilename);
        room.setSyllabusFileSize(file.getSize());
        room.setSyllabusContentType(file.getContentType());
        if (room.getSyllabusMode() == SyllabusMode.FORM) {
            room.setSyllabusMode(SyllabusMode.BOTH);
        } else {
            room.setSyllabusMode(SyllabusMode.FILE);
        }
        classRoomRepository.save(room);
        learningStorageCleanupService.deleteObjectAfterCommit(previousFileKey);
        log.info("Uploaded syllabus file [{}] for ClassRoom #{}", originalFilename, classId);
    }

    @Transactional(readOnly = true)
    public PresignedDownloadUrlResponse getSyllabusDownloadUrl(Long classId) {
        ClassRoom room = classRoomRepository.findById(classId)
                .orElseThrow(() -> new ResourceNotFoundException("Lớp học không tồn tại: " + classId));
        sessionAccessControl.requireCanView(room);

        if (!StringUtils.hasText(room.getSyllabusFileKey())) {
            throw new ResourceNotFoundException("Lớp học chưa có file lộ trình đính kèm");
        }

        String downloadUrl = fileStorageService.createPresignedGetUrl(room.getSyllabusFileKey());
        return new PresignedDownloadUrlResponse(downloadUrl, room.getSyllabusFileName(), room.getSyllabusContentType());
    }

    private String normalizeText(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private String normalizeGradeScore(String value) {
        if (!StringUtils.hasText(value)) {
            throw new BadRequestException("Vui long nhap diem hoac danh gia Dat/Chua dat.");
        }
        String trimmed = value.trim();
        if (trimmed.length() > 50) {
            throw new BadRequestException("Diem/danh gia khong duoc vuot qua 50 ky tu.");
        }

        String normalizedLabel = trimmed
                .toLowerCase(Locale.ROOT)
                .replace('đ', 'd')
                .replaceAll("\\s+", " ");
        if ("dat".equals(normalizedLabel) || "chua dat".equals(normalizedLabel)
                || "pass".equals(normalizedLabel) || "fail".equals(normalizedLabel)) {
            return trimmed;
        }

        try {
            double score = Double.parseDouble(trimmed.replace(',', '.'));
            if (score < 0 || score > 10) {
                throw new BadRequestException("Diem so phai nam trong khoang 0 den 10.");
            }
            return trimmed;
        } catch (NumberFormatException ex) {
            throw new BadRequestException("Diem khong hop le. Hay nhap so tu 0 den 10 hoac Dat/Chua dat.");
        }
    }

    private String normalizeTutorFeedback(String value) {
        if (!StringUtils.hasText(value)) {
            throw new BadRequestException("Vui long nhap nhan xet cho hoc vien.");
        }
        String trimmed = value.trim();
        if (trimmed.length() > 4000) {
            throw new BadRequestException("Nhan xet khong duoc vuot qua 4000 ky tu.");
        }
        return trimmed;
    }

    private void publishHomeworkSubmittedNotification(ClassSession session, SessionAttendance attendance) {
        ClassRoom room = session.getClassRoom();
        learningEventPublisher.publishHomeworkSubmitted(
                room.getId(),
                session.getId(),
                attendance.getId(),
                attendance.getTutorId(),
                attendance.getStudentId(),
                room.getName(),
                session.getTopic(),
                session.getSequenceNumber(),
                attendance.getStudentName()
        );
    }

    private void publishHomeworkGradedNotification(ClassSession session, SessionAttendance attendance) {
        ClassRoom room = session.getClassRoom();
        learningEventPublisher.publishHomeworkGraded(
                room.getId(),
                session.getId(),
                attendance.getId(),
                attendance.getStudentId(),
                attendance.getTutorId(),
                room.getName(),
                session.getTopic(),
                session.getSequenceNumber(),
                attendance.getStudentName(),
                attendance.getGradeScore()
        );
    }

    private void validateHomeworkSubmissionPolicy(ClassSession session) {
        if (!session.isSubmissionRequired()) {
            throw new BadRequestException("Buoi hoc nay chi giao bai tap de luyen tap, khong yeu cau nop bai.");
        }
        if (session.getAssignmentDueAt() != null
                && LocalDateTime.now().isAfter(session.getAssignmentDueAt())
                && !session.isLateSubmissionAllowed()) {
            throw new BadRequestException("Da qua han nop bai va gia su khong cho phep nop tre.");
        }
    }

    private void validateHomeworkCanBeMutated(SessionAttendance attendance) {
        if (attendance.getGradedAt() != null || StringUtils.hasText(attendance.getGradeScore())) {
            throw new BadRequestException("Bai da duoc gia su cham diem nen khong the go hoac cap nhat bai nop.");
        }
    }

    private void clearHomeworkSubmission(SessionAttendance attendance) {
        attendance.setSubmissionText(null);
        attendance.setSubmissionFileUrl(null);
        attendance.setSubmissionFileKey(null);
        attendance.setSubmissionFileName(null);
        attendance.setSubmissionFileSize(null);
        attendance.setSubmissionContentType(null);
        attendance.setSubmittedAt(null);
    }

    private boolean isHttpUrl(String value) {
        try {
            String scheme = new URI(value).getScheme();
            return "http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme);
        } catch (URISyntaxException ex) {
            return false;
        }
    }

    // -------------------------------------------------------------
    // OVERVIEWS
    // -------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<ClassSessionDtos.TutorHomeworkItemResponse> getTutorHomeworkOverview(String tutorEmail) {
        if (tutorEmail == null || tutorEmail.isBlank()) {
            throw new ForbiddenException("Yêu cầu xác thực tài khoản gia sư");
        }
        sessionAccessControl.requireCurrentTutor(tutorEmail);

        List<ClassRoom> tutorClasses = classRoomRepository.findByTutorEmailWithDetails(tutorEmail.trim());
        if (tutorClasses.isEmpty()) {
            return List.of();
        }

        List<Long> classIds = tutorClasses.stream().map(ClassRoom::getId).toList();
        Map<Long, ClassRoom> classMap = tutorClasses.stream().collect(Collectors.toMap(ClassRoom::getId, c -> c));

        List<ClassSession> sessions = classSessionRepository.findByClassRoomIdInOrderBySessionDateAscStartTimeAsc(classIds);
        sessions = sessions.stream()
                .sorted(Comparator.comparing(ClassSession::getSessionDate, Comparator.nullsLast(Comparator.reverseOrder()))
                        .thenComparing(ClassSession::getStartTime, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();

        return sessions.stream().map(session -> {
            ClassRoom room = classMap.get(session.getClassRoom().getId());
            String classTitle = room != null ? room.getName() : "Lớp học #" + session.getClassRoom().getId();

            List<SessionAttendance> attendances = sessionAttendanceRepository.findBySessionId(session.getId());
            int totalStudents = attendances.size();
            int submittedCount = (int) attendances.stream()
                    .filter(a -> a.getSubmittedAt() != null
                            || StringUtils.hasText(a.getSubmissionFileKey())
                            || (a.getSubmissionText() != null && !a.getSubmissionText().isBlank())
                            || (a.getSubmissionFileUrl() != null && !a.getSubmissionFileUrl().isBlank()))
                    .count();
            int gradedCount = (int) attendances.stream()
                    .filter(a -> a.getGradedAt() != null || (a.getGradeScore() != null && !a.getGradeScore().isBlank()))
                    .count();

            List<ClassSessionDtos.SessionAttendanceResponse> attendanceResponses = attendances.stream()
                    .map(this::toAttendanceResponse)
                    .toList();

            List<SessionFile> sessionFiles = sessionFileRepository.findBySession_IdOrderByFileOrderAscCreatedAtAsc(session.getId());
            List<ClassSessionDtos.SessionFileItem> assignmentFiles = sessionFiles.stream()
                    .filter(f -> "ASSIGNMENT".equalsIgnoreCase(f.getFileCategory()))
                    .map(this::toSessionFileItem).toList();
            List<ClassSessionDtos.SessionFileItem> materialFiles = sessionFiles.stream()
                    .filter(f -> "MATERIAL".equalsIgnoreCase(f.getFileCategory()))
                    .map(this::toSessionFileItem).toList();

            return new ClassSessionDtos.TutorHomeworkItemResponse(
                    session.getId(),
                    session.getClassRoom().getId(),
                    classTitle,
                    session.getSequenceNumber(),
                    session.getTopic(),
                    session.getSessionDate(),
                    session.getStartTime(),
                    session.getEndTime(),
                    session.getAssignmentTitle(),
                    session.getAssignmentDescription(),
                    session.getAssignmentFileUrl(),
                    session.getAssignmentDueAt(),
                    session.isSubmissionRequired(),
                    session.isLateSubmissionAllowed(),
                    session.getMaterialUrl(),
                    session.getMaterialDescription(),
                    totalStudents,
                    submittedCount,
                    gradedCount,
                    attendanceResponses,
                    assignmentFiles,
                    materialFiles,
                    session.getAssignmentExternalUrl(),
                    session.getMaterialExternalUrl()
            );
        }).toList();
    }

    @Transactional(readOnly = true)
    public List<ClassSessionDtos.StudentHomeworkItemResponse> getStudentHomeworkOverview(Long studentId) {
        if (studentId == null) {
            throw new ForbiddenException("Yêu cầu xác thực tài khoản học viên");
        }
        sessionAccessControl.requireCurrentStudent(studentId);

        List<SessionAttendance> attendances = sessionAttendanceRepository.findByStudentId(studentId);
        if (attendances.isEmpty()) {
            return List.of();
        }

        LocalDateTime now = LocalDateTime.now();
        record AttendanceWithFiles(SessionAttendance attendance, List<SessionFile> files) {}

        return attendances.stream()
                .map(att -> {
                    ClassSession session = att.getSession();
                    List<SessionFile> sessionFiles = session != null
                            ? sessionFileRepository.findBySession_IdOrderByFileOrderAscCreatedAtAsc(session.getId())
                            : List.<SessionFile>of();
                    return new AttendanceWithFiles(att, sessionFiles);
                })
                .filter(item -> {
                    SessionAttendance att = item.attendance();
                    ClassSession session = att.getSession();
                    if (session == null) return false;
                    boolean hasSubmitted = att.getSubmittedAt() != null
                            || StringUtils.hasText(att.getSubmissionFileKey())
                            || (att.getSubmissionText() != null && !att.getSubmissionText().isBlank())
                            || (att.getSubmissionFileUrl() != null && !att.getSubmissionFileUrl().isBlank());
                    boolean hasAssignmentTitle = StringUtils.hasText(session.getAssignmentTitle());
                    boolean hasAssignmentDesc = StringUtils.hasText(session.getAssignmentDescription());
                    boolean hasAssignmentFile = StringUtils.hasText(session.getAssignmentFileUrl()) || StringUtils.hasText(session.getAssignmentExternalUrl());
                    boolean hasMaterial = StringUtils.hasText(session.getMaterialUrl()) || StringUtils.hasText(session.getMaterialExternalUrl()) || StringUtils.hasText(session.getMaterialDescription());
                    boolean hasFiles = !item.files().isEmpty();
                    return hasAssignmentTitle || hasAssignmentDesc || hasAssignmentFile || hasMaterial || hasFiles || hasSubmitted;
                })
                .sorted(Comparator.comparing((AttendanceWithFiles item) -> item.attendance().getSession().getSessionDate(), Comparator.nullsLast(Comparator.reverseOrder()))
                        .thenComparing(item -> item.attendance().getSession().getStartTime(), Comparator.nullsLast(Comparator.reverseOrder())))
                .map(item -> {
                    SessionAttendance att = item.attendance();
                    List<SessionFile> sessionFiles = item.files();
                    ClassSession session = att.getSession();
                    ClassRoom room = session.getClassRoom();
                    String classTitle = room != null ? room.getName() : "Lớp học #" + session.getClassRoom().getId();
                    String tutorName = room != null ? (room.getTutorFullName() != null ? room.getTutorFullName() : room.getTutorEmail()) : null;

                    boolean checkedIn = Boolean.TRUE.equals(att.getStudentChecked());
                    boolean hasSubmitted = att.getSubmittedAt() != null
                            || StringUtils.hasText(att.getSubmissionFileKey())
                            || (att.getSubmissionText() != null && !att.getSubmissionText().isBlank())
                            || (att.getSubmissionFileUrl() != null && !att.getSubmissionFileUrl().isBlank());
                    boolean hasGraded = att.getGradedAt() != null
                            || (att.getGradeScore() != null && !att.getGradeScore().isBlank());
                    boolean isLateSubmission = att.getSubmittedAt() != null
                            && session.getAssignmentDueAt() != null
                            && att.getSubmittedAt().isAfter(session.getAssignmentDueAt());
                    boolean isOverdue = session.getAssignmentDueAt() != null && now.isAfter(session.getAssignmentDueAt());
                    boolean submissionBlockedByDeadline = isOverdue && !session.isLateSubmissionAllowed();

                    String status;
                    if (!checkedIn) {
                        status = "LOCKED";
                    } else if (hasGraded) {
                        status = "GRADED";
                    } else if (hasSubmitted && isLateSubmission) {
                        status = "LATE_SUBMITTED";
                    } else if (hasSubmitted) {
                        status = "SUBMITTED";
                    } else if (!session.isSubmissionRequired()) {
                        status = "NO_SUBMISSION_REQUIRED";
                    } else if (submissionBlockedByDeadline) {
                        status = "CLOSED";
                    } else if (isOverdue) {
                        status = "OVERDUE";
                    } else {
                        status = "TODO";
                    }

                    List<ClassSessionDtos.SessionFileItem> assignmentFiles = checkedIn ? sessionFiles.stream()
                            .filter(f -> "ASSIGNMENT".equalsIgnoreCase(f.getFileCategory()))
                            .map(this::toSessionFileItem).toList() : List.of();
                    List<ClassSessionDtos.SessionFileItem> materialFiles = checkedIn ? sessionFiles.stream()
                            .filter(f -> "MATERIAL".equalsIgnoreCase(f.getFileCategory()))
                            .map(this::toSessionFileItem).toList() : List.of();

                    return new ClassSessionDtos.StudentHomeworkItemResponse(
                            session.getId(),
                            att.getId(),
                            room.getId(),
                            classTitle,
                            tutorName,
                            session.getSequenceNumber(),
                            session.getTopic(),
                            session.getSessionDate(),
                            session.getStartTime(),
                            session.getEndTime(),
                            session.getAssignmentTitle(),
                            checkedIn ? session.getAssignmentDescription() : null,
                            checkedIn ? session.getAssignmentFileUrl() : null,
                            checkedIn ? session.getAssignmentDueAt() : null,
                            checkedIn ? session.isSubmissionRequired() : null,
                            checkedIn ? session.isLateSubmissionAllowed() : null,
                            checkedIn ? session.getMaterialUrl() : null,
                            checkedIn ? session.getMaterialDescription() : null,
                            checkedIn,
                            att.getSubmissionText(),
                            att.getSubmissionFileUrl(),
                            att.getSubmittedAt(),
                            att.getGradeScore(),
                            att.getTutorFeedback(),
                            att.getGradedAt(),
                            status,
                            assignmentFiles,
                            materialFiles,
                            checkedIn ? session.getAssignmentExternalUrl() : null,
                            checkedIn ? session.getMaterialExternalUrl() : null,
                            att.getSubmissionFileName(),
                            att.getSubmissionFileSize(),
                            isLateSubmission,
                            submissionBlockedByDeadline
                    );
                }).toList();
    }

    // -------------------------------------------------------------
    // RESPONSE MAPPING HELPERS
    // -------------------------------------------------------------

    private ClassSessionDtos.ClassSessionResponse toSessionResponse(ClassSession session) {
        return toSessionResponse(session, sessionAccessControl.currentStudentId());
    }

    private ClassSessionDtos.ClassSessionResponse toSessionResponse(ClassSession session, Long studentId) {
        List<SessionAttendance> attendances = (session.getAttendances() != null && !session.getAttendances().isEmpty())
                ? session.getAttendances() : sessionAttendanceRepository.findBySessionId(session.getId());

        int total = attendances.size();
        int present = (int) attendances.stream()
                .filter(a -> Boolean.TRUE.equals(a.getStudentChecked()) || a.getFinalOutcome() == AttendanceOutcome.BOTH_PRESENT)
                .count();

        Boolean myCheckedIn = null;
        Long myAttendanceId = null;
        String mySubmissionText = null;
        String mySubmissionFileUrl = null;
        LocalDateTime mySubmittedAt = null;
        String myGradeScore = null;
        String myTutorFeedback = null;
        LocalDateTime myGradedAt = null;
        AttendanceOutcome myFinalOutcome = null;
        String mySubmissionFileName = null;
        Long mySubmissionFileSize = null;

        if (studentId != null) {
            SessionAttendance myAtt = attendances.stream()
                    .filter(a -> a.getStudentId().equals(studentId))
                    .findFirst()
                    .orElse(null);
            if (myAtt != null) {
                myAttendanceId = myAtt.getId();
                myCheckedIn = Boolean.TRUE.equals(myAtt.getStudentChecked());
                mySubmissionText = myAtt.getSubmissionText();
                mySubmissionFileUrl = myAtt.getSubmissionFileUrl();
                mySubmittedAt = myAtt.getSubmittedAt();
                myGradeScore = myAtt.getGradeScore();
                myTutorFeedback = myAtt.getTutorFeedback();
                myGradedAt = myAtt.getGradedAt();
                myFinalOutcome = myAtt.getFinalOutcome();
                mySubmissionFileName = myAtt.getSubmissionFileName();
                mySubmissionFileSize = myAtt.getSubmissionFileSize();
            }
        }

        boolean tutorCheckedIn = attendances.stream().anyMatch(a -> Boolean.TRUE.equals(a.getTutorChecked()));
        if (studentId == null) {
            myCheckedIn = tutorCheckedIn;
        }
        int bothPresentCount = (int) attendances.stream()
                .filter(a -> a.getFinalOutcome() == AttendanceOutcome.BOTH_PRESENT)
                .count();
        int studentAbsentCount = (int) attendances.stream()
                .filter(a -> a.getFinalOutcome() == AttendanceOutcome.STUDENT_ABSENT_TUTOR_PRESENT)
                .count();
        int tutorAbsentCount = (int) attendances.stream()
                .filter(a -> a.getFinalOutcome() == AttendanceOutcome.TUTOR_ABSENT)
                .count();

        boolean canAccessMaterialsAndHomework = (studentId == null) || Boolean.TRUE.equals(myCheckedIn);

        List<SessionFile> sessionFiles = (session.getSessionFiles() != null && !session.getSessionFiles().isEmpty())
                ? session.getSessionFiles() : sessionFileRepository.findBySession_IdOrderByFileOrderAscCreatedAtAsc(session.getId());

        List<ClassSessionDtos.SessionFileItem> assignmentFiles = canAccessMaterialsAndHomework
                ? sessionFiles.stream().filter(f -> "ASSIGNMENT".equalsIgnoreCase(f.getFileCategory())).map(this::toSessionFileItem).toList()
                : List.of();

        List<ClassSessionDtos.SessionFileItem> materialFiles = canAccessMaterialsAndHomework
                ? sessionFiles.stream().filter(f -> "MATERIAL".equalsIgnoreCase(f.getFileCategory())).map(this::toSessionFileItem).toList()
                : List.of();

        return new ClassSessionDtos.ClassSessionResponse(
                session.getId(),
                session.getClassRoom().getId(),
                session.getSequenceNumber(),
                session.getTopic(),
                session.getSessionDate(),
                session.getStartTime(),
                session.getEndTime(),
                session.getAssignmentTitle(),
                canAccessMaterialsAndHomework ? session.getAssignmentDescription() : null,
                canAccessMaterialsAndHomework ? session.getAssignmentFileUrl() : null,
                canAccessMaterialsAndHomework ? session.getAssignmentDueAt() : null,
                canAccessMaterialsAndHomework ? session.isSubmissionRequired() : null,
                canAccessMaterialsAndHomework ? session.isLateSubmissionAllowed() : null,
                canAccessMaterialsAndHomework ? session.getMaterialUrl() : null,
                canAccessMaterialsAndHomework ? session.getMaterialDescription() : null,
                session.getStatus(),
                session.getCreatedAt(),
                session.getUpdatedAt(),
                total,
                present,
                myAttendanceId,
                myCheckedIn,
                mySubmissionText,
                mySubmissionFileUrl,
                mySubmittedAt,
                myGradeScore,
                myTutorFeedback,
                myGradedAt,
                tutorCheckedIn,
                myFinalOutcome,
                bothPresentCount,
                studentAbsentCount,
                tutorAbsentCount,
                session.isSettlementDispatched(),
                assignmentFiles,
                materialFiles,
                session.getAssignmentExternalUrl(),
                session.getMaterialExternalUrl(),
                mySubmissionFileName,
                mySubmissionFileSize
        );
    }

    private ClassSessionDtos.SessionFileItem toSessionFileItem(SessionFile sf) {
        return new ClassSessionDtos.SessionFileItem(
                sf.getId(),
                sf.getSession().getId(),
                sf.getFileCategory(),
                sf.getFileName(),
                sf.getFileSize(),
                sf.getContentType(),
                sf.getFileOrder(),
                sf.getCreatedAt()
        );
    }

    private ClassSessionDtos.SessionAttendanceResponse toAttendanceResponse(SessionAttendance att) {
        return toAttendanceResponse(att, null);
    }

    private ClassSessionDtos.SessionAttendanceResponse toAttendanceResponse(
            SessionAttendance att,
            EnrollmentRequestStatus enrollmentStatus
    ) {
        LocalDateTime assignmentDueAt = att.getSession() != null ? att.getSession().getAssignmentDueAt() : null;
        Boolean isLate = null;
        if (att.getSubmittedAt() != null && assignmentDueAt != null) {
            isLate = att.getSubmittedAt().isAfter(assignmentDueAt);
        }

        return new ClassSessionDtos.SessionAttendanceResponse(
                att.getId(),
                att.getSession().getId(),
                att.getStudentId(),
                att.getStudentName(),
                att.getStudentEmail(),
                att.getTutorId(),
                att.getTutorChecked(),
                att.getTutorCheckedAt(),
                att.getStudentChecked(),
                att.getStudentCheckedAt(),
                att.getFinalOutcome(),
                att.getSubmissionText(),
                att.getSubmissionFileUrl(),
                att.getSubmittedAt(),
                att.getGradeScore(),
                att.getTutorFeedback(),
                att.getGradedAt(),
                att.getGradedByTutorEmail(),
                isLate,
                enrollmentStatus,
                enrollmentStatus == EnrollmentRequestStatus.CANCELLED,
                att.getSubmissionFileName(),
                att.getSubmissionFileSize()
        );
    }
}
