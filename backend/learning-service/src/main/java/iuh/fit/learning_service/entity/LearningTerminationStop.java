package iuh.fit.learning_service.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity @Table(name = "learning_termination_stop")
@Getter @Setter
public class LearningTerminationStop {
    @Id @Column(length = 36) private String agreementId;
    private Long classroomId;
    private Long studentId;
    private Integer cutoffSession;
    private boolean closed;

    @Column(name = "origin", length = 40)
    private String origin;

    @Column(name = "effective_requested_at")
    private OffsetDateTime effectiveRequestedAt;

    @Column(name = "command_id")
    private UUID commandId;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;
}
