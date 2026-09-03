package iuh.fit.learning_service.controller;

import iuh.fit.learning_service.dto.ClassSessionDtos;
import iuh.fit.learning_service.dto.ClassSessionDtos.*;
import iuh.fit.learning_service.service.SessionAttendanceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
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
     * Gia sư cập nhật chủ đề, bài tập hoặc file tài liệu đính kèm cho buổi học.
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
        Long studentId = authentication != null && authentication.getDetails() instanceof Number value ? value.longValue() : null;
        SessionAttendanceResponse response = sessionAttendanceService.studentCheckIn(sessionId, studentId);
        return ResponseEntity.ok(response);
    }

    /**
     * Gia sư bấm Điểm danh vào dạy bất kỳ lúc nào trong khung giờ học [start_time, end_time].
     * (Hệ thống sẽ tự động chốt và hoàn tất buổi học khi kết thúc giờ học thực tế).
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
}
