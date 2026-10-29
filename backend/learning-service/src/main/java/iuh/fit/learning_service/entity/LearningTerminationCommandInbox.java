package iuh.fit.learning_service.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "learning_termination_command_inbox", uniqueConstraints = {
        @UniqueConstraint(name = "uq_learning_command_inbox", columnNames = {"command_id", "action"})
})
@Getter @Setter
public class LearningTerminationCommandInbox {
    @Id
    private UUID id;

    @Column(name = "command_id", nullable = false)
    private UUID commandId;

    @Column(nullable = false, length = 30)
    private String action;

    @Column(nullable = false)
    private Long classroomId;

    @Column(nullable = false, length = 36)
    private String agreementId;

    @Column(nullable = false)
    private Integer cutoffSession;

    @Column(nullable = false, length = 64)
    private String payloadHash;

    @Column(nullable = false, length = 30)
    private String status;

    @Column(name = "required_session_sequences_csv", nullable = false, columnDefinition = "TEXT")
    private String requiredSessionSequencesCsv;

    private OffsetDateTime nextSessionStartAt;

    @Column(name = "class_cancelled", nullable = false)
    private boolean classCancelled = false;

    @Column(nullable = false, updatable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(nullable = false)
    private OffsetDateTime updatedAt = OffsetDateTime.now();
}
