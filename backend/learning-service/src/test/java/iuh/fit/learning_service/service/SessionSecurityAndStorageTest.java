package iuh.fit.learning_service.service;

import iuh.fit.learning_service.dto.ClassSessionDtos;
import iuh.fit.learning_service.dto.ClassroomMaterialDtos.PresignedDownloadUrlResponse;
import iuh.fit.learning_service.entity.ClassRoom;
import iuh.fit.learning_service.entity.ClassSession;
import iuh.fit.learning_service.entity.ClassroomMaterial;
import iuh.fit.learning_service.entity.SessionAttendance;
import iuh.fit.learning_service.entity.SessionFile;
import iuh.fit.learning_service.exception.BadRequestException;
import iuh.fit.learning_service.exception.ForbiddenException;
import iuh.fit.learning_service.repository.ClassRoomRepository;
import iuh.fit.learning_service.repository.ClassSessionRepository;
import iuh.fit.learning_service.repository.ClassroomMaterialRepository;
import iuh.fit.learning_service.repository.SessionAttendanceRepository;
import iuh.fit.learning_service.repository.SessionFileRepository;
import iuh.fit.learning_service.service.storage.FileStorageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SessionSecurityAndStorageTest {

    @Mock
    private ClassSessionRepository classSessionRepository;

    @Mock
    private SessionAttendanceRepository sessionAttendanceRepository;

    @Mock
    private ClassRoomRepository classRoomRepository;

    @Mock
    private ClassroomMaterialRepository classroomMaterialRepository;

    @Mock
    private SessionFileRepository sessionFileRepository;

    @Mock
    private FileStorageService fileStorageService;

    @Mock
    private SessionAccessControl sessionAccessControl;

    @Mock
    private LearningStorageCleanupService learningStorageCleanupService;

    @InjectMocks
    private SessionAttendanceService sessionAttendanceService;

    @InjectMocks
    private ClassroomMaterialService classroomMaterialService;

    private ClassRoom classRoom;
    private ClassSession session;
    private SessionAttendance attendance;
    private SessionFile sessionFile;
    private ClassroomMaterial material;

    @BeforeEach
    void setUp() {
        classRoom = new ClassRoom();
        classRoom.setId(100L);
        classRoom.setName("Vật lý lớp 9");
        classRoom.setTutorEmail("tutor@edu.vn");

        session = new ClassSession();
        session.setId(5L);
        session.setClassRoom(classRoom);
        session.setTopic("Buổi 5 - Khúc xạ ánh sáng");
        session.setSubmissionRequired(true);
        session.setLateSubmissionAllowed(true);

        attendance = new SessionAttendance();
        attendance.setId(501L);
        attendance.setSession(session);
        attendance.setStudentId(200L);
        attendance.setStudentChecked(false);

        sessionFile = new SessionFile();
        sessionFile.setId(10L);
        sessionFile.setSession(session);
        sessionFile.setFileCategory("ASSIGNMENT");
        sessionFile.setFileName("baitap_buoi5.pdf");
        sessionFile.setFileKey("classes/100/sessions/5/assignments/uuid_baitap_buoi5.pdf");

        material = new ClassroomMaterial();
        material.setId(20L);
        material.setClassRoom(classRoom);
        material.setTitle("Sách giáo khoa Vật Lý 9");
        material.setFileName("sgk_vatly9.pdf");
        material.setFileKey("classes/100/materials/uuid_sgk_vatly9.pdf");
    }

    @Test
    @DisplayName("Học viên chưa điểm danh buổi học -> BỊ CHẶN (403) không tải được file bài tập/slide")
    void studentWithoutCheckInCannotDownloadSessionFile() {
        when(classSessionRepository.findById(5L)).thenReturn(Optional.of(session));
        when(sessionFileRepository.findById(10L)).thenReturn(Optional.of(sessionFile));
        when(sessionAccessControl.currentStudentId()).thenReturn(200L);
        when(sessionAttendanceRepository.findBySessionIdAndStudentId(5L, 200L)).thenReturn(Optional.of(attendance));

        assertThatThrownBy(() -> sessionAttendanceService.getSessionFileDownloadUrl(5L, 10L))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("Bạn chưa điểm danh buổi học này");

        verify(fileStorageService, never()).createPresignedGetUrl(any());
    }

    @Test
    @DisplayName("Học viên đã điểm danh buổi học -> MỞ KHÓA tải được file bài tập/slide")
    void studentWithCheckInCanDownloadSessionFile() {
        attendance.setStudentChecked(true);
        when(classSessionRepository.findById(5L)).thenReturn(Optional.of(session));
        when(sessionFileRepository.findById(10L)).thenReturn(Optional.of(sessionFile));
        when(sessionAccessControl.currentStudentId()).thenReturn(200L);
        when(sessionAttendanceRepository.findBySessionIdAndStudentId(5L, 200L)).thenReturn(Optional.of(attendance));
        when(fileStorageService.createPresignedGetUrl(sessionFile.getFileKey())).thenReturn("https://s3.amazonaws.com/presigned-url");

        PresignedDownloadUrlResponse res = sessionAttendanceService.getSessionFileDownloadUrl(5L, 10L);

        assertThat(res).isNotNull();
        assertThat(res.downloadUrl()).isEqualTo("https://s3.amazonaws.com/presigned-url");
        assertThat(res.fileName()).isEqualTo("baitap_buoi5.pdf");
    }

    @Test
    @DisplayName("Học viên trong lớp tải tài liệu cấp lớp (Classroom Material) NGAY LẬP TỨC MÀ KHÔNG CẦN ĐIỂM DANH")
    void studentCanDownloadClassroomMaterialWithoutCheckIn() {
        when(classRoomRepository.findById(100L)).thenReturn(Optional.of(classRoom));
        when(classroomMaterialRepository.findById(20L)).thenReturn(Optional.of(material));
        when(fileStorageService.createPresignedGetUrl(material.getFileKey())).thenReturn("https://s3.amazonaws.com/material-presigned-url");

        PresignedDownloadUrlResponse res = classroomMaterialService.getMaterialDownloadUrl(100L, 20L);

        assertThat(res).isNotNull();
        assertThat(res.downloadUrl()).isEqualTo("https://s3.amazonaws.com/material-presigned-url");
        verify(sessionAccessControl).requireCanView(classRoom);
    }

    @Test
    @DisplayName("Người ngoài không thuộc lớp -> BỊ CHẶN (403) không tải được tài liệu lớp")
    void strangerCannotDownloadClassroomMaterial() {
        when(classRoomRepository.findById(100L)).thenReturn(Optional.of(classRoom));
        doThrow(new ForbiddenException("This classroom belongs to other users"))
                .when(sessionAccessControl).requireCanView(classRoom);

        assertThatThrownBy(() -> classroomMaterialService.getMaterialDownloadUrl(100L, 20L))
                .isInstanceOf(ForbiddenException.class);

        verify(fileStorageService, never()).createPresignedGetUrl(any());
    }

    @Test
    @DisplayName("Gia sư upload file bài tập vượt quá giới hạn 5 file -> Báo lỗi 400 Bad Request")
    void tutorCannotUploadMoreThan5AssignmentFiles() {
        when(classSessionRepository.findById(5L)).thenReturn(Optional.of(session));
        // Hiện tại đã có 4 file
        when(sessionFileRepository.countBySession_IdAndFileCategory(5L, "ASSIGNMENT")).thenReturn(4L);

        MockMultipartFile file1 = new MockMultipartFile("files", "file1.pdf", "application/pdf", "dummy1".getBytes());
        MockMultipartFile file2 = new MockMultipartFile("files", "file2.pdf", "application/pdf", "dummy2".getBytes());

        // Muốn upload thêm 2 file nữa -> tổng là 6 file (> 5)
        assertThatThrownBy(() -> sessionAttendanceService.uploadAssignmentFiles(5L, List.of(file1, file2)))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("tối đa 5 file bài tập");

        verify(fileStorageService, never()).store(any(), any(), any());
    }

    @Test
    @DisplayName("Học viên nộp bài tập BẮT BUỘC ĐÍNH KÈM FILE (nếu rỗng báo 400 Bad Request)")
    void studentSubmitHomeworkRequiresFile() {
        attendance.setStudentChecked(true);
        when(classSessionRepository.findById(5L)).thenReturn(Optional.of(session));
        when(sessionAttendanceRepository.findBySessionIdAndStudentId(5L, 200L)).thenReturn(Optional.of(attendance));

        MockMultipartFile emptyFile = new MockMultipartFile("file", "", "text/plain", new byte[0]);

        assertThatThrownBy(() -> sessionAttendanceService.submitHomeworkWithFile(5L, 200L, emptyFile, "ghi chú"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("bắt buộc phải tải lên file bài làm");

        verify(fileStorageService, never()).store(any(), any(), any());
    }

    @Test
    @DisplayName("Học viên chưa điểm danh mà bấm nộp bài tập -> BỊ CHẶN (403)")
    void studentCannotSubmitHomeworkWithoutCheckIn() {
        attendance.setStudentChecked(false); // Chưa điểm danh
        when(classSessionRepository.findById(5L)).thenReturn(Optional.of(session));
        when(sessionAttendanceRepository.findBySessionIdAndStudentId(5L, 200L)).thenReturn(Optional.of(attendance));

        MockMultipartFile file = new MockMultipartFile("file", "bailam.pdf", "application/pdf", "abc".getBytes());

        assertThatThrownBy(() -> sessionAttendanceService.submitHomeworkWithFile(5L, 200L, file, "ghi chú"))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("phải điểm danh buổi học trước khi nộp bài tập");

        verify(fileStorageService, never()).store(any(), any(), any());
    }

    @Test
    @DisplayName("Student can replace an S3 homework file with an external GitHub or Drive link")
    void studentCanReplaceS3HomeworkFileWithExternalLink() {
        attendance.setStudentChecked(true);
        attendance.setSubmissionFileKey("classes/100/sessions/5/submissions/200/old-work.pdf");
        attendance.setSubmissionFileName("old-work.pdf");
        when(classSessionRepository.findById(5L)).thenReturn(Optional.of(session));
        when(sessionAttendanceRepository.findBySessionIdAndStudentId(5L, 200L)).thenReturn(Optional.of(attendance));
        when(sessionAttendanceRepository.save(attendance)).thenReturn(attendance);

        var response = sessionAttendanceService.submitHomework(
                5L, 200L, new ClassSessionDtos.SubmitHomeworkRequest("source code", "https://github.com/example/homework")
        );

        assertThat(response.submissionFileUrl()).isEqualTo("https://github.com/example/homework");
        assertThat(response.submissionFileName()).isNull();
        verify(learningStorageCleanupService).deleteObjectAfterCommit(
                "classes/100/sessions/5/submissions/200/old-work.pdf");
    }

    @Test
    @DisplayName("Student can remove an editable S3 homework submission and cleanup the old S3 object")
    void studentCanRemoveEditableHomeworkSubmissionAndCleanupS3() {
        attendance.setStudentChecked(true);
        attendance.setSubmissionText("old answer");
        attendance.setSubmissionFileUrl("https://drive.google.com/file");
        attendance.setSubmissionFileKey("classes/100/sessions/5/submissions/200/old-work.pdf");
        attendance.setSubmissionFileName("old-work.pdf");
        attendance.setSubmissionFileSize(1234L);
        attendance.setSubmittedAt(LocalDateTime.now().minusMinutes(5));
        when(classSessionRepository.findById(5L)).thenReturn(Optional.of(session));
        when(sessionAttendanceRepository.findBySessionIdAndStudentId(5L, 200L)).thenReturn(Optional.of(attendance));
        when(sessionAttendanceRepository.save(attendance)).thenReturn(attendance);

        var response = sessionAttendanceService.deleteHomeworkSubmission(5L, 200L);

        assertThat(response.submissionText()).isNull();
        assertThat(response.submissionFileUrl()).isNull();
        assertThat(response.submissionFileName()).isNull();
        assertThat(response.submittedAt()).isNull();
        verify(learningStorageCleanupService).deleteObjectAfterCommit(
                "classes/100/sessions/5/submissions/200/old-work.pdf");
    }

    @Test
    @DisplayName("Student cannot remove homework submission after due time when late submissions are disabled")
    void studentCannotRemoveSubmissionAfterClosedDeadline() {
        session.setLateSubmissionAllowed(false);
        session.setAssignmentDueAt(LocalDateTime.now().minusMinutes(1));
        attendance.setStudentChecked(true);
        attendance.setSubmissionFileKey("classes/100/sessions/5/submissions/200/old-work.pdf");
        attendance.setSubmissionFileName("old-work.pdf");
        attendance.setSubmittedAt(LocalDateTime.now().minusHours(1));
        when(classSessionRepository.findById(5L)).thenReturn(Optional.of(session));
        when(sessionAttendanceRepository.findBySessionIdAndStudentId(5L, 200L)).thenReturn(Optional.of(attendance));

        assertThatThrownBy(() -> sessionAttendanceService.deleteHomeworkSubmission(5L, 200L))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("khong cho phep nop tre");

        verify(sessionAttendanceRepository, never()).save(any(SessionAttendance.class));
        verify(learningStorageCleanupService, never()).deleteObjectAfterCommit(any());
    }
}
