package iuh.fit.contract_service.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "class_tutor_attendance_signal")
@Getter @Setter
public class ClassTutorAttendanceSignal {
    @Id
    private UUID id;

    @Column(nullable = false)
    private Long classroomId;

    @Column(nullable = false)
    private Long learningSessionId;

    @Column(nullable = false)
    private Integer sessionSequence;

    @Column(nullable = false, length = 20)
    private String tutorAttendanceOutcome;

    @Column(nullable = false)
    private OffsetDateTime finalizedAt;

    private Integer nextSessionSequence;

    private OffsetDateTime nextSessionStartAt;

    @Column(nullable = false, unique = true, length = 100)
    private String sourceEventId;

    @Column(nullable = false, updatable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();
}
