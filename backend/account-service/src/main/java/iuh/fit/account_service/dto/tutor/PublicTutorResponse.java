package iuh.fit.account_service.dto.tutor;

import java.time.LocalDateTime;
import java.util.List;

public class PublicTutorResponse {

    private final Long id;
    private final Long userId;
    private final String fullName;
    private final String bio;
    private final List<PublicTutorSubjectResponse> subjects;
    private final LocalDateTime createdAt;

    public PublicTutorResponse(
            Long id,
            Long userId,
            String fullName,
            String bio,
            List<PublicTutorSubjectResponse> subjects,
            LocalDateTime createdAt
    ) {
        this.id = id;
        this.userId = userId;
        this.fullName = fullName;
        this.bio = bio;
        this.subjects = subjects;
        this.createdAt = createdAt;
    }

    public Long getId() {
        return id;
    }

    public Long getUserId() {
        return userId;
    }

    public String getFullName() {
        return fullName;
    }

    public String getBio() {
        return bio;
    }

    public List<PublicTutorSubjectResponse> getSubjects() {
        return subjects;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}
