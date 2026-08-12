package iuh.fit.learningservice.modules.classroom.controller;

import iuh.fit.learningservice.modules.classroom.dto.ApprovedSubjectResponse;
import iuh.fit.learningservice.modules.classroom.dto.ClassRoomResponse;
import iuh.fit.learningservice.modules.classroom.dto.CreateClassRoomRequest;
import iuh.fit.learningservice.modules.classroom.service.ClassRoomService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/classrooms")
public class ClassRoomController {

    public static final String USER_ID_HEADER = "X-User-Id";

    private final ClassRoomService classRoomService;

    public ClassRoomController(ClassRoomService classRoomService) {
        this.classRoomService = classRoomService;
    }

    @GetMapping("/approved-subjects")
    public List<ApprovedSubjectResponse> getApprovedTeachingSubjects(
        @RequestHeader(USER_ID_HEADER) UUID tutorId
    ) {
        return classRoomService.getApprovedTeachingSubjects(tutorId);
    }

    @PostMapping
    public ClassRoomResponse createClassRoom(
        @RequestHeader(USER_ID_HEADER) UUID tutorId,
        @Valid @RequestBody CreateClassRoomRequest request
    ) {
        return classRoomService.createClassRoom(tutorId, request);
    }

    @GetMapping("/me")
    public List<ClassRoomResponse> getMyClassRooms(
        @RequestHeader(USER_ID_HEADER) UUID tutorId
    ) {
        return classRoomService.getMyClassRooms(tutorId);
    }

    @GetMapping("/admin")
    public List<ClassRoomResponse> getAllClassRoomsForAdmin() {
        return classRoomService.getAllClassRoomsForAdmin();
    }

    @GetMapping("/{id}")
    public ClassRoomResponse getClassRoomById(@PathVariable UUID id) {
        return classRoomService.getClassRoomById(id);
    }

    @PutMapping("/{id}/approve")
    public ClassRoomResponse approveClassRoom(@PathVariable UUID id) {
        return classRoomService.approveClassRoom(id);
    }

    @PutMapping("/{id}/reject")
    public ClassRoomResponse rejectClassRoom(@PathVariable UUID id) {
        return classRoomService.rejectClassRoom(id);
    }

    @PutMapping("/{id}/cancel")
    public ClassRoomResponse cancelClassRoom(
        @RequestHeader(USER_ID_HEADER) UUID tutorId,
        @PathVariable UUID id
    ) {
        return classRoomService.cancelClassRoom(tutorId, id);
    }
}
