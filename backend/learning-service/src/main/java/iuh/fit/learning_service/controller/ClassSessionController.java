package iuh.fit.learning_service.controller;

import iuh.fit.learning_service.dto.ClassSessionDtos;
import iuh.fit.learning_service.dto.ClassSessionDtos.*;
import iuh.fit.learning_service.dto.ClassroomMaterialDtos.PresignedDownloadUrlResponse;
import iuh.fit.learning_service.service.SessionAttendanceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@PreAuthorize("isAuthenticated()")
@RequiredArgsConstructor
public class ClassSessionController {

    private final SessionAttendanceService sessionAttendanceService;

    /**
     * Lấy danh sách các buổi học của một lớp học (Học viên & Gia sư đều xem được).
     */
    @GetMapping({"/classes/{classId}/sessions", "/public/classes/{classId}/sessions", "/learning/classes/{classId}/sessions", "/v1/classes/{classId}/sessions"})
    public ResponseEntity<List<ClassSessionResponse>> getSessionsByClassRoomId(@PathVariable Long classId) {
        List<ClassSessionResponse> sessions = sessionAttendanceService.getSessionsByClassRoomId(classId);
        return ResponseEntity.ok(sessions);
    }

    /**
     * Gia sư chủ động bấm mở 3 buổi học của tuần đầu tiên nếu muốn soạn bài tập trước.
     */
    @PostMapping({"/classes/{classId}/generate-initial-sessions", "/learning/classes/{classId}/generate-initial-sessions", "/v1/classes/{classId}/generate-initial-sessions"})
    public ResponseEntity<List<ClassSessionResponse>> generateInitialSessions(@PathVariable Long classId) {
        List<ClassSessionResponse> sessions = sessionAttendanceService.generateInitialWeekSessions(classId);
        return ResponseEntity.ok(sessions);
    }

    /**
     * Lấy chi tiết một buổi học.
     */
    @GetMapping({"/sessions/{sessionId}", "/public/sessions/{sessionId}", "/learning/sessions/{sessionId}"})
    public ResponseEntity<ClassSessionResponse> getSessionById(@PathVariable Long sessionId) {
        ClassSessionResponse response = sessionAttendanceService.getSessionById(sessionId);
        return ResponseEntity.ok(response);
    }

    /**
     * Gia sư cập nhật Link phòng học cố định cho toàn bộ Lớp học.
     */
    @PutMapping("/classes/{classId}/meeting-link")
    public ResponseEntity<Void> updateClassMeetingLink(
            Authentication authentication,
            @PathVariable Long classId,
            @Valid @RequestBody UpdateClassMeetingLinkRequest request
    ) {
        sessionAttendanceService.updateClassMeetingLink(classId, authentication != null ? authentication.getName() : null, request.meetingLink());
        return ResponseEntity.ok().build();
    }

    /**
     * Gia sư cập nhật chủ đề, bài tập hoặc thông tin phụ cho buổi học.
     */
    @PutMapping("/sessions/{sessionId}/details")
    public ResponseEntity<ClassSessionResponse> updateSessionDetails(
            Authentication authentication,
            @PathVariable Long sessionId,
            @Valid @RequestBody UpdateSessionDetailsRequest request
    ) {
        ClassSessionResponse response = sessionAttendanceService.updateSessionDetails(sessionId, authentication != null ? authentication.getName() : null, request);
        return ResponseEntity.ok(response);
    }

    /**
     * Gia sư tải lên file bài tập cho buổi học (tối đa 5 file, lưu S3).
     */
    @PostMapping(value = "/sessions/{sessionId}/assignment-files", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<List<SessionFileItem>> uploadAssignmentFiles(
            @PathVariable Long sessionId,
            @RequestParam("files") List<MultipartFile> files
    ) {
        List<SessionFileItem> result = sessionAttendanceService.uploadAssignmentFiles(sessionId, files);
        return ResponseEntity.ok(result);
    }

    /**
     * Gia sư tải lên slide / bài giảng cho buổi học (lưu S3).
     */
    @PostMapping(value = "/sessions/{sessionId}/material-files", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<List<SessionFileItem>> uploadMaterialFiles(
            @PathVariable Long sessionId,
            @RequestParam("files") List<MultipartFile> files
    ) {
        List<SessionFileItem> result = sessionAttendanceService.uploadMaterialFiles(sessionId, files);
        return ResponseEntity.ok(result);
    }

    /**
     * Gia sư xóa 1 file bài tập hoặc slide của buổi học.
     */
    @DeleteMapping("/sessions/{sessionId}/files/{fileId}")
    public ResponseEntity<Void> deleteSessionFile(
            @PathVariable Long sessionId,
            @PathVariable Long fileId
    ) {
        sessionAttendanceService.deleteSessionFile(sessionId, fileId);
        return ResponseEntity.noContent().build();
    }

    /**
     * BẢO MẬT & GATE: Lấy link presigned để tải file bài tập hoặc slide của buổi học.
     * Gia sư: Tải được mọi lúc.
     * Học viên: BẮT BUỘC ĐÃ ĐIỂM DANH (studentChecked == true). Nếu chưa điểm danh trả 403 Forbidden.
     */
    @GetMapping("/sessions/{sessionId}/files/{fileId}/download-url")
    public ResponseEntity<PresignedDownloadUrlResponse> getSessionFileDownloadUrl(
            @PathVariable Long sessionId,
            @PathVariable Long fileId
    ) {
        PresignedDownloadUrlResponse response = sessionAttendanceService.getSessionFileDownloadUrl(sessionId, fileId);
        return ResponseEntity.ok(response);
    }

    /**
     * Gia sư lấy danh sách điểm danh chi tiết của toàn bộ học viên trong buổi học.
     */
    @GetMapping("/sessions/{sessionId}/attendances")
    public ResponseEntity<List<SessionAttendanceResponse>> getAttendancesBySessionId(
            Authentication authentication,
            @PathVariable Long sessionId
    ) {
        List<SessionAttendanceResponse> attendances = sessionAttendanceService.getAttendancesBySessionId(sessionId, authentication != null ? authentication.getName() : null);
        return ResponseEntity.ok(attendances);
    }

    /**
     * Học viên bấm Check-in điểm danh vào học trong đúng khung giờ học [start_time, end_time].
     */
    @PostMapping("/sessions/{sessionId}/student-checkin")
    public ResponseEntity<SessionAttendanceResponse> studentCheckIn(
            Authentication authentication,
            @PathVariable Long sessionId
    ) {
        Long studentId = extractStudentId(authentication);
        SessionAttendanceResponse response = sessionAttendanceService.studentCheckIn(sessionId, studentId);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/sessions/{sessionId}/student-meeting-link")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<Map<String, String>> getStudentMeetingLink(
            Authentication authentication,
            @PathVariable Long sessionId
    ) {
        Long studentId = extractStudentId(authentication);
        String meetingLink = sessionAttendanceService.getMeetingLinkAfterStudentCheckIn(sessionId, studentId);
        return ResponseEntity.ok().header("Cache-Control", "no-store")
                .body(Map.of("meetingLink", meetingLink));
    }

    /**
     * Gia sư bấm Điểm danh vào dạy bất kỳ lúc nào trong khung giờ học [start_time, end_time].
     */
    @PostMapping("/sessions/{sessionId}/tutor-attendance")
    public ResponseEntity<ClassSessionResponse> tutorCheckIn(
            Authentication authentication,
            @PathVariable Long sessionId,
            @RequestBody(required = false) TutorAttendanceRequest request
    ) {
        ClassSessionResponse response = sessionAttendanceService.tutorCheckIn(sessionId, authentication != null ? authentication.getName() : null, request);
        return ResponseEntity.ok(response);
    }

    /**
     * Học viên nộp bài tập về nhà BẮT BUỘC ĐÍNH KÈM FILE LÊN S3.
     */
    @PostMapping(value = "/sessions/{sessionId}/homework-submission-file", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<SessionAttendanceResponse> submitHomeworkWithFile(
            Authentication authentication,
            @PathVariable Long sessionId,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "submissionText", required = false) String submissionText,
            @RequestParam(value = "submissionFileUrl", required = false) String submissionFileUrl
    ) {
        Long studentId = extractStudentId(authentication);
        SessionAttendanceResponse response = sessionAttendanceService.submitHomeworkWithFile(
                sessionId, studentId, file, submissionText, submissionFileUrl
        );
        return ResponseEntity.ok(response);
    }

    /**
     * Học viên nộp bài tập (hỗ trợ tương thích ngược dạng JSON nếu có client cũ gọi).
     */
    @PostMapping("/sessions/{sessionId}/homework-submission")
    public ResponseEntity<SessionAttendanceResponse> submitHomework(
            Authentication authentication,
            @PathVariable Long sessionId,
            @RequestBody SubmitHomeworkRequest request
    ) {
        Long studentId = extractStudentId(authentication);
        SessionAttendanceResponse response = sessionAttendanceService.submitHomework(sessionId, studentId, request);
        return ResponseEntity.ok(response);
    }

    /**
     * Học viên gỡ bài đã nộp khi bài vẫn còn trong cửa sổ cho phép nộp/cập nhật.
     * Nếu bài đã được chấm hoặc đã đóng hạn nộp thì backend sẽ từ chối.
     */
    @DeleteMapping("/sessions/{sessionId}/homework-submission")
    public ResponseEntity<SessionAttendanceResponse> deleteHomeworkSubmission(
            Authentication authentication,
            @PathVariable Long sessionId
    ) {
        Long studentId = extractStudentId(authentication);
        SessionAttendanceResponse response = sessionAttendanceService.deleteHomeworkSubmission(sessionId, studentId);
        return ResponseEntity.ok(response);
    }

    /**
     * Tải bài làm nộp của học viên (Gia sư chấm bài hoặc chính học viên sở hữu bài nộp).
     */
    @GetMapping("/sessions/{sessionId}/attendances/{attendanceId}/submission-download-url")
    public ResponseEntity<PresignedDownloadUrlResponse> getSubmissionDownloadUrl(
            @PathVariable Long sessionId,
            @PathVariable Long attendanceId
    ) {
        PresignedDownloadUrlResponse response = sessionAttendanceService.getSubmissionDownloadUrl(sessionId, attendanceId);
        return ResponseEntity.ok(response);
    }

    /**
     * Gia sư chấm điểm và nhận xét bài tập của học viên.
     */
    @PutMapping("/sessions/{sessionId}/attendances/{attendanceId}/grade")
    public ResponseEntity<SessionAttendanceResponse> gradeHomework(
            Authentication authentication,
            @PathVariable Long sessionId,
            @PathVariable Long attendanceId,
            @RequestBody GradeHomeworkRequest request
    ) {
        SessionAttendanceResponse response = sessionAttendanceService.gradeHomework(
                sessionId,
                attendanceId,
                authentication != null ? authentication.getName() : null,
                request
        );
        return ResponseEntity.ok(response);
    }

    /**
     * Gia sư tải file lộ trình môn học (Syllabus PDF/Word) lên S3.
     */
    @PostMapping(value = "/classes/{classId}/syllabus-file", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Void> uploadSyllabusFile(
            @PathVariable Long classId,
            @RequestParam("file") MultipartFile file
    ) {
        sessionAttendanceService.uploadSyllabusFile(classId, file);
        return ResponseEntity.ok().build();
    }

    /**
     * Tải file lộ trình môn học (Syllabus) từ S3.
     */
    @GetMapping("/classes/{classId}/syllabus/download-url")
    public ResponseEntity<PresignedDownloadUrlResponse> getSyllabusDownloadUrl(@PathVariable Long classId) {
        PresignedDownloadUrlResponse response = sessionAttendanceService.getSyllabusDownloadUrl(classId);
        return ResponseEntity.ok(response);
    }

    /**
     * Gia sư lấy danh sách tổng quan tất cả bài tập & tài liệu các lớp phụ trách.
     */
    @GetMapping({"/tutor/homework-overview", "/learning/tutor/homework-overview"})
    public ResponseEntity<List<TutorHomeworkItemResponse>> getTutorHomeworkOverview(Authentication authentication) {
        List<TutorHomeworkItemResponse> overview = sessionAttendanceService.getTutorHomeworkOverview(
                authentication != null ? authentication.getName() : null
        );
        return ResponseEntity.ok(overview);
    }

    /**
     * Học viên lấy danh sách tổng quan tất cả bài tập các lớp tham gia.
     */
    @GetMapping({"/student/homework-overview", "/learning/student/homework-overview"})
    public ResponseEntity<List<StudentHomeworkItemResponse>> getStudentHomeworkOverview(Authentication authentication) {
        Long studentId = extractStudentId(authentication);
        List<StudentHomeworkItemResponse> overview = sessionAttendanceService.getStudentHomeworkOverview(studentId);
        return ResponseEntity.ok(overview);
    }

    private Long extractStudentId(Authentication authentication) {
        Long studentId = authentication != null && authentication.getDetails() instanceof Number value ? value.longValue() : null;
        if (studentId == null && authentication != null && authentication.getPrincipal() instanceof iuh.fit.learning_service.config.security.LearningUserPrincipal principal) {
            studentId = principal.userId();
        }
        return studentId;
    }
}
