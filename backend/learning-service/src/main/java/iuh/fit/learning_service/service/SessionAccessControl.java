package iuh.fit.learning_service.service;

import iuh.fit.learning_service.config.security.LearningUserPrincipal;
import iuh.fit.learning_service.entity.ClassRoom;
import iuh.fit.learning_service.enums.EnrollmentRequestStatus;
import iuh.fit.learning_service.exception.ForbiddenException;
import iuh.fit.learning_service.repository.EnrollmentRequestRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import java.util.List;
import java.util.Objects;

@Component
@RequiredArgsConstructor
public class SessionAccessControl {
    private final EnrollmentRequestRepository enrollments;

    private LearningUserPrincipal user() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || !(auth.getPrincipal() instanceof LearningUserPrincipal user)) {
            throw new ForbiddenException("Authentication required");
        }
        return user;
    }

    private boolean hasRole(String role) {
        var user = user();
        return role.equalsIgnoreCase(user.activeRole()) && SecurityContextHolder.getContext().getAuthentication()
                .getAuthorities().stream().anyMatch(authority -> authority.getAuthority().equals("ROLE_" + role));
    }

    public Long currentStudentId() { return hasRole("STUDENT") ? user().userId() : null; }

    public void requireTutor(ClassRoom room) {
        if (!hasRole("TUTOR") || !user().email().equalsIgnoreCase(room.getTutorEmail())) {
            throw new ForbiddenException("Only this classroom's tutor can manage sessions");
        }
    }

    public void requireStudent(ClassRoom room, Long studentId) {
        if (!hasRole("STUDENT") || !Objects.equals(user().userId(), studentId)
                || !isEnrolled(room, studentId)) {
            throw new ForbiddenException("Confirmed enrollment is required");
        }
    }

    public void requireCanView(ClassRoom room) {
        if (hasRole("ADMIN")
                || (hasRole("STAFF") && user().email().equalsIgnoreCase(room.getReviewedByEmail()))
                || (hasRole("TUTOR") && user().email().equalsIgnoreCase(room.getTutorEmail()))
                || (hasRole("STUDENT") && isEnrolled(room, user().userId()))) return;
        throw new ForbiddenException("This classroom belongs to other users");
    }

    private boolean isEnrolled(ClassRoom room, Long studentId) {
        return enrollments.findFirstByClassRoomIdAndStudentIdAndStatusInOrderByCreatedAtDesc(
                room.getId(), studentId, List.of(EnrollmentRequestStatus.ENROLLED)).isPresent();
    }
}
